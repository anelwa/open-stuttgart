// Auswertung des Niederschlagsradars: Wert an einem Ort, Beginn und Ende von Niederschlag, Rasterbild für die Karte.
export interface Radar {
  corners: [number, number][];
  rows: number;
  cols: number;
  frames: { t: string; v: number[][] }[];
  fetchedAt: string;
  source: string;
}

/** Schwelle für „Niederschlag“: 0,1 mm/h */
export const RAIN_MMH = 0.1;
/** Rohwert (0,01 mm je 5 min) in mm/h */
export const mmh = (v: number) => v * 0.12;

/** Rasterzelle zu einem Ort; Raster als Parallelogramm aus den Ecken oben links, oben rechts, unten links */
export function cellOf(r: Radar, lon: number, lat: number) {
  if (r.corners.length < 4) return null;
  const [tl, bl, , tr] = r.corners;
  const ax = tr[0] - tl[0], ay = tr[1] - tl[1];
  const bx = bl[0] - tl[0], by = bl[1] - tl[1];
  const px = lon - tl[0], py = lat - tl[1];
  const det = ax * by - ay * bx;
  const u = (px * by - py * bx) / det;
  const v = (ax * py - ay * px) / det;
  const col = Math.floor(u * r.cols), row = Math.floor(v * r.rows);
  if (col < 0 || row < 0 || col >= r.cols || row >= r.rows) return null;
  return { row, col };
}

export function seriesAt(r: Radar, lon: number, lat: number) {
  const c = cellOf(r, lon, lat);
  if (!c) return null;
  return r.frames.map((f) => ({ t: Date.parse(f.t), mmh: mmh(f.v[c.row]?.[c.col] ?? 0) }));
}

export function rainOutlook(series: { t: number; mmh: number }[], now = Date.now()) {
  const past = series.filter((s) => s.t <= now);
  const current = past[past.length - 1] ?? series[0];
  const future = series.filter((s) => s.t > now);
  const raining = (current?.mmh ?? 0) >= RAIN_MMH;
  const change = future.find((s) => (s.mmh >= RAIN_MMH) !== raining);
  return {
    raining,
    current: current?.mmh ?? 0,
    rainFrom: !raining && change ? change.t : null,
    dryFrom: raining && change ? change.t : null,
    until: series[series.length - 1]?.t ?? now,
    peak: Math.max(0, ...future.map((s) => s.mmh)),
  };
}

const RAMP: [number, [number, number, number, number]][] = [
  [10, [120, 40, 160, 215]], [4, [30, 60, 180, 200]], [1, [40, 110, 220, 170]], [RAIN_MMH, [90, 165, 235, 120]],
];

export function radarImage(r: Radar, frame: number) {
  const f = r.frames[frame];
  if (!f) return null;
  const c = document.createElement('canvas');
  c.width = r.cols;
  c.height = r.rows;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(r.cols, r.rows);
  let any = false;
  f.v.forEach((row, y) => row.forEach((v, x) => {
    const m = mmh(v);
    const col = RAMP.find(([th]) => m >= th)?.[1];
    if (!col) return;
    any = true;
    img.data.set(col, (y * r.cols + x) * 4);
  }));
  ctx.putImageData(img, 0, 0);
  return { url: c.toDataURL(), any };
}

/** Kartenkoordinaten des Rasterbilds: oben links, oben rechts, unten rechts, unten links */
export const radarCoords = (r: Radar) => [r.corners[0], r.corners[3], r.corners[2], r.corners[1]] as [[number, number], [number, number], [number, number], [number, number]];

/** Index des Bildes, das „jetzt“ am nächsten liegt */
export const nowFrame = (r: Radar, now = Date.now()) => {
  let best = 0;
  r.frames.forEach((f, i) => { if (Date.parse(f.t) <= now) best = i; });
  return best;
};
