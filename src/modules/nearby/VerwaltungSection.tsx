// Abschnitt "Verwaltung und Leistungen" im Modul "In der Nähe" (Spezifikation Abschnitt 3 bis 6).
import { useEffect, useMemo, useState } from 'react';
import { usePolling } from '../../lib/api';
import { distM, walkMin } from '../../lib/geo';
import { Explain } from '../../lib/info';
import type { Facility, Selection } from '../../lib/types';
import { Icon } from '../../components/Icon';
import { ErrorNote, Section } from '../../components/ui';
import type { WartezeitInfo } from '../../components/VerwaltungDetail';
import { CAT_COLOR } from './cats';

interface GebaeudeFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    address: string;
    stadtbezirk: string | null;
    einheitenCount: number;
    einheiten: { id: string; name: string; art: string; rubrik: string; amt: string | null }[];
    leistungenCount: number;
    rubrik: string;
    rubriken: string[];
    buergerbuero: boolean;
    tafel_id: number | null;
    jetzt: 'offen' | 'termin' | 'geschlossen' | 'unbekannt';
    jetztText: string | null;
    wartezeit: WartezeitInfo | null;
  };
}

interface GebaeudeGeoJson {
  type: 'FeatureCollection';
  features: GebaeudeFeature[];
  rubriken: { id: string; label: string; defaultOn: boolean }[];
  totalGebaeude: number;
  totalEinheiten: number;
  totalLeistungen: number;
  stand: string;
  sourceMode: string;
  source: string;
}

interface SucheResponse {
  q: string;
  leistungen: { id: string; name: string; url: string; leika: string | null; zustaendig: string | null; online: boolean; booking: string | null; kurz: string | null }[];
  einheiten: { id: string; gebaeudeId: string; name: string; amt: string | null; rubrik: string; address: string; stadtbezirk: string | null; lat: number; lon: number; leistungenCount: number }[];
  gebaeude: { id: string; address: string; stadtbezirk: string | null; lat: number; lon: number; einheitenCount: number; buergerbuero: boolean }[];
  total: number;
  stand: string;
}

const DEFAULT_RUBRIKEN = ['buergerbuero', 'amt'];

const RUBRIK_CHIPS: { id: string; label: string }[] = [
  { id: 'buergerbuero', label: 'Bürgerbüros' },
  { id: 'amt', label: 'Ämter und Dienststellen' },
  { id: 'bezirksamt', label: 'Bezirksämter' },
  { id: 'schule_bildung', label: 'Schulen und Bildung' },
  { id: 'beratung_soziales', label: 'Beratung und Soziales' },
  { id: 'sonstige', label: 'Sonstige Adressen' },
];

const SCHNELLWAHL = [
  { label: 'Personalausweis', q: 'Personalausweis' },
  { label: 'Reisepass', q: 'Reisepass' },
  { label: 'Wohnsitz ummelden', q: 'Wohnsitz' },
  { label: 'Bewohnerparkausweis', q: 'Bewohnerparkausweis' },
  { label: 'Kfz-Zulassung', q: 'Kraftfahrzeug' },
  { label: 'Sperrmüll', q: 'Sperrmüll' },
];

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`);

function waitDotClass(w: WartezeitInfo | null | undefined) {
  if (!w || w.status === 0) return 'w-zu';
  if (w.status >= 11) return 'w-voll';
  if (w.status >= 6) return 'w-lang';
  return 'w-kurz';
}

export function VerwaltungSection({
  lngLat,
  select,
  flyTo,
  mapActive,
  onToggleMap,
  setNearby,
}: {
  lngLat: [number, number];
  select: (s: Selection) => void;
  flyTo: (c: [number, number], z?: number) => void;
  mapActive: boolean;
  onToggleMap: () => void;
  setNearby: (n: { items: Facility[]; color: Record<string, string> } | null) => void;
}) {
  const [lon, lat] = lngLat;
  const [sucheQ, setSucheQ] = useState('');
  const [rubriken, setRubriken] = useState<string[]>(DEFAULT_RUBRIKEN);

  const rubrikParam = rubriken.length ? rubriken.join(',') : 'buergerbuero,amt';
  const geb = usePolling<GebaeudeGeoJson>(`/api/verwaltung/gebaeude?rubrik=${encodeURIComponent(rubrikParam)}`, 60_000);
  const suche = usePolling<SucheResponse>(
    sucheQ.trim().length >= 2 ? `/api/verwaltung/suche?q=${encodeURIComponent(sucheQ.trim())}` : null,
    60_000,
  );

  const toggleRubrik = (id: string) => {
    setRubriken((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        return next.length ? next : [id];
      }
      return [...prev, id];
    });
  };

  const sortedGebaeude = useMemo(() => {
    const feats = geb.data?.features ?? [];
    return feats
      .map((f) => {
        const [gLon, gLat] = f.geometry.coordinates;
        return {
          ...f.properties,
          lon: gLon,
          lat: gLat,
          dist: distM([lon, lat], [gLon, gLat]),
        };
      })
      .sort((a, b) => a.dist - b.dist);
  }, [geb.data, lon, lat]);

  useEffect(() => {
    if (!mapActive || !geb.data) return;
    const items: Facility[] = sortedGebaeude.map((g) => ({
      id: `verw-${g.id}`,
      cat: `verwaltung_${g.rubrik}`,
      name: g.einheitenCount > 1 ? `${g.name} (+${g.einheitenCount - 1})` : g.name,
      lat: g.lat,
      lon: g.lon,
      address: g.address,
      live: g.wartezeit ? `Wartezeit: ${g.wartezeit.text}` : g.jetztText,
    }));
    setNearby({ items, color: CAT_COLOR });
  }, [mapActive, geb.data, sortedGebaeude, setNearby]);

  return (
    <Section
      title="Verwaltung und Leistungen"
      aside={
        <>
          {geb.data ? `${geb.data.totalLeistungen} Leistungen · ${geb.data.totalGebaeude} Gebäude` : null}
          <Explain id="verwaltung" />
        </>
      }
    >
      <div className="nearby-search" style={{ marginBottom: 8 }}>
        <Icon name="search" size={16} />
        <input
          value={sucheQ}
          onChange={(e) => setSucheQ(e.target.value)}
          placeholder="Leistung, Amt oder Straße suchen, z. B. Reisepass, Kfz, Kita …"
          aria-label="Verwaltungsleistung oder Dienststelle suchen"
        />
        {sucheQ && (
          <button type="button" className="link-quiet small" onClick={() => setSucheQ('')} aria-label="Suche leeren">
            Leeren
          </button>
        )}
      </div>

      {!sucheQ.trim() && (
        <div className="chips filter-chips" style={{ marginBottom: 10 }}>
          {SCHNELLWAHL.map((s) => (
            <button key={s.q} type="button" className="chip" onClick={() => setSucheQ(s.q)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {sucheQ.trim().length >= 2 && suche.data && (
        <div style={{ marginBottom: 14 }}>
          {suche.data.total === 0 && <p className="muted small">Keine Treffer für „{suche.data.q}“.</p>}
          {suche.data.leistungen.length > 0 && (
            <>
              <h4 className="sub-head">Leistungen ({suche.data.leistungen.length})</h4>
              <ul className="near-list">
                {suche.data.leistungen.map((l) => (
                  <li key={l.url}>
                    <button type="button" onClick={() => select({ type: 'verwaltung_leistung', url: l.url, lat, lon })}>
                      <span className="near-main">
                        <span className="near-name">{l.name}</span>
                        <span className="near-sub">
                          {[
                            l.online ? 'Online möglich' : 'Vor Ort',
                            l.booking ? 'Terminbuchung verfügbar' : null,
                            l.zustaendig,
                          ].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <Icon name="chevron" size={16} className="muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {suche.data.einheiten.length > 0 && (
            <>
              <h4 className="sub-head">Dienststellen ({suche.data.einheiten.length})</h4>
              <ul className="near-list">
                {suche.data.einheiten.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        select({ type: 'verwaltung_gebaeude', id: e.gebaeudeId, lngLat: [e.lon, e.lat] });
                        flyTo([e.lon, e.lat], 16);
                      }}
                    >
                      <span className="near-main">
                        <span className="near-name">{e.name}</span>
                        <span className="near-sub">
                          {[e.address, e.amt, e.leistungenCount ? `${e.leistungenCount} Leistungen` : null].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <Icon name="chevron" size={16} className="muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="cat-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="cat-group-label">Gebäude nach Rubrik</span>
          <button type="button" className={`chip ${mapActive ? 'on' : ''}`} aria-pressed={mapActive} onClick={onToggleMap}>
            <Icon name="pin" size={14} /> {mapActive ? 'Verwaltung auf Karte aktiv' : 'Auf der Karte zeigen'}
          </button>
        </div>
        <div className="chips filter-chips">
          {RUBRIK_CHIPS.map((c) => {
            const on = rubriken.includes(c.id);
            return (
              <button key={c.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleRubrik(c.id)}>
                <i className="cat-dot" style={{ background: CAT_COLOR[`verwaltung_${c.id}`] ?? '#1E3A5F' }} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {geb.error && !geb.data && <ErrorNote text="Verwaltungsgebäude derzeit nicht abrufbar." onRetry={geb.reload} />}
      {!geb.data && !geb.error && <span className="skeleton block" style={{ height: 120 }} />}

      {sortedGebaeude.length > 0 && (
        <ul className="near-list">
          {sortedGebaeude.slice(0, 6).map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => {
                  select({ type: 'verwaltung_gebaeude', id: g.id, lngLat: [g.lon, g.lat] });
                  flyTo([g.lon, g.lat], 16);
                }}
              >
                {g.buergerbuero && g.wartezeit ? (
                  <span className={`wait-dot ${waitDotClass(g.wartezeit)}`} aria-hidden />
                ) : (
                  <span className="walk"><Icon name="walk" size={16} /><strong>{walkMin(g.dist)}</strong><small>min</small></span>
                )}
                <span className="near-main">
                  <span className="near-name">
                    {g.einheitenCount > 1 ? `${g.name} (${g.einheitenCount} Einheiten)` : g.name}
                  </span>
                  <span className="near-sub">
                    {[
                      fmtDist(g.dist),
                      g.address,
                      g.jetztText,
                      g.wartezeit ? `Wartezeit: ${g.wartezeit.text}` : null,
                      g.leistungenCount ? `${g.leistungenCount} Leistungen` : null,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Icon name="chevron" size={16} className="muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {geb.data && (
        <p className="muted small">
          Quelle: {geb.data.source}.
        </p>
      )}
    </Section>
  );
}
