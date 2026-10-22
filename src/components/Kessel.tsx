// Austauscharme Wetterlage im Talkessel: Modell (Temperatur unten und in der Höhe) und gemessenes Höhenprofil.
import { useData } from '../lib/data';
import { useNow } from '../lib/api';
import { AIR_LABEL, fmtDec, fmtTime } from '../lib/format';
import { Section, Source } from './ui';

export interface KesselHour { t: string; t2: number; t925: number; t850: number; bl: number; wind: number; dT: number | null; level: 0 | 1 | 2 | null }
export interface Kessel {
  model: { elevation: number | null; hours: KesselHour[] } | null;
  modelError: string | null;
  profile: {
    n: number;
    scCount?: number;
    osemInProfile?: number;
    slope: number | null;
    bands: { from: number; to: number; n: number; median: number | null }[];
    opensensemap?: {
      totalBoxes: number;
      activeBoxes: number;
      medianTemp: number | null;
      medianPm10: number | null;
      boxes: { id: string; name: string; lat: number | null; lon: number | null; alt: number | null; temp: number | null; pm10: number | null; pm25: number | null; measuredAt: string | null }[];
    };
  } | null;
  profileError: string | null;
  source: string;
}

const LEVEL = ['Luftaustausch gut', 'Luftaustausch eingeschränkt', 'Inversion, Luftaustausch gering'];
const LEVEL_SHORT = ['offen', 'eingeschränkt', 'geschlossen'];
const fmtDayHour = (t: string | number) => new Intl.DateTimeFormat('de-DE', { weekday: 'short', hour: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(t));

export function KesselSection() {
  const { kessel, air } = useData();
  const now = useNow(60_000);
  const k = kessel.data;
  if (!k) return null;
  const hours = k.model?.hours ?? [];
  const cur = [...hours].reverse().find((h) => Date.parse(h.t) <= now) ?? hours[0];
  const future = hours.filter((h) => Date.parse(h.t) > now);
  const change = cur ? future.find((h) => h.level !== cur.level) : undefined;
  const p = k.profile;
  const measuredInv = p?.slope != null ? p.slope > 0 : null;
  const modelInv = cur?.dT != null ? cur.dT >= 0 : null;
  const temps = (p?.bands ?? []).map((b) => b.median).filter((x): x is number => x != null);
  const tMin = Math.min(...temps) - 0.5, tMax = Math.max(...temps) + 0.5;
  const worst = (air.data?.stations ?? []).reduce<number | null>((m, s) => (s.index == null ? m : m == null || s.index > m ? s.index : m), null);

  return (
    <Section title="Luftaustausch im Talkessel" explain="kessel" aside={cur ? `Stand ${fmtTime(cur.t)} Uhr` : undefined}>
      <p className="muted small kessel-intro">
        Liegt wärmere Luft über kälterer Luft (Inversion), werden Luftschadstoffe im Talkessel schlechter abtransportiert.
      </p>
      {cur?.level != null && (
        <div className={`kessel-state lvl-${cur.level}`}>
          <strong>{LEVEL[cur.level]}</strong>
          <span className="small">
            {change ? `Voraussichtlich ${LEVEL_SHORT[change.level ?? 0]} ab ${fmtDayHour(change.t)}.` : 'Keine Änderung in den nächsten 48 Stunden erwartet.'}
          </span>
        </div>
      )}
      {cur && (
        <dl className="facts compact-facts">
          <div><dt>Temperatur 2 m</dt><dd>{fmtDec(cur.t2)} °C</dd></div>
          <div><dt>Temperatur 925 hPa (ca. 800 m)</dt><dd>{fmtDec(cur.t925)} °C ({cur.dT != null && cur.dT >= 0 ? '+' : ''}{fmtDec(cur.dT ?? 0)} K)</dd></div>
          <div><dt>Grenzschichthöhe</dt><dd>{Math.round(cur.bl)} m</dd></div>
          <div><dt>Wind 10 m</dt><dd>{Math.round(cur.wind)} km/h</dd></div>
          {worst != null && <div><dt>Luftqualität (ungünstigste Station)</dt><dd>{AIR_LABEL[worst]}</dd></div>}
        </dl>
      )}
      {future.length > 0 && (
        <div className="kessel-strip" aria-label="Vorhersage Luftaustausch 48 Stunden">
          {future.filter((_, i) => i % 2 === 0).map((h) => (
            <span key={h.t} className={`lvl-${h.level ?? 0}`} title={`${fmtDayHour(h.t)}: ${LEVEL_SHORT[h.level ?? 0]}`} />
          ))}
        </div>
      )}
      {future.length > 0 && (
        <div className="slider-scale"><span>{fmtDayHour(future[0].t)}</span><span>{fmtDayHour(future[future.length - 1].t)}</span></div>
      )}
      {k.modelError && !k.model && <p className="muted small">Modelldaten derzeit nicht verfügbar.</p>}

      {p && p.n > 0 && (
        <>
          <h4 className="list-head">
            Gemessenes Höhenprofil, {p.n} Sensoren
            {p.osemInProfile ? ` (${p.scCount ?? p.n - p.osemInProfile} Sensor.Community, ${p.osemInProfile} openSenseMap)` : ''}
          </h4>
          <ul className="profile">
            {[...p.bands].reverse().map((b) => (
              <li key={b.from}>
                <span className="alt">{b.from}–{b.to} m</span>
                <span className="bar">{b.median != null && <span style={{ width: `${Math.max(6, ((b.median - tMin) / (tMax - tMin || 1)) * 100)}%` }} />}</span>
                <span className="val">{b.median != null ? `${fmtDec(b.median)} °C` : '–'}<small> ({b.n})</small></span>
              </li>
            ))}
          </ul>
          {p.slope != null && (
            <p className="muted small">
              Temperaturänderung mit der Höhe: {p.slope > 0 ? '+' : ''}{fmtDec(p.slope, 2)} K je 100 m
              {measuredInv ? ' (Zunahme nach oben: Inversion gemessen).' : ' (Abnahme nach oben: keine Inversion in Bodennähe).'}
              {measuredInv != null && modelInv != null && measuredInv !== modelInv && ' Messung und Modell weichen voneinander ab.'}
            </p>
          )}
          {p.opensensemap && p.opensensemap.totalBoxes > 0 && (
            <p className="muted small">
              openSenseMap im Stadtgebiet: {p.opensensemap.activeBoxes} von {p.opensensemap.totalBoxes} Umweltmessboxen senden aktuell
              {p.opensensemap.medianTemp != null ? ` · Median Temperatur ${fmtDec(p.opensensemap.medianTemp)} °C` : ''}
              {p.opensensemap.medianPm10 != null ? ` · Median PM10 ${fmtDec(p.opensensemap.medianPm10)} µg/m³` : ''}.
            </p>
          )}
        </>
      )}
      <Source>
        Modell: Open-Meteo (CC BY 4.0). Messung: Bürgersensoren von Sensor.Community (ODbL) und openSenseMap (Universität Münster / ifgi, CC BY 4.0), Median je Höhenband,
        Ausreißer über 3 K entfernt. Einfache Sensoren können durch Sonneneinstrahlung zu hohe Werte liefern.
      </Source>
    </Section>
  );
}
