// Detailansicht einer Station aus einer Bar-Tour. Sie verbindet den kuratierten
// Tour-Kontext mit den vorhandenen Bausteinen für Anreise, Route und Quellen.
import { useData } from '../lib/data';
import type { Selection } from '../lib/types';
import { Icon } from './Icon';
import { SheetHead } from './Details';
import { GettingThere } from './CultureDetails';
import { DetailFallback, Source } from './ui';

type Close = { onClose: () => void };
type Nav = { select: (s: Selection) => void; flyTo: (c: [number, number], z?: number) => void };

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

export function BartourStopDetail({ sel, onClose, select, flyTo }: Close & Nav & { sel: Extract<Selection, { type: 'bartour-stop' }> }) {
  const { bartouren } = useData();
  const tour = bartouren.data?.items.find((t) => t.id === sel.tourId);
  const stop = tour?.stops.find((s) => s.index === sel.stopIndex);

  if (!bartouren.data && !bartouren.error) {
    return <DetailFallback title="Bar-Tour" text="Die Tourdaten werden geladen …" onClose={onClose} />;
  }
  if (!tour || !stop) {
    return (
      <DetailFallback
        title="Station nicht gefunden"
        text={bartouren.error ? 'Die Tourdaten sind derzeit nicht erreichbar.' : 'Diese Station ist nicht mehr Teil der Tour.'}
        onClose={onClose}
        onRetry={bartouren.error ? bartouren.reload : undefined}
      />
    );
  }

  const next = tour.stops.find((s) => s.index === stop.index + 1);
  const near = stop.nearestStops?.[0];

  return (
    <div className="sheet-inner">
      <SheetHead
        eyebrow={`Bar-Tour · ${tour.title}`}
        title={`${stop.index}. ${stop.name}`}
        onClose={onClose}
      >
        <div className="bt-detail-badges">
          <span className="bt-detail-badge">{stop.category}</span>
          <span className="bt-detail-badge">{ROLE_LABEL[stop.role] ?? stop.role}</span>
          {stop.optional && <span className="bt-detail-badge">optional</span>}
        </div>
      </SheetHead>
      <div className="sheet-body">
        <p className="bt-detail-lede">{stop.why}</p>

        <dl className="facts">
          <div><dt>Adresse</dt><dd>{stop.address}</dd></div>
          <div><dt>Aufenthalt</dt><dd>etwa {stop.stayMin} Minuten</dd></div>
          <div><dt>Bestellung</dt><dd>{stop.orderIdea}</dd></div>
          <div><dt>Öffnungszeiten</dt><dd>{stop.openingHours}</dd></div>
          <div><dt>Barrierefreiheit</dt><dd>{WHEEL_LABEL[stop.wheelchair] ?? 'keine Angabe'}</dd></div>
          {next && <div><dt>Nächster Stopp</dt><dd>{next.name}, {stop.walkToNextMin} Min. zu Fuß</dd></div>}
          {near && <div><dt>Nächste Haltestelle</dt><dd>{near.name}, {near.walkMin} Min. zu Fuß</dd></div>}
          <div><dt>Quelle</dt><dd>{stop.source}</dd></div>
        </dl>

        {stop.note && <p className="muted small bt-detail-note"><Icon name="info" size={14} /> {stop.note}</p>}

        {next && (
          <button
            type="button"
            className="link-btn secondary bt-next"
            onClick={() => {
              select({ type: 'bartour-stop', tourId: tour.id, stopIndex: next.index, lngLat: [next.lon, next.lat] });
              flyTo([next.lon, next.lat], 16);
            }}
          >
            <Icon name="chevron" size={16} /> Weiter zu {next.index}. {next.name}
          </button>
        )}

        <GettingThere lngLat={[stop.lon, stop.lat]} select={select} flyTo={flyTo} label={stop.name} />

        <div className="bt-detail-actions">
          <a className="link-btn secondary" href={`/api/bartouren/${tour.id}.gpx`} download>
            <Icon name="route" size={16} /> GPX der Tour
          </a>
        </div>

        <Source>
          {stop.source}. Stand {stop.checkedAt}; Öffnungszeiten, Einlass und Barrierefreiheit ohne Gewähr.
          Die Tour ist ein redaktioneller Vorschlag, keine bezahlte Platzierung.
        </Source>
      </div>
    </div>
  );
}
