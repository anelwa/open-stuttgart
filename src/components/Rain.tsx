// Niederschlagsradar: Abschnitt im Umwelt-Modul und Hinweiszeile in der Haltestellenansicht.
import { useEffect, useState } from 'react';
import { useData } from '../lib/data';
import { useNow } from '../lib/api';
import { fmtDec, fmtTime } from '../lib/format';
import { nowFrame, rainOutlook, RAIN_MMH, seriesAt } from '../lib/rain';
import type { Departure } from '../lib/types';
import type { OverlayKey } from '../map/overlays';
import { Icon } from './Icon';
import { LayerRow, Section } from './ui';

function Bars({ series, now }: { series: { t: number; mmh: number }[]; now: number }) {
  const max = Math.max(1, ...series.map((s) => s.mmh));
  return (
    <div className="rain-bars" aria-hidden>
      {series.map((s) => (
        <span key={s.t} className={s.t > now ? 'fc' : ''} style={{ height: `${Math.max(4, (s.mmh / max) * 100)}%`, opacity: s.mmh >= RAIN_MMH ? 1 : 0.25 }} />
      ))}
    </div>
  );
}

/** Zeile über den Abfahrten: Niederschlag am Ort der Haltestelle in der nächsten Stunde */
export function RainLine({ lngLat, departures }: { lngLat: [number, number]; departures: Departure[] }) {
  const { radar } = useData();
  const now = useNow(30_000);
  if (!radar.data) return null;
  const series = seriesAt(radar.data, lngLat[0], lngLat[1]);
  if (!series) return null;
  const o = rainOutlook(series, now);
  const next = departures.find((d) => !d.cancelled && Date.parse(d.estimated ?? d.planned) > now);
  const nextT = next ? Date.parse(next.estimated ?? next.planned) : null;
  if (!o.raining && !o.rainFrom) {
    return <p className="rain-line dry"><Icon name="cloud" size={16} /> Radar: kein Niederschlag bis {fmtTime(o.until)} Uhr</p>;
  }
  return (
    <div className="rain-line wet">
      <Icon name="umbrella" size={20} />
      <div>
        <strong>
          {o.raining
            ? `Niederschlag (${fmtDec(o.current)} mm/h)${o.dryFrom ? `, voraussichtlich bis ${fmtTime(o.dryFrom)} Uhr` : `, anhaltend bis mindestens ${fmtTime(o.until)} Uhr`}`
            : `Niederschlag ab ca. ${fmtTime(o.rainFrom!)} Uhr`}
        </strong>
        {next && nextT && o.rainFrom && (
          <span className="small">
            Nächste Abfahrt {next.line} um {fmtTime(nextT)} Uhr, {nextT < o.rainFrom ? 'vor' : 'nach'} Niederschlagsbeginn.
          </span>
        )}
        <Bars series={series} now={now} />
        <span className="rain-scale">
          <span>{fmtTime(series[0].t)}</span>
          <span className="now" style={{ left: `${Math.min(100, Math.max(0, ((now - series[0].t) / (series[series.length - 1].t - series[0].t)) * 100))}%` }}>jetzt</span>
          <span>{fmtTime(series[series.length - 1].t)}</span>
        </span>
      </div>
    </div>
  );
}

export function RadarSection({ visible, toggle, center, radarFrame, setRadarFrame }: {
  visible: Record<OverlayKey, boolean>; toggle: (k: OverlayKey) => void; center: [number, number];
  radarFrame: number | null; setRadarFrame: (i: number | null) => void;
}) {
  const { radar } = useData();
  const now = useNow(30_000);
  const [playing, setPlaying] = useState(false);
  const r = radar.data;
  const n = r?.frames.length ?? 0;
  useEffect(() => {
    if (!playing || !n) return;
    let i = 0;
    const t = setInterval(() => { setRadarFrame(i); i += 1; if (i >= n) { i = 0; } }, 350);
    return () => clearInterval(t);
  }, [playing, n, setRadarFrame]);
  useEffect(() => () => setRadarFrame(null), [setRadarFrame]);
  if (!r || !n) return null;
  const idx = radarFrame ?? nowFrame(r, now);
  const t = Date.parse(r.frames[idx].t);
  const series = seriesAt(r, center[0], center[1]);
  const o = series ? rainOutlook(series, now) : null;
  const anyRain = r.frames.some((f) => f.v.some((row) => row.some((v) => v * 0.12 >= RAIN_MMH)));
  return (
    <Section title="Niederschlagsradar" explain="radar" aside={`${fmtTime(r.frames[0].t)} bis ${fmtTime(r.frames[n - 1].t)} Uhr`}>
      <p className="muted small">
        {!anyRain
          ? 'Im Stadtgebiet derzeit kein Niederschlag gemessen und keiner vorhergesagt.'
          : o?.raining
            ? `Am Kartenmittelpunkt Niederschlag${o.dryFrom ? `, voraussichtlich bis ${fmtTime(o.dryFrom)} Uhr` : ''}.`
            : o?.rainFrom ? `Am Kartenmittelpunkt Niederschlag ab ca. ${fmtTime(o.rainFrom)} Uhr.` : 'Am Kartenmittelpunkt kein Niederschlag bis zum Ende der Vorhersage.'}
      </p>
      <div className="sun-slider">
        <button type="button" className="play" onClick={() => { if (playing) setRadarFrame(null); setPlaying((p) => !p); }} aria-label={playing ? 'Anhalten' : 'Abspielen'}>
          <Icon name={playing ? 'pause' : 'play'} size={18} />
        </button>
        <div className="slider-wrap">
          <input type="range" min={0} max={n - 1} step={1} value={idx} aria-label="Zeitpunkt des Radarbilds"
            onChange={(e) => { setPlaying(false); setRadarFrame(Number(e.target.value)); }} />
          <div className="slider-scale">
            <span>{fmtTime(r.frames[0].t)}</span>
            <strong>{fmtTime(t)} Uhr {t > now ? '(Vorhersage)' : '(Messung)'}</strong>
            <span>{fmtTime(r.frames[n - 1].t)}</span>
          </div>
        </div>
      </div>
      <div className="sun-legend">
        <span><i className="sw" style={{ background: 'rgba(90,165,235,.6)' }} /> ab 0,1 mm/h</span>
        <span><i className="sw" style={{ background: 'rgba(40,110,220,.8)' }} /> ab 1 mm/h</span>
        <span><i className="sw" style={{ background: 'rgba(30,60,180,.9)' }} /> ab 4 mm/h</span>
        <span><i className="sw" style={{ background: 'rgba(120,40,160,.9)' }} /> ab 10 mm/h</span>
      </div>
      <div className="layer-list">
        <LayerRow icon="rain" tone="blue" title="Niederschlagsradar" on={visible.radar} onToggle={() => toggle('radar')} meta="DWD, 5-Minuten-Raster, etwa 1 km" />
      </div>
    </Section>
  );
}
