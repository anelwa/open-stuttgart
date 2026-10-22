import { useData } from '../../lib/data';
import { usePolling } from '../../lib/api';
import { AIR_COLOR, AIR_LABEL, WEATHER_LABEL, compass, fmtDec, fmtTime, ubaHour, ago } from '../../lib/format';
import { distM } from '../../lib/geo';
import type { Facility, NinaWarnung } from '../../lib/types';
import { LayerRow, Section, Source, ErrorNote } from '../../components/ui';
import { Icon, weatherIconName } from '../../components/Icon';
import { Sparkline } from '../../components/Sparkline';
import type { ModuleProps } from '../types';
import { RadarSection } from '../../components/Rain';
import { KesselSection } from '../../components/Kessel';
import { HealthEnergy } from '../../components/HealthEnergy';
import { NaturSection } from '../../components/Natur';
import { Pollenkarte } from '../../components/Pollenkarte';

export function EnvironmentPanel({ visible, toggle, select, flyTo, center, radarFrame, setRadarFrame }: ModuleProps) {
  const { weather, air, water, warnungen, flug, kaltluft, kessel } = useData();
  const notfall = usePolling<{ items: Facility[] }>('/api/nearby/facilities?cat=notfall', 24 * 3600_000);
  const w = weather.data;
  const stations = air.data?.stations ?? [];
  const withData = stations.filter((s) => s.index != null);
  const worst = withData.reduce<number | null>((m, s) => (m == null || (s.index ?? 0) > m ? s.index : m), null);
  const nextLeuchtturm = (notfall.data?.items ?? [])
    .filter((f) => f.info?.includes('Notfall-Leuchtturm'))
    .map((f) => ({ f, d: Math.round(distM(center, [f.lon, f.lat])) }))
    .sort((a, b) => a.d - b.d)[0] ?? null;
  const warnList: NinaWarnung[] = warnungen.data?.items ?? [];
  const luft = flug.data;
  const helis = luft?.hubschrauber ?? [];
  const warm = w ? w.temperature >= 22 : false;
  const inversion = (kessel.data?.model?.hours ?? []).some((h) => h.level === 2
    && Date.parse(h.t) >= Date.now() - 3600_000 && Date.parse(h.t) <= Date.now() + 6 * 3600_000);

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

      <Section title="Bevölkerungsschutz (BBK / NINA)" explain="warnungen">
        {warnList.length === 0 ? (
          <p className="muted small">
            Derzeit liegt für Stuttgart keine amtliche Gefahrenmeldung über MoWaS, KATWARN oder BIWAPP vor.
            {nextLeuchtturm && (
              <> Nächster Notfall-Leuchtturm mit Notstrom ab Kartenmitte: <button type="button" className="link-quiet" onClick={() => { select({ type: 'facility', item: nextLeuchtturm.f }); flyTo([nextLeuchtturm.f.lon, nextLeuchtturm.f.lat], 15.5); }}>{nextLeuchtturm.f.name}</button> ({nextLeuchtturm.d} m).</>
            )}
          </p>
        ) : (
          <div className="nina-list">
            {warnList.map((m) => (
              <div key={m.id} className="alert-card" role="alert">
                <Icon name="warn" size={18} />
                <div>
                  <strong>{m.title}</strong>
                  <p className="small">{m.provider}{m.sent ? ` · ${fmtTime(m.sent)} Uhr` : ''}{m.expires ? ` bis ${fmtTime(m.expires)} Uhr` : ''} · {m.area}</p>
                  {m.description && <p className="small">{m.description.slice(0, 260)}{m.description.length > 260 ? ' …' : ''}</p>}
                  {m.instruction && <p className="small"><strong>Handlungsempfehlung:</strong> {m.instruction.slice(0, 220)}{m.instruction.length > 220 ? ' …' : ''}</p>}
                  {m.polygon && (
                    <p className="small">
                      Das betroffene Gebiet ist auf der Karte als Fläche eingezeichnet.
                      {m.notfall?.treffpunkt && (
                        <> Nächster Notfall-Treffpunkt außerhalb des Gebiets:{' '}
                          <button type="button" className="link-quiet" onClick={() => { select({ type: 'facility', item: m.notfall!.treffpunkt! }); flyTo([m.notfall!.treffpunkt!.lon, m.notfall!.treffpunkt!.lat], 15.5); }}>
                            {m.notfall.treffpunkt.name} ({m.notfall.treffpunkt.dist} m)
                          </button>
                        </>
                      )}
                      {m.notfall?.leuchtturm && (
                        <> · Leuchtturm mit Notstrom:{' '}
                          <button type="button" className="link-quiet" onClick={() => { select({ type: 'facility', item: m.notfall!.leuchtturm! }); flyTo([m.notfall!.leuchtturm!.lon, m.notfall!.leuchtturm!.lat], 15.5); }}>
                            {m.notfall.leuchtturm.name}
                          </button>
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {!warnList.some((m) => m.polygon) && nextLeuchtturm && (
              <p className="small">
                Nächste Anlaufstelle mit Notstrom (Notfall-Leuchtturm):{' '}
                <button type="button" className="link-quiet" onClick={() => { select({ type: 'facility', item: nextLeuchtturm.f }); flyTo([nextLeuchtturm.f.lon, nextLeuchtturm.f.lat], 15.5); }}>
                  {nextLeuchtturm.f.name} ({nextLeuchtturm.d} m)
                </button>
              </p>
            )}
          </div>
        )}
      </Section>

      <Section title="Himmel über Stuttgart" explain="flug" aside={luft ? `ADS-B, ${fmtTime(luft.fetchedAt)}` : undefined}>
        {luft?.edds && (
          <p className="small">
            Flughafen Stuttgart (EDDS): {luft.edds.betriebsrichtung ? `Betriebsrichtung ${luft.edds.betriebsrichtung}` : 'Betriebsrichtung derzeit nicht bestimmbar'}
            {luft.edds.windKt != null && luft.edds.windDir != null ? `, Wind ${Math.round(luft.edds.windKt * 1.852)} km/h ${compass(luft.edds.windDir)}` : ''}.{' '}
            {luft.edds.hinweis}
          </p>
        )}
        {luft?.iss && (
          <p className="small">
            <strong>ISS:</strong> {luft.iss.altKm != null ? `${luft.iss.altKm.toLocaleString('de-DE')} km Höhe` : 'Position bekannt'}
            {luft.iss.distance != null ? `, ${luft.iss.distance.toLocaleString('de-DE')} km von Stuttgart entfernt` : ''}
            {luft.iss.visibility === 'daylight' ? ' · im Sonnenlicht' : luft.iss.visibility === 'eclipsed' ? ' · im Erdschatten' : ''}
            {luft.iss.velocityKmh != null ? ` · ${luft.iss.velocityKmh.toLocaleString('de-DE')} km/h` : ''}.
            {' '}Die Raumstation ist keine Bedrohung und kein Einsatzflug – nur ein öffentlich verfolgtes Objekt am Himmel.
          </p>
        )}
        {luft?.sonden && luft.sonden.length > 0 ? (
          <p className="small">
            <strong>Wetterballons:</strong> {luft.sonden.length === 1 ? 'Ein Radiosonde-' : `${luft.sonden.length} Radiosonden-`}Signal
            im Umkreis von 300 km, zuletzt gehört von der SondeHub-Community
            {luft.sonden[0] ? ` – die nächste bei ${luft.sonden[0].distance.toLocaleString('de-DE')} km, ${luft.sonden[0].altM != null ? `${luft.sonden[0].altM.toLocaleString('de-DE')} m Höhe` : 'Höhe unbekannt'}${luft.sonden[0].tempC != null ? `, ${luft.sonden[0].tempC.toLocaleString('de-DE')} °C` : ''}` : ''}.
          </p>
        ) : <p className="muted small">Derzeit keine Radiosonde im Umkreis von 300 km empfangen.</p>}
        {luft?.mond && (
          <p className="small"><strong>Mond:</strong> {luft.mond.name}, {luft.mond.illumination} % beleuchtet. Die Mondphase wird aus dem Datum berechnet, nicht live gemessen.</p>
        )}
        {helis.length > 0 ? (
          <p className="small">
            <Icon name="warn" size={14} /> {helis.length === 1 ? 'Ein Hubschrauber ist' : `${helis.length} Hubschrauber sind`} gerade im Luftraum über der Region:{' '}
            {helis.slice(0, 3).map((a) => `${a.callsign ?? a.reg ?? a.type ?? 'Hubschrauber'}${a.altFt != null ? ` auf ${a.altFt.toLocaleString('de-DE')} ft` : ''}`).join(', ')}.
          </p>
        ) : (
          <p className="muted small">Derzeit kein Hubschrauber im Umkreis von 30 km gemeldet.</p>
        )}
        <ul className="near-list">
          {(luft?.aircraft ?? []).slice(0, 5).map((a) => (
            <li key={a.hex}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
                <span className="near-main">
                  <span className="near-name">{a.callsign ?? a.reg ?? a.type ?? 'Flugzeug'}{a.type ? ` · ${a.type}` : ''}</span>
                  <span className="near-sub">
                    {a.altFt != null ? `${a.altFt.toLocaleString('de-DE')} ft` : 'Höhe unbekannt'}
                    {a.gsKt != null ? ` · ${Math.round(a.gsKt * 1.852)} km/h` : ''}
                    {a.niedrig ? ' · tief über der Stadt' : ''}
                    {a.heli ? ' · Hubschrauber' : ''}
                    {a.dist != null ? ` · ${a.dist < 1000 ? `${a.dist} m` : `${(a.dist / 1000).toFixed(1)} km`}` : ''}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
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

      {(warm || inversion) && (
        <Section title="Abendspaziergang in der kühlen Brise" explain="kaltluft">
          <p className="small">
            {warm ? 'Bei der heutigen Wärme' : 'Bei der austauscharmen Wetterlage'} ziehen nachts Kaltluftströme durch die Täler des Kessels
            (Nesenbachtal, Feuerbachtal, Kräherwald). Die Ebene „Kaltluftabfluss“ zeigt die Strömungspfeile aus dem Klimaatlas der Stadt.
          </p>
          <button type="button" className={`chip ${visible.kaltluft ? 'on' : ''}`} aria-pressed={visible.kaltluft} onClick={() => toggle('kaltluft')}>
            <Icon name="wind" size={16} /> Kaltluftschneisen auf der Karte {visible.kaltluft ? 'ausblenden' : 'einblenden'}
          </button>
          <p className="muted small">
            {kaltluft.data ? `${kaltluft.data.anzahl} Rasterpunkte mit Richtung und Geschwindigkeit des nächtlichen Kaltluftabflusses.` : 'Kaltluftdaten werden geladen.'}
          </p>
        </Section>
      )}

      <HealthEnergy />

      <NaturSection center={center} flyTo={flyTo} />

      <Pollenkarte flyTo={flyTo} />

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

      <Section title="Auf der Karte" collapsible defaultOpen={false}>
        <div className="layer-list">
          <LayerRow icon="air" tone="green" title="Luftmessstellen" on={visible.air} onToggle={() => toggle('air')} meta={`${withData.length} von ${stations.length || 4} liefern aktuelle Werte`} />
          <LayerRow icon="water" tone="blue" title="Pegel Neckar" on={visible.water} onToggle={() => toggle('water')} meta="Wasserstand, alle 15 Minuten" />
          <LayerRow icon="warn" tone="amber" title="Warngebiete (NINA / MoWaS)" on={visible.warnung} onToggle={() => toggle('warnung')}
            meta={warnList.length ? `${warnList.length} aktive Meldung(en), Gebiet als Fläche` : 'derzeit keine aktive Meldung'} />
          <LayerRow icon="mobility" tone="ink" title="Flugverkehr (ADS-B)" on={visible.flug} onToggle={() => toggle('flug')}
            meta={luft ? `${luft.count} Luftfahrzeuge im Umkreis von 30 km${helis.length ? `, davon ${helis.length} Hubschrauber` : ''}` : 'wird geladen'} />
          <LayerRow icon="wind" tone="blue" title="Kaltluftabfluss (Klimaatlas)" on={visible.kaltluft} onToggle={() => toggle('kaltluft')}
            meta={kaltluft.data ? `${kaltluft.data.anzahl} Strömungspfeile` : 'wird geladen'} />
        </div>
      </Section>

      <Source disclosure>
        Wetter: Deutscher Wetterdienst über Bright Sky. Bevölkerungsschutz: Bundesamt für Bevölkerungsschutz und Katastrophenhilfe (BBK, NINA/MoWaS, dl-de/by-2-0),
        Notfall-Treffpunkte: Landeshauptstadt Stuttgart (CC BY 4.0). Luft: Umweltbundesamt mit Daten der LUBW (dl-de/by-2-0), Index nach UBA.
        Pegel: WSV, PEGELONLINE. Die Station Am Neckartor liefert seit August 2026 keine Werte.
        Flugverkehr: adsb.lol (ODbL) und METAR des NOAA Aviation Weather; Betriebsrichtung abgeleitet aus dem Wind. Wetterballons: SondeHub (offene Community-Empfänge). ISS: wheretheiss.at (Open Data). Mondphase berechnet.
        Kaltluft: Klimaatlas der Stadt (CC BY 4.0). Artenbeobachtungen: iNaturalist (CC BY 4.0).
      </Source>
    </div>
  );
}

