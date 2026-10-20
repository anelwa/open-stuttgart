import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModuleProps } from '../types';
import { useData } from '../../lib/data';
import { useNow } from '../../lib/api';
import { useStops } from '../../lib/stops';
import { nearestStops } from '../../lib/geo';
import { berlinDate, fmtTime } from '../../lib/format';
import { weatherAt } from '../../lib/weather';
import { shadeImage, sunAt, useSunDay, type SunPoint } from '../../lib/useSun';
import type { Viewpoint } from '../../lib/sunWorker';
import { Icon } from '../../components/Icon';
import { ErrorNote, LayerRow, Section, Source } from '../../components/ui';

// Höhenzüge, die in Wikidata nicht als Aussichtspunkt geführt sind; Lage wird auf den höchsten Punkt in der Nähe gezogen
const HILLS: Viewpoint[] = [
  { id: 'birkenkopf', name: 'Birkenkopf', lat: 48.7699, lon: 9.1314, snap: true },
  { id: 'karlshoehe', name: 'Karlshöhe', lat: 48.7656, lon: 9.1640, snap: true },
  { id: 'uhlandshoehe', name: 'Uhlandshöhe', lat: 48.7830, lon: 9.1960, snap: true },
  { id: 'bismarckturm', name: 'Bismarckturm', lat: 48.7955, lon: 9.1700, snap: true },
  { id: 'wuerttemberg', name: 'Grabkapelle Württemberg', lat: 48.7886, lon: 9.2708, snap: true },
];
// Aussichtsplattform des Fernsehturms in rund 150 m Höhe; alle anderen Orte in Augenhöhe am Boden gerechnet
const EYE: Record<string, number> = { 'Stuttgarter Fernsehturm': 150 };

const min = (ms: number) => Math.round(ms / 60_000);

export function SunPanel({ visible, toggle, setLayer, setSunImage, flyTo, select, center }: ModuleProps) {
  const { places, weather } = useData();
  const stops = useStops();
  const now = useNow(30_000);
  const today = berlinDate(now);
  const viewpoints = useMemo<Viewpoint[] | null>(() => {
    if (!places.data) return null;
    const wd = places.data.places.filter((p) => p.kind === 'aussicht' && p.name !== 'Eugensplatz')
      .map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, eye: EYE[p.name] }));
    return [...HILLS, ...wd];
  }, [places.data]);

  // Nach Sonnenuntergang geht es um den nächsten Morgen
  const [date, setDate] = useState(today);
  const { day, error } = useSunDay(date, viewpoints);
  const [mode, setMode] = useState<'abend' | 'morgen'>('abend');
  useEffect(() => {
    if (day && date === today && now > day.set + 15 * 60_000) { setDate(berlinDate(now + 86400_000)); setMode('morgen'); }
  }, [day, date, today, now]);

  const range = useMemo<[number, number] | null>(() => {
    if (!day) return null;
    return mode === 'abend' ? [day.set - 3 * 3600_000, day.set] : [day.rise, day.rise + 3 * 3600_000];
  }, [day, mode]);
  const [t, setT] = useState<number | null>(null);
  useEffect(() => {
    if (!range) return;
    const [a, b] = range;
    setT(now > a && now < b ? Math.round(now / 120_000) * 120_000 : mode === 'abend' ? b - 60 * 60_000 : a + 30 * 60_000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // Ebene beim Öffnen einblenden, beim Verlassen wieder aus
  useEffect(() => {
    setLayer('sun', true);
    return () => { setLayer('sun', false); setSunImage(null); };
  }, [setLayer, setSunImage]);
  useEffect(() => {
    if (day && t != null) setSunImage(shadeImage(day, t, mode));
  }, [day, t, mode, setSunImage]);

  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing || !range) return;
    timer.current = setInterval(() => {
      setT((x) => {
        const n = (x ?? range[0]) + 2 * 60_000;
        if (n >= range[1]) { setPlaying(false); return range[1]; }
        return n;
      });
    }, 90);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, range]);

  // Sonnenzeiten am Kartenmittelpunkt
  const [here, setHere] = useState<{ set: number; rise: number; h: number; c: [number, number] } | null>(null);
  useEffect(() => {
    if (!day) return;
    let live = true;
    const c = center;
    const id = setTimeout(() => sunAt(date, c[1], c[0]).then((r) => { if (live) setHere({ ...r, c }); }), 250);
    return () => { live = false; clearTimeout(id); };
  }, [center, date, day]);
  const hereStop = useMemo(() => (here ? nearestStops(stops, here.c, 1, 3000)[0] : undefined), [here, stops]);

  const astro = day ? (mode === 'abend' ? day.set : day.rise) : null;
  const cloudHour = astro ? weatherAt(weather.data, mode === 'abend' ? astro - 45 * 60_000 : astro + 45 * 60_000) : null;
  const cloud = cloudHour?.cloud ?? null;

  const list = useMemo(() => {
    if (!day) return [];
    const pts = day.points.filter((p) => !Number.isNaN(mode === 'abend' ? p.set : p.rise));
    return pts.sort((a, b) => (mode === 'abend' ? b.set - a.set : a.rise - b.rise));
  }, [day, mode]);
  const stopFor = (p: SunPoint) => nearestStops(stops, [p.lon, p.lat], 1, 2500)[0];

  const hereT = here ? (mode === 'abend' ? here.set : here.rise) : NaN;
  const isTomorrow = date !== today;

  return (
    <div className="module">
      <div className="culture-hero sun-hero">
        <span className="eyebrow">{mode === 'abend' ? 'Sonnenuntergang im Gelände' : isTomorrow ? 'Sonnenaufgang im Gelände, morgen' : 'Sonnenaufgang im Gelände'}</span>
        {!day && !error && <h3>Berechnung läuft …</h3>}
        {day && here && (
          <h3>
            {Number.isNaN(hereT)
              ? 'Kartenmittelpunkt: im Berechnungszeitraum verschattet'
              : mode === 'abend'
                ? <>Kartenmittelpunkt: Sonne bis {fmtTime(hereT)} Uhr</>
                : <>Kartenmittelpunkt: Sonne ab {fmtTime(hereT)} Uhr</>}
          </h3>
        )}
        {day && here && !Number.isNaN(hereT) && astro && (
          <p className="hero-line">
            <Icon name="sunset" size={18} />
            <span>
              {mode === 'abend' ? `${min(astro - hereT)} min vor dem astronomischen Sonnenuntergang (${fmtTime(astro)} Uhr)` : `${min(hereT - astro)} min nach dem astronomischen Sonnenaufgang (${fmtTime(astro)} Uhr)`}
              . Geländehöhe {Math.round(here.h)} m{hereStop && <>, nächste Haltestelle {hereStop.stop.properties.name}</>}.
            </span>
          </p>
        )}
        {cloud != null && (
          <p className="hero-line">
            <Icon name="cloud" size={18} />
            <span>
              {cloud >= 85 ? `Bewölkung ${cloud} %: Sonne voraussichtlich nicht sichtbar. Die Zeiten gelten für wolkenlosen Himmel.`
                : cloud >= 50 ? `Bewölkung ${cloud} %: Sonne zeitweise sichtbar.` : `Bewölkung ${cloud} %.`}
            </span>
          </p>
        )}
      </div>

      {error && <ErrorNote text={`Höhenmodell nicht verfügbar: ${error}`} />}

      <Section title="Verschattung durch das Gelände" explain="sonne" aside={day ? `${(day.cols * day.rows).toLocaleString("de-DE")} Punkte gerechnet` : undefined}>
        <div className="seg sun-seg" role="tablist" aria-label="Tageszeit">
          <button role="tab" aria-selected={mode === 'abend'} className={mode === 'abend' ? 'active' : ''} onClick={() => setMode('abend')}>Abend</button>
          <button role="tab" aria-selected={mode === 'morgen'} className={mode === 'morgen' ? 'active' : ''} onClick={() => setMode('morgen')}>Morgen</button>
        </div>
        {range && t != null ? (
          <div className="sun-slider">
            <button type="button" className="play" onClick={() => { if (!playing && t >= range[1]) setT(range[0]); setPlaying((p) => !p); }} aria-label={playing ? 'Anhalten' : 'Abspielen'}>
              <Icon name={playing ? 'pause' : 'play'} size={18} />
            </button>
            <div className="slider-wrap">
              <input type="range" min={range[0]} max={range[1]} step={120_000} value={t} aria-label="Uhrzeit"
                onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} />
              <div className="slider-scale"><span>{fmtTime(range[0])}</span><strong>{fmtTime(t)} Uhr</strong><span>{fmtTime(range[1])}</span></div>
            </div>
          </div>
        ) : !error && <span className="skeleton block" style={{ height: 56 }} />}
        <div className="sun-legend">
          <span><i className="sw sun" /> besonnt</span>
          <span><i className="sw shade" /> verschattet</span>
        </div>
        <div className="layer-list">
          <LayerRow icon="sunset" tone="amber" title="Besonnung" on={visible.sun} onToggle={() => toggle('sun')}
            meta="Höhenmodell, ohne Gebäude und Bäume" />
        </div>
      </Section>

      <Section title="Aussichtspunkte und Höhenlagen" aside={mode === 'abend' ? 'Sonne bis' : 'Sonne ab'}>
        {!day && !error && <span className="skeleton block" style={{ height: 200 }} />}
        <ul className="near-list sun-list">
          {list.map((p) => {
            const tt = mode === 'abend' ? p.set : p.rise;
            const s = stopFor(p);
            const gone = mode === 'abend' && !isTomorrow && now > tt;
            const diff = !Number.isNaN(hereT) ? (mode === 'abend' ? min(tt - hereT) : min(hereT - tt)) : null;
            return (
              <li key={p.id} className={gone ? 'gone' : ''}>
                <button type="button" onClick={() => { flyTo([p.lon, p.lat], 15); if (!HILLS.some((h) => h.id === p.id)) select({ type: 'place', id: p.id }); }}>
                  <span className="sun-time"><strong>{fmtTime(tt)}</strong>{diff != null && diff > 0 && <small>+{diff} min</small>}</span>
                  <span className="near-main">
                    <span className="near-name">{p.name}</span>
                    <span className="near-sub">
                      {Math.round(p.h)} m{p.eye ? `, Plattform ${p.eye} m` : ''}
                      {s && <> · {s.stop.properties.name}, {s.walk} min Fußweg</>}
                      {gone && <> · bereits verschattet</>}
                    </span>
                  </span>
                  <Icon name="chevron" size={16} className="muted" />
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Source>
        Eigene Rechnung: Sonnenstand nach suncalc-Formeln, Horizont aus dem Höhenmodell (Mapzen Terrain Tiles, rund 25 m Raster, bis 6 km Entfernung).
        Gebäude und Bäume fehlen im Modell, in der Innenstadt verschwindet die Sonne daher oft noch früher. Bewölkung: DWD über Bright Sky.
      </Source>
    </div>
  );
}
