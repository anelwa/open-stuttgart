// Werkzeuge rund um Stadtbezirk und Adresse. Sie verbinden die neuen amtlichen
// CKAN-Reihen mit dem vorhandenen Adressprofil und den WFS-Ebenen der Stadt.
import { report, block, source, action, numDe, haversine, km } from '../util.mjs';
import {
  ckanRows, col, districtAt, maxYear, nearest, resolvePlace, rowNum, rowsForDistrict,
  rowsForYear, sameDistrict, sourceInfo, sum, wfsItems, areaAt, nearby,
} from './util.mjs';

const P = {
  einwohner: { source: 'ckan-einwohner-altersgruppen', value: /^Einwohner$/i, kind: 'sum', year: /stichtag/i, label: 'Einwohner' },
  unter18: { source: 'ckan-einwohner-altersgruppen', value: /^Einwohner$/i, kind: 'young', year: /stichtag/i, label: 'unter 18 Jahren' },
  ueber65: { source: 'ckan-einwohner-altersgruppen', value: /^Einwohner$/i, kind: 'old', year: /stichtag/i, label: 'ab 65 Jahren' },
  haushalte: { source: 'ckan-privathaushalte', value: /Haushalte insgesamt/i, kind: 'sum', year: /stichtag/i, label: 'Haushalte' },
  singlehaushalte: { source: 'ckan-privathaushalte', value: /Haushalte mit 1 Person/i, kind: 'sum', year: /stichtag/i, label: 'Single-Haushalte' },
  familien: { source: 'ckan-familien', value: /Familien mit Kindern insgesamt/i, kind: 'sum', year: /stichtag/i, label: 'Familien mit Kindern' },
  alleinerziehende: { source: 'ckan-familien', value: /Alleinerziehende/i, kind: 'sum', year: /stichtag/i, label: 'Alleinerziehende' },
  arbeitslose: { source: 'ckan-arbeitslos', value: /arbeitslos Gemeldete insgesamt/i, kind: 'sum', year: /jahr/i, label: 'Arbeitslos Gemeldete' },
  arbeitslosenquote: { source: 'ckan-arbeitslos', value: /Arbeitslosenquote/i, kind: 'avg', year: /jahr/i, label: 'Arbeitslosenquote' },
  einkommen: { source: 'ckan-einkommen', value: /Nettoeinkünfte je veranlagter Person/i, kind: 'avg', year: /jahr/i, label: 'Nettoeinkommen je veranlagter Person' },
  einkommensindex: { source: 'ckan-einkommen', value: /Einkommens-Index/i, kind: 'avg', year: /jahr/i, label: 'Einkommensindex (Stuttgart = 100)' },
  wohnungen: { source: 'ckan-wohnungen-groesse', value: /^Anzahl$/i, kind: 'sum', year: /stichtag/i, label: 'Wohnungen' },
  baugenehmigungen: { source: 'ckan-baugenehmigungen', value: /Wohnungen_insgesamt/i, kind: 'sum', year: /jahr/i, label: 'genehmigte Wohnungen' },
};

const YOUNG = /0 bis unter 3|3 bis unter 6|6 bis unter 15|15 bis unter 18/;
const OLD = /65 bis unter 75|75 Jahre oder älter/;

function yearOf(rows, pattern) {
  return maxYear(rows, pattern);
}

function rowsAtLatest(rows, yearPattern, district) {
  const year = yearOf(rows, yearPattern);
  const latest = year ? rowsForYear(rows, year, yearPattern) : rows;
  return { year, rows: rowsForDistrict(latest, district) };
}

function aggregate(rows, pattern, kind) {
  if (kind === 'young') {
    const age = col(rows[0], /alter|gruppe/i);
    return age ? sum(rows.filter((r) => YOUNG.test(String(r[age] ?? ''))), pattern) : null;
  }
  if (kind === 'old') {
    const age = col(rows[0], /alter|gruppe/i);
    return age ? sum(rows.filter((r) => OLD.test(String(r[age] ?? ''))), pattern) : null;
  }
  if (kind === 'avg') {
    const vals = rows.map((r) => rowNum(r, pattern)).filter((v) => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  }
  return sum(rows, pattern);
}

/** Ein Indikator für einen Stadtbezirk oder die ganze Stadt. */
async function indicator(key, district = null) {
  const spec = P[key];
  if (!spec) return null;
  const rows = await ckanRows(spec.source);
  const { year, rows: filtered } = district
    ? rowsAtLatest(rows, spec.year, district)
    : { year: yearOf(rows, spec.year), rows: (() => { const y = yearOf(rows, spec.year); return y ? rowsForYear(rows, y, spec.year) : rows; })() };
  const value = aggregate(filtered, spec.value, spec.kind);
  return { key, label: spec.label, value, year, source: spec.source };
}

async function districtNames() {
  const rows = await ckanRows('ckan-einwohner-altersgruppen');
  const year = yearOf(rows, /stichtag/i);
  return [...new Set((year ? rowsForYear(rows, year, /stichtag/i) : rows).map((r) => String(r.Stadtbezirk ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
}

async function factsFor(district) {
  const keys = ['einwohner', 'unter18', 'ueber65', 'haushalte', 'singlehaushalte', 'familien', 'arbeitslose', 'arbeitslosenquote', 'einkommen', 'wohnungen', 'baugenehmigungen'];
  const values = await Promise.all(keys.map((k) => indicator(k, district).catch(() => null)));
  const byKey = Object.fromEntries(values.filter(Boolean).map((v) => [v.key, v]));
  return {
    district,
    values: byKey,
    year: byKey.einwohner?.year ?? null,
    sources: [...new Set(values.filter(Boolean).map((v) => v.source))],
  };
}

function fmt(key, v) {
  if (v == null) return 'keine Angabe';
  if (key === 'arbeitslosenquote') return `${numDe(v, 1)} %`;
  if (key === 'einkommen') return `${numDe(v, 0)} €`;
  if (key === 'einkommensindex') return `${numDe(v, 0)}`;
  if (key === 'baugenehmigungen') return `${numDe(v, 0)} Wohnungen`;
  return numDe(v, 0);
}

async function sourceList(ids) {
  const list = await Promise.all(ids.map((id) => sourceInfo(id).catch(() => null)));
  return list.filter(Boolean).map((s) => source(s.name, s.url, s.license));
}

export async function kiezSteckbrief(params) {
  const district = String(params.bezirk ?? '').trim();
  if (!district) throw Object.assign(new Error('Bitte einen Stadtbezirk angeben.'), { status: 400 });
  const names = await districtNames();
  const match = names.find((n) => sameDistrict(n, district)) ?? district;
  const f = await factsFor(match);
  const v = f.values;
  const facts = [
    { label: 'Einwohner', value: fmt('einwohner', v.einwohner?.value), note: v.einwohner?.year ? `Stand ${v.einwohner.year}` : null },
    { label: 'unter 18', value: fmt('unter18', v.unter18?.value), note: v.unter18?.value ? `${((v.unter18.value / v.einwohner.value) * 100).toFixed(1).replace('.', ',')} %` : null },
    { label: 'ab 65', value: fmt('ueber65', v.ueber65?.value), note: v.ueber65?.value ? `${((v.ueber65.value / v.einwohner.value) * 100).toFixed(1).replace('.', ',')} %` : null },
    { label: 'Haushalte', value: fmt('haushalte', v.haushalte?.value) },
    { label: 'Single-Haushalte', value: fmt('singlehaushalte', v.singlehaushalte?.value), note: v.singlehaushalte?.value && v.haushalte?.value ? `${((v.singlehaushalte.value / v.haushalte.value) * 100).toFixed(1).replace('.', ',')} %` : null },
    { label: 'Familien mit Kindern', value: fmt('familien', v.familien?.value) },
    { label: 'Arbeitslos Gemeldete', value: fmt('arbeitslose', v.arbeitslose?.value), note: v.arbeitslosenquote?.value != null ? `Quote ${fmt('arbeitslosenquote', v.arbeitslosenquote.value)}` : null },
    { label: 'Einkommen je Veranlagter', value: fmt('einkommen', v.einkommen?.value), note: v.einkommen?.year ? `Stand ${v.einkommen.year}` : null },
    { label: 'Wohnungen', value: fmt('wohnungen', v.wohnungen?.value) },
    { label: 'Genehmigte Wohnungen', value: fmt('baugenehmigungen', v.baugenehmigungen?.value), note: v.baugenehmigungen?.year ? `Stand ${v.baugenehmigungen.year}` : null },
  ];
  const blocks = [
    block.facts('Zahlen im Überblick', facts),
    block.text('Einordnung', `${match} hat ${fmt('einwohner', v.einwohner?.value)} Einwohnerinnen und Einwohner. ${v.unter18?.value != null ? `${fmt('unter18', v.unter18.value)} sind jünger als 18 Jahre, ${fmt('ueber65', v.ueber65?.value)} sind 65 Jahre oder älter.` : ''} Die Daten stammen aus verschiedenen amtlichen Reihen mit unterschiedlichen Ständen; sie sind keine tagesaktuelle Fortschreibung.`),
    block.list('Was du als Nächstes tun kannst', [
      { title: 'Zeitreise für diesen Stadtbezirk', subtitle: 'Entwicklung eines Indikators seit 1995', href: `#labor=kiez-zeitreise&bezirk=${encodeURIComponent(match)}` },
      { title: 'Mit einem anderen Stadtbezirk vergleichen', subtitle: 'Zwei Kieze nebeneinander', href: `#labor=kiez-vergleich&bezirk=${encodeURIComponent(match)}` },
      { title: 'Amtliche Datensätze öffnen', subtitle: 'OpenData@Stuttgart, CC BY 4.0', href: 'https://opendata.stuttgart.de/' },
    ]),
  ];
  return report({
    title: `Kiez-Steckbrief: ${match}`,
    subtitle: f.year ? `Amtliche Statistik, überwiegend Stand ${f.year}` : 'Amtliche Statistik',
    summary: `${match} in Zahlen: Bevölkerung, Haushalte, Familien, Arbeitsmarkt, Einkommen und Bauen.`,
    facts: facts.slice(0, 4),
    blocks,
    sources: await sourceList(f.sources),
    actions: [action('Alle Datensätze öffnen', 'https://opendata.stuttgart.de/')],
    limits: ['Die Reihen haben unterschiedliche Stände (2022/2023, Einkommen 2017). Einzelne Werte können sich durch Nachmeldungen ändern.', 'Stadtbezirksgrenzen und Statistikgrenzen sind nicht identisch.'],
  });
}

export async function kiezZeitreise(params) {
  const district = String(params.bezirk ?? '').trim();
  const key = String(params.indikator ?? 'einwohner');
  if (!district) throw Object.assign(new Error('Bitte einen Stadtbezirk angeben.'), { status: 400 });
  const spec = P[key];
  if (!spec) throw Object.assign(new Error('Unbekannter Indikator.'), { status: 400 });
  const rows = await ckanRows(spec.source);
  const yearKey = col(rows[0], spec.year) ?? 'Jahr';
  const years = [...new Set(rows.map((r) => (String(r[yearKey] ?? '').match(/(?:19|20)\d{2}/) ?? [])[0]).filter(Boolean))].sort();
  const dRows = rowsForDistrict(rows, district);
  const values = [];
  for (const year of years) {
    const yearRows = rowsForYear(dRows, year, spec.year);
    const value = aggregate(yearRows, spec.value, spec.kind);
    if (value != null) values.push({ year, value });
  }
  const shown = values.slice(-30);
  const first = shown[0];
  const last = shown.at(-1);
  const change = first && last && first.value ? ((last.value - first.value) / first.value) * 100 : null;
  return report({
    title: `Kiez-Zeitreise: ${spec.label} in ${district}`,
    subtitle: shown.length ? `${shown[0].year} bis ${shown.at(-1).year}` : null,
    summary: shown.length ? `${spec.label}: ${fmt(key, first.value)} (${first.year}) → ${fmt(key, last.value)} (${last.year})${change != null ? `, ${change >= 0 ? '+' : ''}${change.toFixed(1).replace('.', ',')} %` : ''}.` : 'Für diesen Indikator liegen keine Zeitreihenwerte vor.',
    blocks: [
      block.chart(spec.label, shown.map((x) => x.year), shown.map((x) => +x.value.toFixed(2)), key === 'einkommen' ? '€' : ''),
      block.table('Jahreswerte', ['Jahr', spec.label], shown.slice().reverse().map((x) => [x.year, fmt(key, x.value)])),
      block.text('Methodik', `Summe bzw. Mittelwert der amtlichen Reihe für ${district}. Die Jahre sind nicht immer vollständig; fehlende Werte werden nicht interpoliert.`),
    ],
    sources: await sourceList([spec.source]),
    limits: ['Die Reihe ist eine Momentaufnahme und kann rückwirkend korrigiert werden.', 'Ein Stadtbezirk ist keine sozial homogene Einheit; Durchschnitte verdecken Unterschiede im Quartier.'],
  });
}

export async function kiezVergleich(params) {
  const a = String(params.bezirk ?? '').trim();
  const b = String(params.bezirk2 ?? '').trim();
  if (!a || !b) throw Object.assign(new Error('Bitte zwei Stadtbezirke angeben.'), { status: 400 });
  const [fa, fb] = await Promise.all([factsFor(a), factsFor(b)]);
  const rows = ['einwohner', 'unter18', 'ueber65', 'haushalte', 'singlehaushalte', 'familien', 'arbeitslose', 'arbeitslosenquote', 'einkommen', 'wohnungen', 'baugenehmigungen'].map((k) => {
    const va = fa.values[k]?.value;
    const vb = fb.values[k]?.value;
    const diff = va != null && vb != null ? va - vb : null;
    return [P[k].label, fmt(k, va), fmt(k, vb), diff == null ? '–' : `${diff > 0 ? '+' : ''}${numDe(diff, k === 'einkommen' ? 0 : 1)}`];
  });
  return report({
    title: `Kiez-Vergleich: ${a} und ${b}`,
    subtitle: 'Amtliche Statistik, unterschiedliche Stände',
    summary: `Bevölkerung, Haushalte, Arbeitsmarkt und Bauen im direkten Vergleich.`,
    blocks: [
      block.table('Zahlen nebeneinander', [P.einwohner.label, a, b, 'Differenz'], rows),
      block.text('Lesehilfe', 'Die Differenz ist die absolute Differenz der angezeigten Werte. Bei Quoten und Einkommen ist sie ein Rohwert, kein Signifikanztest. Unterschiedliche Jahre sind möglich.'),
    ],
    sources: await sourceList([...new Set([...fa.sources, ...fb.sources])]),
    limits: ['Kein statistischer Test, keine Kausalität.', 'Die Werte sind gerundet; kleine Differenzen sind nicht aussagekräftig.'],
  });
}

export async function kiezRanking(params) {
  const key = String(params.indikator ?? 'einwohner');
  if (!P[key]) throw Object.assign(new Error('Unbekannter Indikator.'), { status: 400 });
  const names = await districtNames();
  const values = await Promise.all(names.map(async (name) => {
    const r = await indicator(key, name).catch(() => null);
    return r?.value != null ? { name, value: r.value, year: r.year } : null;
  }));
  const sorted = values.filter(Boolean).sort((a, b) => b.value - a.value);
  return report({
    title: `Kiez-Ranking: ${P[key].label}`,
    subtitle: `${sorted.length} Stadtbezirke, absteigend sortiert`,
    summary: sorted.length ? `${sorted[0].name} führt mit ${fmt(key, sorted[0].value)}; ${sorted.at(-1).name} liegt am Ende.` : 'Keine Werte verfügbar.',
    blocks: [
      block.table(P[key].label, ['#', 'Stadtbezirk', 'Wert', 'Jahr'], sorted.map((x, i) => [String(i + 1), x.name, fmt(key, x.value), x.year ?? '–'])),
      block.text('Methodik', 'Alle 23 Stadtbezirke, jeweils der jüngste verfügbare Jahreswert. Bei Summen ist der Bezirk insgesamt gemeint, nicht ein Quartier.'),
    ],
    sources: await sourceList([P[key].source]),
    limits: ['Ein Ranking nach einem Indikator ist keine Bewertung des Stadtbezirks.', 'Unterschiedliche Flächen, Einwohnerzahlen und Jahre erschweren den Vergleich.'],
  });
}

export async function wohnlageCheck(params) {
  const p = await resolvePlace(params);
  const district = await districtAt(p.lat, p.lon);
  const [miet, facts, profil] = await Promise.allSettled([
    areaAt('GEOLINE_FLEX:A12_MSP_LAGEN_EPSG25832', p.lat, p.lon, 2500),
    district ? factsFor(district.name) : Promise.resolve(null),
    import('../../sources/adresse.mjs').then((m) => m.profil(p.lat, p.lon)),
  ]);
  const m = miet.status === 'fulfilled' ? miet.value?.properties ?? null : null;
  const f = facts.status === 'fulfilled' ? facts.value : null;
  const prof = profil.status === 'fulfilled' ? profil.value : null;
  const factsList = [
    { label: 'Mietspiegel-Wohnlage', value: m?.LAGE ?? prof?.wohnlage?.LAGE ?? 'nicht gefunden', note: m?.STAND ? `Stand ${m.STAND}` : null },
    { label: 'Stadtbezirk', value: district?.name ?? prof?.wahl?.stadtbezirk ?? 'unbekannt' },
    { label: 'Wohnungen im Bezirk', value: f ? fmt('wohnungen', f.values.wohnungen?.value) : '–' },
    { label: 'Genehmigte Wohnungen', value: f ? fmt('baugenehmigungen', f.values.baugenehmigungen?.value) : '–', note: f?.values.baugenehmigungen?.year ? `Stand ${f.values.baugenehmigungen.year}` : null },
    { label: 'Haushalte', value: f ? fmt('haushalte', f.values.haushalte?.value) : '–' },
    { label: 'Single-Haushalte', value: f ? fmt('singlehaushalte', f.values.singlehaushalte?.value) : '–' },
  ];
  return report({
    title: 'Wohnlage & Miete',
    subtitle: p.label,
    summary: m?.LAGE ? `Der Punkt liegt in der Mietspiegel-Wohnlage „${m.LAGE}“.` : 'Die Mietspiegel-Wohnlage konnte am Punkt nicht ermittelt werden.',
    facts: factsList.slice(0, 4),
    blocks: [
      block.facts('Wohnen im Bezirk', factsList),
      block.text('Was die Wohnlage bedeutet', 'Die Mietspiegel-Wohnlage ist eine amtliche Einordnung des Wohnumfelds. Sie ist kein Mietpreis und keine individuelle Bewertung der Wohnung. Für die konkrete Miete gilt der Mietspiegel mit Baujahr, Ausstattung und Größe.'),
      block.links('Weiter', [
        { title: 'Mietspiegel der Stadt Stuttgart', href: 'https://www.stuttgart.de/leben/wohnen/mieten/mietspiegel/', note: 'Amtliche Informationen und Tabellen' },
        { title: 'OpenData@Stuttgart: Wohnen', href: 'https://opendata.stuttgart.de/dataset/wohnungen-nach-wohnungsgroesse', note: 'CC BY 4.0' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [
      source('Landeshauptstadt Stuttgart, Mietspiegel-Wohnlagen (WFS, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'),
      ...(await sourceList(['ckan-wohnungen-groesse', 'ckan-baugenehmigungen', 'ckan-privathaushalte'])),
    ],
    limits: ['Die Wohnlage ist eine grobe amtliche Einordnung, keine Mietpreisauskunft.', 'Der Mietspiegel gilt für frei finanzierte Wohnungen; Sonderregeln sind zu prüfen.'],
  });
}

function withDistance(items, lat, lon) {
  return items.map((x) => ({ ...x, distance: haversine({ lat, lon }, { lat: x.lat, lon: x.lon }) })).sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
}

function facilityList(items, label) {
  return items.slice(0, 6).map((x) => ({
    title: x.name ?? label,
    subtitle: [x.address, x.distance != null ? km(x.distance) : null, ...(x.info ?? []).slice(0, 2)].filter(Boolean).join(' · '),
    href: x.web ?? null,
    lat: x.lat, lon: x.lon,
  }));
}

export async function familienCheck(params) {
  const p = await resolvePlace(params);
  const [kitas, schulen, spielplaetze, ferien, bib, schulbezirk] = await Promise.all([
    nearby('kita'), nearby('grundschule'), nearby('spielplatz'), nearby('ferienprogramm'), nearby('bibliothek'),
    import('../../sources/nearby.mjs').then((m) => m.schulbezirk(p.lat, p.lon)).catch(() => null),
  ]);
  const all = {
    kita: withDistance(kitas, p.lat, p.lon).slice(0, 3),
    schule: withDistance(schulen, p.lat, p.lon).slice(0, 3),
    spielplatz: withDistance(spielplaetze, p.lat, p.lon).slice(0, 3),
    ferien: withDistance(ferien, p.lat, p.lon).slice(0, 3),
  };
  const facts = [
    { label: 'Kitas im Umkreis', value: String(kitas.length) },
    { label: 'Grundschulen', value: String(schulen.length) },
    { label: 'Spielplätze', value: String(spielplaetze.length) },
    { label: 'Ferienangebote', value: String(ferien.length) },
    { label: 'Grundschulbezirk', value: schulbezirk?.name ?? schulbezirk?.bezirk ?? 'nicht ermittelt' },
  ];
  return report({
    title: 'Familien-Check',
    subtitle: p.label,
    summary: `In der Nähe: ${kitas.length} Kitas, ${schulen.length} Grundschulen, ${spielplaetze.length} Spielplätze und ${ferien.length} Ferienangebote.`,
    facts: facts.slice(0, 4),
    blocks: [
      block.facts('Familienangebote', facts),
      block.list('Nächste Kitas', facilityList(all.kita, 'Kita')),
      block.list('Nächste Grundschulen', facilityList(all.schule, 'Grundschule')),
      block.list('Nächste Spielplätze', facilityList(all.spielplatz, 'Spielplatz')),
      block.list('Ferienangebote', facilityList(all.ferien, 'Ferienangebot')),
      block.links('Mehr', [
        { title: 'Alle Einrichtungen in „Nähe“', href: '#modul=nearby', note: 'Kitas, Schulen, Spielplätze und mehr' },
        { title: 'Ferienprogramm der Stadt', href: 'https://www.stuttgart.de/leben/familie/ferienprogramm/', note: 'Amtliche Übersicht' },
      ]),
    ],
    points: [
      { lat: p.lat, lon: p.lon, label: p.label },
      ...all.spielplatz.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    ],
    sources: [
      source('Landeshauptstadt Stuttgart, Einrichtungsverzeichnis (WFS, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'),
      source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL'),
    ],
    limits: ['Die Liste ist ein Ausschnitt im Umkreis; sie ersetzt keine Platzanmeldung.', 'Öffnungszeiten und freie Plätze stehen nicht in allen Datensätzen.'],
  });
}

export async function seniorenCheck(params) {
  const p = await resolvePlace(params);
  const district = await districtAt(p.lat, p.lon);
  const [kliniken, toiletten, kuehl, buecherei, notfall, overpass] = await Promise.all([
    nearby('klinik'), nearby('toilette'), nearby('kuehl'), nearby('bibliothek'), nearby('notfall'),
    import('./util.mjs').then((m) => m.overpassQuery('[out:json][timeout:25];(node[amenity=social_facility](around:1500,' + p.lat + ',' + p.lon + ');node[amenity=doctors](around:1500,' + p.lat + ',' + p.lon + ');node[amenity=pharmacy](around:1500,' + p.lat + ',' + p.lon + '););out center tags;')).catch(() => []),
  ]);
  const pflege = overpass.filter((x) => /social_facility|nursing|assisted/.test(`${x.tags?.amenity ?? ''} ${x.tags?.social_facility ?? ''}`)).map((x) => ({ id: x.id, name: x.tags?.name ?? 'Soziale Einrichtung', lat: x.lat ?? x.center?.lat, lon: x.lon ?? x.center?.lon, address: [x.tags?.['addr:street'], x.tags?.['addr:housenumber']].filter(Boolean).join(' ') })).filter((x) => x.lat && x.lon);
  const aerzte = overpass.filter((x) => x.tags?.amenity === 'doctors').map((x) => ({ id: x.id, name: x.tags?.name ?? 'Arztpraxis', lat: x.lat ?? x.center?.lat, lon: x.lon ?? x.center?.lon, address: [x.tags?.['addr:street'], x.tags?.['addr:housenumber']].filter(Boolean).join(' ') })).filter((x) => x.lat && x.lon);
  const apo = overpass.filter((x) => x.tags?.amenity === 'pharmacy').map((x) => ({ id: x.id, name: x.tags?.name ?? 'Apotheke', lat: x.lat ?? x.center?.lat, lon: x.lon ?? x.center?.lon, address: [x.tags?.['addr:street'], x.tags?.['addr:housenumber']].filter(Boolean).join(' ') })).filter((x) => x.lat && x.lon);
  const facts = [
    { label: 'Stadtbezirk', value: district?.name ?? 'unbekannt' },
    { label: 'Kliniken', value: String(kliniken.length) },
    { label: 'Arztpraxen (OSM)', value: String(aerzte.length) },
    { label: 'Apotheken (OSM)', value: String(apo.length) },
    { label: 'Barrierearme Toiletten', value: String(toiletten.filter((x) => /barriere|rollstuhl/i.test(`${x.name} ${(x.info ?? []).join(' ')}`)).length) },
  ];
  return report({
    title: 'Senioren-Check',
    subtitle: p.label,
    summary: `Gesundheit, Alltag und Barrierefreiheit im Umkreis von etwa 1,5 Kilometern.`,
    facts: facts.slice(0, 4),
    blocks: [
      block.facts('Versorgung im Umkreis', facts),
      block.list('Nächste Kliniken', facilityList(withDistance(kliniken, p.lat, p.lon), 'Klinik')),
      block.list('Arztpraxen', facilityList(withDistance(aerzte, p.lat, p.lon), 'Arztpraxis')),
      block.list('Apotheken', facilityList(withDistance(apo, p.lat, p.lon), 'Apotheke')),
      block.list('Pflege und soziale Einrichtungen', facilityList(withDistance(pflege, p.lat, p.lon), 'Einrichtung')),
      block.list('Barrierearme Toiletten und kühle Orte', [...facilityList(withDistance(toiletten.filter((x) => /barriere|rollstuhl/i.test(`${x.name} ${(x.info ?? []).join(' ')}`)), p.lat, p.lon), 'Toilette'), ...facilityList(withDistance(kuehl, p.lat, p.lon), 'Kühler Ort')].slice(0, 6)),
      block.links('Hilfe und Beratung', [
        { title: 'Pflegestützpunkt Stuttgart', href: 'https://www.stuttgart.de/leben/gesundheit/pflege/', note: 'Amtliche Beratung' },
        { title: 'Seniorenberatung', href: 'https://www.stuttgart.de/leben/senioren/', note: 'Angebote der Stadt' },
      ]),
    ],
    points: [
      { lat: p.lat, lon: p.lon, label: p.label },
      ...withDistance(kliniken, p.lat, p.lon).slice(0, 3).map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    ],
    sources: [
      source('Landeshauptstadt Stuttgart, Einrichtungsverzeichnis (WFS, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'),
      source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL'),
    ],
    limits: ['OpenStreetMap ist kein amtliches Arztregister; Vollständigkeit und Öffnungszeiten sind nicht garantiert.', 'Im Notfall gilt 112.'],
  });
}

export async function autoCheck(params) {
  const p = await resolvePlace(params);
  const [park, tank, laden, unfall, tempo] = await Promise.allSettled([
    import('../../sources/parking.mjs').then((m) => m.parking()),
    import('../../sources/tanken.mjs').then((m) => m.tankpreise()),
    import('../../sources/nearby.mjs').then((m) => m.laden(p.lat, p.lon)),
    import('../../sources/unfall.mjs').then((m) => m.unfaelle({ lat: p.lat, lon: p.lon, r: 1000, limit: 20 })),
    wfsItems('GEOLINE_FLEX:A66_GB_TEMPO30_GEBIETE_EPSG25832', p.lat, p.lon, 3000, 20),
  ]);
  const parking = park.status === 'fulfilled' ? park.value.sites ?? [] : [];
  const tankstellen = tank.status === 'fulfilled' ? tank.value.items ?? [] : [];
  const ladesaeulen = laden.status === 'fulfilled' ? laden.value.items ?? [] : [];
  const unfaelle = unfall.status === 'fulfilled' ? unfall.value.items ?? [] : [];
  const tempoZonen = tempo.status === 'fulfilled' ? tempo.value : [];
  const nearestPark = withDistance(parking.filter((x) => Number.isFinite(x.lat)), p.lat, p.lon).slice(0, 4);
  const nearestTank = withDistance(tankstellen.filter((x) => Number.isFinite(x.lat)), p.lat, p.lon).slice(0, 4);
  const nearestLaden = withDistance(ladesaeulen.filter((x) => Number.isFinite(x.lat)), p.lat, p.lon).slice(0, 4);
  const facts = [
    { label: 'Parkhäuser', value: String(parking.length) },
    { label: 'Freie Plätze in der Nähe', value: nearestPark.map((x) => x.free).filter((x) => x != null).reduce((s, x) => s + x, 0).toLocaleString('de-DE') },
    { label: 'Tankstellen', value: String(tankstellen.length) },
    { label: 'Ladepunkte', value: String(ladesaeulen.length) },
    { label: 'Unfälle im 1-km-Umkreis', value: String(unfaelle.length) },
    { label: 'Tempo-30-Zonen', value: String(tempoZonen.length) },
  ];
  return report({
    title: 'Auto-Check',
    subtitle: p.label,
    summary: `Parken, Tanken, Laden und Unfalllage im Umkreis.`,
    facts: facts.slice(0, 4),
    blocks: [
      block.facts('Überblick', facts),
      block.list('Nächste Parkhäuser', nearestPark.map((x) => ({ title: x.name, subtitle: [x.free != null ? `${x.free} frei` : null, x.distance != null ? km(x.distance) : null, x.address].filter(Boolean).join(' · ') }))),
      block.list('Günstigste Tankstellen in der Nähe', nearestTank.map((x) => ({ title: x.name, subtitle: [x.e5 != null ? `E5 ${x.e5.toFixed(3).replace('.', ',')} €` : null, x.e10 != null ? `E10 ${x.e10.toFixed(3).replace('.', ',')} €` : null, x.diesel != null ? `Diesel ${x.diesel.toFixed(3).replace('.', ',')} €` : null, x.distance != null ? km(x.distance) : null].filter(Boolean).join(' · ') }))),
      block.list('Ladepunkte', nearestLaden.map((x) => ({ title: x.name ?? 'Ladepunkt', subtitle: [x.free != null ? `${x.free} frei` : null, x.power != null ? `${x.power} kW` : null, x.distance != null ? km(x.distance) : null].filter(Boolean).join(' · ') }))),
      block.text('Unfalllage', unfaelle.length ? `${unfaelle.length} Unfälle mit Personenschaden im Kilometer-Umkreis, davon ${unfaelle.filter((x) => x.schwere === 'tote' || x.kategorie === 1).length} tödlich.` : 'Keine Unfälle im Kilometer-Umkreis im aktuellen Unfallatlas.'),
      block.links('Weiter', [
        { title: 'Parken & Rad im Modul Mobilität', href: '#modul=mobility', note: 'Live-Belegung und Alternativen' },
        { title: 'Unfallatlas', href: 'https://www.unfallatlas.statistikportal.de/', note: 'Amtliche Daten, dl-de/by-2-0' },
      ]),
    ],
    points: [
      { lat: p.lat, lon: p.lon, label: p.label },
      ...nearestPark.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    ],
    sources: [
      source('Landeshauptstadt Stuttgart, ParkAPI/MobiData BW (dl-de/by-2-0)', 'https://www.mobidata-bw.de/', 'dl-de/by-2-0'),
      source('Markttransparenzstelle für Kraftstoffe / Tankerkönig', 'https://www.tankerkönig.de/', 'Quellenangabe'),
      source('Unfallatlas der Statistischen Ämter (dl-de/by-2-0)', 'https://www.unfallatlas.statistikportal.de/', 'dl-de/by-2-0'),
    ],
    limits: ['Preise und Belegungen sind Momentaufnahmen.', 'Die Unfallzahl im Radius ist keine Aussage über die Sicherheit einer Straße.'],
  });
}

export async function barriereCheck(params) {
  const p = await resolvePlace(params);
  const [toiletten, kliniken, buechereien, bueros, bad, gastro] = await Promise.all([
    nearby('toilette'), nearby('klinik'), nearby('bibliothek'), nearby('buergerbuero'), nearby('bad'), nearby('essen_cafe'),
  ]);
  const all = [
    ...toiletten.map((x) => ({ ...x, kind: 'Toilette' })),
    ...kliniken.map((x) => ({ ...x, kind: 'Klinik' })),
    ...buechereien.map((x) => ({ ...x, kind: 'Bibliothek' })),
    ...bueros.map((x) => ({ ...x, kind: 'Bürgerbüro' })),
    ...bad.map((x) => ({ ...x, kind: 'Bad' })),
  ];
  const withWheel = all.filter((x) => /rollstuhl|stufenlos|barriere/i.test(`${x.wheelchair ?? ''} ${(x.info ?? []).join(' ')}`));
  const nearestList = withDistance(withWheel, p.lat, p.lon).slice(0, 8);
  const outdoor = withDistance(gastro.filter((x) => x.wheelchair), p.lat, p.lon).slice(0, 4);
  return report({
    title: 'Barriere-Check',
    subtitle: p.label,
    summary: `${withWheel.length} barrierearme Einrichtungen im Umkreis, darunter ${toiletten.length} Toiletten.`,
    facts: [
      { label: 'Barrierearme Einrichtungen', value: String(withWheel.length) },
      { label: 'Toiletten', value: String(toiletten.length) },
      { label: 'Kliniken', value: String(kliniken.length) },
      { label: 'Gastronomie mit Angabe', value: String(outdoor.length) },
    ],
    blocks: [
      block.list('Barrierearme Orte', nearestList.map((x) => ({ title: x.name, subtitle: [x.kind, x.address, x.distance != null ? km(x.distance) : null, ...(x.info ?? []).slice(0, 2)].filter(Boolean).join(' · '), href: x.web ?? null }))),
      block.list('Gastronomie mit Barriere-Angabe', outdoor.map((x) => ({ title: x.name, subtitle: [x.wheelchair, x.distance != null ? km(x.distance) : null, x.address].filter(Boolean).join(' · ') }))),
      block.text('Was „barrierearm“ heißt', 'Die Angaben kommen aus OpenStreetMap und dem Einrichtungsverzeichnis. „Stufenlos“ oder „rollstuhlgeeignet“ ist eine Selbstauskunft bzw. Kartierung, keine geprüfte Zertifizierung. Im Zweifel vor dem Besuch anrufen.'),
      block.links('Mehr', [
        { title: 'Barrierefreiheit in der App', href: '#info=barrierefreiheit', note: 'Eigene Seite mit Bedienhinweisen' },
        { title: 'Wheelmap', href: 'https://wheelmap.org/', note: 'Community-Karte für Rollstuhlgerechtheit' },
      ]),
    ],
    points: [
      { lat: p.lat, lon: p.lon, label: p.label },
      ...nearestList.slice(0, 4).map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    ],
    sources: [
      source('Landeshauptstadt Stuttgart, Einrichtungsverzeichnis (WFS, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'),
      source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL'),
    ],
    limits: ['Keine amtliche Zertifizierung; Angaben können veraltet sein.', 'Toiletten können vorübergehend geschlossen sein.'],
  });
}

export async function adressZeugnis(params) {
  const p = await resolvePlace(params);
  const prof = await import('../../sources/adresse.mjs').then((m) => m.profil(p.lat, p.lon));
  const wahl = prof.wahl ?? {};
  const stark = prof.starkregen ?? {};
  const solar = prof.solar ?? {};
  const baeume = prof.baeume ?? {};
  const klima = prof.klima ?? {};
  const laerm = prof.laerm ?? {};
  const factList = [
    { label: 'Stadtbezirk', value: wahl.stadtbezirk ?? 'unbekannt' },
    { label: 'Wahlbezirk', value: wahl.bezirk ?? 'unbekannt' },
    { label: 'Wahllokal', value: wahl.lokal?.name ?? 'nicht ermittelt', note: wahl.lokal?.address ?? null },
    { label: 'Starkregen (extrem)', value: stark.flaechen?.find((x) => /extrem/.test(x.szenario))?.betroffen ? 'Fläche betroffen' : 'nicht betroffen', note: stark.fliessweg != null ? `Fließweg in ${stark.fliessweg} m` : null },
    { label: 'HQ100', value: stark.hq100?.betroffen ? 'betroffen' : 'nicht betroffen', note: stark.hq100?.imUmkreis100m ? 'Fläche im 100-m-Umkreis' : null },
    { label: 'Straßenlärm', value: laerm.strasse ? `${laerm.strasse} dB(A)` : 'keine Angabe', note: laerm.schiene ? `Schiene ${laerm.schiene} dB(A)` : null },
    { label: 'Solarpotenzial', value: solar.pvKwp ? `${numDe(solar.pvKwp)} kWp` : 'keine Angabe', note: solar.stromKwhA ? `${numDe(solar.stromKwhA)} kWh/Jahr` : null },
    { label: 'Bäume im 150-m-Umkreis', value: baeume.anzahl150m != null ? numDe(baeume.anzahl150m) : 'keine Angabe' },
    { label: 'Klimatop', value: klima.klimatop ?? 'keine Angabe' },
  ];
  return report({
    title: 'Adress-Zeugnis',
    subtitle: p.label,
    summary: `Die wichtigsten amtlichen Angaben zu diesem Ort – von Wahlbezirk und Starkregen bis Solar und Bäumen.`,
    facts: factList.slice(0, 4),
    blocks: [
      block.facts('Amtliche Angaben', factList),
      block.text('Wahllokal und Barrierefreiheit', wahl.lokal ? `${wahl.lokal.name}, ${wahl.lokal.address}. Zugang: ${wahl.lokal.zugang ?? 'keine Angabe'}; Tür: ${wahl.lokal.tuer ?? 'keine Angabe'}; Lift: ${wahl.lokal.lift ?? 'keine Angabe'}; Bewertung: ${wahl.lokal.barrierefrei ?? 'keine Angabe'}.` : 'Für diesen Punkt wurde kein Wahllokal gefunden.'),
      block.text('Starkregen', stark.flaechen?.length ? stark.flaechen.map((x) => `${x.szenario}: ${x.betroffen ? 'Fläche betroffen' : x.nahe ? 'Fläche in der Nähe' : 'keine Fläche in der Nähe'}`).join('; ') + '.' : 'Keine Starkregenangabe verfügbar.'),
      block.text('Solar und Dach', solar.flaecheM2 ? `Dachfläche ${numDe(solar.flaecheM2)} m², PV-Leistung ${numDe(solar.pvKwp)} kWp, Stromertrag ${numDe(solar.stromKwhA)} kWh/Jahr, CO₂-Einsparung ${numDe(solar.co2Tonnen)} t/Jahr.` : 'Für diesen Punkt liegt kein Solarkataster-Eintrag vor.'),
      block.text('Bäume und Klima', baeume.anzahl150m != null ? `${baeume.anzahl150m} Bäume im 150-m-Umkreis; häufigste Arten: ${(baeume.topArten ?? []).slice(0, 3).map((x) => `${x.art} (${x.anzahl})`).join(', ') || 'keine Angabe'}. Klimatop: ${klima.klimatop ?? 'keine Angabe'}.` : 'Keine Baumdaten verfügbar.'),
      block.links('Nächste Schritte', [
        { title: 'Vollständiges Adressprofil öffnen', href: '#modul=nearby&focus=adresse', note: 'Alle Themen zu dieser Adresse' },
        { title: 'Mängel an die Stadt melden', href: 'https://www.stuttgart.de/service/gelbe-karte/', note: 'Gelbe Karte' },
        { title: 'OpenStreetMap-Hinweis schreiben', href: `https://www.openstreetmap.org/note/new#map=18/${p.lat.toFixed(5)}/${p.lon.toFixed(5)}`, note: 'Für alle Karten sichtbar' },
      ]),
    ],
    points: [
      { lat: p.lat, lon: p.lon, label: p.label },
      ...(wahl.lokal?.lat ? [{ lat: wahl.lokal.lat, lon: wahl.lokal.lon, label: `Wahllokal: ${wahl.lokal.name}` }] : []),
    ],
    sources: [
      source('Landeshauptstadt Stuttgart, Adressprofil (WFS/Geoserver, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'),
      source('Landeshauptstadt Stuttgart, Wahllokale, Starkregen, Lärm, Solar, Baumkataster', 'https://www.stuttgart.de/', 'CC BY 4.0'),
      source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL'),
    ],
    limits: ['Die Angaben sind amtliche Momentaufnahmen; Starkregen- und Lärmkarten sind modellhaft.', 'Das Adressprofil ist keine Baugenehmigung und keine Rechtsberatung.'],
  });
}

export { factsFor, districtNames, indicator, P as KIEZ_INDICATORS };
