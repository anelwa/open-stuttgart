// Panels "Gebäude" und "Leistung" der Ebene Verwaltung (Spezifikation Abschnitt 5 und 6).
import { useMemo, useState } from 'react';
import { usePolling } from '../lib/api';
import { distM, walkMin } from '../lib/geo';
import type { Selection } from '../lib/types';
import { GettingThere } from './CultureDetails';
import { SheetHead } from './Details';
import { Icon } from './Icon';
import { ErrorNote, Section, Source } from './ui';

type Nav = { select: (s: Selection) => void; flyTo: (c: [number, number], z?: number) => void };
type Close = { onClose: () => void };

export interface OnlineAngebot {
  art: 'termin' | 'stadt' | 'land' | 'bund' | 'formular';
  titel: string;
  url: string;
}

export interface WartezeitInfo {
  status: number;
  farbe: 'grau' | 'gruen' | 'gelb' | 'rot';
  text: string;
  waitMin: number | null;
}

export interface OeffnungszeitZeile {
  day: string;
  times: string;
  note?: string;
}

export interface JetztGeoeffnetInfo {
  open: boolean;
  onlyAppointment: boolean;
  state: 'offen' | 'termin' | 'geschlossen' | 'unbekannt';
  text: string;
}

export interface EinheitLeistung {
  id: string;
  name: string;
  url: string;
  rolle: string;
  online: boolean;
  booking?: string | null;
}

export interface GebaeudeEinheit {
  id: string;
  name: string;
  amt: string | null;
  art: string;
  rubrik: string;
  url: string | null;
  booking: string | null;
  phone: string | null;
  email: string | null;
  oeffnungszeiten: OeffnungszeitZeile[];
  jetztGeoeffnet: JetztGeoeffnetInfo | null;
  wartezeit: WartezeitInfo | null;
  onlineAngebote: OnlineAngebot[];
  leistungen: EinheitLeistung[];
}

export interface GebaeudeResponse {
  id: string;
  address: string;
  stadtbezirk: string | null;
  lat: number;
  lon: number;
  buergerbuero: boolean;
  tafel_id: number | null;
  wartezeit: WartezeitInfo | null;
  einheiten: GebaeudeEinheit[];
  stand: string;
  source: string;
}

export interface LeistungOrt {
  gebaeudeId: string;
  name: string;
  amt: string | null;
  address: string;
  stadtbezirk: string | null;
  lat: number;
  lon: number;
  booking: string | null;
  jetztGeoeffnet: JetztGeoeffnetInfo | null;
  wartezeit: WartezeitInfo | null;
}

export interface LeistungResponse {
  id: string;
  name: string;
  url: string;
  leika: string | null;
  zustaendig: string | null;
  booking: string | null;
  onlineAngebote: OnlineAngebot[];
  abschnitte: Record<string, string>;
  orte: LeistungOrt[];
  stand: string;
  source: string;
}

const ABSCHNITT_FOLGE = [
  'Voraussetzungen',
  'Benötigte Unterlagen',
  'Gebühren',
  'Bearbeitungsdauer',
  'Ablauf',
  'Rechtsgrundlage',
];

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`);

function waitDotClass(w: WartezeitInfo | null | undefined) {
  if (!w) return 'w-zu';
  if (w.status === 0) return 'w-zu';
  if (w.status >= 11) return 'w-voll';
  if (w.status >= 6) return 'w-lang';
  return 'w-kurz';
}

function CopyField({ label, value, href }: { label: string; value: string; href: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <dt>{label}</dt>
      <dd style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <a href={href} style={{ color: 'inherit', fontWeight: 600 }}>
          {value}
        </a>
        <button
          type="button"
          className="link-quiet small"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }, () => {});
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={13} /> {copied ? 'Kopiert' : 'Kopieren'}
        </button>
      </dd>
    </div>
  );
}

/** Knöpfe in fester Reihenfolge: 1. Termin buchen, 2. Online erledigen, 3. Seite der Stadt */
function ActionButtons({ booking, onlineAngebote, cityUrl }: { booking?: string | null; onlineAngebote?: OnlineAngebot[]; cityUrl?: string | null }) {
  const terminUrl = booking ?? onlineAngebote?.find((o) => o.art === 'termin')?.url ?? null;
  const onlineList = (onlineAngebote ?? []).filter((o) => o.art === 'stadt' || o.art === 'land' || o.art === 'bund');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '10px 0' }}>
      {terminUrl && (
        <a className="link-btn" href={terminUrl} target="_blank" rel="noreferrer">
          Termin buchen <Icon name="external" size={16} />
        </a>
      )}
      {onlineList.map((o) => (
        <a key={o.url} className="link-btn" href={o.url} target="_blank" rel="noreferrer">
          Online erledigen ({o.art === 'land' ? 'Land' : o.art === 'bund' ? 'Bund' : 'Stadt'}): {o.titel} <Icon name="external" size={16} />
        </a>
      ))}
      {cityUrl && (
        <a className="link-btn secondary" href={cityUrl} target="_blank" rel="noreferrer">
          Seite der Stadt <Icon name="external" size={16} />
        </a>
      )}
    </div>
  );
}

function EinheitBlock({ e, lat, lon, select }: { e: GebaeudeEinheit; lat: number; lon: number; select: (s: Selection) => void }) {
  const [filter, setFilter] = useState('');
  const svcs = e.leistungen ?? [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return svcs;
    return svcs.filter((s) => s.name.toLowerCase().includes(q));
  }, [svcs, filter]);
  const onlineSvcs = filtered.filter((s) => s.online);
  const vorOrtSvcs = filtered.filter((s) => !s.online);

  return (
    <Section title={e.name} aside={e.amt ? <span className="muted small">{e.amt}</span> : undefined}>
      {e.jetztGeoeffnet && (
        <p className={`open-state ${e.jetztGeoeffnet.open ? 'is-open' : ''}`}>
          {e.jetztGeoeffnet.text}
        </p>
      )}
      {e.wartezeit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
          <span className={`wait-dot ${waitDotClass(e.wartezeit)}`} aria-hidden />
          <strong>Wartezeit Bürgerbüro: {e.wartezeit.text}</strong>
        </div>
      )}
      {e.oeffnungszeiten.length > 0 && (
        <dl className="facts">
          {e.oeffnungszeiten.map((r, idx) => (
            <div key={`${r.day}-${idx}`}>
              <dt>{r.day}</dt>
              <dd>{r.times}{r.note ? <span className="block muted small">{r.note}</span> : null}</dd>
            </div>
          ))}
        </dl>
      )}
      {(e.phone || e.email) && (
        <dl className="facts">
          {e.phone && <CopyField label="Telefon" value={e.phone} href={`tel:${e.phone.replace(/[^\d+]/g, '')}`} />}
          {e.email && <CopyField label="E-Mail" value={e.email} href={`mailto:${e.email}`} />}
        </dl>
      )}

      <ActionButtons booking={e.booking} onlineAngebote={e.onlineAngebote} cityUrl={e.url} />

      {svcs.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {svcs.length > 15 && (
            <div className="nearby-search" style={{ marginBottom: 8 }}>
              <Icon name="search" size={16} />
              <input
                value={filter}
                onChange={(ev) => setFilter(ev.target.value)}
                placeholder={`Unter ${svcs.length} Leistungen filtern …`}
                aria-label="Leistungen der Einheit filtern"
              />
            </div>
          )}
          {onlineSvcs.length > 0 && (
            <>
              <h4 className="sub-head">Online möglich ({onlineSvcs.length})</h4>
              <ul className="near-list">
                {onlineSvcs.map((s) => (
                  <li key={s.url}>
                    <button type="button" onClick={() => select({ type: 'verwaltung_leistung', url: s.url, lat, lon })}>
                      <span className="near-main">
                        <span className="near-name">{s.name}</span>
                        <span className="near-sub">Online-Dienst verfügbar · {s.rolle}</span>
                      </span>
                      <Icon name="chevron" size={16} className="muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {vorOrtSvcs.length > 0 && (
            <>
              <h4 className="sub-head">Vor Ort ({vorOrtSvcs.length})</h4>
              <ul className="near-list">
                {vorOrtSvcs.map((s) => (
                  <li key={s.url}>
                    <button type="button" onClick={() => select({ type: 'verwaltung_leistung', url: s.url, lat, lon })}>
                      <span className="near-main">
                        <span className="near-name">{s.name}</span>
                        <span className="near-sub">{s.rolle}</span>
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
    </Section>
  );
}

export function GebaeudeDetail({ id, onClose, select, flyTo }: Close & Nav & { id: string }) {
  const { data, error, loading, reload } = usePolling<GebaeudeResponse>(`/api/verwaltung/gebaeude?id=${encodeURIComponent(id)}`, 60_000);
  const title = data?.einheiten.length === 1 ? data.einheiten[0].name : (data?.address ?? 'Verwaltungsgebäude');
  const eyebrow = data?.buergerbuero
    ? 'Verwaltung · Bürgerbüro'
    : data?.einheiten.length && data.einheiten.length > 1
      ? `Verwaltungsgebäude · ${data.einheiten.length} Einheiten`
      : 'Verwaltung · Dienststelle';

  return (
    <div className="sheet-inner">
      <SheetHead eyebrow={eyebrow} title={title} onClose={onClose}>
        {data && (
          <p className="head-sub">
            {data.address}{data.stadtbezirk ? ` · Stadtbezirk ${data.stadtbezirk}` : ''}
          </p>
        )}
      </SheetHead>
      <div className="sheet-body">
        {error && !data && <ErrorNote text={`Gebäudeangaben nicht verfügbar: ${error}`} onRetry={reload} />}
        {loading && !data && <span className="skeleton block" style={{ height: 180 }} />}
        {data && (
          <>
            <div className="where">
              <Icon name="pin" size={20} />
              <div>
                <strong>{data.address}</strong>
                {data.stadtbezirk && <span className="block muted small">Stadtbezirk {data.stadtbezirk}</span>}
              </div>
            </div>

            {data.einheiten.map((e) => (
              <EinheitBlock key={e.id} e={e} lat={data.lat} lon={data.lon} select={select} />
            ))}

            <GettingThere lngLat={[data.lon, data.lat]} select={select} flyTo={flyTo} label={title} />
            <Source>{data.source}.</Source>
          </>
        )}
      </div>
    </div>
  );
}

export function LeistungDetail({ url, lat, lon, onClose, select, flyTo }: Close & Nav & { url: string; lat?: number; lon?: number }) {
  const origin = useMemo<[number, number]>(() => {
    if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) return [lon, lat];
    try {
      const saved = JSON.parse(localStorage.getItem('os-adresse') ?? 'null');
      if (saved?.lngLat) return saved.lngLat;
    } catch { /* egal */ }
    return [9.1778, 48.7749];
  }, [lat, lon]);

  const { data, error, loading, reload } = usePolling<LeistungResponse>(`/api/verwaltung/leistung?url=${encodeURIComponent(url)}`, 60_000);

  const sortedOrte = useMemo(() => {
    if (!data?.orte) return [];
    return data.orte
      .map((o) => ({ ...o, dist: distM(origin, [o.lon, o.lat]) }))
      .sort((a, b) => a.dist - b.dist);
  }, [data, origin]);

  const sectionEntries = useMemo(() => {
    if (!data?.abschnitte) return [];
    const seen = new Set<string>();
    const out: [string, string][] = [];
    for (const k of ABSCHNITT_FOLGE) {
      if (data.abschnitte[k]) {
        seen.add(k);
        out.push([k, data.abschnitte[k]]);
      }
    }
    for (const [k, v] of Object.entries(data.abschnitte)) {
      if (!seen.has(k) && v) out.push([k, v]);
    }
    return out;
  }, [data]);

  return (
    <div className="sheet-inner">
      <SheetHead eyebrow="Verwaltungsleistung" title={data?.name ?? 'Leistung wird geladen …'} onClose={onClose}>
        {data?.zustaendig && <p className="head-sub">Zuständig: {data.zustaendig}</p>}
      </SheetHead>
      <div className="sheet-body">
        {error && !data && <ErrorNote text={`Leistung nicht verfügbar: ${error}`} onRetry={reload} />}
        {loading && !data && <span className="skeleton block" style={{ height: 180 }} />}
        {data && (
          <>
            <ActionButtons booking={data.booking} onlineAngebote={data.onlineAngebote} cityUrl={data.url} />

            {sortedOrte.length > 0 && (
              <Section title="Wo erledigen" aside={<span className="muted small">{sortedOrte.length} {sortedOrte.length === 1 ? 'Standort' : 'Standorte'}</span>}>
                <ul className="near-list">
                  {sortedOrte.slice(0, 8).map((o) => (
                    <li key={o.gebaeudeId}>
                      <button
                        type="button"
                        onClick={() => {
                          select({ type: 'verwaltung_gebaeude', id: o.gebaeudeId, lngLat: [o.lon, o.lat] });
                          flyTo([o.lon, o.lat], 16);
                        }}
                      >
                        {o.wartezeit ? (
                          <span className={`wait-dot ${waitDotClass(o.wartezeit)}`} aria-hidden />
                        ) : (
                          <span className="walk"><Icon name="walk" size={16} /><strong>{walkMin(o.dist)}</strong><small>min</small></span>
                        )}
                        <span className="near-main">
                          <span className="near-name">{o.name}</span>
                          <span className="near-sub">
                            {[
                              fmtDist(o.dist),
                              o.address,
                              o.jetztGeoeffnet?.text,
                              o.wartezeit ? `Wartezeit: ${o.wartezeit.text}` : null,
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

            {sectionEntries.map(([titel, text]) => (
              <Section key={titel} title={titel}>
                <p className="small" style={{ whiteSpace: 'pre-line' }}>{text}</p>
              </Section>
            ))}

            {data.leika && <p className="muted small">LeiKa-Schlüssel: {data.leika}</p>}
            <Source>{data.source}.</Source>
          </>
        )}
      </div>
    </div>
  );
}
