import { useMemo } from 'react';
import { useData } from '../../lib/data';
import { fmtNum, occupancy, ago } from '../../lib/format';
import { LayerRow, Section, Source, ErrorNote, LiveDot } from '../../components/ui';
import { useStops } from '../../lib/stops';
import type { ModuleProps } from '../types';
import { Anschluss } from '../../components/Anschluss';
import { BahnHbf } from '../../components/BahnHbf';
import { PuenktlichkeitSection } from '../../components/Puenktlichkeit';

const QUICK = ['Hauptbahnhof', 'Charlottenplatz', 'Stadtmitte', 'Schlossplatz', 'Bad Cannstatt Wilhelmsplatz', 'Vaihingen', 'Marienplatz', 'Feuersee'];

export function MobilityPanel({ visible, toggle, select, flyTo, setLayer }: ModuleProps) {
  const { parking, sharing, roadworks, traffic } = useData();
  const stops = useStops();

  const park = useMemo(() => {
    const sites = parking.data?.sites ?? [];
    const live = sites.filter((s) => s.free != null);
    return {
      free: live.reduce((a, s) => a + (s.free ?? 0), 0),
      cap: live.reduce((a, s) => a + (s.capacity ?? 0), 0),
      live: live.length,
      total: sites.length,
      top: [...live].sort((a, b) => (b.free ?? 0) - (a.free ?? 0)).slice(0, 5),
      full: live.filter((s) => occupancy(s.free, s.capacity) === 'full').length,
    };
  }, [parking.data]);

  const share = useMemo(() => {
    const items = sharing.data?.items ?? [];
    const c = { car: 0, bike: 0, scooter: 0 };
    for (const i of items) c[i.kind] += i.station ? (i.available ?? 0) : 1;
    return c;
  }, [sharing.data]);

  const works = roadworks.data?.items ?? [];
  const active = works.filter((w) => w.status === 'active').length;

  const meld = traffic.data?.items ?? [];
  const akut = meld.filter((t) => t.typ === 'Unfall' || t.typ === 'Stau' || t.typ === 'Sperrung');

  const quick = QUICK.map((n) => stops.find((s) => s.properties.name === n)).filter(Boolean);

  return (
    <div className="module">
      <Section title="Haltestelle wählen" explain="abfahrten" aside="Echtzeit-Abfahrten">
        <div className="chips">
          {quick.map((s) => (
            <button key={s!.properties.id} type="button" className="chip" onClick={() => {
              const c = s!.geometry.coordinates as [number, number];
              select({ type: 'stop', id: s!.properties.id, name: s!.properties.name, lngLat: c, lines: s!.properties.lines });
              flyTo(c, 15);
            }}>
              {s!.properties.name.replace(' Wilhelmsplatz', '')}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Auf der Karte">
        <div className="layer-list">
          <LayerRow icon="train" tone="ink" title="Stadtbahn und S-Bahn" on={visible.network} onToggle={() => toggle('network')}
            meta="Liniennetz nach VVS-Fahrplan" />
          <LayerRow icon="stop" tone="ink" title="Haltestellen" on={visible.stops} onToggle={() => toggle('stops')}
            meta={`${fmtNum(stops.length)} Halte, antippen für Abfahrten`} />
          <LayerRow icon="parking" tone="green" title="Parkhäuser" on={visible.parking} onToggle={() => toggle('parking')}
            loading={parking.loading && !parking.data}
            meta={parking.error && !parking.data ? 'nicht erreichbar' : <><LiveDot stale={!!parking.error} /> {fmtNum(park.free)} Plätze frei in {park.live} Häusern</>} />
          <LayerRow icon="share" tone="blue" title="Sharing" on={visible.sharing} onToggle={() => toggle('sharing')}
            loading={sharing.loading && !sharing.data}
            meta={sharing.error && !sharing.data ? 'nicht erreichbar' : <><LiveDot stale={!!sharing.error} /> {fmtNum(share.car)} Autos · {fmtNum(share.bike)} Räder · {fmtNum(share.scooter)} Scooter</>} />
          <LayerRow icon="cone" tone="amber" title="Baustellen" on={visible.roadworks} onToggle={() => toggle('roadworks')}
            loading={roadworks.loading && !roadworks.data}
            meta={roadworks.error && !roadworks.data ? 'nicht erreichbar' : `${active} im Bau · ${works.length - active} geplant`} />
          <LayerRow icon="warn" tone="amber" title="Verkehrsmeldungen" on={visible.traffic} onToggle={() => toggle('traffic')}
            loading={traffic.loading && !traffic.data}
            meta={traffic.error && !traffic.data ? 'nicht erreichbar' : <><LiveDot stale={!!traffic.error} /> {meld.filter((t) => t.typ === 'Unfall').length} Unfälle · {meld.filter((t) => t.typ === 'Stau').length} Staus · {meld.filter((t) => t.typ === 'Sperrung').length} Sperrungen</>} />
          <LayerRow icon="route" tone="green" title="Hauptradrouten" on={visible.bike} onToggle={() => toggle('bike')}
            meta="Radnetz der Stadt Stuttgart" />
        </div>
      </Section>

      <Section title="Verkehrsmeldungen" explain="verkehr" aside={traffic.updatedAt ? ago(traffic.updatedAt) : undefined}>
        {traffic.error && !traffic.data && <ErrorNote text="Verkehrsmeldungen gerade nicht erreichbar." onRetry={traffic.reload} />}
        {traffic.data && !akut.length && <p className="muted small">Derzeit keine Unfälle, Staus oder Sperrungen gemeldet. {meld.length ? `${meld.length} Meldungen zu Baustellen und Sonstigem.` : ''}</p>}
        <ul className="traffic-list">
          {akut.slice(0, 6).map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => { setLayer('traffic', true); flyTo([t.lon, t.lat], 14.5); }}>
                <span className={`traffic-typ typ-${t.typ}`}>{t.typ}</span>
                <span className="traffic-text">{t.text}</span>
                <span className="traffic-src">{t.quelle}{t.seit ? `, seit ${new Date(t.seit).toLocaleString('de-DE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
        {akut.length > 6 && <p className="muted small">Weitere {akut.length - 6} Meldungen auf der Karte.</p>}
        <p className="muted small">Gemeldete Ereignisse. Eine Verkehrslage mit Geschwindigkeiten für Stadtstraßen ist offen nicht verfügbar.</p>
      </Section>

      <PuenktlichkeitSection />
      <Anschluss />
      <BahnHbf />

      <Section title="Parkhäuser, aktuelle Belegung" explain="parken" aside={parking.updatedAt ? ago(parking.updatedAt) : undefined}>
        {parking.error && !parking.data && <ErrorNote text="Parkdaten gerade nicht erreichbar." onRetry={parking.reload} />}
        {park.cap > 0 && (
          <div className="occ-summary">
            <div className="occ-big">
              <span className="num">{Math.round((1 - park.free / park.cap) * 100)}<small>%</small></span>
              <span className="lbl">durchschnittlich belegt</span>
            </div>
            <div className="occ-bar" aria-hidden>
              <span style={{ width: `${(1 - park.free / park.cap) * 100}%` }} />
            </div>
            <p className="muted small">{park.full ? `${park.full} ${park.full === 1 ? 'Parkhaus' : 'Parkhäuser'} voll oder nahezu voll belegt.` : 'Derzeit kein Parkhaus voll belegt.'}</p>
          </div>
        )}
        <ul className="rank-list">
          {park.top.map((s) => {
            const occ = occupancy(s.free, s.capacity);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => { select({ type: 'parking', id: s.id }); flyTo([s.lon, s.lat], 15.5); }}>
                  <span className={`occ-dot occ-${occ}`} aria-hidden />
                  <span className="rank-name">{s.name}</span>
                  <span className="rank-val"><strong>{s.free}</strong> frei</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Source>
        Fahrplan: VVS (CC BY 4.0). Abfahrten: EFA-BW/NVBW (dl-de/by-2-0). Parken: Stadt Stuttgart, PBW über MobiData BW.
        Sharing: Anbieter über MobiData BW. Baustellen und Radrouten: Landeshauptstadt Stuttgart (Open Data).
        Verkehrsmeldungen: Landesmeldestelle Baden-Württemberg und Integrierte Verkehrsleitzentrale Stuttgart über MobiData BW (dl-de/by-2-0); Autobahn GmbH des Bundes.
      </Source>
    </div>
  );
}
