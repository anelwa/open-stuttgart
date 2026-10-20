import { useData } from '../../lib/data';
import { AIR_COLOR, AIR_LABEL, WEATHER_LABEL, compass, fmtDec, fmtTime, ubaHour, ago } from '../../lib/format';
import { LayerRow, Section, Source, ErrorNote } from '../../components/ui';
import { Icon, weatherIconName } from '../../components/Icon';
import { Sparkline } from '../../components/Sparkline';
import type { ModuleProps } from '../types';
import { RadarSection } from '../../components/Rain';
import { KesselSection } from '../../components/Kessel';
import { HealthEnergy } from '../../components/HealthEnergy';

export function EnvironmentPanel({ visible, toggle, select, flyTo, center, radarFrame, setRadarFrame }: ModuleProps) {
  const { weather, air, water } = useData();
  const w = weather.data;
  const stations = air.data?.stations ?? [];
  const withData = stations.filter((s) => s.index != null);
  const worst = withData.reduce<number | null>((m, s) => (m == null || (s.index ?? 0) > m ? s.index : m), null);

  return (
    <div className="module">
      <Section title="Wetter, aktuelle Messung" explain="wetter" aside={w ? `${w.station.replace(/\s*\(.*/, '')}, ${fmtTime(w.measuredAt)}` : undefined}>
        {weather.error && !w && <ErrorNote text="Wetterdaten gerade nicht erreichbar." onRetry={weather.reload} />}
        {!w && !weather.error && <div className="skeleton block" />}
        {w && (
          <div className="weather-card">
            <div className="weather-main">
              <Icon name={weatherIconName(w.icon)} size={44} className="weather-icon" />
              <div>
                <div className="temp">{fmtDec(w.temperature)}<span>°C</span></div>
                <div className="cond">{WEATHER_LABEL[w.icon] ?? w.condition}</div>
              </div>
            </div>
            <dl className="weather-facts">
              <div><dt><Icon name="wind" size={15} /> Wind</dt><dd>{Math.round(w.wind)} km/h {compass(w.windDirection)}</dd></div>
              <div><dt><Icon name="drop" size={15} /> Feuchte</dt><dd>{w.humidity} %</dd></div>
              <div><dt><Icon name="rain" size={15} /> Regen 1 h</dt><dd>{fmtDec(w.precipitation ?? 0)} mm</dd></div>
            </dl>
            {w.forecast.length > 0 && (
              <ol className="forecast" aria-label="Vorhersage nächste 24 Stunden">
                {w.forecast.map((f) => (
                  <li key={f.t}>
                    <span className="f-time">{fmtTime(f.t)}</span>
                    <Icon name={weatherIconName(f.icon)} size={18} />
                    <span className="f-temp">{Math.round(f.temperature)}°</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        {w?.alerts.map((a) => (
          <div key={a.headline + a.onset} className="alert-card" role="alert">
            <Icon name="warn" size={18} />
            <div><strong>{a.headline}</strong><p>{fmtTime(a.onset)} bis {fmtTime(a.expires)}</p></div>
          </div>
        ))}
      </Section>

      <RadarSection visible={visible} toggle={toggle} center={center} radarFrame={radarFrame} setRadarFrame={setRadarFrame} />

      <Section title="Luftqualität" explain="luft" aside={air.updatedAt ? ago(air.updatedAt) : undefined}>
        {air.error && !air.data && <ErrorNote text="Luftdaten gerade nicht erreichbar." onRetry={air.reload} />}
        {worst != null && (
          <p className="air-summary">
            Die Luft ist derzeit höchstens <strong>{AIR_LABEL[worst]}</strong>, gemessen an der am stärksten belasteten Station.
          </p>
        )}
        <ul className="air-list">
          {stations.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => { select({ type: 'air', id: s.id }); flyTo([s.lon, s.lat], 14); }}>
                <span className="air-idx" style={{ background: s.index != null ? AIR_COLOR[s.index] : 'var(--line)' }} aria-hidden />
                <span className="air-name">
                  {s.name}
                  <small>{s.type}{s.measuredAt ? ` · bis ${ubaHour(s.measuredAt)} Uhr` : ''}</small>
                </span>
                <span className="air-val">{s.index != null ? AIR_LABEL[s.index] : 'keine Werte'}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="air-scale" aria-label="Skala Luftqualitätsindex des Umweltbundesamts">
          <div className="air-scale-bar">{AIR_LABEL.map((l, i) => <span key={l} style={{ background: AIR_COLOR[i] }} title={l} />)}</div>
          <div className="air-scale-lbl"><small>sehr gut</small><small>sehr schlecht</small></div>
        </div>
      </Section>

      <KesselSection />
      <HealthEnergy />

      <Section title="Neckar" explain="pegel" aside={water.data ? `Pegel Cannstatt, ${fmtTime(water.data.measuredAt)}` : undefined}>
        {water.error && !water.data && <ErrorNote text="Pegeldaten gerade nicht erreichbar." onRetry={water.reload} />}
        {water.data && (
          <button type="button" className="water-card" onClick={() => { select({ type: 'water' }); flyTo([water.data!.lon, water.data!.lat], 14); }}>
            <span className="water-val">{water.data.value}<small> cm</small></span>
            <Sparkline values={water.data.series.map((s) => s.v)} width={140} height={40} color="var(--water)" label="Wasserstand der letzten 24 Stunden" />
            <span className="muted small">{water.data.state === 'normal' ? 'Normaler Wasserstand' : `Status: ${water.data.state}`}, Verlauf 24 Stunden</span>
          </button>
        )}
      </Section>

      <Section title="Auf der Karte">
        <div className="layer-list">
          <LayerRow icon="air" tone="green" title="Luftmessstellen" on={visible.air} onToggle={() => toggle('air')} meta={`${withData.length} von ${stations.length || 4} liefern aktuelle Werte`} />
          <LayerRow icon="water" tone="blue" title="Pegel Neckar" on={visible.water} onToggle={() => toggle('water')} meta="Wasserstand, alle 15 Minuten" />
        </div>
      </Section>

      <Source>
        Wetter: Deutscher Wetterdienst über Bright Sky. Luft: Umweltbundesamt mit Daten der LUBW (dl-de/by-2-0), Index nach UBA.
        Pegel: WSV, PEGELONLINE. Die Station Am Neckartor liefert seit August 2026 keine Werte.
      </Source>
    </div>
  );
}
