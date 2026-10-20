// Rechnet im Hintergrund, wann das Gelände die Sonne verdeckt: für ein Gitter über Stuttgart und für einzelne Orte.
// Höhenmodell: Mapzen-Terrarium-Kacheln (dieselben wie das Kartenrelief), Zoom 12, rund 25 m je Pixel.
import { GRID, LIMB, noonOf, sunPosition, sunTimes } from './sun';

const Z = 12;
const N = 2 ** Z * 256;
const TILE_URL = (x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
const tiles = new Map<string, Float32Array>();

const AREA = { w: GRID.w - 0.09, e: GRID.e + 0.09, s: GRID.s - 0.06, n: GRID.n + 0.06 };
const CENTER = { lat: 48.7784, lon: 9.18 };
const STEP = 2 * 60_000;
const EYE = 1.7;
const R = 6371000 / (1 - 0.13); // Erdkrümmung, um die übliche Refraktion entschärft

const px = (lon: number) => ((lon + 180) / 360) * N;
const py = (lat: number) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * N; };

async function loadTile(x: number, y: number) {
  const res = await fetch(TILE_URL(x, y));
  if (!res.ok) throw new Error(`Höhenkachel ${x}/${y}: ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  const c = new OffscreenCanvas(256, 256);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, 256, 256).data;
  const h = new Float32Array(256 * 256);
  for (let i = 0; i < h.length; i++) h[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
  tiles.set(`${x}/${y}`, h);
}

async function loadArea() {
  if (tiles.size) return;
  const x0 = Math.floor(px(AREA.w) / 256), x1 = Math.floor(px(AREA.e) / 256);
  const y0 = Math.floor(py(AREA.n) / 256), y1 = Math.floor(py(AREA.s) / 256);
  const jobs: [number, number][] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push([x, y]);
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < jobs.length) { const [x, y] = jobs[next++]; await loadTile(x, y); }
  }));
}

function rawAt(X: number, Y: number) {
  const tx = Math.floor(X / 256), ty = Math.floor(Y / 256);
  const t = tiles.get(`${tx}/${ty}`);
  if (!t) return NaN;
  return t[(Math.floor(Y) - ty * 256) * 256 + (Math.floor(X) - tx * 256)];
}

/** Geländehöhe mit bilinearer Interpolation */
function elev(lat: number, lon: number) {
  const X = px(lon) - 0.5, Y = py(lat) - 0.5;
  const fx = Math.floor(X), fy = Math.floor(Y), ax = X - fx, ay = Y - fy;
  const a = rawAt(fx, fy), b = rawAt(fx + 1, fy), c = rawAt(fx, fy + 1), d = rawAt(fx + 1, fy + 1);
  return (a * (1 - ax) + b * ax) * (1 - ay) + (c * (1 - ax) + d * ax) * ay;
}

const DIST: number[] = [];
for (let d = 40; d <= 1000; d += 40) DIST.push(d);
for (let d = 1100; d <= 6000; d += 100) DIST.push(d);

/** Höchster Geländewinkel (Grad) in einer Richtung, gesehen aus Augenhöhe h0 */
function horizon(lat: number, lon: number, h0: number, bearing: number) {
  const b = (bearing * Math.PI) / 180;
  const kLat = Math.cos(b) / 111320;
  const kLon = Math.sin(b) / (111320 * Math.cos((lat * Math.PI) / 180));
  let best = -10;
  for (const d of DIST) {
    const h = elev(lat + d * kLat, lon + d * kLon);
    if (Number.isNaN(h)) break;
    const a = Math.atan2(h - h0 - (d * d) / (2 * R), d);
    if (a > best) best = a;
  }
  return (best * 180) / Math.PI;
}

interface Day { date: string; rise: number; set: number; evening: { t: number; alt: number; bearing: number }[]; morning: { t: number; alt: number; bearing: number }[] }

function prepareDay(date: string): Day {
  const { rise, set } = sunTimes(noonOf(date), CENTER.lat, CENTER.lon);
  const evening = [];
  for (let t = set; t >= set - 4 * 3600_000; t -= STEP) evening.push({ t, ...sunPosition(t, CENTER.lat, CENTER.lon) });
  const morning = [];
  for (let t = rise; t <= rise + 4 * 3600_000; t += STEP) morning.push({ t, ...sunPosition(t, CENTER.lat, CENTER.lon) });
  return { date, rise, set, evening, morning };
}

const visible = (lat: number, lon: number, h0: number, s: { alt: number; bearing: number }) => s.alt + LIMB > horizon(lat, lon, h0, s.bearing);

/** Gelände-Sonnenuntergang (letzter Moment mit Sonne) und -aufgang (erster Moment) für einen Punkt */
function pointTimes(day: Day, lat: number, lon: number, eye = EYE) {
  const h0 = elev(lat, lon) + eye;
  let set = NaN;
  for (const s of day.evening) if (visible(lat, lon, h0, s)) { set = s.t; break; }
  let rise = NaN;
  for (const s of day.morning) if (visible(lat, lon, h0, s)) { rise = s.t; break; }
  return { set, rise, h: h0 - eye };
}

/** Bei Gipfeln und Türmen ungenauer Lage: höchsten Punkt im Umkreis von etwa 250 m nehmen */
function snapToTop(lat: number, lon: number) {
  let best = { lat, lon, h: elev(lat, lon) };
  for (let i = -10; i <= 10; i++) for (let j = -10; j <= 10; j++) {
    const a = lat + i * 0.000225, b = lon + j * 0.00034;
    const h = elev(a, b);
    if (h > best.h && Math.hypot(i, j) <= 10) best = { lat: a, lon: b, h };
  }
  return best;
}

export interface Viewpoint { id: string; name: string; lat: number; lon: number; eye?: number; snap?: boolean }
export type SunIn =
  | { type: 'day'; date: string; viewpoints: Viewpoint[] }
  | { type: 'point'; id: number; date: string; lat: number; lon: number };

let current: Day | null = null;

self.onmessage = async (ev: MessageEvent<SunIn>) => {
  const msg = ev.data;
  try {
    await loadArea();
    if (!current || current.date !== msg.date) current = prepareDay(msg.date);
    const day = current;
    if (msg.type === 'point') {
      self.postMessage({ type: 'point', id: msg.id, ...pointTimes(day, msg.lat, msg.lon) });
      return;
    }
    const t0 = performance.now();
    const cols = Math.round((GRID.e - GRID.w) / GRID.dLon) + 1;
    const rows = Math.round((GRID.n - GRID.s) / GRID.dLat) + 1;
    const set = new Float64Array(cols * rows);
    const rise = new Float64Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      const lat = GRID.n - r * GRID.dLat;
      for (let c = 0; c < cols; c++) {
        const p = pointTimes(day, lat, GRID.w + c * GRID.dLon);
        set[r * cols + c] = p.set;
        rise[r * cols + c] = p.rise;
      }
    }
    const points = msg.viewpoints.map((v) => {
      const at = v.snap ? snapToTop(v.lat, v.lon) : { lat: v.lat, lon: v.lon };
      return { ...v, lat: at.lat, lon: at.lon, ...pointTimes(day, at.lat, at.lon, v.eye ?? EYE) };
    });
    self.postMessage({ type: 'day', date: day.date, rise: day.rise, set: day.set, cols, rows, gridSet: set, gridRise: rise, points, ms: Math.round(performance.now() - t0) },
      { transfer: [set.buffer, rise.buffer] });
  } catch (e) {
    self.postMessage({ type: 'error', message: (e as Error).message });
  }
};
