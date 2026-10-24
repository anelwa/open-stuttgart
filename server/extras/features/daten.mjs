// Werkzeuge für Transparenz und Daten: Quellen prüfen, Datensätze erkunden,
// Lizenzen verstehen und Exporte bauen. Sie arbeiten ausschließlich auf dem
// Quellenregister und den bereits gecachten Adaptern.
import { report, block, source, action, numDe, clean } from '../util.mjs';
import { SOURCES, SOURCE_BY_ID } from '../sources.mjs';
import { runSource, publicSource, sourceCatalog } from '../run-source.mjs';
import { ckanRows, maxYear, rowsForYear, sum, col, resolvePlace } from './util.mjs';

function findSources(q) {
  const t = String(q ?? '').trim().toLowerCase();
  if (!t) return [];
  return SOURCES.filter((s) => `${s.id} ${s.title} ${s.summary} ${s.license} ${s.group} ${s.kind}`.toLowerCase().includes(t));
}

function metaFacts(s) {
  return [
    { label: 'Typ', value: s.kind },
    { label: 'Lizenz', value: s.license },
    { label: 'Quellenangabe', value: s.attribution },
    { label: 'Aktualisierung', value: s.ttl },
    { label: 'Status', value: s.status === 'live' ? 'live angebunden' : s.status === 'key' ? 'Schlüssel nötig' : 'in Vorbereitung' },
  ];
}

export async function quellenCheck(params) {
  const q = String(params.quelle ?? '').trim();
  if (!q) throw Object.assign(new Error('Bitte Quellen-ID oder Stichwort angeben.'), { status: 400 });
  const exact = SOURCE_BY_ID.get(q);
  const matches = exact ? [exact] : findSources(q);
  if (!matches.length) throw Object.assign(new Error('Keine Quelle gefunden.'), { status: 404 });
  if (exact) {
    const s = exact;
    return report({
      title: `Quelle: ${s.title}`,
      subtitle: s.id,
      summary: s.summary,
      facts: metaFacts(s),
      blocks: [
        block.facts('Steckbrief', metaFacts(s)),
        block.text('Grenzen und Hinweise', s.note ?? 'Keine besonderen Einschränkungen dokumentiert.'),
        block.list('Weiterverwendung', [
          { title: 'Direkter API-Abruf', subtitle: `/api/labor/quelle?id=${encodeURIComponent(s.id)}`, href: `/api/labor/quelle?id=${encodeURIComponent(s.id)}` },
          { title: 'Originalquelle', subtitle: s.url, href: s.url },
          { title: 'Als Werkzeug öffnen', subtitle: 'Datensatz-Explorer', href: `#labor=datensatz-explorer&quelle=${encodeURIComponent(s.id)}` },
        ]),
      ],
      sources: [source(`${s.attribution} – ${s.title}`, s.url, s.license)],
      limits: [s.note, 'Die Anbindung nennt Quelle und Lizenz; die Rechte an den Daten liegen beim Anbieter.'].filter(Boolean),
    });
  }
  return report({
    title: `Quellen zu „${q}“`,
    subtitle: `${matches.length} Treffer`,
    summary: 'Die gefundenen Quellen mit Lizenz und Status. Für Details eine ID öffnen.',
    blocks: [
      block.table('Treffer', ['ID', 'Titel', 'Typ', 'Lizenz'], matches.slice(0, 40).map((s) => [s.id, s.title, s.kind, s.license])),
      block.list('Direkt öffnen', matches.slice(0, 8).map((s) => ({ title: s.title, subtitle: `${s.kind} · ${s.license}`, href: `#labor=datensatz-explorer&quelle=${encodeURIComponent(s.id)}` }))),
    ],
    sources: [source('Open Stuttgart, Quellenregister', '/api/labor/quellen', 'EUPL-1.2')],
    limits: ['Die Suche geht über Titel, Kurzbeschreibung, Lizenz und Typ.'],
  });
}

export async function datensatzExplorer(params) {
  const q = String(params.q ?? '').trim();
  const id = String(params.quelle ?? '').trim();
  if (id) {
    const r = await runSource(id, params);
    const blocks = [];
    if (r.type === 'table') {
      blocks.push(block.table(
        r.title,
        r.columns ?? [],
        (r.rows ?? []).slice(0, 40).map((row) => (r.columns ?? []).map((c) => row[c])),
        r.truncated ? `${r.rows.length} von ${r.totalRows} Zeilen` : null,
      ));
    } else if (r.type === 'geojson') {
      blocks.push(block.text('GeoJSON', `${r.features?.length ?? 0} Objekte im Ausschnitt. Die Punkte sind auf der Karte markiert.`));
    } else if (r.type === 'points') {
      blocks.push(block.list('Objekte', (r.points ?? []).slice(0, 30).map((p) => ({ title: p.name, subtitle: [p.props?.amenity, p.props?.shop].filter(Boolean).join(' · '), lat: p.lat, lon: p.lon }))));
    } else {
      blocks.push(block.list('Einträge', (r.items ?? []).slice(0, 20).map((x) => ({ title: x.title, subtitle: x.subtitle, href: x.href, lat: x.lat ?? null, lon: x.lon ?? null }))));
    }
    return report({
      title: r.title,
      subtitle: `${r.kind} · ${r.license}`,
      summary: r.summary,
      blocks: [
        ...blocks,
        block.facts('Quelle', [
          { label: 'ID', value: r.id },
          { label: 'Lizenz', value: r.license },
          { label: 'Quellenangabe', value: r.attribution },
          { label: 'Abruf', value: new Date(r.fetchedAt).toLocaleString('de-DE') },
        ]),
        block.links('Export und Original', [
          { title: 'JSON-Abruf', href: `/api/labor/quelle?id=${encodeURIComponent(r.id)}` },
          { title: 'Originalquelle', href: r.sourceUrl ?? r.dataset?.url ?? '' },
          ...(r.dataset?.url ? [{ title: 'CKAN-Datensatz', href: r.dataset.url }] : []),
        ]),
      ],
      points: r.points ?? [],
      sources: [source(`${r.attribution} – ${r.title}`, r.sourceUrl ?? r.dataset?.url ?? '', r.license)],
      limits: r.limits ?? [],
    });
  }
  const matches = q ? findSources(q) : SOURCES;
  if (!matches.length) throw Object.assign(new Error('Keine Quelle gefunden.'), { status: 404 });
  return report({
    title: q ? `Datensätze zu „${q}“` : 'Alle neuen Datensätze',
    subtitle: `${matches.length} von ${SOURCES.length} Quellen`,
    summary: 'Durchsuche die über 100 neuen Quellen. Eine ID öffnet die Tabelle, die Karte oder die Rohdaten.',
    blocks: [
      block.table('Quellen', ['ID', 'Titel', 'Typ', 'Lizenz'], matches.slice(0, 60).map((s) => [s.id, s.title, s.kind, s.license])),
      block.list('Öffnen', matches.slice(0, 12).map((s) => ({ title: s.title, subtitle: `${s.kind} · ${s.license}`, href: `#labor=datensatz-explorer&quelle=${encodeURIComponent(s.id)}` }))),
    ],
    sources: [source('Open Stuttgart, Quellenregister', '/api/labor/quellen', 'EUPL-1.2')],
    limits: ['Maximal 60 Treffer in der Tabelle; die API liefert das vollständige Register.'],
  });
}

export async function stadtVergleich() {
  const [pop, hh, work, bau, income] = await Promise.all([
    ckanRows('ckan-einwohner-altersgruppen'),
    ckanRows('ckan-privathaushalte'),
    ckanRows('ckan-arbeitslos'),
    ckanRows('ckan-baugenehmigungen'),
    ckanRows('ckan-einkommen'),
  ]);
  const series = (rows, yearPattern, valuePattern) => {
    const yearKey = col(rows[0], yearPattern);
    const years = [...new Set(rows.map((r) => (String(r[yearKey] ?? '').match(/(?:19|20)\d{2}/) ?? [])[0]).filter(Boolean))].sort();
    return years.map((y) => ({ year: y, value: sum(rowsForYear(rows, y, yearPattern), valuePattern) })).filter((x) => x.value != null);
  };
  const population = series(pop, /stichtag/i, /^Einwohner$/i);
  const households = series(hh, /stichtag/i, /Haushalte insgesamt/i);
  const unemployed = series(work, /jahr/i, /arbeitslos Gemeldete insgesamt/i);
  const permits = series(bau, /jahr/i, /Wohnungen_insgesamt/i);
  const incomeRows = rowsForYear(income, maxYear(income, /jahr/i), /jahr/i);
  const incomeAvg = (() => {
    const vals = incomeRows.map((r) => Number(String(r['Nettoeinkünfte je veranlagter Person in Euro'] ?? '').replace(',', '.'))).filter(Number.isFinite);
    return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
  })();
  return report({
    title: 'Stuttgart im langfristigen Vergleich',
    subtitle: 'Amtliche Reihen, unterschiedliche Jahre',
    summary: population.length ? `Bevölkerung ${numDe(population[0].value)} (${population[0].year}) → ${numDe(population.at(-1).value)} (${population.at(-1).year}).` : 'Keine Vergleichsreihen verfügbar.',
    blocks: [
      block.chart('Bevölkerung', population.map((x) => x.year), population.map((x) => x.value), 'Personen'),
      block.chart('Haushalte', households.map((x) => x.year), households.map((x) => x.value), 'Haushalte'),
      block.chart('Arbeitslos Gemeldete', unemployed.map((x) => x.year), unemployed.map((x) => x.value), 'Personen'),
      block.chart('Genehmigte Wohnungen', permits.map((x) => x.year), permits.map((x) => x.value), 'Wohnungen'),
      block.facts('Weitere Kennzahlen', [
        { label: 'Einwohner (letzter Wert)', value: numDe(population.at(-1)?.value), note: population.at(-1)?.year ?? null },
        { label: 'Haushalte (letzter Wert)', value: numDe(households.at(-1)?.value), note: households.at(-1)?.year ?? null },
        { label: 'Arbeitslose (letzter Wert)', value: numDe(unemployed.at(-1)?.value), note: unemployed.at(-1)?.year ?? null },
        { label: 'Einkommen je Veranlagter', value: incomeAvg != null ? `${numDe(incomeAvg)} €` : 'keine Angabe', note: `Stadtweiter Durchschnitt, Stand ${maxYear(income, /jahr/i) ?? 'unbekannt'}` },
      ]),
      block.text('Methodik', 'Die Reihen stammen aus unterschiedlichen Ämtern und Jahren. Bevölkerungszahlen werden je Stichtag summiert; Einkommen ist ein ungewichteter Durchschnitt der Stadtbezirke.'),
    ],
    sources: [
      source('Landeshauptstadt Stuttgart, Statistisches Amt (CC BY 4.0)', 'https://opendata.stuttgart.de/', 'CC BY 4.0'),
    ],
    limits: ['Unterschiedliche Stände und Abgrenzungen; kein einheitliches Panel.', 'Die Einkommensreihe endet 2017.'],
  });
}

export async function katalogNeu() {
  const { stadtKatalog, dcatKatalog } = await import('../../sources/schnittstellen.mjs');
  const [stadt, gov] = await Promise.allSettled([stadtKatalog(), dcatKatalog()]);
  const items = [];
  if (stadt.status === 'fulfilled') {
    for (const d of stadt.value.items ?? []) items.push({ title: d.title, date: d.modified, href: d.url, badge: 'OpenData@Stuttgart', note: d.organization ?? null, license: d.license ?? null });
  }
  if (gov.status === 'fulfilled') {
    for (const d of gov.value.items ?? []) items.push({ title: d.title, date: d.modified, href: d.url, badge: 'GovData', note: d.organization ?? null, license: d.license ?? null });
  }
  const seen = new Set();
  const unique = items.filter((x) => {
    if (!x.href || seen.has(x.href)) return false;
    seen.add(x.href); return true;
  }).sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))).slice(0, 40);
  return report({
    title: 'Neue und zuletzt geänderte Datensätze',
    subtitle: `${unique.length} Einträge aus zwei Katalogen`,
    summary: 'Der jüngste Stand aus OpenData@Stuttgart und GovData – mit Direktlink und Lizenz.',
    blocks: [
      block.list('Zuletzt geändert', unique.map((x) => ({ title: x.title, subtitle: [x.badge, x.date ? new Date(x.date).toLocaleDateString('de-DE') : null, x.license].filter(Boolean).join(' · '), href: x.href }))),
      block.text('Hinweis', 'Der Änderungsfeed zeigt Metadaten, nicht die Inhalte. Ein neuer Datensatz ist noch keine geprüfte Quelle; Lizenz und Qualität müssen vor der Nutzung geprüft werden.'),
    ],
    sources: [
      source('OpenData@Stuttgart (CKAN)', 'https://opendata.stuttgart.de/', 'CC BY 4.0 / je Datensatz'),
      source('GovData.de (DCAT-AP)', 'https://www.govdata.de/', 'Metadaten CC0'),
    ],
    limits: ['Sortierung nach Metadaten-Datum; diese können ungenau sein.'],
  });
}

export async function lizenzFinder(params) {
  const q = String(params.q ?? '').trim().toLowerCase();
  const matches = q ? SOURCES.filter((s) => `${s.license} ${s.title} ${s.attribution} ${s.kind}`.toLowerCase().includes(q)) : SOURCES;
  const groups = new Map();
  for (const s of matches) {
    const key = s.license;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return report({
    title: q ? `Lizenzen zu „${q}“` : 'Lizenzübersicht der neuen Quellen',
    subtitle: `${matches.length} Quellen, ${groups.size} Lizenzfamilien`,
    summary: 'Welche Lizenz gilt – und was muss bei der Weiterverwendung genannt werden?',
    blocks: [
      block.list('Lizenzfamilien', [...groups.entries()].map(([license, list]) => ({ title: license, subtitle: `${list.length} Quellen`, note: list.slice(0, 4).map((s) => s.title).join(', ') }))),
      block.table('Quellen und Lizenzen', ['Quelle', 'Typ', 'Lizenz'], matches.slice(0, 60).map((s) => [s.title, s.kind, s.license])),
      block.text('Kurzregeln', 'CC BY 4.0: Namensnennung, Lizenz und Änderungshinweis. dl-de/by-2-0: Quellenvermerk mit Datenhaltender Stelle und Jahr. ODbL: Namensnennung und Share-alike für abgeleitete Datenbanken. CC0: keine Pflicht, Quellenangabe bleibt gute Praxis. Bei „Quellenangabe“ ohne Standardlizenz: Rechte vor Weiterverwendung klären.'),
    ],
    sources: [source('Open Stuttgart, Quellenregister', '/api/labor/quellen', 'EUPL-1.2')],
    limits: ['Keine Rechtsberatung. Maßgeblich sind die Lizenztexte und die Angaben der Quelle.'],
  });
}

export async function openDataExport(params) {
  const q = String(params.q ?? '').trim();
  const matches = findSources(q);
  if (!matches.length) throw Object.assign(new Error('Keine exportierbare Quelle gefunden.'), { status: 404 });
  return report({
    title: 'Open-Data-Export',
    subtitle: `${matches.length} Quellen zu „${q}“`,
    summary: 'Direkte API- und Original-Links. Die Endpunkte liefern Quelle, Lizenz und Abrufzeit mit.',
    blocks: [
      block.list('Direkte Abrufe', matches.slice(0, 20).map((s) => ({ title: s.title, subtitle: `${s.kind} · ${s.license}`, href: `/api/labor/quelle?id=${encodeURIComponent(s.id)}` }))),
      block.table('Quellen', ['ID', 'Titel', 'Typ', 'Lizenz'], matches.map((s) => [s.id, s.title, s.kind, s.license])),
      block.text('Formate', 'Tabellen liefert der Endpunkt als JSON; GeoJSON-Quellen als FeatureCollection. Ein CSV-Download lässt sich mit jedem Tabellenkalkulationsprogramm aus der JSON-Antwort erzeugen; die Originaldatei steht zusätzlich unter der Quellen-URL bereit.'),
    ],
    sources: [source('Open Stuttgart, Quellenregister', '/api/labor/quellen', 'EUPL-1.2')],
    limits: ['Bitte Fair-Use beachten: Die Endpunkte cachen, aber nicht in Schleifen abrufen.'],
  });
}

export async function aenderungsFeed() {
  const [emsc, news, gdacs] = await Promise.allSettled([
    runSource('api-emsc-erdbeben', { limit: 10 }),
    runSource('api-tagesschau', { limit: 10 }),
    runSource('api-gdacs', { limit: 10 }),
  ]);
  const items = [];
  for (const r of [emsc, news, gdacs]) {
    if (r.status !== 'fulfilled') continue;
    for (const x of r.value.items ?? []) items.push({ title: x.title, subtitle: [x.badge, x.subtitle].filter(Boolean).join(' · '), date: x.date, href: x.href, lat: x.lat, lon: x.lon });
  }
  items.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  return report({
    title: 'Änderungs-Feed',
    subtitle: `${items.length} aktuelle Einträge`,
    summary: 'Erdbeben, Nachrichten und globale Warnungen – die letzten Meldungen aus drei unabhängigen Quellen.',
    blocks: [
      block.list('Aktuell', items.slice(0, 30)),
      block.text('Feed-Idee', 'Die vorhandenen Endpunkte lassen sich als RSS abonnieren: Stadtgedächtnis, FragDenStaat und die WFS-Layer. Dieser Überblick bündelt zusätzlich Quellen, die noch keinen eigenen Feed haben.'),
    ],
    sources: [
      source('EMSC (CC BY 4.0)', 'https://www.seismicportal.eu/', 'CC BY 4.0'),
      source('tagesschau.de (Quellenangabe)', 'https://www.tagesschau.de/', 'Quellenangabe'),
      source('GDACS (Nutzungsbedingungen)', 'https://www.gdacs.org/', 'GDACS-Nutzungsbedingungen'),
    ],
    limits: ['Kein vollständiger Nachrichtenüberblick; nur Titel und Link.'],
  });
}

export { findSources };

export async function haushaltTransparenz() {
  const r = await runSource('ckan-kulturausgaben', { limit: 5000 });
  const rows = r.rows ?? [];
  const years = new Map();
  for (const row of rows) {
    const year = String(row.Jahr ?? '').slice(0, 4);
    if (!year) continue;
    if (!years.has(year)) years.set(year, { year, aufwand: 0, ertrag: 0, netto: 0, positionen: 0 });
    const y = years.get(year);
    const pos = String(row.Haushaltsposition ?? '');
    const betrag = Number(String(row.Betrag ?? '').replace(/\./g, '').replace(',', '.')) || 0;
    if (/Kulturaufwand/i.test(pos)) y.aufwand += betrag;
    if (/Kulturertrag/i.test(pos)) y.ertrag += betrag;
    if (/Nettoressourcenbedarf/i.test(pos)) y.netto += betrag;
    y.positionen++;
  }
  const series = [...years.values()].sort((a, b) => a.year.localeCompare(b.year));
  const latest = series.at(-1);
  return report({
    title: 'Haushalt & Kulturausgaben',
    subtitle: 'Amtliche Haushaltsdaten der Kulturverwaltung',
    summary: latest ? `Im Jahr ${latest.year}: ${(latest.aufwand / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. € Kulturaufwand und ${(latest.ertrag / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. € Erträge.` : 'Keine Haushaltsdaten verfügbar.',
    facts: [
      { label: 'Jahre', value: String(series.length) },
      { label: 'Letztes Jahr', value: latest?.year ?? '–' },
      { label: 'Kulturaufwand', value: latest ? `${(latest.aufwand / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. €` : '–' },
      { label: 'Kulturerträge', value: latest ? `${(latest.ertrag / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. €` : '–' },
    ],
    blocks: [
      block.chart('Kulturaufwand und Erträge', series.map((x) => x.year), series.map((x) => +(x.aufwand / 1e6).toFixed(1)), 'Mio. €'),
      block.table('Jahreswerte', ['Jahr', 'Aufwand (Mio. €)', 'Erträge (Mio. €)', 'Netto (Mio. €)'], series.map((x) => [x.year, (x.aufwand / 1e6).toFixed(1), (x.ertrag / 1e6).toFixed(1), (x.netto / 1e6).toFixed(1)])),
      block.text('Was die Zahlen zeigen', 'Die Daten unterscheiden Aufwand und Erträge der Kulturverwaltung. Sie sind kein vollständiger kommunaler Haushalt und keine Bewertung einzelner Kultureinrichtungen. Für den gesamten Haushalt die verlinkten Transparenzportale nutzen.'),
      block.links('Mehr', [
        { title: 'OpenData@Stuttgart: Kulturausgaben', href: r.dataset?.url ?? 'https://opendata.stuttgart.de/', note: 'Rohdaten, CC BY 4.0' },
        { title: 'Offener Haushalt', href: 'https://offenerhaushalt.de/', note: 'Kommunale Haushaltsdaten' },
      ]),
    ],
    sources: [source('Landeshauptstadt Stuttgart, Kulturausgaben (CC BY 4.0)', 'https://opendata.stuttgart.de/', 'CC BY 4.0')],
    limits: ['Nur Kulturverwaltung, nicht der gesamte Stadthaushalt.', 'Haushaltsdaten können sich durch Nachtragshaushalte ändern.'],
  });
}

export async function datenqualitaet(params) {
  const p = await resolvePlace(params);
  const { wfsItems, overpassQuery } = await import('./util.mjs');
  const checks = [
    ['Bäume (Baumkataster)', () => wfsItems('Base:A67_GFM_BAUM_PLUS_EPSG25832', p.lat, p.lon, 300, 200)],
    ['Toiletten', () => wfsItems('GEOLINE_FLEX:IP_2_10_10_TOILETTENANLAGE_EPSG25832', p.lat, p.lon, 800, 100)],
    ['Trinkbrunnen', () => wfsItems('GEOLINE_FLEX:A62_BRU_BRUNNEN_Trinkwasserbr_in_Betr_EPSG25832', p.lat, p.lon, 800, 100)],
    ['Spielplätze', () => wfsItems('GEOLINE_FLEX:A62_SPF_SPIELPLAETZE_EPSG25832', p.lat, p.lon, 1000, 100)],
    ['Grundschulen', () => wfsItems('GEOLINE_FLEX:IP_2_04_01_GRUNDSCHULE_EPSG25832', p.lat, p.lon, 1500, 100)],
    ['Wahllokale', () => wfsItems('GEOLINE_FLEX:A12_GBE_WAHLLOKALE_EPSG25832', p.lat, p.lon, 1500, 100)],
  ];
  const results = [];
  for (const [label, fn] of checks) {
    try { results.push({ label, count: (await fn()).length }); } catch { results.push({ label, count: null }); }
  }
  let osm = null;
  try {
    const els = await overpassQuery('[out:json][timeout:25];(node[amenity=bench](around:500,' + p.lat + ',' + p.lon + ');node[amenity=waste_basket](around:500,' + p.lat + ',' + p.lon + ');node[amenity=drinking_water](around:500,' + p.lat + ',' + p.lon + ');node[amenity=toilets](around:500,' + p.lat + ',' + p.lon + '););out count;');
    osm = els?.[0]?.tags?.total ?? null;
  } catch { /* optional */ }
  const withData = results.filter((x) => x.count > 0).length;
  return report({
    title: 'Datenqualität vor Ort',
    subtitle: p.label,
    summary: `${withData} von ${results.length} amtlichen Ebenen liefern im Umkreis Daten. ${osm != null ? `OpenStreetMap: ${osm} Alltagsobjekte im 500-m-Umkreis.` : 'OSM-Abfrage nicht verfügbar.'}`,
    facts: [
      { label: 'Amtliche Ebenen mit Daten', value: `${withData}/${results.length}` },
      { label: 'OSM-Objekte (500 m)', value: osm != null ? String(osm) : '–' },
      { label: 'Geprüfte Ebenen', value: String(results.length) },
    ],
    blocks: [
      block.table('Amtliche Ebenen im Umkreis', ['Ebene', 'Objekte'], results.map((x) => [x.label, x.count == null ? 'nicht erreichbar' : String(x.count)])),
      block.text('Was die Prüfung bedeutet', 'Gezählt wird, ob eine Ebene im Umkreis Daten liefert – nicht, ob sie vollständig oder aktuell ist. Eine leere Ebene kann auch bedeuten, dass es vor Ort keine solchen Objekte gibt. OpenStreetMap ergänzt amtliche Daten, ist aber keine amtliche Quelle.'),
      block.links('Mehr', [
        { title: 'Stadt-Layer-Katalog', href: '#modul=wissen&focus=karte', note: 'Alle WFS-Layer und Freigaben' },
        { title: 'OSM-Hinweise', href: '#modul=wissen&focus=fundstuecke', note: 'Fehlende Daten melden' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [source('Landeshauptstadt Stuttgart, Geoserver (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL')],
    limits: ['Keine Vollständigkeitsprüfung; nur eine Stichprobe im Umkreis.', 'Leere Ergebnisse können korrekt sein.'],
  });
}

export async function strassenRanking() {
  const { unfaelle } = await import('../../sources/unfall.mjs');
  const u = await unfaelle({ bbox: '9.03,48.68,9.32,48.87', limit: 5000 });
  const items = u.items ?? [];
  const cells = new Map();
  for (const x of items) {
    const key = `${Math.round(x.lat / 0.0012)}:${Math.round(x.lon / 0.0018)}`;
    if (!cells.has(key)) cells.set(key, { lat: 0, lon: 0, n: 0, severe: 0, rad: 0, fuss: 0 });
    const c = cells.get(key);
    c.lat += x.lat; c.lon += x.lon; c.n++;
    if (x.kategorie <= 2) c.severe++;
    if (x.rad) c.rad++;
    if (x.fuss) c.fuss++;
  }
  const clusters = [...cells.values()].map((c) => ({ lat: c.lat / c.n, lon: c.lon / c.n, n: c.n, severe: c.severe, rad: c.rad, fuss: c.fuss })).sort((a, b) => b.n - a.n).slice(0, 12);
  const { districtAt } = await import('./util.mjs');
  for (const c of clusters) {
    try { const d = await districtAt(c.lat, c.lon); c.district = d?.name ?? null; } catch { c.district = null; }
  }
  return report({
    title: 'Unfallschwerpunkte im Stadtgebiet',
    subtitle: 'Unfallatlas 2025, Raster-Näherung',
    summary: `${items.length} Unfälle mit Personenschaden; der dichteste Rasterpunkt liegt im Bereich ${clusters[0]?.district ?? 'Stuttgart'} mit ${clusters[0]?.n ?? 0} Unfällen.`,
    facts: [
      { label: 'Unfälle gesamt', value: String(items.length) },
      { label: 'Schwerpunkte', value: String(clusters.length) },
      { label: 'Schwer/tödlich', value: String(items.filter((x) => x.kategorie <= 2).length) },
      { label: 'Mit Rad', value: String(items.filter((x) => x.rad).length) },
    ],
    blocks: [
      block.table('Dichteste Rasterpunkte', ['Bezirk', 'Unfälle', 'schwer/tödlich', 'Rad', 'Fuß'], clusters.map((c) => [c.district ?? '–', String(c.n), String(c.severe), String(c.rad), String(c.fuss)])),
      block.text('Methodik und Grenzen', 'Die Unfälle werden in ein Raster von etwa 120 × 120 Metern gruppiert. Das ist keine amtliche Straßen- oder Kreuzungsstatistik; die Bezirksangabe ist eine Näherung. Die Karte zeigt die Rasterpunkte, nicht die einzelnen Unfälle.'),
      block.links('Mehr', [
        { title: 'Unfallatlas', href: 'https://www.unfallatlas.statistikportal.de/', note: 'Amtliche Einzelpunkte' },
        { title: 'Unfallatlas in der App', href: '#modul=mobility&focus=verkehr', note: 'Karte nach Schwere' },
      ]),
    ],
    points: clusters.map((c) => ({ lat: c.lat, lon: c.lon, label: `${c.n} Unfälle${c.district ? ` · ${c.district}` : ''}` })),
    sources: [source('Unfallatlas der Statistischen Ämter (dl-de/by-2-0)', 'https://www.unfallatlas.statistikportal.de/', 'dl-de/by-2-0')],
    limits: ['Raster-Näherung, keine Straßenzuordnung.', 'Nur Unfälle mit Personenschaden; keine Sachschäden.'],
  });
}
