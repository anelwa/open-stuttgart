// Themenmodul "Verwaltung": Kartenebene, Suche über Leistungen/Einheiten/Straßen,
// Filter-Chips nach Rubrik, Live-Wartezeit der Bürgerbüros und Einstieg in die Panels "Gebäude" und "Leistung".
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModuleProps } from '../types';
import { usePolling } from '../../lib/api';
import { distM, walkMin } from '../../lib/geo';
import { Explain } from '../../lib/info';
import { tr, useLang } from '../../lib/i18n';
import type { Facility } from '../../lib/types';
import { Icon } from '../../components/Icon';
import { ErrorNote, LayerRow, Section, Source, SkeletonRows } from '../../components/ui';
import type { WartezeitInfo } from '../../components/VerwaltungDetail';
import { CAT_COLOR } from '../nearby/cats';

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

const KERN_LEISTUNGEN: { name: string; url: string; online: boolean; booking: boolean; zustaendig: string }[] = [
  { name: 'Reisepass beantragen – erstmalig oder nach Ablauf', url: 'https://www.stuttgart.de/organigramm/leistungen/reisepass-beantragen-erstmalig-oder-nach-ablauf', online: false, booking: true, zustaendig: 'Amt für öffentliche Ordnung / Bürgerbüros' },
  { name: 'Wohnsitz anmelden – als Hauptwohnsitz', url: 'https://www.stuttgart.de/organigramm/leistungen/wohnsitz-anmelden-als-hauptwohnsitz', online: true, booking: true, zustaendig: 'Amt für öffentliche Ordnung / Bürgerbüros' },
  { name: 'Personalausweis – Ausstellung wegen Verlust oder Diebstahl', url: 'https://www.stuttgart.de/organigramm/leistungen/personalausweis-ausstellung-wegen-verlust-oder-diebstahl-beantragen', online: false, booking: true, zustaendig: 'Amt für öffentliche Ordnung / Bürgerbüros' },
  { name: 'Personalausweis – Adressänderung', url: 'https://www.stuttgart.de/organigramm/leistungen/personalausweis-adressaenderung', online: true, booking: true, zustaendig: 'Amt für öffentliche Ordnung / Bürgerbüros' },
  { name: 'Bewohnerparkausweis beantragen', url: 'https://www.stuttgart.de/organigramm/leistungen/bewohnerparkausweis-beantragen', online: true, booking: true, zustaendig: 'Amt für öffentliche Ordnung / Bürgerbüros' },
  { name: 'Bewohnerparkausweis verlängern', url: 'https://www.stuttgart.de/organigramm/leistungen/bewohnerparkausweis-verlaengern', online: true, booking: true, zustaendig: 'Amt für öffentliche Ordnung / Bürgerbüros' },
  { name: 'Führerschein beantragen – erstmalig', url: 'https://www.stuttgart.de/organigramm/leistungen/fuehrerschein-beantragen-erstmalig', online: false, booking: true, zustaendig: 'Amt für öffentliche Ordnung – Führerscheinstelle' },
  { name: 'Einfaches Führungszeugnis beantragen', url: 'https://www.stuttgart.de/organigramm/leistungen/einfaches-fuehrungszeugnis-beantragen', online: true, booking: true, zustaendig: 'Amt für öffentliche Ordnung / Bürgerbüros' },
  { name: 'Kindertageseinrichtung – Kind für Aufnahme anmelden', url: 'https://www.stuttgart.de/organigramm/leistungen/kindertageseinrichtung-kind-fuer-aufnahme-anmelden', online: true, booking: false, zustaendig: 'Jugendamt Stuttgart' },
  { name: 'Eheschließung anmelden', url: 'https://www.stuttgart.de/organigramm/leistungen/eheschliessung-anmelden', online: true, booking: true, zustaendig: 'Standesamt Stuttgart' },
  { name: 'Abfuhrtermine und Abfallkalender', url: 'https://www.stuttgart.de/organigramm/leistungen/abfuhrtermine', online: true, booking: false, zustaendig: 'Abfallwirtschaft Stuttgart (AWS)' },
  { name: 'Hundehaltung – Namens- und Adressänderung mitteilen', url: 'https://www.stuttgart.de/organigramm/leistungen/hundehaltung-namens-und-adressaenderung-mitteilen', online: true, booking: false, zustaendig: 'Stadtkämmerei' },
];

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`);

function waitDotClass(w: WartezeitInfo | null | undefined) {
  if (!w || w.status === 0) return 'w-zu';
  if (w.status >= 11) return 'w-voll';
  if (w.status >= 6) return 'w-lang';
  return 'w-kurz';
}

export function VerwaltungPanel({ center, flyTo, select, setNearby, setLayer, visible, toggle, botCommand }: ModuleProps) {
  useLang();
  const [q, setQ] = useState('');
  const [rubriken, setRubriken] = useState<string[]>(DEFAULT_RUBRIKEN);
  const lastBotCommand = useRef('');

  // Suche aus dem Bot: „Suche nach Personalausweis“.
  useEffect(() => {
    if (!botCommand || botCommand.module !== 'verwaltung' || lastBotCommand.current === botCommand.id) return;
    lastBotCommand.current = botCommand.id;
    if (botCommand.command === 'query') setQ(String(botCommand.args?.value ?? ''));
  }, [botCommand]);

  const origin = useMemo<[number, number]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('os-adresse') ?? 'null');
      if (saved?.lngLat) return saved.lngLat;
    } catch { /* egal */ }
    return center;
  }, [center]);
  const [lon, lat] = origin;

  useEffect(() => {
    setLayer('nearby', true);
    return () => setNearby(null);
  }, [setLayer, setNearby]);

  const rubrikParam = rubriken.length ? rubriken.join(',') : 'buergerbuero,amt';
  const geb = usePolling<GebaeudeGeoJson>(`/api/verwaltung/gebaeude?rubrik=${encodeURIComponent(rubrikParam)}`, 60_000);
  const suche = usePolling<SucheResponse>(
    q.trim().length >= 2 ? `/api/verwaltung/suche?q=${encodeURIComponent(q.trim())}` : null,
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

  const buergerbueros = useMemo(
    () => sortedGebaeude.filter((g) => g.buergerbuero),
    [sortedGebaeude],
  );

  useEffect(() => {
    if (!geb.data) return;
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
  }, [geb.data, sortedGebaeude, setNearby]);

  return (
    <div className="module nearby">
      <div className="culture-hero nearby-hero">
        <span className="eyebrow">{tr('Landeshauptstadt Stuttgart')}</span>
        <h3>Verwaltung und Leistungen</h3>
        <p className="small" style={{ margin: '4px 0 10px', opacity: 0.9 }}>
          {geb.data
            ? `${geb.data.totalLeistungen} Leistungen · ${geb.data.totalEinheiten} Dienststellen in ${geb.data.totalGebaeude} Gebäuden`
            : 'Leistungen, Zuständigkeiten, Öffnungszeiten, Terminbuchung und Wartezeiten'}
        </p>
        <div className="nearby-search">
          <Icon name="search" size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Leistung, Amt oder Straße suchen, z. B. Reisepass, Kfz, Kita …"
            aria-label="Verwaltungsleistung, Dienststelle oder Straße suchen"
          />
          {q && (
            <button type="button" className="link-quiet small" onClick={() => setQ('')} style={{ color: 'inherit' }}>
              Leeren
            </button>
          )}
        </div>
      </div>

      {q.trim().length >= 2 && suche.loading && !suche.data && (
        <Section title="Suche läuft">
          <SkeletonRows rows={4} />
        </Section>
      )}

      {q.trim().length >= 2 && suche.error && !suche.data && (
        <div className="nearby-hint">
          <ErrorNote text="Die Verwaltungssuche ist derzeit nicht verfügbar." onRetry={suche.reload} />
        </div>
      )}

      {q.trim().length >= 2 && suche.data && (
        <Section title={`Suchergebnisse (${suche.data.total})`}>
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
          {suche.data.gebaeude.length > 0 && (
            <>
              <h4 className="sub-head">Adressen ({suche.data.gebaeude.length})</h4>
              <ul className="near-list">
                {suche.data.gebaeude.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => {
                        select({ type: 'verwaltung_gebaeude', id: g.id, lngLat: [g.lon, g.lat] });
                        flyTo([g.lon, g.lat], 16);
                      }}
                    >
                      <span className="near-main">
                        <span className="near-name">{g.address}</span>
                        <span className="near-sub">
                          {[g.stadtbezirk, g.einheitenCount ? `${g.einheitenCount} Dienststellen` : null].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <Icon name="chevron" size={16} className="muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}

      <Section title="Auf der Karte" aside={<Explain id="verwaltung" />} collapsible defaultOpen={false}>
        <LayerRow
          icon="home"
          tone="ink"
          title="Verwaltungsgebäude nach Rubrik"
          on={visible.nearby}
          onToggle={() => toggle('nearby')}
          meta={geb.data ? `${sortedGebaeude.length} Gebäude sichtbar, ein Punkt je Anschrift` : 'wird geladen'}
        />
        <LayerRow
          icon="clock"
          tone="green"
          title="Live-Wartezeit der Bürgerbüros"
          on={visible.live}
          onToggle={() => toggle('live')}
          meta="Wartezeit-Ampel (Stufe 0 bis 11) direkt an den Bürgerbüros"
        />
        <div className="cat-group" style={{ marginTop: 8 }}>
          <span className="cat-group-label">Filter (Chips)</span>
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
      </Section>

      <Section title="Verwaltungsleistungen" aside={<Explain id="verwaltung" />}>
        <p className="section-intro">Voraussetzungen, Unterlagen, Gebühren und der Ort, an dem Sie die Leistung erledigen.</p>
        <ul className="near-list">
          {KERN_LEISTUNGEN.map((l) => (
            <li key={l.url}>
              <button type="button" onClick={() => select({ type: 'verwaltung_leistung', url: l.url, lat, lon })}>
                <span className="near-main">
                  <span className="near-name">{l.name}</span>
                  <span className="near-sub">
                    {[
                      l.online ? 'Online möglich' : 'Vor Ort',
                      l.booking ? 'Terminbuchung' : null,
                      l.zustaendig,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Icon name="chevron" size={16} className="muted" />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {buergerbueros.length > 0 && (
        <Section title="Bürgerbüros nach Entfernung" aside={<Explain id="buergerbuero" />}>
          <ul className="near-list">
            {buergerbueros.slice(0, 6).map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => {
                    select({ type: 'verwaltung_gebaeude', id: g.id, lngLat: [g.lon, g.lat] });
                    flyTo([g.lon, g.lat], 16);
                  }}
                >
                  <span className={`wait-dot ${waitDotClass(g.wartezeit)}`} aria-hidden />
                  <span className="near-main">
                    <span className="near-name">{g.name}</span>
                    <span className="near-sub">
                      {[
                        fmtDist(g.dist),
                        g.wartezeit ? `Wartezeit: ${g.wartezeit.text}` : null,
                        g.jetztText,
                        g.address,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <Icon name="chevron" size={16} className="muted" />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Gebäude und Dienststellen"
        aside={<span className="muted small">{sortedGebaeude.length} {sortedGebaeude.length === 1 ? 'Gebäude' : 'Gebäude'}</span>}
      >
        {geb.error && !geb.data && <ErrorNote text="Verwaltungsgebäude derzeit nicht abrufbar." onRetry={geb.reload} />}
        {!geb.data && !geb.error && <span className="skeleton block" style={{ height: 140 }} />}
        <ul className="near-list">
          {sortedGebaeude.slice(0, 12).map((g) => (
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
      </Section>

      <Source disclosure>
        {geb.data?.source ?? 'Landeshauptstadt Stuttgart, stuttgart.de, Stand 20.10.2026'}. Wartezeiten: Bürgerbüros der Stadt (`wartezeiten.stuttgart.de`).
        Für verbindliche Auskünfte gilt immer die verlinkte Originalseite der Landeshauptstadt Stuttgart.
      </Source>
    </div>
  );
}
