import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModuleProps } from '../types';
import { useData } from '../../lib/data';
import type { UmlandZiel } from '../../lib/types';
import { ErrorNote, LayerRow, Section, ShowMore, SkeletonRows, Source } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { tr } from '../../lib/i18n';
import '../../styles/umland.css';

const dauer = (min: number) => (min >= 120 ? `${Math.round((min / 60) * 2) / 2} Std.` : `${min} Min.`);

function ZielCard({ z, onOpen }: { z: UmlandZiel; onOpen: () => void }) {
  return (
    <li className="umland-card">
      <button type="button" className="umland-card-link" onClick={onOpen}>
        <span className="umland-thumb" style={{ background: z.farbe }}>
          {z.image ? <img src={z.image} alt="" loading="lazy" /> : <Icon name={z.icon} size={24} />}
          <span className="umland-cat-dot" style={{ background: z.farbe }} aria-hidden />
        </span>
        <span className="umland-body">
          <span className="umland-kicker">{z.kreisLabel} · {z.kategorieKurz}</span>
          <span className="umland-name">{z.name}</span>
          <span className="umland-kurz">{z.kurz}</span>
          <span className="umland-meta">
            <span><Icon name="clock" size={13} /> {dauer(z.dauerMin)}</span>
            {z.naechsteHaltestelle && (
              <span><Icon name="train" size={13} /> Halt: {z.naechsteHaltestelle.name} · {z.naechsteHaltestelle.walkMin} Min.</span>
            )}
            {z.familie && <span className="umland-tag">Familie</span>}
          </span>
        </span>
        <Icon name="chevron" size={16} className="umland-chev" />
      </button>
    </li>
  );
}

export function UmlandPanel({ visible, toggle, select, flyTo, fitBounds, setLayer }: ModuleProps) {
  const { umland } = useData();
  const [kat, setKat] = useState('alle');
  const [kreis, setKreis] = useState('alle');
  const [q, setQ] = useState('');
  const [familie, setFamilie] = useState(false);
  const fitted = useRef(false);

  const d = umland.data;
  const items = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (d?.items ?? []).filter((z) =>
      (kat === 'alle' || z.kategorie === kat)
      && (kreis === 'alle' || z.kreis === kreis)
      && (!familie || z.familie)
      && (!text || `${z.name} ${z.kurz} ${z.beschreibung} ${z.gemeinde} ${z.kreisLabel}`.toLowerCase().includes(text)));
  }, [d, kat, kreis, q, familie]);

  const bounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!items.length) return null;
    const lons = items.map((z) => z.lon);
    const lats = items.map((z) => z.lat);
    return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
  }, [items]);

  // Beim ersten Öffnen den Blick auf die Region legen; sonst liegt der Ausschnitt
  // mitten in Stuttgart, wo kein Ausflugsziel markiert ist.
  useEffect(() => {
    if (!d || !bounds || fitted.current) return;
    // Bei einem geteilten Link auf ein einzelnes Ziel nicht auf die ganze Region zoomen.
    if (new URLSearchParams(location.search).get('o') === 'umland') { fitted.current = true; setLayer('umland', true); return; }
    fitted.current = true;
    setLayer('umland', true);
    fitBounds(bounds, { maxZoom: 10 });
  }, [d, bounds, fitBounds, setLayer]);

  const open = (z: UmlandZiel) => {
    select({ type: 'umland', id: z.id, lngLat: [z.lon, z.lat] });
    flyTo([z.lon, z.lat], 13.5);
  };

  return (
    <div className="umland">
      <p className="umland-intro">
        {tr('Schlösser, Burgen, Seen, Altstädte und Natur in der Region Stuttgart – erreichbar mit VVS, Rad oder Auto. Die Auswahl ist redaktionell und keine Rangliste.')}
      </p>

      <LayerRow
        icon="tree"
        tone="amber"
        title="Ausflugsziele im Umland"
        meta={d ? `${d.items.length} Ziele · ${d.kreise.length} Landkreise` : 'wird geladen'}
        on={visible.umland}
        onToggle={() => toggle('umland')}
        loading={!d && !!umland.loading}
      />

      {umland.error && !d && <ErrorNote text={`Ausflugsziele nicht verfügbar: ${umland.error}`} onRetry={umland.reload} />}
      {!d && !umland.error && <SkeletonRows rows={5} />}

      {d && (
        <>
          <Section
            title="Ziele filtern"
            aside={`${items.length} von ${d.items.length}`}
            collapsible={false}
          >
            <div className="umland-filters">
              <div className="umland-chips" role="group" aria-label="Kategorie">
                <button type="button" className={`umland-chip ${kat === 'alle' ? 'on' : ''}`} aria-pressed={kat === 'alle'} onClick={() => setKat('alle')}>
                  Alle <span>{d.items.length}</span>
                </button>
                {d.kategorien.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    className={`umland-chip ${kat === k.id ? 'on' : ''}`}
                    aria-pressed={kat === k.id}
                    onClick={() => setKat(k.id)}
                    style={kat === k.id ? { borderColor: k.farbe, color: k.farbe } : undefined}
                  >
                    <span className="umland-chip-dot" style={{ background: k.farbe }} />
                    {tr(k.label)} <span>{k.anzahl}</span>
                  </button>
                ))}
              </div>
              <div className="umland-selects">
                <label>
                  <span className="muted small">Landkreis</span>
                  <select value={kreis} onChange={(e) => setKreis(e.target.value)}>
                    <option value="alle">Alle Landkreise</option>
                    {d.kreise.map((k) => <option key={k.id} value={k.id}>{k.label} ({k.anzahl})</option>)}
                  </select>
                </label>
                <label className="umland-check">
                  <input type="checkbox" checked={familie} onChange={(e) => setFamilie(e.target.checked)} />
                  <span>Nur mit Kindern</span>
                </label>
              </div>
              <label className="umland-search">
                <Icon name="search" size={16} />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={tr('Ziel, Ort oder Stichwort')}
                  aria-label={tr('Ausflugsziele durchsuchen')}
                />
              </label>
              <div className="umland-actions">
                <button
                  type="button"
                  className="link-btn secondary"
                  disabled={!bounds}
                  onClick={() => {
                    setLayer('umland', true);
                    if (bounds) fitBounds(bounds, { maxZoom: 11 });
                  }}
                >
                  <Icon name="layers" size={16} /> {tr('Gefilterte Ziele auf der Karte')}
                </button>
                <button type="button" className="link-btn secondary" onClick={() => { setKat('alle'); setKreis('alle'); setQ(''); setFamilie(false); }}>
                  <Icon name="refresh" size={16} /> {tr('Filter zurücksetzen')}
                </button>
              </div>
            </div>
          </Section>

          <Section title="Ausflugsziele" aside={`${items.length} Treffer`} explain="umland">
            {items.length === 0 ? (
              <p className="muted small">Kein Ziel passt zu dieser Auswahl. Bitte einen Filter zurücksetzen.</p>
            ) : (
              <ul className="umland-list">
                <ShowMore first={10} asList>
                  {items.map((z) => <ZielCard key={z.id} z={z} onOpen={() => open(z)} />)}
                </ShowMore>
              </ul>
            )}
            <Source disclosure>
              {d.source}. {d.lizenz}. Stand {d.stand ?? 'unbekannt'}. {d.hinweis}
            </Source>
          </Section>
        </>
      )}
    </div>
  );
}
