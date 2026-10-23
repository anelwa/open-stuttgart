// Modul „Bar-Touren“: sieben kuratierte Routen durch Bars, Weinbars, Biergärten und Clubs.
// Daten von /api/bartouren (server/sources/bartouren.mjs), Grundlage OpenStreetMap (ODbL).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ModuleProps } from '../types';
import { useData } from '../../lib/data';
import { tr, useLang } from '../../lib/i18n';
import type { Bartour, BartourStop } from '../../lib/types';
import { Icon } from '../../components/Icon';
import { ErrorNote, LayerRow, Section, SkeletonRows, Source } from '../../components/ui';
import '../../styles/bartouren.css';

const THEME_LABEL: Record<string, string> = {
  klassisch: 'Klassisch',
  jazz: 'Jazz',
  kneipe: 'Kneipe',
  cocktails: 'Cocktails',
  date: 'Date Night',
  wohnzimmer: 'Wohnzimmer',
  wein: 'Wein',
  aussicht: 'Aussicht',
  draussen: 'Draußen',
  afterwork: 'After Work',
  bier: 'Bier',
  wasen: 'Wasen',
  club: 'Club',
  nacht: 'Nacht',
};

const FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'klassisch', label: 'Klassisch' },
  { id: 'cocktails', label: 'Cocktails' },
  { id: 'wein', label: 'Wein' },
  { id: 'wohnzimmer', label: 'Wohnzimmer' },
  { id: 'draussen', label: 'Draußen' },
  { id: 'club', label: 'Clubs' },
];

const ROLE_LABEL: Record<string, string> = {
  ankommen: 'Ankommen',
  vertiefen: 'Vertiefen',
  wechseln: 'Wechseln',
  saettigen: 'Sättigen',
  finale: 'Finale',
};

const WHEEL_LABEL: Record<string, string> = {
  yes: 'stufenlos',
  limited: 'bedingt',
  no: 'nicht barrierefrei',
  unknown: 'keine Angabe',
};

const fmtDuration = (min: number) => `${(min / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Std.`;
const fmtDistance = (m: number) => `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`;

export function BartourenPanel({ visible, toggle, select, flyTo, fitBounds, setLayer, focus }: ModuleProps) {
  useLang();
  const { bartouren } = useData();
  const [tag, setTag] = useState('all');
  const [openId, setOpenId] = useState<string | null>(focus ?? null);
  const lastFocus = useRef<string | null>(focus ?? null);

  useEffect(() => {
    setLayer('bartouren', true);
    return () => setLayer('bartouren', false);
  }, [setLayer]);

  // Aus dem Bot oder aus einem Anliegen kann eine Tour direkt geöffnet werden.
  useEffect(() => {
    if (!focus || focus === lastFocus.current) return;
    lastFocus.current = focus;
    if (bartouren.data?.items.some((t) => t.id === focus)) setOpenId(focus);
  }, [focus, bartouren.data]);

  const items = bartouren.data?.items ?? [];
  const shown = useMemo(() => items.filter((t) => tag === 'all' || t.themes.includes(tag)), [items, tag]);
  const stopCount = items.reduce((n, t) => n + t.stopCount, 0);

  const fitTour = (t: Bartour) => {
    setLayer('bartouren', true);
    fitBounds([[t.bbox[0], t.bbox[1]], [t.bbox[2], t.bbox[3]]], { maxZoom: 15 });
  };

  const toggleTour = (t: Bartour) => {
    const next = openId === t.id ? null : t.id;
    setOpenId(next);
    if (next) fitTour(t);
  };

  const openStop = (t: Bartour, s: BartourStop) => {
    select({ type: 'bartour-stop', tourId: t.id, stopIndex: s.index, lngLat: [s.lon, s.lat] });
    flyTo([s.lon, s.lat], 16);
  };

  return (
    <div className="module bt-module">
      <div className="bt-hero">
        <span className="eyebrow"><Icon name="cocktail" size={14} /> Bar-Touren <span className="bt-hero-dot" /> Drinking Spots</span>
        <h3>{items.length ? `${items.length} Touren für einen Abend in Stuttgart` : 'Touren werden geladen …'}</h3>
        <p className="bt-hero-line">
          Kuratierte Routen mit Dramaturgie, kurzen Wegen und ehrlichen Hinweisen zu Öffnungszeiten,
          Barrierefreiheit und Heimweg. Keine bezahlte Platzierung, keine Rangliste.
        </p>
        {bartouren.data && (
          <p className="bt-hero-meta">
            {stopCount} Stationen · {items.filter((t) => t.themes.includes('wein')).length} Wein-Touren ·{' '}
            {items.filter((t) => t.themes.includes('club')).length} Club-Touren
          </p>
        )}
      </div>

      <Section title="Touren" explain="bartouren" aside={bartouren.data ? `${shown.length} von ${items.length}` : undefined}>
        <div className="chips filter-chips" role="group" aria-label="Touren filtern">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${tag === f.id ? 'on' : ''}`}
              aria-pressed={tag === f.id}
              onClick={() => setTag(f.id)}
            >
              {tr(f.label)}
            </button>
          ))}
        </div>

        {bartouren.error && !bartouren.data && (
          <ErrorNote text={`Bar-Touren nicht verfügbar: ${bartouren.error}`} onRetry={bartouren.reload} />
        )}
        {!bartouren.data && !bartouren.error && <SkeletonRows rows={4} />}
        {bartouren.data && shown.length === 0 && (
          <p className="muted small">Für diesen Filter ist keine Tour hinterlegt.</p>
        )}

        <div className="bt-list">
          {shown.map((t) => {
            const open = openId === t.id;
            return (
              <article
                key={t.id}
                className={`bt-card ${open ? 'is-open' : ''}`}
                style={{ '--bt-color': t.color } as CSSProperties}
              >
                <button
                  type="button"
                  className="bt-card-head"
                  aria-expanded={open}
                  onClick={() => toggleTour(t)}
                >
                  <span className="bt-swatch" aria-hidden />
                  <span className="bt-card-main">
                    <span className="bt-kicker">{t.subtitle}</span>
                    <span className="bt-title">{t.title}</span>
                    <span className="bt-meta">
                      {t.stopCount} Stationen · {fmtDuration(t.durationMin)} · {fmtDistance(t.distanceM)}
                    </span>
                    <span className="bt-tags">
                      {t.themes.map((id) => <span className="bt-tag" key={id}>{THEME_LABEL[id] ?? id}</span>)}
                    </span>
                  </span>
                  <span className="bt-card-side">
                    <span className="bt-price">{t.priceLevel}</span>
                    <Icon name="chevron" size={17} className={open ? 'chev-down' : 'chev-right'} />
                  </span>
                </button>

                {open && (
                  <div className="bt-body">
                    <p className="bt-intro">{t.intro}</p>
                    <p className="bt-dramaturgy"><strong>Dramaturgie:</strong> {t.dramaturgy}</p>

                    <dl className="bt-facts">
                      <div><dt>Für wen</dt><dd>{t.audience}</dd></div>
                      <div><dt>Beste Zeit</dt><dd>{t.bestDays}, {t.bestTime}</dd></div>
                      <div><dt>Budget</dt><dd>{t.budget} pro Person (Schätzung)</dd></div>
                      <div><dt>Reservierung</dt><dd>{t.reservation}</dd></div>
                      <div><dt>Barrierefreiheit</dt><dd>{t.accessibility}</dd></div>
                      <div><dt>Alkoholfrei</dt><dd>{t.alcoholFree === 'options' ? 'Optionen möglich; vor Ort fragen' : t.alcoholFree}</dd></div>
                      <div><dt>Regen</dt><dd>{t.weather}</dd></div>
                      <div><dt>Heimweg</dt><dd>{t.home}</dd></div>
                    </dl>

                    <div className="bt-route-head">
                      <h4>Route</h4>
                      <span>{t.season}</span>
                    </div>
                    <ol className="bt-stops">
                      {t.stops.map((s) => (
                        <li key={s.id}>
                          <button type="button" className="bt-stop" onClick={() => openStop(t, s)}>
                            <span className="bt-stop-num">{s.index}</span>
                            <span className="bt-stop-main">
                              <span className="bt-stop-name">
                                {s.name}
                                {s.optional && <small className="bt-optional">optional</small>}
                              </span>
                              <span className="bt-stop-sub">{s.category} · {s.address}</span>
                              <span className="bt-stop-why">{s.why}</span>
                              <span className="bt-stop-order">{ROLE_LABEL[s.role] ?? s.role} · {s.orderIdea}</span>
                            </span>
                            <span className="bt-stop-side">
                              <strong>{s.stayMin} Min.</strong>
                              <span>{s.walkToNextMin ? `${s.walkToNextMin} Min. →` : 'Ziel'}</span>
                              <span className={`bt-wheel bt-wheel-${s.wheelchair}`}>{WHEEL_LABEL[s.wheelchair] ?? 'k. A.'}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>

                    <div className="bt-actions">
                      <button type="button" className="link-btn" onClick={() => fitTour(t)}>
                        <Icon name="pin" size={16} /> Auf der Karte zeigen
                      </button>
                      <a className="link-btn secondary" href={`/api/bartouren/${t.id}.gpx`} download>
                        <Icon name="route" size={16} /> GPX der Stationen
                      </a>
                    </div>

                    <details className="bt-details">
                      <summary>Varianten und Hinweise</summary>
                      <ul>
                        {t.variants.map((v) => <li key={v}>{v}</li>)}
                        {t.notes.map((n) => <li key={n}>{n}</li>)}
                      </ul>
                    </details>

                    <Source>
                      {t.sources.join(' · ')}. Stand {t.checkedAt}; Öffnungszeiten, Einlass und
                      Barrierefreiheit ohne Gewähr. Die Linie verbindet die Stationen, sie ist keine Navigation.
                    </Source>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </Section>

      <Section title="Auf der Karte" collapsible defaultOpen={false}>
        <div className="layer-list">
          <LayerRow
            icon="cocktail"
            tone="ink"
            title="Bar-Touren"
            on={visible.bartouren}
            onToggle={() => toggle('bartouren')}
            meta={bartouren.data ? `${items.length} Touren, ${stopCount} Stationen` : 'lädt'}
            loading={!bartouren.data}
          />
        </div>
        <div className="bt-legend" aria-hidden>
          <span><i className="bt-legend-line" /> Verlauf zwischen den Stationen</span>
          <span><i className="bt-legend-dot" /> nummerierte Station</span>
        </div>
        <p className="muted small">
          Die Karte zeigt die kuratierte Reihenfolge. Für den tatsächlichen Fußweg den Stopp öffnen
          und „Verbindung suchen“ nutzen; die App übergibt an das Weg-Modul.
        </p>
      </Section>

      {bartouren.data && (
        <p className="muted small bt-footnote">
          {bartouren.data.hinweis}
        </p>
      )}
    </div>
  );
}
