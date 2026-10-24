// Alltagshilfe und Notfallwissen: Fristen, Umzug, Entsorgung, Strom, Gas,
// Erste Hilfe, Feuerwehr und Polizei. Wo es keine amtliche Live-Quelle gibt,
// steht das ausdrücklich dabei.
import { report, block, source, action, numDe, km, dateDe, haversine } from '../util.mjs';
import { nearest, resolvePlace } from './util.mjs';

const STROM = { '-1': 'sehr gut (viel erneuerbare Energie)', 1: 'normal', 3: 'erhöht', 4: 'hoch' };

export async function fristenRechner(params) {
  const startRaw = String(params.start ?? '').trim();
  const art = String(params.art ?? '').trim();
  const start = new Date(startRaw);
  if (Number.isNaN(+start)) throw Object.assign(new Error('Bitte ein gültiges Startdatum angeben.'), { status: 400 });
  const config = {
    widerspruch: { label: 'Widerspruch', months: 1, note: 'Die Widerspruchsfrist beginnt mit der Bekanntgabe des Bescheids. Bei Zustellung per Post kann sich der Beginn verschieben.' },
    kuendigung: { label: 'Kündigung', weeks: 4, note: 'Bei Miet- und Arbeitsverhältnissen sind die gesetzlichen und vertraglichen Fristen zu prüfen; die Vier-Wochen-Frist ist nur ein Beispiel.' },
    gewaehrleistung: { label: 'Gewährleistung', years: 2, note: 'Die regelmäßige Gewährleistungsfrist beträgt zwei Jahre ab Übergabe; bei Grundstücken und Bauwerken gelten längere Fristen.' },
    bauantrag: { label: 'Bauantrag', months: 3, note: 'Die Bearbeitungsfrist der Baugenehmigung beträgt in Baden-Württemberg in der Regel drei Monate; Sonderregeln sind möglich.' },
  }[art];
  if (!config) throw Object.assign(new Error('Unbekannte Fristart.'), { status: 400 });
  const due = new Date(start);
  if (config.months) due.setMonth(due.getMonth() + config.months);
  if (config.weeks) due.setDate(due.getDate() + config.weeks * 7);
  if (config.years) due.setFullYear(due.getFullYear() + config.years);
  let holidays = new Set();
  try {
    const { runSource } = await import('../run-source.mjs');
    const years = new Set([start.getFullYear(), due.getFullYear()]);
    for (const year of years) {
      const h = await runSource('api-feiertage', { year });
      for (const row of h.rows ?? []) if (row.Datum) holidays.add(row.Datum);
    }
  } catch { /* Feiertage sind optional */ }
  const shift = (d) => {
    const x = new Date(d);
    for (let i = 0; i < 14; i++) {
      const iso = x.toISOString().slice(0, 10);
      const day = x.getDay();
      if (day !== 0 && day !== 6 && !holidays.has(iso)) return x;
      x.setDate(x.getDate() + 1);
    }
    return x;
  };
  const shifted = shift(due);
  const wasShifted = shifted.toISOString().slice(0, 10) !== due.toISOString().slice(0, 10);
  return report({
    title: `Frist: ${config.label}`,
    subtitle: `Start ${dateDe(start.toISOString())}`,
    summary: `Fristende: ${dateDe(shifted.toISOString())}${wasShifted ? ' (auf den nächsten Werktag verschoben)' : ''}.`,
    facts: [
      { label: 'Start', value: dateDe(start.toISOString()) },
      { label: 'Frist', value: config.months ? `${config.months} Monat(e)` : config.weeks ? `${config.weeks} Wochen` : `${config.years} Jahre` },
      { label: 'Fristende', value: dateDe(shifted.toISOString()) },
      { label: 'Verschiebung', value: wasShifted ? 'ja, Wochenende/Feiertag' : 'nein' },
    ],
    blocks: [
      block.text('Berechnung', `${config.note} Die Berechnung ist eine Orientierung, keine Rechtsberatung. Maßgeblich sind Gesetz, Vertrag und der Zugang des Schreibens.`),
      block.list('Nächste Schritte', [
        { title: 'Frist im Kalender notieren', subtitle: 'Mit Erinnerung einige Tage vorher' },
        { title: 'Rechtsberatung prüfen', subtitle: 'Verbraucherzentrale, Anwalt oder Beratungshilfe', href: 'https://www.verbraucherzentrale-bawue.de/' },
        { title: 'Feiertage Baden-Württemberg', subtitle: 'Grundlage der Verschiebung', href: 'https://www.stuttgart.de/' },
      ]),
    ],
    sources: [source('Feiertage in Baden-Württemberg (feiertage-api.de)', 'https://feiertage-api.de/', 'Freie Nutzung')],
    limits: ['Keine Rechtsberatung.', 'Zustellungs- und Zugangsfiktionen können den Fristbeginn verändern.'],
  });
}

export async function ummeldeHilfer(params) {
  const p = await resolvePlace(params);
  const { buergerbueros } = await import('../../sources/nearby.mjs');
  const b = await buergerbueros();
  const near = nearest((b.items ?? []).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon)), p.lat, p.lon, 4);
  return report({
    title: 'Ummelde-Helfer',
    subtitle: p.label,
    summary: 'Die wichtigsten Schritte nach dem Umzug – mit dem nächsten Bürgerbüro und den nötigen Unterlagen.',
    facts: [
      { label: 'Nächstes Bürgerbüro', value: near[0]?.name ?? '–', note: near[0] ? km(near[0].distance) : null },
      { label: 'Adresse', value: near[0]?.address ?? '–' },
      { label: 'Wartezeit', value: near[0]?.waitMin != null ? `${near[0].waitMin} min` : near[0]?.text ?? '–' },
    ],
    blocks: [
      block.list('Schritte', [
        { title: '1. Wohnungsgeberbestätigung besorgen', subtitle: 'Vermieter oder Hauptmieter; beim Einzug ausgehändigt' },
        { title: '2. Personalausweis/Reisepass mitnehmen', subtitle: 'Bei Kindern Geburtsurkunde und ggf. Einverständnis' },
        { title: '3. Wohnsitz anmelden', subtitle: 'Innerhalb von zwei Wochen nach Einzug; persönlich im Bürgerbüro', href: near[0]?.booking ?? 'https://stuttgart.konsentas.de/' },
        { title: '4. Bank, Versicherung, Arbeitgeber informieren', subtitle: 'Adressänderung und ggf. Kfz-Umschreibung' },
        { title: '5. Abfall, Strom, Gas, Internet ummelden', subtitle: 'Abfuhrtermine und Zählernummern prüfen' },
        { title: '6. Schule, Kita, Arzt und Vereine informieren', subtitle: 'Grundschulbezirk und Betreuung prüfen' },
      ]),
      block.list('Nächste Bürgerbüros', near.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance), x.waitMin != null ? `${x.waitMin} min Wartezeit` : x.text].filter(Boolean).join(' · '), href: x.booking ?? x.url ?? null }))),
      block.links('Mehr', [
        { title: 'Wohnsitz anmelden', href: 'https://www.stuttgart.de/leben/buergerservice/wohnsitz/', note: 'Amtliche Informationen und Formulare' },
        { title: 'Abfuhrkalender', href: '#labor=abfall-kalender&strasse=&nr=', note: 'Termine für die neue Adresse' },
      ]),
    ],
    points: near.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Landeshauptstadt Stuttgart, Bürgerbüros (Quellenangabe)', 'https://www.stuttgart.de/', 'Quellenangabe')],
    limits: ['Keine Rechts- oder Steuerberatung.', 'Die Zwei-Wochen-Frist kann je nach Landesrecht abweichen; maßgeblich ist die Meldebehörde.'],
  });
}

export async function sperrmuellCheck(params) {
  const p = await resolvePlace(params);
  const [wertstoff, mobil, gruen] = await Promise.all([nearest(await (await import('../../sources/nearby.mjs')).facilities('wertstoffhof').then((r) => r.items), p.lat, p.lon, 3), nearest(await (await import('../../sources/nearby.mjs')).facilities('umweltmobil').then((r) => r.items), p.lat, p.lon, 3), nearest(await (await import('../../sources/nearby.mjs')).facilities('gruengut').then((r) => r.items), p.lat, p.lon, 3)]);
  return report({
    title: 'Sperrmüll & Sonderabfall',
    subtitle: p.label,
    summary: 'Wohin mit Sperrmüll, Elektrogeräten, Farben und Grüngut? Mit den nächsten Annahmestellen und Regeln.',
    facts: [
      { label: 'Wertstoffhöfe', value: String(wertstoff.length) },
      { label: 'Schadstoffmobil', value: String(mobil.length) },
      { label: 'Grüngutannahme', value: String(gruen.length) },
    ],
    blocks: [
      block.list('Wertstoffhöfe', wertstoff.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance), ...(x.info ?? []).slice(0, 2)].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.list('Schadstoffmobil', mobil.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance), ...(x.info ?? []).slice(0, 2)].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.list('Grüngut', gruen.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance)].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.text('Was wohin gehört', 'Sperrmüll: Anmeldung bei der Abfallwirtschaft, Abholung oder Wertstoffhof. Elektrogeräte: Wertstoffhof oder Händler-Rücknahme, nicht in den Restabfall. Farben, Lacke, Lösungsmittel: Schadstoffmobil. Grüngut: Grüngutannahme oder Biotonne, nicht in den Wald.'),
      block.links('Mehr', [
        { title: 'Abfallwirtschaft Stuttgart', href: 'https://www.stuttgart.de/leben/umwelt/abfall/', note: 'Anmeldung und Gebühren' },
        { title: 'Abfuhrkalender', href: '#labor=abfall-kalender&strasse=&nr=', note: 'Nächste Termine' },
      ]),
    ],
    points: [...wertstoff, ...mobil, ...gruen].map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Landeshauptstadt Stuttgart, Wertstoffhöfe, Schadstoffmobil und Grüngut (WFS, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0')],
    limits: ['Öffnungszeiten und Annahmebedingungen können sich ändern.', 'Gewerblicher Abfall und Sonderfälle sind nicht abgedeckt.'],
  });
}

export async function stromausfallCheck() {
  const { gesundheit } = await import('../../sources/nearby.mjs');
  const g = await gesundheit('70173');
  const now = Date.now();
  const cur = (g.strom ?? []).find((s) => Date.parse(s.from) <= now && Date.parse(s.to) > now) ?? (g.strom ?? [])[0] ?? null;
  const next = (g.strom ?? []).find((s) => Date.parse(s.from) > now && s.state !== cur?.state) ?? null;
  return report({
    title: 'Stromausfall & Netzlage',
    subtitle: 'TransnetBW StromGedacht, Region Stuttgart',
    summary: cur ? `Netzzustand: ${STROM[cur.state] ?? `Zustand ${cur.state}`}.${next ? ` Ab ${timeLabel(next.from)}: ${STROM[next.state] ?? next.state}.` : ''}` : 'Keine Netzdaten verfügbar.',
    facts: [
      { label: 'Netzzustand', value: cur ? STROM[cur.state] ?? `Zustand ${cur.state}` : '–' },
      { label: 'Nächste Änderung', value: next ? timeLabel(next.from) : '–' },
      { label: 'Grünstromanteil', value: g.gruenstrom?.aktuell?.share != null ? `${numDe(g.gruenstrom.aktuell.share, 0)} %` : '–' },
      { label: 'Bestes Fenster', value: g.gruenstrom?.bestesFenster ? `${timeLabel(g.gruenstrom.bestesFenster.von)}–${timeLabel(g.gruenstrom.bestesFenster.bis)}` : '–' },
    ],
    blocks: [
      block.facts('Netz und Strom', [
        { label: 'Netzzustand', value: cur ? STROM[cur.state] ?? `Zustand ${cur.state}` : '–' },
        { label: 'Grünstrom jetzt', value: g.gruenstrom?.aktuell?.share != null ? `${numDe(g.gruenstrom.aktuell.share, 0)} %` : '–' },
        { label: 'Grünstrom-Spanne', value: g.gruenstrom ? `${numDe(g.gruenstrom.min, 0)}–${numDe(g.gruenstrom.max, 0)} %` : '–' },
      ]),
      block.text('Bei einem Stromausfall', 'Kerzen und Taschenlampe statt offener Flammen, Kühlschrank geschlossen halten, Aufzüge meiden, elektronische Geräte ausschalten. Bei medizinischen Geräten den Notruf 112 wählen. Den örtlichen Netzbetreiber informieren; die Störungshotline steht auf der Netzbetreiber-Website.'),
      block.links('Mehr', [
        { title: 'StromGedacht', href: 'https://www.stromgedacht.de/', note: 'Netzlage und Prognose' },
        { title: 'Netzbetreiber Stuttgart', href: 'https://www.netze-bw.de/', note: 'Störungshotline und Hinweise' },
        { title: 'Notfall-Leuchttürme', href: '#labor=notfall-karte&ort=Stuttgart', note: 'Treffpunkte mit Notstrom' },
      ]),
    ],
    points: [],
    sources: [source('TransnetBW StromGedacht', 'https://www.stromgedacht.de/', 'Quellenangabe'), source('Fraunhofer ISE Energy-Charts (CC BY 4.0)', 'https://www.energy-charts.info/', 'CC BY 4.0')],
    limits: ['Keine Störungsmeldung für den eigenen Hausanschluss; die Netzlage ist eine regionale Prognose.', 'Bei akuter Gefahr 112.'],
  });
}

export async function gasNotfall() {
  return report({
    title: 'Gas-Notfall',
    subtitle: 'Was tun bei Gasgeruch?',
    summary: 'Gasgeruch ist ein Notfall: Gebäude verlassen, keine Schalter betätigen, 112 anrufen und den Netzbetreiber informieren.',
    facts: [
      { label: 'Notruf', value: '112' },
      { label: 'Netzbetreiber', value: 'Netze BW' },
      { label: 'Störungshotline', value: '0800 362 94 75' },
      { label: 'Giftnotruf', value: '0761 19240' },
    ],
    blocks: [
      block.list('Sofortmaßnahmen', [
        { title: '1. Ruhe bewahren und Gebäude verlassen', subtitle: 'Alle Personen und Haustiere mitnehmen; Nachbarn warnen.' },
        { title: '2. Keine Schalter, Klingeln oder Telefone im Gebäude', subtitle: 'Kein Licht, keine Steckdosen, kein Feuer; Funken vermeiden.' },
        { title: '3. 112 anrufen', subtitle: 'Von außerhalb des Gebäudes; Gasgeruch und Adresse nennen.' },
        { title: '4. Netzbetreiber informieren', subtitle: 'Netze BW Störungshotline 0800 362 94 75.' },
        { title: '5. Nicht zurück ins Gebäude', subtitle: 'Bis Feuerwehr oder Netzbetreiber freigibt.' },
      ]),
      block.text('Warnzeichen', 'Typisch sind Geruch nach Gas, zischende Geräusche, Flammen an unerwarteten Stellen oder Kopfschmerzen und Übelkeit in geschlossenen Räumen. Bei Verdacht immer 112.'),
      block.links('Mehr', [
        { title: 'Netze BW', href: 'https://www.netze-bw.de/', note: 'Störung und Gasnotfall' },
        { title: 'Feuerwehr Stuttgart', href: 'https://www.feuerwehr-stuttgart.de/', note: 'Sicherheitshinweise' },
      ]),
    ],
    sources: [source('Netze BW (Quellenangabe)', 'https://www.netze-bw.de/', 'Quellenangabe'), source('Feuerwehr Stuttgart', 'https://www.feuerwehr-stuttgart.de/', 'Quellenangabe')],
    limits: ['Allgemeine Hinweise, keine individuelle Anleitung für die Gasanlage.', 'Im Notfall gilt 112.'],
  });
}

function timeLabel(iso) {
  const d = new Date(iso);
  return Number.isNaN(+d) ? '–' : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export async function ersteHilfe() {
  return report({
    title: 'Erste Hilfe',
    subtitle: 'Die ersten Minuten zählen',
    summary: 'Prüfen, rufen, drücken: Bei Bewusstlosigkeit und fehlender Atmung sofort 112 rufen und mit Herzdruckmassage beginnen.',
    facts: [
      { label: 'Notruf', value: '112' },
      { label: 'Druckfrequenz', value: '100–120 pro Minute' },
      { label: 'Drucktiefe', value: '5–6 cm' },
      { label: 'AED', value: 'Nächsten Defibrillator holen lassen' },
    ],
    blocks: [
      block.list('Bei Bewusstlosigkeit', [
        { title: '1. Ansprechen und anfassen', subtitle: 'Keine Reaktion? Atemwege prüfen.' },
        { title: '2. Atmung prüfen', subtitle: 'Maximal 10 Sekunden: Atemgeräusche, Brustkorb, Luftstrom.' },
        { title: '3. 112 rufen (lassen)', subtitle: 'Freisprecher nutzen, Leitstelle folgt.' },
        { title: '4. Herzdruckmassage', subtitle: 'Fersen der Hand auf die Mitte des Brustkorbs, Arme gestreckt, 100–120/min, 5–6 cm tief.' },
        { title: '5. AED holen lassen und einsetzen', subtitle: 'Gerät gibt Sprachanweisungen; Analyse nicht unterbrechen.' },
      ]),
      block.list('Bei starker Blutung', [
        { title: 'Wunde abdecken und drücken', subtitle: 'Mit sauberem Tuch oder Verband kräftig drücken.' },
        { title: 'Betroffenen hinlegen', subtitle: 'Schock vermeiden, Wärme halten.' },
        { title: '112 rufen', subtitle: 'Bei starker, nicht stillbarer Blutung.' },
      ]),
      block.text('Rechtliches', 'Erste Hilfe ist zumutbar und in § 323c StGB geschuldet; wer helfen kann, muss helfen. Laienhandlungen sind grundsätzlich durch die Geschäftsführung ohne Auftrag und den rechtfertigenden Notstand geschützt.'),
      block.links('Mehr', [
        { title: 'DRK: Erste Hilfe', href: 'https://www.drk.de/hilfe-in-deutschland/erste-hilfe/', note: 'Anleitungen und Kurse' },
        { title: 'Defibrillator in der Nähe', href: '#labor=defi-check&ort=Stuttgart', note: 'Nächste AED-Standorte' },
      ]),
    ],
    sources: [source('Deutsches Rotes Kreuz (Quellenangabe)', 'https://www.drk.de/', 'Quellenangabe'), source('Bundeszentrale für gesundheitliche Aufklärung', 'https://www.bzga.de/', 'Quellenangabe')],
    limits: ['Keine medizinische Beratung und kein Ersatz für einen Erste-Hilfe-Kurs.', 'Im Notfall gilt 112.'],
  });
}

export async function feuerwehrCheck(params) {
  const p = await resolvePlace(params);
  const { overpassQuery } = await import('./util.mjs');
  const els = await overpassQuery('[out:json][timeout:25];(node[amenity=fire_station](around:4000,' + p.lat + ',' + p.lon + '););out center tags;').catch(() => []);
  const stations = els.map((el) => ({ id: `${el.type}/${el.id}`, name: el.tags?.name ?? 'Feuerwehr', lat: el.lat ?? el.center?.lat, lon: el.lon ?? el.center?.lon, address: [el.tags?.['addr:street'], el.tags?.['addr:housenumber']].filter(Boolean).join(' ') })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
  const near = nearest(stations, p.lat, p.lon, 5);
  return report({
    title: 'Feuerwehr & Brandschutz',
    subtitle: p.label,
    summary: near.length ? `${near.length} Feuerwehrstandorte im Umkreis; der nächste ist ${km(near[0].distance)} entfernt.` : 'Keine Feuerwehrstandorte im OpenStreetMap-Umkreis gefunden.',
    facts: [
      { label: 'Notruf', value: '112' },
      { label: 'Feuerwehrstandorte', value: String(near.length) },
      { label: 'Nächste Wache', value: near[0] ? km(near[0].distance) : '–', note: near[0]?.name ?? null },
      { label: 'Rauchmelder', value: 'Pflicht in Schlaf- und Kinderzimmern' },
    ],
    blocks: [
      block.list('Feuerwehrstandorte', near.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance)].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.text('Verhalten im Brandfall', 'Menschen warnen, 112 rufen, Gebäude über sichere Fluchtwege verlassen, Türen schließen, keine Aufzüge. Wenn Verrauchung den Fluchtweg blockiert: in einem Raum bleiben, Tür abdichten, am Fenster bemerkbar machen.'),
      block.text('Vorbeugen', 'Rauchmelder in Schlaf- und Kinderzimmern sowie im Flur, jährlich prüfen. Fluchtwege freihalten. Grills und Feuer nur an erlaubten Stellen. Elektrogeräte nicht unbeaufsichtigt laden.'),
      block.links('Mehr', [
        { title: 'Feuerwehr Stuttgart', href: 'https://www.feuerwehr-stuttgart.de/', note: 'Sicherheitstipps und Wachen' },
        { title: 'Rauchmelder-Pflicht', href: 'https://www.stuttgart.de/', note: 'Informationen der Stadt' },
      ]),
    ],
    points: near.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL'), source('Feuerwehr Stuttgart', 'https://www.feuerwehr-stuttgart.de/', 'Quellenangabe')],
    limits: ['OpenStreetMap ist kein amtliches Feuerwehrregister.', 'Im Notfall gilt 112.'],
  });
}

export async function polizeiCheck(params) {
  const p = await resolvePlace(params);
  const { ckanRows, maxYear, rowsForYear, sum } = await import('./util.mjs');
  let crime = null;
  try {
    const rows = await ckanRows('ckan-straftaten');
    const year = maxYear(rows, /jahr/i);
    const latest = rowsForYear(rows, year, /jahr/i);
    crime = { year, total: sum(latest, /Erfaßte Straftaten insgesamt/i) };
  } catch { /* optional */ }
  const stations = await nearest(await (await import('../../sources/nearby.mjs')).facilities('polizei').then((r) => r.items), p.lat, p.lon, 5);
  return report({
    title: 'Polizei & Sicherheit',
    subtitle: p.label,
    summary: stations.length ? `${stations.length} Polizeidienststellen im Umkreis; die nächste ist ${km(stations[0].distance)} entfernt.` : 'Keine Polizeidienststellen im Datensatz in der Nähe.',
    facts: [
      { label: 'Notruf', value: '110' },
      { label: 'Polizeidienststellen', value: String(stations.length) },
      { label: 'Nächste Stelle', value: stations[0] ? km(stations[0].distance) : '–', note: stations[0]?.name ?? null },
      { label: 'Straftaten (Stadt)', value: crime?.total != null ? `${numDe(crime.total)} (${crime.year})` : '–' },
    ],
    blocks: [
      block.list('Polizeidienststellen', stations.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance), x.phone].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.text('Was die Zahl bedeutet', crime?.total != null ? `Die Kriminalstatistik weist für Stuttgart ${numDe(crime.total)} erfasste Straftaten im Jahr ${crime.year} aus. Das ist eine stadtweite Zahl, keine Aussage über den Stadtbezirk oder die eigene Straße.` : 'Keine Kriminalstatistik verfügbar.',),
      block.links('Mehr', [
        { title: 'Polizei Baden-Württemberg', href: 'https://www.polizei-bw.de/', note: 'Dienststellen und Online-Wache' },
        { title: 'Kriminalstatistik', href: 'https://www.stuttgart.de/', note: 'Amtliche Zahlen der Stadt' },
      ]),
    ],
    points: stations.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Landeshauptstadt Stuttgart, Polizeidienststellen (WFS, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('Landeshauptstadt Stuttgart, Kriminalstatistik (CC BY 4.0)', 'https://opendata.stuttgart.de/', 'CC BY 4.0')],
    limits: ['Stadtweite Kriminalstatistik, keine Aussage über einzelne Straßen.', 'Im Notfall gilt 110.'],
  });
}

export async function gebuehrenRechner(params) {
  const leistung = String(params.leistung ?? '').trim();
  const table = {
    personalausweis: { label: 'Personalausweis', fee: '37 €', note: 'Antrag ab 24 Jahren; unter 24 Jahren günstiger. Gebühr kann sich ändern.' },
    reisepass: { label: 'Reisepass', fee: '70 €', note: 'Antrag ab 24 Jahren; unter 24 Jahren 37,50 €. Expresszuschlag möglich.' },
    meldebescheinigung: { label: 'Meldebescheinigung', fee: '10 €', note: 'Einfache Bescheinigung; erweiterte Varianten können teurer sein.' },
    gewerbe: { label: 'Gewerbeanmeldung', fee: 'rund 40 €', note: 'Abhängig von Rechtsform und Kammer; Auslagen kommen hinzu.' },
    hund: { label: 'Hundesteuer', fee: 'je nach Gemeinde', note: 'Stuttgart staffelt nach Anzahl und Art; die Satzung ist maßgeblich.' },
  };
  const t = table[leistung];
  if (!t) throw Object.assign(new Error('Unbekannte Leistung.'), { status: 400 });
  return report({
    title: `Gebühren: ${t.label}`,
    subtitle: 'Richtwert, keine verbindliche Auskunft',
    summary: `${t.label}: ${t.fee}. ${t.note}`,
    facts: [
      { label: 'Leistung', value: t.label },
      { label: 'Richtwert', value: t.fee },
      { label: 'Verbindlich', value: 'Gebührensatzung der Stadt' },
    ],
    blocks: [
      block.text('Hinweis', 'Gebühren ändern sich durch Satzung oder Rechtsverordnung. Maßgeblich ist die amtliche Leistungsseite bzw. der Gebührenbescheid. Diese Übersicht ist eine Orientierung, keine Rechtsberatung.'),
      block.links('Mehr', [
        { title: 'Leistungen und Gebühren', href: 'https://www.stuttgart.de/organigramm/leistungen/', note: 'Amtlicher Leistungskatalog' },
        { title: 'Termin buchen', href: 'https://stuttgart.konsentas.de/', note: 'Bürgerbüro' },
        { title: 'Dokumenten-Checkliste', href: '#labor=dokumenten-checkliste&q=' + encodeURIComponent(t.label), note: 'Unterlagen prüfen' },
      ]),
    ],
    sources: [source('Landeshauptstadt Stuttgart, Leistungskatalog und Gebührensatzung', 'https://www.stuttgart.de/', 'Quellenangabe')],
    limits: ['Richtwerte, keine verbindliche Gebührenauskunft.', 'Ermäßigungen und Sonderfälle sind nicht abgebildet.'],
  });
}

export async function foerderFinder(params) {
  const p = await resolvePlace(params);
  const prof = await import('../../sources/adresse.mjs').then((m) => m.profil(p.lat, p.lon));
  const solar = prof.solar ?? {};
  const gruen = prof.gruendach ?? {};
  const geo = prof.geothermie ?? {};
  const waerme = prof.waermeplanung ?? {};
  return report({
    title: 'Förderungen',
    subtitle: p.label,
    summary: 'Energetische Sanierung, Solar, Gründach und Wärmewende – welche Programme passen könnten.',
    facts: [
      { label: 'Solarpotenzial', value: solar.pvKwp ? `${numDe(solar.pvKwp)} kWp` : 'keine Angabe' },
      { label: 'Dachfläche', value: solar.flaecheM2 ? `${numDe(solar.flaecheM2)} m²` : 'keine Angabe' },
      { label: 'Gründach', value: gruen?.flaecheM2 ? `${numDe(gruen.flaecheM2)} m² Potenzial` : 'keine Angabe' },
      { label: 'Geothermie', value: geo?.bohrtiefeM ? `${numDe(geo.bohrtiefeM)} m` : 'keine Angabe' },
      { label: 'Wärmeplanung', value: waerme?.quartier ?? waerme?.steckbrief?.name ?? 'keine Angabe' },
    ],
    blocks: [
      block.facts('Potenziale am Standort', [
        { label: 'Solar', value: solar.pvKwp ? `${numDe(solar.pvKwp)} kWp, ${numDe(solar.stromKwhA)} kWh/Jahr` : 'keine Angabe' },
        { label: 'Gründach', value: gruen?.flaecheM2 ? `${numDe(gruen.flaecheM2)} m²` : 'keine Angabe' },
        { label: 'Geothermie', value: geo?.bohrtiefeM ? `bis ${numDe(geo.bohrtiefeM)} m` : 'keine Angabe' },
      ]),
      block.list('Programme und Anlaufstellen', [
        { title: 'BAFA – Bundesförderung effiziente Gebäude', href: 'https://www.bafa.de/DE/Energie/Effiziente_Gebaeude/effiziente_gebaeude_node.html', note: 'Bundesförderung für Sanierung und Heizung' },
        { title: 'KfW – Energieeffizient Bauen und Sanieren', href: 'https://www.kfw.de/inlandsfoerderung/Privatpersonen/', note: 'Zuschüsse und Kredite' },
        { title: 'Landeshauptstadt Stuttgart – Klimaschutz', href: 'https://www.stuttgart.de/leben/umwelt/klimaschutz/', note: 'Kommunale Programme' },
        { title: 'Solaroffensive Stuttgart', href: 'https://www.stuttgart.de/leben/umwelt/energie/solar/', note: 'Beratung und Förderung' },
        { title: 'Verbraucherzentrale BW', href: 'https://www.verbraucherzentrale-bawue.de/', note: 'Unabhängige Energieberatung' },
      ]),
      block.text('Vor dem Antrag', 'Zuerst Energieberatung und Sanierungsfahrplan, dann Antrag, dann Beauftragung. Viele Programme dürfen nicht nachträglich beantragt werden. Förderfähigkeit, Technik und Kosten sind individuell zu prüfen.'),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [source('Landeshauptstadt Stuttgart, Solarkataster, Gründachkataster, Geothermie und Wärmeplanung (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('BAFA/KfW (Quellenangabe)', 'https://www.bafa.de/', 'Quellenangabe')],
    limits: ['Keine Förderberatung und keine Zusage.', 'Daten zu Dach und Geothermie sind modellhaft; Eigentümerverhältnisse sind nicht berücksichtigt.'],
  });
}

export async function schulwegCheck(params) {
  const p = await resolvePlace(params);
  const [schul, schulen, unfall, radwege, achtung] = await Promise.allSettled([
    import('../../sources/nearby.mjs').then((m) => m.schulbezirk(p.lat, p.lon)),
    (await import('../../sources/nearby.mjs')).facilities('grundschule').then((r) => r.items),
    import('../../sources/unfall.mjs').then((m) => m.unfaelle({ lat: p.lat, lon: p.lon, r: 800, limit: 100 })),
    import('./util.mjs').then((m) => m.wfsItems('GEOLINE_FLEX:A32_RSP_RADSCHULWEGE_EPSG25832', p.lat, p.lon, 1200, 100)),
    import('./util.mjs').then((m) => m.wfsItems('GEOLINE_FLEX:A32_RSP_ACHTUNGSSTELLEN_EPSG25832', p.lat, p.lon, 1200, 100)),
  ]);
  const s = schul.status === 'fulfilled' ? schul.value : null;
  const grundschulen = schulen.status === 'fulfilled' ? nearest(schulen.value, p.lat, p.lon, 4) : [];
  const unfaelle = unfall.status === 'fulfilled' ? (unfall.value.items ?? []) : [];
  const rw = radwege.status === 'fulfilled' ? radwege.value.length : 0;
  const ac = achtung.status === 'fulfilled' ? achtung.value.length : 0;
  return report({
    title: 'Sicherer Schulweg',
    subtitle: p.label,
    summary: s?.school ? `Grundschulbezirk: ${s.school}. ${unfaelle.length} Unfälle im 800-m-Umkreis, ${ac} Achtungsstellen.` : 'Kein Grundschulbezirk ermittelt.',
    facts: [
      { label: 'Grundschule', value: s?.school ?? '–' },
      { label: 'Unfälle 800 m', value: String(unfaelle.length) },
      { label: 'Achtungsstellen', value: String(ac) },
      { label: 'Radschulwege', value: String(rw) },
    ],
    blocks: [
      block.facts('Schulbezirk', [
        { label: 'Schule', value: s?.school ?? '–' },
        { label: 'Stand', value: s?.stand ?? '–' },
        { label: 'Adresse', value: s?.facility?.address ?? '–' },
        { label: 'Telefon', value: s?.facility?.phone ?? '–' },
      ]),
      block.list('Grundschulen in der Nähe', grundschulen.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance)].filter(Boolean).join(' · '), href: x.web ?? null }))),
      block.text('Schulweg sicher planen', 'Den Weg gemeinsam abgehen, Querungen an Ampeln oder Lotsen nutzen, Sichtbarkeit durch helle Kleidung und Reflektoren. Der kürzeste Weg ist nicht immer der sicherste. Achtungsstellen und Radschulwege sind Hinweise der Stadt, keine Garantie.'),
      block.links('Mehr', [
        { title: 'Radschulwegplan', href: '#modul=nearby&focus=adresse', note: 'Im Adressprofil' },
        { title: 'Unfallatlas', href: 'https://www.unfallatlas.statistikportal.de/', note: 'Amtliche Unfalldaten' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }, ...grundschulen.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name }))],
    sources: [source('Landeshauptstadt Stuttgart, Grundschulbezirke und Radschulwege (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('Unfallatlas (dl-de/by-2-0)', 'https://www.unfallatlas.statistikportal.de/', 'dl-de/by-2-0')],
    limits: ['Keine Verkehrserziehung und keine Garantie für einen sicheren Weg.', 'Unfälle im Umkreis sind keine Aussage über den konkreten Schulweg.'],
  });
}

export async function apothekenNotdienst(params) {
  const p = await resolvePlace(params);
  const { overpassQuery, nearest } = await import('./util.mjs');
  const els = await overpassQuery('[out:json][timeout:25];(node[amenity=pharmacy](around:2500,' + p.lat + ',' + p.lon + '););out center tags;').catch(() => []);
  const items = els.map((el) => ({
    id: `${el.type}/${el.id}`, name: el.tags?.name ?? 'Apotheke',
    lat: el.lat ?? el.center?.lat, lon: el.lon ?? el.center?.lon,
    address: [el.tags?.['addr:street'], el.tags?.['addr:housenumber']].filter(Boolean).join(' '),
    phone: el.tags?.phone ?? null, opening: el.tags?.opening_hours ?? null,
  })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
  const near = nearest(items, p.lat, p.lon, 8);
  return report({
    title: 'Apotheken-Notdienst',
    subtitle: p.label,
    summary: `${near.length} Apotheken im Umkreis. Den aktuellen Notdienst bitte über die offizielle Notdienstsuche prüfen – sie ist hier nicht live angebunden.`,
    facts: [
      { label: 'Apotheken im Umkreis', value: String(near.length) },
      { label: 'Nächste Apotheke', value: near[0] ? km(near[0].distance) : '–', note: near[0]?.name ?? null },
      { label: 'Notdienst', value: 'offizielle Suche nötig' },
      { label: 'Giftnotruf', value: '0761 19240' },
    ],
    blocks: [
      block.list('Apotheken in der Nähe', near.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance), x.phone, x.opening].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.text('Notdienst finden', 'Die Notdienstpläne wechseln täglich und sind nicht in OpenStreetMap enthalten. Die offizielle Suche der Apothekerschaft zeigt die diensthabende Apotheke mit Adresse und Rufnummer. Bei Vergiftungsverdacht den Giftnotruf anrufen.'),
      block.links('Offizielle Suche', [
        { title: 'Apotheken-Notdienstsuche', href: 'https://www.aponet.de/apotheke/notdienstsuche', note: 'Bundesweite Suche der ABDA' },
        { title: 'Giftnotruf Freiburg', href: 'https://www.uniklinik-freiburg.de/giftberatung.html', note: '24 Stunden erreichbar' },
      ]),
    ],
    points: near.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL'), source('ABDA/aponet (Quellenangabe)', 'https://www.aponet.de/', 'Quellenangabe')],
    limits: ['Kein Live-Notdienst; die Liste zeigt nur Apotheken in der Nähe.', 'Öffnungszeiten in OSM können veraltet sein.', 'Im Notfall 112.'],
  });
}
