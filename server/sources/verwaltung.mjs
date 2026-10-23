// Ebene „Verwaltung“ und Grundlage für den Assistenten (Spezifikation docs/spezifikation-ebene-verwaltung.md).
// Liest den Datensatz aus server/data/verwaltung-demo.json, server/data/gebaeude.geojson, server/data/verwaltung.json
// (bzw. verwaltung-dock.json) oder server/data/verwaltung.sqlite. Liegt noch keine der Crawl-Dateien auf dem Rechner,
// stellt das Modul einen Basisbestand aus den 19 Bürgerbüros (mit Live-Wartezeit-Ampel), den Kernämtern und den
// wichtigsten Stuttgarter Verwaltungsleistungen bereit und schaltet im laufenden Betrieb automatisch auf den
// Volldatensatz um, sobald die Datei abgelegt wird.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buergerbueros } from './nearby.mjs';
import { districtOf } from './wasgeht/common.mjs';

const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
const FILES = {
  demo: () => process.env.OS_VERWALTUNG_DEMO ?? `${DATA_DIR}verwaltung-demo.json`,
  gebaeude: () => process.env.OS_VERWALTUNG_GEBAEUDE ?? `${DATA_DIR}gebaeude.geojson`,
  dock: () => process.env.OS_VERWALTUNG ?? (existsSync(`${DATA_DIR}verwaltung.json`) ? `${DATA_DIR}verwaltung.json` : `${DATA_DIR}verwaltung-dock.json`),
  sqlite: () => process.env.OS_VERWALTUNG_SQLITE ?? `${DATA_DIR}verwaltung.sqlite`,
};

export const RUBRIKEN = [
  { id: 'buergerbuero', label: 'Bürgerbüros', defaultOn: true },
  { id: 'amt', label: 'Ämter und Dienststellen', defaultOn: true },
  { id: 'bezirksamt', label: 'Bezirksämter', defaultOn: true },
  { id: 'schule_bildung', label: 'Schulen und Bildung', defaultOn: false },
  { id: 'beratung_soziales', label: 'Beratung und Soziales', defaultOn: false },
  { id: 'sonstige', label: 'Sonstige Adressen', defaultOn: false },
];

// ---------- Feiertage Baden-Württemberg und Öffnungszeiten (Abschnitt 4) ----------
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

const addUtcDays = (d, n) => new Date(d.getTime() + n * 86400_000).toISOString().slice(0, 10);

const holidayCache = new Map();
/** Gesetzliche Feiertage in Baden-Württemberg für ein Jahr als Map YYYY-MM-DD -> Name. */
export function feiertageBW(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const easter = easterSunday(year);
  const map = new Map([
    [`${year}-01-01`, 'Neujahr'],
    [`${year}-01-06`, 'Heilige Drei Könige'],
    [addUtcDays(easter, -2), 'Karfreitag'],
    [addUtcDays(easter, 1), 'Ostermontag'],
    [`${year}-05-01`, 'Tag der Arbeit'],
    [addUtcDays(easter, 39), 'Christi Himmelfahrt'],
    [addUtcDays(easter, 50), 'Pfingstmontag'],
    [addUtcDays(easter, 60), 'Fronleichnam'],
    [`${year}-10-03`, 'Tag der Deutschen Einheit'],
    [`${year}-11-01`, 'Allerheiligen'],
    [`${year}-12-25`, '1. Weihnachtstag'],
    [`${year}-12-26`, '2. Weihnachtstag'],
  ]);
  holidayCache.set(year, map);
  return map;
}

const DAY_INDEX = {
  mo: 1, montag: 1,
  di: 2, dienstag: 2,
  mi: 3, mittwoch: 3,
  do: 4, donnerstag: 4,
  fr: 5, freitag: 5,
  sa: 6, samstag: 6,
  so: 0, sonntag: 0,
};

function berlinParts(now = new Date()) {
  const dateStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(now);
  const hmStr = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const [h, m] = hmStr.split(':').map(Number);
  const wd = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return { dateStr, year: Number(dateStr.slice(0, 4)), wd, minutes: h * 60 + m };
}

function normalizeHoursRows(hours) {
  if (!hours) return [];
  if (Array.isArray(hours)) {
    return hours.map((r) => ({
      day: String(r.day ?? r.tag ?? '').trim(),
      times: String(r.times ?? r.zeit ?? r.zeiten ?? '').trim(),
      note: String(r.note ?? r.hinweis ?? '').trim(),
    })).filter((r) => r.day || r.times || r.note);
  }
  if (typeof hours === 'string') {
    return hours.split(/\r?\n|;\s*/).map((line) => {
      const m = /^([^:]+):\s*(.*)$/.exec(line.trim());
      if (!m) return { day: '', times: line.trim(), note: '' };
      const rest = m[2].trim();
      const noteMatch = /\(([^)]*termin[^)]*)\)/i.exec(rest);
      return {
        day: m[1].trim(),
        times: rest.replace(/\([^)]*\)/g, '').trim(),
        note: noteMatch ? noteMatch[1].trim() : /terminvereinbarung|nur mit termin/i.test(rest) ? rest : '',
      };
    }).filter((r) => r.day || r.times);
  }
  return [];
}

function matchWeekday(dayText, wd) {
  const s = dayText.toLowerCase().replace(/\./g, '').trim();
  if (!s || /täglich|montag\s*(?:bis|–|-)\s*freitag|mo\s*(?:bis|–|-)\s*fr/.test(s)) {
    if (/montag\s*(?:bis|–|-)\s*freitag|mo\s*(?:bis|–|-)\s*fr/.test(s)) return wd >= 1 && wd <= 5;
    if (/täglich/.test(s)) return true;
  }
  const range = /^(mo(?:ntag)?|di(?:enstag)?|mi(?:ttwoch)?|do(?:nnerstag)?|fr(?:eitag)?|sa(?:mstag)?|so(?:nntag)?)\s*(?:bis|–|-)\s*(mo(?:ntag)?|di(?:enstag)?|mi(?:ttwoch)?|do(?:nnerstag)?|fr(?:eitag)?|sa(?:mstag)?|so(?:nntag)?)$/.exec(s);
  if (range) {
    const a = DAY_INDEX[range[1]]; const b = DAY_INDEX[range[2]];
    if (a != null && b != null && a <= b) return wd >= a && wd <= b;
  }
  for (const [k, idx] of Object.entries(DAY_INDEX)) {
    if (new RegExp(`(^|[^a-zäöüß])${k}([^a-zäöüß]|$)`).test(s) && idx === wd) return true;
  }
  return false;
}

/**
 * Wertet Öffnungszeiten-Zeilen (Abschnitt 4) für den aktuellen Zeitpunkt in Europe/Berlin aus.
 * Berücksichtigt Feiertage in Baden-Württemberg und Hinweise auf „nur mit Termin“.
 */
export function jetztGeoeffnet(hours, now = new Date()) {
  const rows = normalizeHoursRows(hours);
  if (!rows.length) return null;
  const { dateStr, year, wd, minutes } = berlinParts(now);
  const feiertag = feiertageBW(year).get(dateStr);
  if (feiertag) return { state: 'geschlossen', open: false, onlyAppointment: false, text: `geschlossen (${feiertag})`, rows };

  const todayRows = rows.filter((r) => matchWeekday(r.day, wd));
  if (!todayRows.length) {
    if (wd === 0 || wd === 6) return { state: 'geschlossen', open: false, onlyAppointment: false, text: 'heute geschlossen', rows };
    return { state: 'unbekannt', open: false, onlyAppointment: false, text: rows.map((r) => [r.day, r.times, r.note].filter(Boolean).join(': ')).join('; '), rows };
  }

  let parsedAny = false;
  let nextOpen = null;
  for (const r of todayRows) {
    const combined = `${r.times} ${r.note}`;
    const appointmentOnly = /terminvereinbarung|nur mit termin|nach vereinbarung/i.test(combined);
    if (/geschlossen/i.test(r.times)) { parsedAny = true; continue; }
    const spans = [...r.times.matchAll(/(\d{1,2})[:.](\d{2})\s*(?:–|-|bis)\s*(\d{1,2})[:.](\d{2})/g)];
    if (!spans.length && appointmentOnly) {
      return { state: 'termin', open: false, onlyAppointment: true, text: 'heute nur mit Termin', rows };
    }
    for (const m of spans) {
      parsedAny = true;
      const from = Number(m[1]) * 60 + Number(m[2]);
      const to = Number(m[3]) * 60 + Number(m[4]);
      const toStr = `${String(m[3]).padStart(2, '0')}:${m[4]}`;
      const fromStr = `${String(m[1]).padStart(2, '0')}:${m[2]}`;
      if (minutes >= from && minutes < to) {
        if (appointmentOnly) return { state: 'termin', open: false, onlyAppointment: true, text: `nur mit Termin (bis ${toStr} Uhr)`, rows };
        return { state: 'offen', open: true, onlyAppointment: false, text: `geöffnet bis ${toStr} Uhr`, rows };
      }
      if (from > minutes && (nextOpen == null || from < nextOpen.from)) {
        nextOpen = { from, fromStr, appointmentOnly };
      }
    }
  }
  if (nextOpen) {
    return {
      state: nextOpen.appointmentOnly ? 'termin' : 'geschlossen',
      open: false,
      onlyAppointment: nextOpen.appointmentOnly,
      text: nextOpen.appointmentOnly ? `ab ${nextOpen.fromStr} Uhr nur mit Termin` : `geschlossen, öffnet heute um ${nextOpen.fromStr} Uhr`,
      rows,
    };
  }
  if (parsedAny) return { state: 'geschlossen', open: false, onlyAppointment: false, text: 'heute geschlossen', rows };
  return { state: 'unbekannt', open: false, onlyAppointment: false, text: todayRows.map((r) => [r.day, r.times, r.note].filter(Boolean).join(' ')).join('; '), rows };
}

// ---------- Wartezeit-Ampel nach Abschnitt 4 ----------
export function ampelDarstellung(status) {
  if (status == null) return null;
  const s = Number(status);
  if (s === 0) return { status: 0, farbe: 'grau', ring: 'closed', text: 'außerhalb der Öffnungszeiten', waitMin: null };
  if (s >= 1 && s <= 5) return { status: s, farbe: 'gruen', ring: 'short', text: `ca. ${s * 15} Minuten (Stufe ${s}, 15 bis 75 Minuten)`, waitMin: s * 15 };
  if (s >= 6 && s <= 9) return { status: s, farbe: 'gelb', ring: 'medium', text: `ca. ${s * 15} Minuten (Stufe ${s}, 90 bis 135 Minuten)`, waitMin: s * 15 };
  if (s === 10) return { status: 10, farbe: 'gelb', ring: 'long', text: '150 Minuten oder mehr (bzw. nachmittags nur mit Termin)', waitMin: 150 };
  return { status: 11, farbe: 'rot', ring: 'full', text: 'alle Wartemarken vergeben', waitMin: null };
}

// ---------- Rubrik-Einteilung nach Abschnitt 4 ----------
function rubrikOf(unit) {
  const raw = String(unit.rubrik ?? '').toLowerCase();
  if (raw === 'amt_dienststelle' || raw === 'beteiligungsunternehmen' || raw === 'nichtstaedtische_behoerde') return 'amt';
  if (RUBRIKEN.some((r) => r.id === raw)) return raw;
  const nameAndParent = `${unit.name ?? ''} ${unit.amt ?? ''} ${unit.uebergeordnet ?? ''}`.toLowerCase();
  if (/bürgerbüro|buergerbuero/.test(nameAndParent) || unit.wartezeit_tafel_id != null) return 'buergerbuero';
  if (/bezirksamt|bezirksrathaus|bezirksvorsteher/.test(nameAndParent)) return 'bezirksamt';
  if (/schule|gymnasium|realschule|grundschule|berufsschule|gemeinschaftsschule|waldorfschule|kita|kindertages|tageseinrichtung|bibliothek|volkshochschule|musikschule|bildung/.test(nameAndParent)) return 'schule_bildung';
  if (/beratung|sozial|jugendamt|flüchtling|pflege|senioren|teilhabe|jobcenter|wohngeld|elterngeld|gesundheitsberatung|bürgerhaus|stadtteilhaus|begegnungsstätte/.test(nameAndParent)) return 'beratung_soziales';
  if (unit.art === 'verwaltungseinheit' || unit.art === 'beteiligungsunternehmen' || unit.art === 'nichtstaedtische_behoerde') return 'amt';
  if (/amt|dienststelle|abteilung|referat|standesamt|zulassungsstelle|führerscheinstelle|ausländerbehörde|stadtkämmerei|steueramt|baurechtsamt|tiefbauamt|garten-|forst|friedhof|branddirektion|ordnungsamt|wahl|statistik|rathaus|eigenbetrieb|aws|stadtentwässerung/.test(nameAndParent)) return 'amt';
  return 'sonstige';
}

// ---------- Synonyme und Textnormalisierung (Abschnitt 7.1) ----------
const SYNONYME = [
  [/\bperso\b/g, 'personalausweis'],
  [/\bpass\b/g, 'reisepass personalausweis'],
  [/\b(?:ummelden|anmelden|abmelden|umzug|wohnsitz)\b/g, 'wohnsitz anmelden ummelden abmelden'],
  [/\b(?:kfz|auto|fahrzeug|nummernschild|kennzeichen)\b/g, 'kraftfahrzeug zulassung kfz'],
  [/\b(?:führerschein|fuehrerschein|lappen|fahrerlaubnis)\b/g, 'fuehrerschein fahrerlaubnis'],
  [/\b(?:kita|kindergarten|krippe|betreuung)\b/g, 'kindertageseinrichtung kita'],
  [/\b(?:parkausweis|anwohnerparken|bewohnerparken)\b/g, 'bewohnerparkausweis parkausweis'],
  [/\b(?:heirat|heiraten|trauung|hochzeit|ehe)\b/g, 'eheschliessung standesamt'],
  [/\b(?:müll|muell|sperrmüll|sperrmuell|abfall|tonne)\b/g, 'sperrmuell abfallwirtschaft'],
  [/\b(?:gewerbe|gewerbeschein|firma)\b/g, 'gewerbeanmeldung gewerbe'],
  [/\b(?:bürgergeld|buergergeld|hartz|jobcenter)\b/g, 'buergergeld sozialleistung'],
  [/\b(?:hund|hundesteuer)\b/g, 'hundesteuer'],
  [/\b(?:geburt|geburtsurkunde|baby)\b/g, 'geburtsurkunde geburt'],
  [/\b(?:führungszeugnis|fuehrungszeugnis)\b/g, 'fuehrungszeugnis'],
  [/\b(?:baustelle|sondernutzung|halteverbot)\b/g, 'sondernutzung strasse'],
  // Die Ausländerbehörde heißt im Datensatz „Amt für öffentliche Ordnung“ bzw.
  // „Ausländerrecht“ und ihre Teams „Aufenthaltstitel“. Ohne diese Brücke findet
  // die Suche nach „Ausländerbehörde“ nur vereinzelte Leistungen.
  [/\b(?:auslaenderbehoerde|auslaender)\b/g, 'auslaenderrecht aufenthaltstitel auslaenderbehoerde'],
  [/\b(?:aufenthaltstitel|aufenthalt|migration)\b/g, 'aufenthaltstitel aufenthalt migration auslaenderrecht'],
  // Duldung ist ein eigener Tatbestand (Chancen-Aufenthaltsrecht), nicht nur
  // ein Unterfall der allgemeinen Aufenthaltserlaubnis.
  [/\b(?:duldung|gestattung)\b/g, 'duldung gestattung chancen aufenthaltsrecht'],
  [/\b(?:abschiebung|aufschiebung)\b/g, 'abschiebung aufschiebung duldung aufenthalt'],
  [/\b(?:asyl|asylbewerber)\b/g, 'asyl aufenthalt migration'],
  [/\b(?:niederlassungserlaubnis|einbuergerung)\b/g, 'niederlassungserlaubnis einbuergerung aufenthaltstitel'],
];

// Füllwörter tragen bei der Suche nichts bei und sorgen sonst dafür, dass
// „Wie hoch ist die Hundesteuer?“ jeden Text mit „hoch“ oder „ist“ trifft.
const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'und', 'oder', 'aber', 'für', 'fuer', 'mit', 'ohne', 'mein', 'meine', 'meinen', 'meinem', 'meiner',
  'ich', 'mir', 'mich', 'du', 'dir', 'dich', 'wir', 'uns', 'zu', 'zum', 'zur', 'von', 'vom',
  'im', 'in', 'am', 'an', 'auf', 'aus', 'bei', 'nach', 'über', 'ueber', 'unter', 'vor', 'um',
  'es', 'ist', 'sind', 'war', 'waren', 'wie', 'was', 'wer', 'wo', 'wann', 'warum', 'wieso',
  'bitte', 'mal', 'noch', 'nur', 'sich', 'sie', 'er', 'ihr', 'ihre', 'ihren', 'kein', 'keine',
  'keinen', 'nicht', 'mehr', 'als', 'auch', 'so', 'dass', 'wenn', 'ob', 'man', 'kann', 'koennen',
  'können', 'muss', 'muessen', 'müssen', 'soll', 'sollen', 'wird', 'werden', 'haben', 'hat', 'habe',
  'brauche', 'brauchen', 'möchte', 'moechte', 'will', 'willst', 'benötige', 'benoetige', 'geht',
  'gibt', 'hoch', 'viel', 'viele', 'etwas',
]);

export function normSearch(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function expandQuery(q) {
  const base = normSearch(q);
  // Grundbegriffe immer behalten; Synonyme nur ergänzen. So verdrängt eine
  // Erweiterung wie „Ausländerbehörde → Ausländerrecht“ nicht das eigentliche
  // Suchwort (etwa „Duldung“).
  const terms = new Set(base.split(/\s+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w)));
  for (const [re, rep] of SYNONYME) {
    re.lastIndex = 0;
    if (!re.test(base)) continue;
    for (const w of rep.split(/\s+/)) if (w.length >= 2 && !STOPWORDS.has(w)) terms.add(w);
  }
  return [...terms];
}

const R = 6371000;
export function distM(a, b) {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// ---------- Basisbestand für Stuttgart (aktiv, solange verwaltung-demo.json / verwaltung.json noch nicht kopiert ist) ----------
const BB_HOURS = [
  { day: 'Montag', times: '08:30 – 13:00', note: '' },
  { day: 'Dienstag', times: '08:30 – 12:00 und 14:00 – 16:00', note: 'nachmittags nach vorheriger Online-Terminvereinbarung' },
  { day: 'Mittwoch', times: '07:30 – 13:00', note: '' },
  { day: 'Donnerstag', times: '08:30 – 12:00 und 14:00 – 18:00', note: 'nachmittags nach vorheriger Online-Terminvereinbarung' },
  { day: 'Freitag', times: '08:30 – 13:00', note: '' },
];

const BASIS_LEISTUNGEN = [
  {
    id: 'lst-personalausweis',
    name: 'Personalausweis beantragen',
    url: 'https://www.stuttgart.de/vv/leistungen/personalausweis-beantragen.php',
    leika: '99118004011000',
    zustaendig: 'Bürgerbüros (Amt für öffentliche Ordnung)',
    booking: 'https://stuttgart.konsentas.de/form/29/',
    onlineAngebote: [
      { art: 'termin', titel: 'Online-Terminvereinbarung Bürgerbüros', url: 'https://stuttgart.konsentas.de/form/29/' },
      { art: 'stadt', titel: 'Ausweisstatus online abfragen', url: 'https://service.stuttgart.de/lhs-services/passstatus/' },
    ],
    abschnitte: {
      Voraussetzungen: 'Deutsche Staatsangehörigkeit; Haupt- oder Nebenwohnsitz in Stuttgart. Ab 16 Jahren besteht Ausweispflicht; persönliche Vorsprache ist wegen der Fingerabdrücke erforderlich.',
      'Benötigte Unterlagen': 'Bisheriger Personalausweis oder Reisepass (bei Erstantrag: Geburtsurkunde); aktuelles biometrisches Lichtbild (digital oder ausgedruckt); bei unter 16-Jährigen Zustimmungserklärung der Sorgeberechtigten.',
      Gebühren: '37,00 Euro (ab 24 Jahren, Gültigkeit 10 Jahre); 22,80 Euro (unter 24 Jahren, Gültigkeit 6 Jahre); vorläufiger Personalausweis: 10,00 Euro.',
      Bearbeitungsdauer: 'Rund 3 bis 4 Wochen (Herstellung in der Bundesdruckerei); vorläufiger Personalausweis wird sofort ausgestellt.',
      Ablauf: 'Termin online vereinbaren oder während der offenen Sprechzeiten vorsprechen, Fingerabdrücke abgeben, Gebühr begleichen. Den Bearbeitungsstand online prüfen und den Ausweis im selben Bürgerbüro abholen.',
      Rechtsgrundlage: 'Personalausweisgesetz (PAuswG), Personalausweisgebührenverordnung (PAuswGebV).',
    },
    rollen: 'buergerbuero',
  },
  {
    id: 'lst-personalausweis-verlust',
    name: 'Personalausweis – Verlust oder Diebstahl melden',
    url: 'https://www.stuttgart.de/vv/leistungen/personalausweis-verlust-oder-diebstahl-melden.php',
    leika: '99118004052000',
    zustaendig: 'Bürgerbüros (Amt für öffentliche Ordnung)',
    booking: 'https://stuttgart.konsentas.de/form/29/',
    onlineAngebote: [
      { art: 'termin', titel: 'Online-Terminvereinbarung Bürgerbüros', url: 'https://stuttgart.konsentas.de/form/29/' },
      { art: 'bund', titel: 'Online-Ausweisfunktion telefonisch sperren (116 116)', url: 'https://www.personalausweisportal.de/' },
    ],
    abschnitte: {
      Voraussetzungen: 'Der Personalausweis ist verloren gegangen oder wurde gestohlen; Wohnsitz in Stuttgart.',
      'Benötigte Unterlagen': 'Falls vorhanden: Reisepass, Führerschein oder Geburtsurkunde zur Identitätsfeststellung; bei Diebstahl die polizeiliche Diebstahlsanzeige; biometrisches Lichtbild bei gleichzeitigem Neuantrag.',
      Gebühren: 'Verlustanzeige und Sperrung der Online-Ausweisfunktion: gebührenfrei. Neuer Personalausweis: 37,00 Euro (ab 24 Jahren) bzw. 22,80 Euro (unter 24 Jahren).',
      Bearbeitungsdauer: 'Verlustmeldung und Sperrung sofort; Neuausstellung 3 bis 4 Wochen.',
      Ablauf: 'Verlust unverzüglich in einem Bürgerbüro oder bei der Polizei anzeigen; Online-Ausweisfunktion sperren lassen; bei Bedarf sofort vorläufigen Personalausweis oder neuen Ausweis beantragen.',
      Rechtsgrundlage: '§ 27 Personalausweisgesetz (PAuswG).',
    },
    rollen: 'buergerbuero',
  },
  {
    id: 'lst-reisepass',
    name: 'Reisepass beantragen',
    url: 'https://www.stuttgart.de/vv/leistungen/reisepass-beantragen.php',
    leika: '99118015011000',
    zustaendig: 'Bürgerbüros (Amt für öffentliche Ordnung)',
    booking: 'https://stuttgart.konsentas.de/form/29/',
    onlineAngebote: [
      { art: 'termin', titel: 'Online-Terminvereinbarung Bürgerbüros', url: 'https://stuttgart.konsentas.de/form/29/' },
      { art: 'stadt', titel: 'Passstatus online abfragen', url: 'https://service.stuttgart.de/lhs-services/passstatus/' },
    ],
    abschnitte: {
      Voraussetzungen: 'Deutsche Staatsangehörigkeit; Wohnsitz in Stuttgart; persönliche Vorsprache (auch bei Kindern).',
      'Benötigte Unterlagen': 'Bisheriger Reisepass oder Personalausweis; aktuelles biometrisches Lichtbild; ggf. Geburts- oder Eheurkunde bei Namensänderung.',
      Gebühren: '70,00 Euro (ab 24 Jahren, 10 Jahre gültig); 37,50 Euro (unter 24 Jahren, 6 Jahre gültig); Expresspass-Zuschlag: 32,00 Euro.',
      Bearbeitungsdauer: 'Regulär ca. 4 bis 6 Wochen; im Expressverfahren 3 bis 4 Werktage (Antragstellung vor 11:00 Uhr).',
      Ablauf: 'Persönliche Antragstellung im Bürgerbüro, Abgabe der Fingerabdrücke, Abholung nach Fertigstellung.',
      Rechtsgrundlage: 'Passgesetz (PassG), Passverordnung (PassV).',
    },
    rollen: 'buergerbuero',
  },
  {
    id: 'lst-wohnsitz-anmelden',
    name: 'Wohnsitz anmelden oder ummelden',
    url: 'https://www.stuttgart.de/vv/leistungen/wohnsitz-anmelden.php',
    leika: '99115003012000',
    zustaendig: 'Bürgerbüros (Amt für öffentliche Ordnung)',
    booking: 'https://stuttgart.konsentas.de/form/29/',
    onlineAngebote: [
      { art: 'bund', titel: 'Elektronische Wohnsitzanmeldung (Online-Dienst)', url: 'https://wohnsitzanmeldung.gov.de/' },
      { art: 'termin', titel: 'Online-Terminvereinbarung Bürgerbüros', url: 'https://stuttgart.konsentas.de/form/29/' },
    ],
    abschnitte: {
      Voraussetzungen: 'Bezug einer neuen Wohnung in Stuttgart; Anmeldung innerhalb von zwei Wochen nach Einzug.',
      'Benötigte Unterlagen': 'Personalausweise und/oder Reisepässe aller umziehenden Personen; Wohnungsgeberbestätigung nach § 19 BMG.',
      Gebühren: 'Gebührenfrei.',
      Bearbeitungsdauer: 'Online oder bei Vorsprache im Bürgerbüro sofort.',
      Ablauf: 'Mit aktivierter Online-Ausweisfunktion elektronisch über wohnsitzanmeldung.gov.de erledigen (Adressaufkleber kommt per Post) oder persönlich in einem beliebigen Stuttgarter Bürgerbüro vorsprechen.',
      Rechtsgrundlage: '§ 17 und § 19 Bundesmeldegesetz (BMG).',
    },
    rollen: 'buergerbuero',
  },
  {
    id: 'lst-fuehrungszeugnis',
    name: 'Führungszeugnis beantragen',
    url: 'https://www.stuttgart.de/vv/leistungen/fuehrungszeugnis-beantragen.php',
    leika: '99044001012000',
    zustaendig: 'Bürgerbüros (Amt für öffentliche Ordnung)',
    booking: 'https://stuttgart.konsentas.de/form/29/',
    onlineAngebote: [
      { art: 'bund', titel: 'Führungszeugnis online beim Bundesamt für Justiz beantragen', url: 'https://www.fuehrungszeugnis.bund.de/' },
      { art: 'termin', titel: 'Online-Terminvereinbarung Bürgerbüros', url: 'https://stuttgart.konsentas.de/form/29/' },
    ],
    abschnitte: {
      Voraussetzungen: 'Mindestalter 14 Jahre; Wohnsitz in Stuttgart.',
      'Benötigte Unterlagen': 'Personalausweis oder Reisepass; beim erweiterten Führungszeugnis schriftliche Aufforderung der anfordernden Stelle; beim Behördenführungszeugnis Anschrift und Verwendungszweck der Behörde.',
      Gebühren: '13,00 Euro (Befreiung bei ehrenamtlicher Tätigkeit mit Nachweis).',
      Bearbeitungsdauer: 'Zustellung durch das Bundesamt für Justiz nach etwa 1 bis 2 Wochen.',
      Ablauf: 'Direkt online über das Portal des Bundesamts für Justiz (mit eID) oder persönlich in einem Stuttgarter Bürgerbüro beantragen.',
      Rechtsgrundlage: '§§ 30, 30a Bundeszentralregistergesetz (BZRG).',
    },
    rollen: 'buergerbuero',
  },
  {
    id: 'lst-bewohnerparkausweis',
    name: 'Bewohnerparkausweis beantragen oder verlängern',
    url: 'https://www.stuttgart.de/vv/leistungen/bewohnerparkausweis-beantragen.php',
    leika: '99107035000000',
    zustaendig: 'Bürgerbüros / Amt für öffentliche Ordnung',
    booking: 'https://stuttgart.konsentas.de/form/29/',
    onlineAngebote: [
      { art: 'stadt', titel: 'Bewohnerparkausweis online beantragen und ausdrucken', url: 'https://service.stuttgart.de/lhs-services/bpa/' },
      { art: 'termin', titel: 'Online-Terminvereinbarung Bürgerbüros', url: 'https://stuttgart.konsentas.de/form/29/' },
    ],
    abschnitte: {
      Voraussetzungen: 'Haupt- oder Nebenwohnsitz in einem Stuttgarter Bewohnerparkgebiet; auf Sie zugelassenes oder dauerhaft genutztes Kraftfahrzeug; kein eigener privater Stellplatz.',
      'Benötigte Unterlagen': 'Zulassungsbescheinigung Teil I (Fahrzeugschein); Personalausweis; ggf. Nutzungsüberlassung des Fahrzeughalters.',
      Gebühren: '30,70 Euro pro Jahr (bei Online-Beantragung und im Bürgerbüro).',
      Bearbeitungsdauer: 'Online sofort zum Selbstausdrucken nach Bezahlung; im Bürgerbüro sofort bei Vorsprache.',
      Ablauf: 'Online über service.stuttgart.de/lhs-services/bpa beantragen, bezahlen und Parkausweis direkt ausdrucken oder im Bürgerbüro ausstellen lassen.',
      Rechtsgrundlage: '§ 45 Straßenverkehrs-Ordnung (StVO), Bewohnerparkgebührensatzung der Landeshauptstadt Stuttgart.',
    },
    rollen: 'buergerbuero',
  },
  {
    id: 'lst-kfz-zulassung',
    name: 'Kraftfahrzeug zulassen, ummelden oder außer Betrieb setzen',
    url: 'https://www.stuttgart.de/vv/leistungen/kraftfahrzeug-zulassen.php',
    leika: '99107002000000',
    zustaendig: 'Kfz-Zulassungsstelle (Amt für öffentliche Ordnung)',
    booking: 'https://stuttgart.konsentas.de/form/5/',
    onlineAngebote: [
      { art: 'stadt', titel: 'Internetbasierte Fahrzeugzulassung (i-Kfz)', url: 'https://service.stuttgart.de/lhs-services/ikfz/' },
      { art: 'stadt', titel: 'Wunschkennzeichen reservieren', url: 'https://service.stuttgart.de/lhs-services/wkz/' },
      { art: 'termin', titel: 'Online-Terminvereinbarung Kfz-Zulassungsstelle', url: 'https://stuttgart.konsentas.de/form/5/' },
    ],
    abschnitte: {
      Voraussetzungen: 'Hauptwohnsitz oder Betriebssitz in Stuttgart; keine Kraftfahrzeugsteuer-Rückstände.',
      'Benötigte Unterlagen': 'Personalausweis oder Reisepass; Zulassungsbescheinigung Teil I und II; elektronische Versicherungsbestätigung (eVB-Nummer); gültiger Nachweis der Hauptuntersuchung (HU); SEPA-Lastschriftmandat für die Kfz-Steuer.',
      Gebühren: 'Je nach Vorgang ca. 27,00 bis 45,00 Euro (online über i-Kfz vergünstigt), zuzüglich Kennzeichenschilder.',
      Bearbeitungsdauer: 'Online (i-Kfz) sofortiges Losfahren möglich; vor Ort mit Termin sofort.',
      Ablauf: 'Online über i-Kfz durchführen oder vorab Termin bei der Kfz-Zulassungsstelle (Wolframstraße 20) vereinbaren.',
      Rechtsgrundlage: 'Fahrzeug-Zulassungsverordnung (FZV).',
    },
    rollen: 'kfz',
  },
  {
    id: 'lst-fuehrerschein',
    name: 'Führerschein beantragen oder umtauschen',
    url: 'https://www.stuttgart.de/vv/leistungen/fuehrerschein-umtausch.php',
    leika: '99107016000000',
    zustaendig: 'Führerscheinstelle (Amt für öffentliche Ordnung)',
    booking: 'https://stuttgart.konsentas.de/form/6/',
    onlineAngebote: [
      { art: 'termin', titel: 'Online-Terminvereinbarung Führerscheinstelle', url: 'https://stuttgart.konsentas.de/form/6/' },
    ],
    abschnitte: {
      Voraussetzungen: 'Ordentlicher Wohnsitz in Stuttgart.',
      'Benötigte Unterlagen': 'Personalausweis oder Reisepass; aktuelles biometrisches Lichtbild; bisheriger Führerschein; bei Erstantrag zusätzlich Sehtest, Erste-Hilfe-Nachweis und Angabe der Fahrschule.',
      Gebühren: 'Umtausch: ca. 26,50 Euro (zuzüglich ca. 5,10 Euro bei Direktversand); Ersterteilung: ca. 45,00 Euro.',
      Bearbeitungsdauer: 'Ca. 3 bis 4 Wochen.',
      Ablauf: 'Termin bei der Führerscheinstelle (Wolframstraße 20) oder in einem Bürgerbüro (für Pflichtumtausch) buchen.',
      Rechtsgrundlage: 'Fahrerlaubnis-Verordnung (FeV).',
    },
    rollen: 'kfz',
  },
  {
    id: 'lst-sperrmuell',
    name: 'Sperrmüll-Abholung anmelden',
    url: 'https://www.stuttgart.de/vv/leistungen/sperrmuell-anmelden.php',
    leika: '99011005000000',
    zustaendig: 'Abfallwirtschaft Stuttgart (AWS)',
    booking: null,
    onlineAngebote: [
      { art: 'stadt', titel: 'Sperrmüll online bei der AWS bestellen', url: 'https://service.stuttgart.de/lhs-services/aws/sperrmuell' },
    ],
    abschnitte: {
      Voraussetzungen: 'Anschluss des Grundstücks an die städtische Abfallentsorgung.',
      'Benötigte Unterlagen': 'Angabe der Adresse, der Sperrmüllgegenstände und bei kostenfreier Abholung die Gutscheinnummer des Abfallkalenders bzw. die Objektnummer.',
      Gebühren: 'Einmal jährlich bis zu 8 Kubikmeter auf Abruf kostenfrei (über Abfallgebühr abgedeckt); Express- oder Zusatzabholung kostenpflichtig.',
      Bearbeitungsdauer: 'Abholtermin wird bei der Online-Bestellung direkt mitgeteilt.',
      Ablauf: 'Online über das AWS-Formular anmelden und Gegenstände am Abholtag bis 6:30 Uhr am Straßenrand bereitstellen.',
      Rechtsgrundlage: 'Abfallwirtschaftssatzung der Landeshauptstadt Stuttgart.',
    },
    rollen: 'aws',
  },
  {
    id: 'lst-kita',
    name: 'Kindertageseinrichtung (Kita) – Platz vormerken',
    url: 'https://www.stuttgart.de/leben/bildung/kitas/anmeldung/',
    leika: '99071001000000',
    zustaendig: 'Jugendamt Stuttgart',
    booking: null,
    onlineAngebote: [
      { art: 'stadt', titel: 'Kita-Vormerkung online', url: 'https://service.stuttgart.de/lhs-services/kita/' },
    ],
    abschnitte: {
      Voraussetzungen: 'Kind mit Wohnsitz in Stuttgart (oder geplantem Zuzug).',
      'Benötigte Unterlagen': 'Angaben zum Kind, zu den Sorgeberechtigten und zum gewünschten Betreuungsumfang.',
      Gebühren: 'Die Vormerkung ist gebührenfrei; Elternbeiträge richten sich nach Betreuungsform und Familieneinkommen.',
      Bearbeitungsdauer: 'Laufende Platzvergabe durch die Träger der Einrichtungen.',
      Ablauf: 'Über das zentrale Online-Vormerksystem bis zu mehrere Wunscheinrichtungen auswählen.',
      Rechtsgrundlage: '§ 24 Achtens Buch Sozialgesetzbuch (SGB VIII).',
    },
    rollen: 'jugendamt',
  },
  {
    id: 'lst-eheschliessung',
    name: 'Eheschließung anmelden und Trautermin reservieren',
    url: 'https://www.stuttgart.de/vv/leistungen/eheschliessung-anmelden.php',
    leika: '99116001012000',
    zustaendig: 'Standesamt Stuttgart',
    booking: 'https://service.stuttgart.de/lhs-services/traukalender/',
    onlineAngebote: [
      { art: 'termin', titel: 'Traukalender Online (Wunschtermin reservieren)', url: 'https://service.stuttgart.de/lhs-services/traukalender/' },
    ],
    abschnitte: {
      Voraussetzungen: 'Mindestens eine Person hat ihren Haupt- oder Nebenwohnsitz in Stuttgart.',
      'Benötigte Unterlagen': 'Personalausweis oder Reisepass; beglaubigter Ausdruck aus dem Geburtenregister; ggf. Eheurkunde und Scheidungsbeschluss einer Vorehe.',
      Gebühren: 'Prüfung der Ehefähigkeit: 55,00 Euro (bei ausländischem Recht: 110,00 Euro); zuzüglich Urkunden und ggf. Nutzung besonderer Trauorte.',
      Bearbeitungsdauer: 'Anmeldung frühestens 6 Monate vor dem gewünschten Eheschließungstermin möglich.',
      Ablauf: 'Wunschtermin im Online-Traukalender vormerken und Eheschließung beim Standesamt anmelden.',
      Rechtsgrundlage: '§§ 11–15 Personenstandsgesetz (PStG).',
    },
    rollen: 'standesamt',
  },
  {
    id: 'lst-wohngeld',
    name: 'Wohngeld (Mietzuschuss oder Lastenzuschuss) beantragen',
    url: 'https://www.stuttgart.de/vv/leistungen/wohngeld-beantragen.php',
    leika: '99108001012000',
    zustaendig: 'Sozialamt Stuttgart – Wohngeldstelle',
    booking: null,
    onlineAngebote: [
      { art: 'land', titel: 'Wohngeld online über service-bw beantragen', url: 'https://www.service-bw.de/zufi/leistungen/400' },
    ],
    abschnitte: {
      Voraussetzungen: 'Wohnraum in Stuttgart; geringes Haushaltseinkommen; kein Bezug von Bürgergeld oder Grundsicherung, bei denen Unterkunftskosten bereits berücksichtigt sind.',
      'Benötigte Unterlagen': 'Mietvertrag und aktueller Mietnachweis; Einkommensnachweise aller Haushaltsmitglieder der letzten 12 Monate.',
      Gebühren: 'Gebührenfrei.',
      Bearbeitungsdauer: 'Zahlung erfolgt ab dem Monat der Antragstellung.',
      Ablauf: 'Antrag online über service-bw oder schriftlich bei der Wohngeldstelle des Sozialamts einreichen.',
      Rechtsgrundlage: 'Wohngeldgesetz (WoGG).',
    },
    rollen: 'sozialamt',
  },
  {
    id: 'lst-gewerbe',
    name: 'Gewerbe anmelden, ummelden oder abmelden',
    url: 'https://www.stuttgart.de/vv/leistungen/gewerbe-anmelden.php',
    leika: '99050003012000',
    zustaendig: 'Amt für öffentliche Ordnung – Gewerbebehörde / Bürgerbüros',
    booking: 'https://stuttgart.konsentas.de/form/29/',
    onlineAngebote: [
      { art: 'land', titel: 'Gewerbemeldung online über service-bw', url: 'https://www.service-bw.de/zufi/leistungen/236' },
      { art: 'termin', titel: 'Online-Terminvereinbarung Bürgerbüros', url: 'https://stuttgart.konsentas.de/form/29/' },
    ],
    abschnitte: {
      Voraussetzungen: 'Aufnahme einer selbstständigen gewerblichen Tätigkeit mit Betriebssitz in Stuttgart.',
      'Benötigte Unterlagen': 'Personalausweis oder Reisepass; bei im Handelsregister eingetragenen Unternehmen aktueller Handelsregisterauszug; ggf. Handwerkskarte oder Erlaubnis.',
      Gebühren: 'An- und Ummeldung: ca. 35,00 Euro; Abmeldung: gebührenfrei.',
      Bearbeitungsdauer: 'Bescheinigung (Gewerbeschein) innerhalb weniger Tage.',
      Ablauf: 'Online über service-bw oder persönlich in einem Bürgerbüro einreichen.',
      Rechtsgrundlage: '§ 14 Gewerbeordnung (GewO).',
    },
    rollen: 'buergerbuero',
  },
  {
    id: 'lst-hundesteuer',
    name: 'Hund zur Hundesteuer anmelden oder abmelden',
    url: 'https://www.stuttgart.de/vv/leistungen/hundesteuer-hund-anmelden.php',
    leika: '99083002012000',
    zustaendig: 'Stadtkämmerei – Steueramt / Bürgerbüros',
    booking: null,
    onlineAngebote: [
      { art: 'stadt', titel: 'Hundesteuer online an- und abmelden', url: 'https://service.stuttgart.de/lhs-services/hundesteuer/' },
    ],
    abschnitte: {
      Voraussetzungen: 'Haltung eines über drei Monate alten Hundes im Stadtgebiet Stuttgart; Anmeldung innerhalb eines Monats.',
      'Benötigte Unterlagen': 'Angaben zu Rasse, Wurfdatum, Anschaffungsdatum und ggf. Vorbesitzer.',
      Gebühren: 'Anmeldung gebührenfrei; Hundesteuer regulär 108,00 Euro pro Jahr für den ersten Hund.',
      Bearbeitungsdauer: 'Zusendung von Steuerbescheid und Hundesteuermarke per Post.',
      Ablauf: 'Online-Formular ausfüllen oder in einem Bürgerbüro bzw. beim Steueramt melden.',
      Rechtsgrundlage: 'Hundesteuersatzung der Landeshauptstadt Stuttgart.',
    },
    rollen: 'buergerbuero',
  },
];

const BASIS_AEMTER = [
  {
    id: 'einheit-rathaus',
    name: 'Rathaus Stuttgart – Zentrale und Bezirksamt Mitte',
    amt: 'Landeshauptstadt Stuttgart',
    art: 'Rathaus',
    rubrik: 'amt',
    address: 'Marktplatz 1, 70173 Stuttgart',
    stadtbezirk: 'Mitte',
    lat: 48.774905,
    lon: 9.177822,
    phone: '0711 216-0',
    email: 'poststelle@stuttgart.de',
    url: 'https://www.stuttgart.de/rathaus/',
    booking: null,
    hours: [
      { day: 'Montag bis Donnerstag', times: '08:00 – 16:00', note: '' },
      { day: 'Freitag', times: '08:00 – 13:00', note: '' },
    ],
    rollen: 'rathaus',
  },
  {
    id: 'einheit-ordnungsamt',
    name: 'Amt für öffentliche Ordnung (Eberhardstraße 33/39)',
    amt: 'Referat Sicherheit, Ordnung und Sport',
    art: 'Amt',
    rubrik: 'amt',
    address: 'Eberhardstraße 39, 70173 Stuttgart',
    stadtbezirk: 'Mitte',
    lat: 48.772850,
    lon: 9.176550,
    phone: '0711 216-32123',
    email: 'ordnungsamt@stuttgart.de',
    url: 'https://www.stuttgart.de/vv/verwaltungseinheit/amt-fuer-oeffentliche-ordnung.php',
    booking: 'https://stuttgart.konsentas.de/',
    hours: BB_HOURS,
    rollen: 'buergerbuero',
  },
  {
    id: 'einheit-kfz',
    name: 'Kfz-Zulassungsstelle und Führerscheinstelle',
    amt: 'Amt für öffentliche Ordnung',
    art: 'Dienststelle',
    rubrik: 'amt',
    address: 'Wolframstraße 20, 70191 Stuttgart',
    stadtbezirk: 'Nord',
    lat: 48.790520,
    lon: 9.181940,
    phone: '0711 216-91111',
    email: 'kfz-zulassung@stuttgart.de',
    url: 'https://www.stuttgart.de/vv/verwaltungseinheit/kfz-zulassungsstelle.php',
    booking: 'https://stuttgart.konsentas.de/form/5/',
    hours: [
      { day: 'Montag bis Mittwoch', times: '08:15 – 12:30 und 14:00 – 15:30', note: 'nach vorheriger Online-Terminvereinbarung' },
      { day: 'Donnerstag', times: '08:15 – 12:30 und 14:00 – 17:30', note: 'nach vorheriger Online-Terminvereinbarung' },
      { day: 'Freitag', times: '08:15 – 12:00', note: 'nach vorheriger Online-Terminvereinbarung' },
    ],
    rollen: 'kfz',
  },
  {
    id: 'einheit-standesamt',
    name: 'Standesamt und Sozialamt (Eichstraße 7)',
    amt: 'Landeshauptstadt Stuttgart',
    art: 'Amt',
    rubrik: 'beratung_soziales',
    address: 'Eichstraße 7, 70173 Stuttgart',
    stadtbezirk: 'Mitte',
    lat: 48.774120,
    lon: 9.176980,
    phone: '0711 216-0',
    email: 'standesamt@stuttgart.de',
    url: 'https://www.stuttgart.de/vv/verwaltungseinheit/standesamt.php',
    booking: 'https://service.stuttgart.de/lhs-services/traukalender/',
    hours: [
      { day: 'Montag, Mittwoch, Freitag', times: '08:30 – 12:30', note: '' },
      { day: 'Donnerstag', times: '08:30 – 12:30 und 14:00 – 16:00', note: 'nach vorheriger Online-Terminvereinbarung' },
    ],
    rollen: 'standesamt,sozialamt',
  },
  {
    id: 'einheit-jugendamt',
    name: 'Jugendamt Stuttgart',
    amt: 'Referat Jugend und Bildung',
    art: 'Amt',
    rubrik: 'beratung_soziales',
    address: 'Wilhelmstraße 3, 70182 Stuttgart',
    stadtbezirk: 'Mitte',
    lat: 48.773150,
    lon: 9.179450,
    phone: '0711 216-55555',
    email: 'jugendamt@stuttgart.de',
    url: 'https://www.stuttgart.de/vv/verwaltungseinheit/jugendamt.php',
    booking: null,
    hours: [
      { day: 'Montag bis Donnerstag', times: '08:30 – 16:00', note: '' },
      { day: 'Freitag', times: '08:30 – 13:00', note: '' },
    ],
    rollen: 'jugendamt',
  },
  {
    id: 'einheit-aws',
    name: 'Abfallwirtschaft Stuttgart (AWS) – Kundenzentrum',
    amt: 'Eigenbetrieb Abfallwirtschaft Stuttgart',
    art: 'Eigenbetrieb',
    rubrik: 'amt',
    address: 'Heinrich-Baumann-Straße 4, 70190 Stuttgart',
    stadtbezirk: 'Ost',
    lat: 48.791840,
    lon: 9.198610,
    phone: '0711 216-88700',
    email: 'aws@stuttgart.de',
    url: 'https://www.stuttgart.de/aws',
    booking: null,
    hours: [
      { day: 'Montag bis Donnerstag', times: '08:00 – 16:30', note: '' },
      { day: 'Freitag', times: '08:00 – 15:00', note: '' },
    ],
    rollen: 'aws',
  },
];

// ---------- Laden und Aufbereiten des Datensatzes ----------
let storeCache = { key: '', data: null };

function fileSig(path) {
  try { return existsSync(path) ? `${path}:${statSync(path).mtimeMs}` : ''; } catch { return ''; }
}

function buildFromDock(rawItems) {
  const gebMap = new Map();
  const einheiten = [];
  const leistungenMap = new Map();

  for (const l of BASIS_LEISTUNGEN) {
    leistungenMap.set(l.url, { ...l, gebaeudeIds: new Set() });
  }

  rawItems.forEach((u, idx) => {
    const lat = Number(u.lat); const lon = Number(u.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const addr = String(u.address ?? '').trim() || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const gebKey = addr.toLowerCase().replace(/\s+/g, ' ');
    let geb = gebMap.get(gebKey);
    if (!geb) {
      geb = {
        id: u.gebaeude_id ?? `geb-${gebMap.size + 1}`,
        address: addr,
        stadtbezirk: u.stadtbezirk ?? u.district ?? districtOf(`${u.name ?? ''} ${addr}`) ?? 'Stuttgart',
        lat,
        lon,
        einheiten: [],
        leistungenSet: new Set(),
        buergerbuero: false,
        tafel_id: null,
      };
      gebMap.set(gebKey, geb);
    }
    const tafel = u.department ?? u.tafel_id ?? (String(u.ibs_id ?? '').match(/(\d{5,})/)?.[1] ? Number(String(u.ibs_id).match(/(\d{5,})/)[1]) : null);
    const rubrik = rubrikOf({ ...u, tafel_id: tafel });
    if (rubrik === 'buergerbuero') geb.buergerbuero = true;
    if (tafel && !geb.tafel_id) geb.tafel_id = Number(tafel);

    const svcs = (u.services ?? u.leistungen ?? []).map((s) => {
      const url = s.url ?? `https://www.stuttgart.de/vv/leistungen/${normSearch(s.name).replace(/\s+/g, '-')}.php`;
      geb.leistungenSet.add(url);
      if (!leistungenMap.has(url)) {
        leistungenMap.set(url, {
          id: `lst-${leistungenMap.size + 1}`,
          name: s.name,
          url,
          leika: s.leika ?? null,
          zustaendig: u.amt ?? u.name,
          booking: u.booking ?? null,
          onlineAngebote: [
            ...(u.booking ? [{ art: 'termin', titel: 'Termin buchen', url: u.booking }] : []),
            ...(s.online ? [{ art: 'stadt', titel: 'Online erledigen', url: s.onlineUrl ?? url }] : []),
          ],
          abschnitte: s.abschnitte ?? {},
          gebaeudeIds: new Set([geb.id]),
        });
      } else {
        leistungenMap.get(url).gebaeudeIds.add(geb.id);
      }
      return {
        name: s.name,
        url,
        rolle: s.rolle ?? 'angeboten in',
        online: Boolean(s.online),
        booking: u.booking ?? null,
      };
    });

    const einheit = {
      id: String(u.id ?? `e-${idx + 1}`),
      gebaeudeId: geb.id,
      name: u.name,
      amt: u.amt ?? null,
      art: u.art ?? (rubrik === 'buergerbuero' ? 'Bürgerbüro' : 'Dienststelle'),
      rubrik,
      address: addr,
      stadtbezirk: geb.stadtbezirk,
      lat,
      lon,
      phone: u.phone ?? u.telefon ?? null,
      email: u.email ?? null,
      url: u.web ?? u.url ?? null,
      booking: u.booking ?? null,
      hours: u.oeffnungszeiten_json ?? u.hours ?? null,
      tafel_id: tafel ? Number(tafel) : null,
      onlineAngebote: u.onlineAngebote ?? [
        ...(u.booking ? [{ art: 'termin', titel: 'Termin buchen', url: u.booking }] : []),
      ],
      leistungen: svcs,
    };
    geb.einheiten.push(einheit);
    einheiten.push(einheit);
  });

  const gebaeude = [...gebMap.values()].map(({ leistungenSet, ...g }) => ({
    ...g,
    leistungenCount: leistungenSet.size,
    rubriken: [...new Set(g.einheiten.map((e) => e.rubrik))],
  }));

  const leistungen = [...leistungenMap.values()].map(({ gebaeudeIds, ...l }) => ({
    ...l,
    gebaeudeIds: [...gebaeudeIds],
  }));

  return { gebaeude, einheiten, leistungen, stand: '20.10.2026', sourceMode: 'datensatz' };
}

const BASIS_BUERGERBUEROS = [
  { id: 1, department: 101268, label: 'Mitte', name: 'Bürgerbüro Mitte', address: 'Eberhardstraße 39, 70173 Stuttgart', lat: 48.77285, lon: 9.17655, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-mitte.php' },
  { id: 2, department: 101269, label: 'Bad Cannstatt', name: 'Bürgerbüro Bad Cannstatt', address: 'Marktplatz 2, 70372 Stuttgart', lat: 48.80539, lon: 9.21414, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-bad-cannstatt.php' },
  { id: 3, department: 101270, label: 'Botnang', name: 'Bürgerbüro Botnang', address: 'Griegstraße 18, 70195 Stuttgart', lat: 48.77822, lon: 9.12872, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-botnang.php' },
  { id: 4, department: 101271, label: 'Degerloch', name: 'Bürgerbüro Degerloch', address: 'Große Falterstraße 2, 70597 Stuttgart', lat: 48.74838, lon: 9.17045, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-degerloch.php' },
  { id: 5, department: 101272, label: 'Feuerbach', name: 'Bürgerbüro Feuerbach', address: 'Wilhelm-Geiger-Platz 10, 70469 Stuttgart', lat: 48.81174, lon: 9.15808, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-feuerbach.php' },
  { id: 6, department: 101273, label: 'Hedelfingen', name: 'Bürgerbüro Hedelfingen', address: 'Heumadener Straße 1, 70329 Stuttgart', lat: 48.75824, lon: 9.25461, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-hedelfingen.php' },
  { id: 7, department: 101274, label: 'Möhringen', name: 'Bürgerbüro Möhringen', address: 'Maierstraße 1, 70567 Stuttgart', lat: 48.72995, lon: 9.14635, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-moehringen.php' },
  { id: 8, department: 101275, label: 'Mühlhausen', name: 'Bürgerbüro Mühlhausen', address: 'Melonenstraße 28, 70378 Stuttgart', lat: 48.84231, lon: 9.22854, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-muehlhausen.php' },
  { id: 9, department: 101276, label: 'Münster', name: 'Bürgerbüro Münster', address: 'Schussengasse 10, 70376 Stuttgart', lat: 48.82291, lon: 9.20892, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-muenster.php' },
  { id: 10, department: 101277, label: 'Nord', name: 'Bürgerbüro Nord', address: 'Stresemannstraße 15, 70191 Stuttgart', lat: 48.80248, lon: 9.18061, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-nord.php' },
  { id: 11, department: 101278, label: 'Obertürkheim', name: 'Bürgerbüro Obertürkheim', address: 'Augsburger Straße 674, 70329 Stuttgart', lat: 48.76419, lon: 9.26873, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-obertuerkheim.php' },
  { id: 12, department: 101279, label: 'Ost', name: 'Bürgerbüro Ost', address: 'Schönbühlstraße 65, 70188 Stuttgart', lat: 48.78488, lon: 9.20632, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-ost.php' },
  { id: 13, department: 101280, label: 'Plieningen', name: 'Bürgerbüro Plieningen', address: 'Filderhauptstraße 155, 70599 Stuttgart', lat: 48.71761, lon: 9.20832, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-plieningen.php' },
  { id: 14, department: 101281, label: 'Süd', name: 'Bürgerbüro Süd', address: 'Böblinger Straße 43, 70199 Stuttgart', lat: 48.76342, lon: 9.16518, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-sued.php' },
  { id: 15, department: 101282, label: 'Stammheim', name: 'Bürgerbüro Stammheim', address: 'Freihofstraße 37, 70439 Stuttgart', lat: 48.84752, lon: 9.15634, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-stammheim.php' },
  { id: 16, department: 101283, label: 'Untertürkheim', name: 'Bürgerbüro Untertürkheim', address: 'Großglocknerstraße 24, 70327 Stuttgart', lat: 48.78012, lon: 9.25128, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-untertuerkheim.php' },
  { id: 17, department: 101284, label: 'Vaihingen', name: 'Bürgerbüro Vaihingen', address: 'Rathausplatz 1, 70563 Stuttgart', lat: 48.73114, lon: 9.10862, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-vaihingen.php' },
  { id: 18, department: 101285, label: 'Weilimdorf', name: 'Bürgerbüro Weilimdorf', address: 'Löwen-Markt 1, 70499 Stuttgart', lat: 48.81412, lon: 9.11284, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-weilimdorf.php' },
  { id: 19, department: 101286, label: 'Zuffenhausen', name: 'Bürgerbüro Zuffenhausen', address: 'Emil-Schuler-Platz 1, 70435 Stuttgart', lat: 48.83124, lon: 9.17042, url: 'https://www.stuttgart.de/vv/verwaltungseinheit/buergerbuero-zuffenhausen.php' },
];

async function buildBasisWithLiveBb() {
  let bbItems = [];
  try {
    bbItems = (await buergerbueros()).items ?? [];
  } catch {
    bbItems = [];
  }
  const sourceBbs = bbItems.filter((b) => b.lat != null && b.lon != null).length ? bbItems : BASIS_BUERGERBUEROS;
  const dockLike = [];

  for (const b of sourceBbs) {
    if (b.lat == null || b.lon == null) continue;
    const bbServices = BASIS_LEISTUNGEN.filter((l) => l.rollen.includes('buergerbuero')).map((l) => ({
      name: l.name,
      url: l.url,
      online: l.onlineAngebote.some((o) => o.art !== 'termin'),
      rolle: 'angeboten in',
    }));
    dockLike.push({
      id: `bb-${b.id}`,
      name: b.name ?? `Bürgerbüro ${b.label}`,
      amt: 'Amt für öffentliche Ordnung',
      art: 'Bürgerbüro',
      rubrik: 'buergerbuero',
      lat: b.lat,
      lon: b.lon,
      address: b.address ?? `Stuttgart-${b.label}`,
      stadtbezirk: b.label,
      phone: b.phone ?? '0711 216-0',
      email: b.email ?? `buergerbuero.${normSearch(b.label).replace(/\s+/g, '')}@stuttgart.de`,
      web: b.url ?? b.web ?? 'https://www.stuttgart.de/buergerbuero/',
      booking: b.booking ?? 'https://stuttgart.konsentas.de/form/29/',
      department: b.department ?? b.ref ?? b.id,
      hours: BB_HOURS,
      services: bbServices,
    });
  }

  for (const a of BASIS_AEMTER) {
    const roles = a.rollen.split(',');
    const svcs = BASIS_LEISTUNGEN.filter((l) => roles.some((r) => l.rollen.includes(r))).map((l) => ({
      name: l.name,
      url: l.url,
      online: l.onlineAngebote.some((o) => o.art !== 'termin'),
      rolle: 'zuständig',
    }));
    dockLike.push({ ...a, web: a.url, services: svcs });
  }

  const built = buildFromDock(dockLike);
  return { ...built, sourceMode: 'basis' };
}

function mapOnlineArt(art) {
  if (art === 'terminbuchung' || art === 'termin') return 'termin';
  if (art === 'online_dienst_stadt' || art === 'online_dienst_sonstige' || art === 'stadt') return 'stadt';
  if (art === 'online_dienst_land' || art === 'land') return 'land';
  if (art === 'online_dienst_bund' || art === 'bund') return 'bund';
  if (art === 'formular') return 'formular';
  return null;
}

async function buildFromSqlite(sqlitePath, dockPath) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(sqlitePath, { readOnly: true });

  const dockRubrikByUrl = new Map();
  if (existsSync(dockPath)) {
    try {
      const dock = JSON.parse(readFileSync(dockPath, 'utf8'));
      for (const item of dock.items ?? []) {
        if (item.web || item.id) dockRubrikByUrl.set(item.web ?? item.id, item.rubrik);
      }
    } catch { /* optional */ }
  }

  const gebRows = db.prepare('SELECT * FROM gebaeude WHERE lat IS NOT NULL AND lon IS NOT NULL').all();
  const einhRows = db.prepare('SELECT * FROM einheiten').all();
  const lstRows = db.prepare('SELECT * FROM leistungen').all();
  const leRows = db.prepare('SELECT * FROM leistung_einheit').all();
  const oaRows = db.prepare('SELECT ov.quelle_url, oa.url, oa.art, oa.bezeichnung FROM online_verweise ov JOIN online_angebote oa ON oa.url = ov.angebot_url').all();
  const wzRows = db.prepare('SELECT * FROM wartezeiten').all();
  db.close();

  const oaBySource = new Map();
  for (const r of oaRows) {
    const mappedArt = mapOnlineArt(r.art);
    if (!mappedArt) continue;
    let list = oaBySource.get(r.quelle_url);
    if (!list) { list = []; oaBySource.set(r.quelle_url, list); }
    if (!list.some((x) => x.url === r.url)) {
      list.push({ art: mappedArt, titel: r.bezeichnung || 'Online-Angebot', url: r.url });
    }
  }

  const leistungenMap = new Map();
  lstRows.forEach((l, idx) => {
    if (String(l.url).includes('sp%3Aout=easy') || String(l.url).includes('sp:out=easy')) return;
    const abschnitte = {};
    if (l.voraussetzungen) abschnitte['Voraussetzungen'] = l.voraussetzungen;
    if (l.unterlagen) abschnitte['Benötigte Unterlagen'] = l.unterlagen;
    if (l.gebuehren) abschnitte['Gebühren'] = l.gebuehren;
    if (l.bearbeitungsdauer) abschnitte['Bearbeitungsdauer'] = l.bearbeitungsdauer;
    if (l.ablauf) abschnitte['Ablauf'] = l.ablauf;
    if (l.rechtsgrundlage) abschnitte['Rechtsgrundlage'] = l.rechtsgrundlage;

    const oas = oaBySource.get(l.url) ?? [];
    const booking = oas.find((o) => o.art === 'termin')?.url ?? null;
    const online = oas.some((o) => o.art === 'stadt' || o.art === 'land' || o.art === 'bund');

    leistungenMap.set(l.url, {
      id: l.cms_id ? `lst-${l.cms_id}` : `lst-${idx + 1}`,
      name: l.name,
      url: l.url,
      leika: l.leika ? String(l.leika).split(';')[0] : null,
      zustaendig: l.zustaendig_dachzeile ?? null,
      booking,
      online,
      onlineAngebote: oas.filter((o) => o.art !== 'formular'),
      abschnitte,
      gebaeudeIds: new Set(),
    });
  });

  const gebMap = new Map();
  for (const g of gebRows) {
    const address = [g.strasse, [g.plz, g.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    gebMap.set(g.id, {
      id: g.id,
      address: address || g.id,
      stadtbezirk: g.stadtbezirk ?? null,
      lat: Number(g.lat),
      lon: Number(g.lon),
      einheiten: [],
      leistungenSet: new Set(),
      buergerbuero: false,
      tafel_id: null,
      department: null,
    });
  }

  const svcsByUnitUrl = new Map();
  for (const le of leRows) {
    const l = leistungenMap.get(le.leistung_url);
    if (!l) continue;
    let arr = svcsByUnitUrl.get(le.einheit_url);
    if (!arr) { arr = []; svcsByUnitUrl.set(le.einheit_url, arr); }
    if (!arr.some((x) => x.url === l.url)) {
      const rolleLabel = le.rolle === 'zustaendig' ? 'zuständig' : le.rolle === 'angeboten_in' ? 'angeboten in' : 'verlinkt';
      arr.push({
        id: l.id,
        name: l.name,
        url: l.url,
        rolle: rolleLabel,
        online: l.online,
        booking: l.booking,
      });
    }
  }

  const einheiten = [];
  for (const e of einhRows) {
    const geb = e.gebaeude_id ? gebMap.get(e.gebaeude_id) : null;
    const lat = Number(e.lat ?? geb?.lat);
    const lon = Number(e.lon ?? geb?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    let phone = null;
    if (e.telefon_json) {
      try {
        const parsed = JSON.parse(e.telefon_json);
        if (Array.isArray(parsed) && parsed.length) phone = parsed[0].number ?? null;
      } catch { /* egal */ }
    }
    let hours = e.oeffnungszeiten_text ?? null;
    if (e.oeffnungszeiten_json) {
      try {
        const parsed = JSON.parse(e.oeffnungszeiten_json);
        if (Array.isArray(parsed) && parsed.length) hours = parsed;
      } catch { /* egal */ }
    }

    const deptMatch = String(e.ibs_id ?? '').match(/ibs\.dept\.(\d+)/i);
    const department = deptMatch ? Number(deptMatch[1]) : null;
    const tafel_id = e.wartezeit_tafel_id != null ? Number(e.wartezeit_tafel_id) : null;
    const dockRubrik = dockRubrikByUrl.get(e.url);
    const rubrik = rubrikOf({ ...e, rubrik: dockRubrik, wartezeit_tafel_id: tafel_id });

    const unitOas = (oaBySource.get(e.url) ?? []).filter((o) => o.art !== 'formular');
    const booking = unitOas.find((o) => o.art === 'termin')?.url ?? null;
    const unitSvcs = svcsByUnitUrl.get(e.url) ?? [];
    const targetGebId = geb ? geb.id : `geb-u-${e.cms_id ?? einheiten.length}`;

    if (geb) {
      if (rubrik === 'buergerbuero') geb.buergerbuero = true;
      if (tafel_id && !geb.tafel_id) geb.tafel_id = tafel_id;
      if (department && !geb.department) geb.department = department;
      for (const s of unitSvcs) {
        geb.leistungenSet.add(s.url);
        const lObj = leistungenMap.get(s.url);
        if (lObj) {
          lObj.gebaeudeIds.add(geb.id);
          if (!lObj.zustaendig && s.rolle === 'zuständig') lObj.zustaendig = e.name;
        }
      }
    }

    const einheit = {
      id: e.cms_id ? `e-${e.cms_id}` : e.url,
      gebaeudeId: targetGebId,
      name: e.name,
      amt: e.uebergeordnet ?? null,
      art: e.art === 'verwaltungseinheit' ? (rubrik === 'buergerbuero' ? 'Bürgerbüro' : 'Dienststelle') : e.art,
      rubrik,
      address: geb?.address ?? ([e.strasse, [e.plz, e.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Stuttgart'),
      stadtbezirk: geb?.stadtbezirk ?? null,
      lat,
      lon,
      phone,
      email: e.email ?? null,
      url: e.url,
      booking,
      hours,
      tafel_id,
      department,
      onlineAngebote: unitOas,
      leistungen: unitSvcs,
    };

    if (geb) geb.einheiten.push(einheit);
    einheiten.push(einheit);
  }

  // Sortiere Einheiten im Gebäude: Verwaltungseinheiten vor Adressen
  const gebaeude = [...gebMap.values()]
    .filter((g) => g.einheiten.length > 0)
    .map(({ leistungenSet, ...g }) => {
      g.einheiten.sort((a, b) => {
        const prio = (x) => (x.rubrik === 'buergerbuero' ? 0 : x.rubrik === 'amt' || x.rubrik === 'bezirksamt' ? 1 : x.rubrik === 'beratung_soziales' ? 2 : x.rubrik === 'schule_bildung' ? 3 : 4);
        return prio(a) - prio(b) || b.leistungen.length - a.leistungen.length;
      });
      return {
        ...g,
        leistungenCount: leistungenSet.size,
        rubriken: [...new Set(g.einheiten.map((e) => e.rubrik))],
      };
    });

  const leistungen = [...leistungenMap.values()].map(({ gebaeudeIds, ...l }) => ({
    ...l,
    gebaeudeIds: [...gebaeudeIds],
  }));

  return { gebaeude, einheiten, leistungen, wzSnapshot: wzRows, stand: '20.10.2026', sourceMode: 'sqlite' };
}

async function getStore() {
  const demoPath = FILES.demo();
  const dockPath = FILES.dock();
  const sqlitePath = FILES.sqlite();
  const sig = [fileSig(sqlitePath), fileSig(demoPath), fileSig(dockPath)].filter(Boolean).join('|');

  if (sig && storeCache.key === sig && storeCache.data) return storeCache.data;

  if (existsSync(sqlitePath)) {
    try {
      const data = await buildFromSqlite(sqlitePath, dockPath);
      if (data.gebaeude.length) {
        storeCache = { key: sig, data };
        return data;
      }
    } catch (e) {
      console.warn(`verwaltung.sqlite nicht direkt lesbar: ${e.message}`);
    }
  }

  if (existsSync(demoPath)) {
    try {
      const raw = JSON.parse(readFileSync(demoPath, 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.einheiten ?? raw.items ?? [];
      if (list.length) {
        const data = buildFromDock(list);
        storeCache = { key: sig, data };
        return data;
      }
    } catch (e) {
      console.warn(`verwaltung-demo.json nicht lesbar: ${e.message}`);
    }
  }

  if (existsSync(dockPath)) {
    try {
      const raw = JSON.parse(readFileSync(dockPath, 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.items ?? raw.features?.map((f) => ({ ...f.properties, lon: f.geometry?.coordinates?.[0], lat: f.geometry?.coordinates?.[1] })) ?? [];
      if (list.length) {
        const data = buildFromDock(list);
        storeCache = { key: sig, data };
        return data;
      }
    } catch (e) {
      console.warn(`verwaltung.json nicht lesbar: ${e.message}`);
    }
  }

  return buildBasisWithLiveBb();
}

async function liveBbMap(wzSnapshot = []) {
  const byDept = new Map();
  const byTafel = new Map();
  const byLabel = new Map();
  for (const w of wzSnapshot) {
    const info = { ...ampelDarstellung(w.status), id: w.tafel_id, label: w.bezeichnung, fetchedAt: w.abgerufen };
    if (w.department) byDept.set(Number(w.department), info);
    if (w.tafel_id) byTafel.set(Number(w.tafel_id), info);
    if (w.bezeichnung) byLabel.set(normSearch(w.bezeichnung), info);
  }
  try {
    const r = await buergerbueros();
    for (const b of r.items ?? []) {
      const info = { ...ampelDarstellung(b.status), id: b.id, label: b.label, fetchedAt: r.fetchedAt, usual: b.usual, best: b.best };
      if (b.department) byDept.set(Number(b.department), info);
      byTafel.set(Number(b.id), info);
      if (b.label) byLabel.set(normSearch(b.label), info);
    }
  } catch { /* Wartezeit optional, Snapshot bleibt erhalten */ }
  return { byDept, byTafel, byLabel };
}

function matchBbWait(gebOrUnit, bbMap) {
  if (gebOrUnit.department && bbMap.byDept.has(Number(gebOrUnit.department))) return bbMap.byDept.get(Number(gebOrUnit.department));
  if (gebOrUnit.tafel_id && bbMap.byTafel.has(Number(gebOrUnit.tafel_id))) return bbMap.byTafel.get(Number(gebOrUnit.tafel_id));
  if (gebOrUnit.tafel_id && bbMap.byDept.has(Number(gebOrUnit.tafel_id))) return bbMap.byDept.get(Number(gebOrUnit.tafel_id));
  const n = normSearch(gebOrUnit.name ?? gebOrUnit.stadtbezirk ?? '');
  for (const [label, info] of bbMap.byLabel.entries()) {
    if (label && n.includes(label)) return info;
  }
  return null;
}

// ---------- 1. /api/verwaltung/gebaeude (GeoJSON & Einzelgebäude) ----------
export async function verwaltungGebaeude(id, rubrikFilter) {
  const store = await getStore();
  const bbMap = await liveBbMap(store.wzSnapshot);
  const now = new Date();

  if (id) {
    const g = store.gebaeude.find((x) => x.id === id)
      ?? store.gebaeude.find((x) => x.einheiten.some((e) => e.id === id || e.url === id));
    if (!g) throw Object.assign(new Error('Gebäude nicht gefunden'), { status: 404 });
    const wartezeit = g.buergerbuero ? matchBbWait(g, bbMap) : null;
    return {
      id: g.id,
      address: g.address,
      stadtbezirk: g.stadtbezirk,
      lat: g.lat,
      lon: g.lon,
      buergerbuero: g.buergerbuero,
      tafel_id: g.tafel_id,
      wartezeit,
      einheiten: g.einheiten.map((e) => ({
        id: e.id,
        name: e.name,
        amt: e.amt,
        art: e.art,
        rubrik: e.rubrik,
        url: e.url,
        booking: e.booking,
        phone: e.phone,
        email: e.email,
        oeffnungszeiten: normalizeHoursRows(e.hours),
        jetztGeoeffnet: jetztGeoeffnet(e.hours, now),
        wartezeit: e.rubrik === 'buergerbuero' ? (matchBbWait(e, bbMap) ?? wartezeit) : null,
        onlineAngebote: e.onlineAngebote ?? [],
        leistungen: e.leistungen ?? [],
      })),
      stand: store.stand,
      sourceMode: store.sourceMode,
      source: `Landeshauptstadt Stuttgart, stuttgart.de, Stand ${store.stand}`,
    };
  }

  const wanted = rubrikFilter
    ? new Set(String(rubrikFilter).split(',').map((s) => s.trim()).filter(Boolean))
    : new Set(RUBRIKEN.filter((r) => r.defaultOn).map((r) => r.id));

  const features = store.gebaeude
    .filter((g) => !wanted.size || g.rubriken.some((r) => wanted.has(r)))
    .map((g) => {
      const wartezeit = g.buergerbuero ? matchBbWait(g, bbMap) : null;
      const openInfos = g.einheiten.map((e) => jetztGeoeffnet(e.hours, now)).filter(Boolean);
      const anyOpen = openInfos.some((o) => o.state === 'offen');
      const anyTermin = !anyOpen && openInfos.some((o) => o.state === 'termin');
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [g.lon, g.lat] },
        properties: {
          id: g.id,
          name: g.einheiten[0]?.name ?? g.address,
          address: g.address,
          stadtbezirk: g.stadtbezirk,
          einheitenCount: g.einheiten.length,
          einheiten: g.einheiten.slice(0, 6).map((e) => ({ id: e.id, name: e.name, art: e.art, rubrik: e.rubrik, amt: e.amt })),
          leistungenCount: g.leistungenCount,
          rubrik: g.buergerbuero ? 'buergerbuero' : g.rubriken[0] ?? 'amt',
          rubriken: g.rubriken,
          buergerbuero: g.buergerbuero,
          tafel_id: g.tafel_id,
          jetzt: anyOpen ? 'offen' : anyTermin ? 'termin' : openInfos.length ? 'geschlossen' : 'unbekannt',
          jetztText: openInfos[0]?.text ?? null,
          wartezeit,
        },
      };
    });

  return {
    type: 'FeatureCollection',
    features,
    rubriken: RUBRIKEN,
    totalGebaeude: store.gebaeude.length,
    totalEinheiten: store.einheiten.length,
    totalLeistungen: store.leistungen.length,
    stand: store.stand,
    sourceMode: store.sourceMode,
    source: `Landeshauptstadt Stuttgart, stuttgart.de, Stand ${store.stand}`,
  };
}

// ---------- 2. /api/verwaltung/leistung?url=… ----------
export async function verwaltungLeistung(urlOrId) {
  if (!urlOrId) throw Object.assign(new Error('url oder id der Leistung angeben'), { status: 400 });
  const store = await getStore();
  const q = String(urlOrId).trim();
  const slug = normSearch(q.split('/').pop()?.replace(/\.php$/i, '') ?? q);
  const l = store.leistungen.find((x) => x.url === q || x.id === q)
    ?? store.leistungen.find((x) => normSearch(x.name) === normSearch(q))
    ?? store.leistungen.find((x) => slug && normSearch(x.url).includes(slug))
    ?? store.leistungen.find((x) => slug && normSearch(x.name).includes(slug));
  if (!l) throw Object.assign(new Error('Leistung nicht gefunden'), { status: 404 });

  const bbMap = await liveBbMap(store.wzSnapshot);
  const now = new Date();
  const orte = store.gebaeude
    .filter((g) => l.gebaeudeIds.includes(g.id))
    .map((g) => {
      const unit = g.einheiten.find((e) => e.leistungen?.some((s) => s.url === l.url)) ?? g.einheiten[0];
      return {
        gebaeudeId: g.id,
        name: unit?.name ?? g.address,
        amt: unit?.amt ?? null,
        address: g.address,
        stadtbezirk: g.stadtbezirk,
        lat: g.lat,
        lon: g.lon,
        booking: unit?.booking ?? l.booking ?? null,
        jetztGeoeffnet: unit ? jetztGeoeffnet(unit.hours, now) : null,
        wartezeit: g.buergerbuero ? matchBbWait(g, bbMap) : null,
      };
    });

  return {
    id: l.id,
    name: l.name,
    url: l.url,
    leika: l.leika ?? null,
    zustaendig: l.zustaendig ?? null,
    booking: l.booking ?? orte.find((o) => o.booking)?.booking ?? null,
    onlineAngebote: l.onlineAngebote ?? [],
    abschnitte: l.abschnitte ?? {},
    orte,
    stand: store.stand,
    source: `Landeshauptstadt Stuttgart, stuttgart.de, Stand ${store.stand}`,
  };
}

// ---------- 3. /api/verwaltung/suche?q=… ----------
export async function verwaltungSuche(q) {
  const raw = String(q ?? '').trim();
  if (raw.length < 2) return { q: raw, leistungen: [], einheiten: [], gebaeude: [], total: 0 };
  const store = await getStore();
  const terms = expandQuery(raw);
  const direct = normSearch(raw);

  const scoreItem = (title, body) => {
    const nt = normSearch(title);
    const nb = normSearch(body);
    let score = 0;
    if (nt === direct) score += 100;
    else if (nt.startsWith(direct)) score += 60;
    else if (nt.includes(direct)) score += 40;
    for (const t of terms) {
      if (nt.includes(t)) score += 20;
      else if (nb.includes(t)) score += 6;
    }
    return score;
  };

  const leistungen = store.leistungen
    .map((l) => {
      const body = `${l.zustaendig ?? ''} ${Object.values(l.abschnitte ?? {}).join(' ')}`;
      return { l, score: scoreItem(l.name, body) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.l.name.localeCompare(b.l.name, 'de'))
    .slice(0, 10)
    .map(({ l }) => ({
      id: l.id,
      name: l.name,
      url: l.url,
      leika: l.leika,
      zustaendig: l.zustaendig,
      online: (l.onlineAngebote ?? []).some((o) => o.art !== 'termin'),
      booking: l.booking ?? null,
      kurz: l.abschnitte?.Voraussetzungen ?? l.abschnitte?.Ablauf ?? null,
    }));

  const einheiten = store.einheiten
    .map((e) => {
      const body = `${e.amt ?? ''} ${e.address ?? ''} ${(e.leistungen ?? []).map((s) => s.name).join(' ')}`;
      return { e, score: scoreItem(e.name, body) };
    })
    // Biografische Einträge wie „Friedrich Hölderlin – Aufenthaltsort …“ sind bei
    // aufenthaltsrechtlichen Fragen kein Treffer, sondern nur ein Wortspiel.
    .filter((x) => x.score > 0 && !(/aufenthaltsort/i.test(x.e.name) && !/aufenthaltsort|\bort\b/.test(normSearch(raw))))
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, 'de'))
    .slice(0, 8)
    .map(({ e }) => ({
      id: e.id,
      gebaeudeId: e.gebaeudeId,
      name: e.name,
      amt: e.amt,
      rubrik: e.rubrik,
      address: e.address,
      stadtbezirk: e.stadtbezirk,
      lat: e.lat,
      lon: e.lon,
      leistungenCount: e.leistungen?.length ?? 0,
    }));

  const gebaeude = store.gebaeude
    .map((g) => ({ g, score: scoreItem(g.address, g.einheiten.map((e) => e.name).join(' ')) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ g }) => ({
      id: g.id,
      address: g.address,
      stadtbezirk: g.stadtbezirk,
      lat: g.lat,
      lon: g.lon,
      einheitenCount: g.einheiten.length,
      buergerbuero: g.buergerbuero,
    }));

  return {
    q: raw,
    leistungen,
    einheiten,
    gebaeude,
    total: leistungen.length + einheiten.length + gebaeude.length,
    stand: store.stand,
  };
}

// ---------- 4. /api/verwaltung/wo?leistung=…&lat=…&lon=… ----------
export async function verwaltungWo(leistungUrlOrId, lat, lon) {
  const detail = await verwaltungLeistung(leistungUrlOrId);
  const hasOrigin = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));
  const pt = hasOrigin ? [Number(lon), Number(lat)] : [9.1778, 48.7749];

  const orte = detail.orte
    .map((o) => ({
      ...o,
      dist: distM(pt, [o.lon, o.lat]),
    }))
    .sort((a, b) => a.dist - b.dist);

  return {
    leistung: { id: detail.id, name: detail.name, url: detail.url, booking: detail.booking, onlineAngebote: detail.onlineAngebote },
    orte,
    stand: detail.stand,
    source: detail.source,
  };
}

// ---------- 5. Werkzeuge für den Assistenten (Abschnitt 7.2) ----------
export async function verwaltungWerkzeug(tool, params = {}) {
  switch (tool) {
    case 'suche_leistung': {
      const r = await verwaltungSuche(params.q);
      return { tool, treffer: r.leistungen.slice(0, 5), stand: r.stand };
    }
    case 'leistung':
      return verwaltungLeistung(params.url ?? params.id);
    case 'wo_erledigen':
      return verwaltungWo(params.url ?? params.leistung, params.lat, params.lon);
    case 'einheit': {
      const store = await getStore();
      const q = normSearch(params.url ?? params.name ?? '');
      const e = store.einheiten.find((x) => x.url === params.url || x.id === params.url || normSearch(x.name).includes(q));
      if (!e) throw Object.assign(new Error('Einheit nicht gefunden'), { status: 404 });
      return verwaltungGebaeude(e.gebaeudeId);
    }
    case 'wartezeit': {
      const r = await buergerbueros();
      return {
        fetchedAt: r.fetchedAt,
        buergerbueros: (r.items ?? []).map((b) => ({
          id: b.id,
          name: b.name ?? `Bürgerbüro ${b.label}`,
          department: b.department,
          address: b.address,
          ...ampelDarstellung(b.status),
        })),
        source: r.source,
      };
    }
    default:
      throw Object.assign(new Error('Unbekanntes Werkzeug (erlaubt: suche_leistung, leistung, wo_erledigen, einheit, wartezeit)'), { status: 400 });
  }
}

export async function verwaltungEinheitenFuerAdresse() {
  const store = await getStore();
  return store.einheiten.map((e) => ({
    id: e.gebaeudeId,
    name: e.name,
    lat: e.lat,
    lon: e.lon,
    address: e.address,
    web: e.url,
    booking: e.booking,
    services: (e.leistungen ?? []).map((s) => ({ name: s.name, url: s.url, online: s.online })),
  }));
}

