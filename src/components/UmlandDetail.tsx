// Detailansicht eines Ausflugsziels: redaktioneller Steckbrief, Wetter am Ziel,
// Anreise mit dem VVS und Links zu Anbieter und Wikipedia.
import { usePolling } from '../lib/api';
import type { Selection, UmlandZiel } from '../lib/types';
import { Icon, weatherIconName } from './Icon';
import { SheetHead } from './Details';
import { GettingThere } from './CultureDetails';
import { DetailFallback, Section, Source } from './ui';
import { fmtDec } from '../lib/format';
import { tr } from '../lib/i18n';

type Close = { onClose: () => void };
type Nav = { select: (s: Selection) => void; flyTo: (c: [number, number], z?: number) => void };

const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });

export function UmlandDetail({ sel, onClose, select, flyTo }: Close & Nav & { sel: Extract<Selection, { type: 'umland' }> }) {
  const { data, error, loading, reload } = usePolling<UmlandZiel>(`/api/umland/ziele/${encodeURIComponent(sel.id)}`, 10 * 60_000);

  if (loading && !data) return <DetailFallback title="Ausflugsziel" text="Der Steckbrief wird geladen …" onClose={onClose} />;
  if (!data) {
    return (
      <DetailFallback
        title="Ausflugsziel nicht gefunden"
        text={error ? 'Der Steckbrief ist derzeit nicht erreichbar.' : 'Dieses Ziel ist nicht mehr im Datensatz.'}
        onClose={onClose}
        onRetry={error ? reload : undefined}
      />
    );
  }

  const w = data.wetter;
  const cur = w?.aktuell;

  return (
    <div className="sheet-inner">
      <SheetHead eyebrow={`${tr('Ausflugsziel')} · ${data.kreisLabel}`} title={data.name} onClose={onClose}>
        <div className="umland-detail-badges">
          <span className="umland-detail-badge" style={{ color: data.farbe }}>{data.kategorieLabel}</span>
          <span className="umland-detail-badge">{data.gemeinde}</span>
          <span className="umland-detail-badge">{data.dauerMin >= 120 ? `${Math.round((data.dauerMin / 60) * 2) / 2} Stunden` : `${data.dauerMin} Minuten`}</span>
          {data.familie && <span className="umland-detail-badge">Familie</span>}
        </div>
      </SheetHead>

      <div className="sheet-body">
        {data.image && (
          <a href={data.imagePage ?? data.image} target="_blank" rel="noreferrer" title="Bild auf Wikimedia Commons">
            <img className="umland-detail-hero" src={data.image} alt={data.name} loading="lazy" />
          </a>
        )}

        <p className="umland-detail-lede">{data.kurz}</p>
        <p className="umland-detail-text">{data.beschreibung}</p>

        {!!data.highlights?.length && (
          <ul className="umland-highlights">
            {data.highlights.map((h) => <li key={h}>{h}</li>)}
          </ul>
        )}

        <dl className="facts">
          <div><dt>Landkreis</dt><dd>{data.kreisLabel}</dd></div>
          <div><dt>Gemeinde</dt><dd>{data.gemeinde}</dd></div>
          <div><dt>Zeitbedarf</dt><dd>etwa {data.dauerMin} Minuten</dd></div>
          <div><dt>Preis</dt><dd>{data.preis}</dd></div>
          <div><dt>Saison</dt><dd>{data.saison}</dd></div>
          <div><dt>Mit Kindern</dt><dd>{data.familie ? 'gut geeignet' : 'keine besondere Angabe'}</dd></div>
        </dl>

        <div className="umland-detail-actions">
          {data.website && (
            <a className="link-btn secondary" href={data.website} target="_blank" rel="noreferrer">
              <Icon name="external" size={16} /> {tr('Website des Ziels')}
            </a>
          )}
          {data.wikipedia && (
            <a className="link-btn secondary" href={`https://de.wikipedia.org/wiki/${encodeURIComponent(data.wikipedia.replace(/ /g, '_'))}`} target="_blank" rel="noreferrer">
              <Icon name="book" size={16} /> Wikipedia
            </a>
          )}
        </div>

        {cur && (
          <div className="umland-weather">
            <div className="umland-weather-top">
              <Icon name={weatherIconName(cur.icon)} size={30} />
              <div>
                <strong>{cur.temperature != null ? fmtDec(cur.temperature, 1) : '–'} °C</strong>
                <span>{cur.text}{cur.apparent != null ? `, gefühlt ${fmtDec(cur.apparent, 1)} °C` : ''}{cur.precipitation != null ? ` · ${fmtDec(cur.precipitation, 1)} mm` : ''}</span>
                <span className="muted">Modellvorhersage für den Zielpunkt{cur.t ? `, ${new Date(cur.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr` : ''}</span>
              </div>
            </div>
            {!!w?.tage?.length && (
              <div className="umland-days">
                {w.tage.map((t) => (
                  <div className="umland-day" key={t.date}>
                    <strong>{day(t.date)}</strong>
                    <Icon name={weatherIconName(t.icon)} size={18} />
                    <b>{t.min != null ? fmtDec(t.min, 0) : '–'}–{t.max != null ? fmtDec(t.max, 0) : '–'} °C</b>
                    <span>{t.text}{t.regen != null ? ` · ${Math.round(t.regen)} % Regen` : ''}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="umland-detail-note"><Icon name="info" size={14} /> {w?.source ?? 'Open-Meteo (CC BY 4.0)'}. Keine amtliche Warnung; für Warnungen das Umweltmodul öffnen.</p>
          </div>
        )}
        {!cur && data.wetterFehler && (
          <p className="umland-detail-note"><Icon name="info" size={14} /> Wetter derzeit nicht abrufbar: {data.wetterFehler}</p>
        )}

        <GettingThere lngLat={[data.lon, data.lat]} select={select} flyTo={flyTo} label={data.name} maxM={3000} />

        {data.wiki?.extract && (
          <Section title="Aus Wikipedia" aside={<a href={data.wiki.url ?? undefined} target="_blank" rel="noreferrer">Artikel <Icon name="external" size={13} /></a>}>
            <p className="umland-wiki">{data.wiki.extract}</p>
            <Source disclosure>Wikipedia, CC BY-SA 4.0; der Text kann vom redaktionellen Steckbrief abweichen.</Source>
          </Section>
        )}

        <Source disclosure>
          {data.quelle ?? data.source}. {data.lizenz ?? ''} Stand {data.stand ?? 'unbekannt'}. {data.hinweis ?? ''} Öffnungszeiten, Preise und Zugänglichkeit vor dem Besuch prüfen.
        </Source>
      </div>
    </div>
  );
}
