// Sonnenstand nach den Näherungsformeln von suncalc (V. Agafonkin, BSD), genau auf etwa eine Minute.
const RAD = Math.PI / 180;
const DAY = 86400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQ = RAD * 23.4397;

const toDays = (t: number) => t / DAY - 0.5 + J1970 - J2000;

/** Höhe über dem Horizont und Richtung (Grad, von Norden im Uhrzeigersinn) der Sonnenmitte, ohne Refraktion */
export function sunPosition(t: number, lat: number, lon: number) {
  const d = toDays(t);
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(OBLIQ) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(OBLIQ), Math.cos(L));
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - ra;
  const phi = RAD * lat;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { alt: alt / RAD, bearing: (az / RAD + 180 + 360) % 360 };
}

/** Oberer Sonnenrand samt Refraktion sinkt unter 0° (astronomischer Auf- bzw. Untergang): Höhe der Mitte −0,833° */
export const LIMB = 0.833;

/** Astronomischer Sonnenaufgang und -untergang eines Tages (Minutensuche um Mittag) */
export function sunTimes(dayNoonUtc: number, lat: number, lon: number) {
  let rise = NaN;
  let set = NaN;
  for (let m = -12 * 60; m <= 12 * 60; m += 1) {
    const t = dayNoonUtc + m * 60_000;
    const up = sunPosition(t, lat, lon).alt + LIMB > 0;
    if (up && Number.isNaN(rise)) rise = t;
    if (!up && !Number.isNaN(rise) && Number.isNaN(set)) set = t;
  }
  return { rise, set };
}

/** Mittag (12 Uhr MEZ/MESZ ungefähr) eines Kalendertags JJJJ-MM-TT als UTC-Zeitstempel */
export const noonOf = (date: string) => Date.parse(`${date}T11:00:00Z`);

/** Rechengitter über dem Stadtgebiet, etwa 300 m Maschenweite */
export const GRID = { w: 9.04, e: 9.32, s: 48.69, n: 48.87, dLon: 0.004, dLat: 0.0027 };
