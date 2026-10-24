// Freizeitwerkzeuge: Regen, Spielplätze, Picknick, Sport, Grillen, Museen,
// Abendplanung und Gießpatenschaft. Sie verbinden Wetter, amtliche Einrichtungen
// und OpenStreetMap – mit klaren Grenzen.
import { report, block, source, action, numDe, km, dateDe, timeDe, haversine } from '../util.mjs';
import { runSource } from '../run-source.mjs';
import { resolvePlace, nearby, nearest, weatherNow, treeCountAt } from './util.mjs';

function distance(a, b) { return haversine(a, b); }
function localHour(iso) {
  const d = new Date(iso);
  return Number.isNaN(+d) ? null : d.getHours() + d.getMinutes() / 60;
}

export async function regenAnkunft(params) {
  const p = await resolvePlace(params);
  const w = await weatherNow();
  const hourly = w.hourly ?? [];
  const now = Date.now();
  const next = hourly.find((x) => new Date(x.t).getTime() >= now - 3600_000 && Number(x.precipitation) > 0.05);
  const nextHours = hourly.filter((x) => new Date(x.t).getTime() >= now - 3600_000).slice(0, 12);
  const total = nextHours.reduce((s, x) => s + (Number(x.precipitation) || 0), 0);
  return report({
    title: 'Wann kommt der Regen?',
    subtitle: p.label,
    summary: next ? `Nächster Niederschlag gegen ${timeDe(next.t) ?? 'unbekannt'}, ${numDe(next.precipitation, 1)} mm/Stunde.` : 'In den nächsten Stunden ist kein Niederschlag vorhergesagt.',
    facts: [
      { label: 'Nächster Regen', value: next ? timeDe(next.t) ?? '–' : 'keiner in 12 h', note: next ? `${numDe(next.precipitation, 1)} mm/h` : null },
      { label: 'Regen in 12 h', value: `${numDe(total, 1)} mm` },
      { label: 'Aktuell', value: `${numDe(w.temperature, 1)} °C, ${w.condition}` },
      { label: 'Luftfeuchte', value: `${Math.round(w.humidity)} %` },
    ],
    blocks: [
      block.chart('Niederschlag der nächsten Stunden', nextHours.map((x) => timeDe(x.t) ?? ''), nextHours.map((x) => Number(x.precipitation) || 0), 'mm/h'),
      block.table('Stundenwerte', ['Zeit', 'mm/h', 'Temperatur', 'Wolken'], nextHours.map((x) => [timeDe(x.t), numDe(x.precipitation, 1), `${numDe(x.temperature, 1)} °C`, `${Math.round(x.cloud)} %`])),
      block.text('Was das heißt', 'Die Werte sind eine Punktvorhersage des DWD über Bright Sky. Schauer können lokal stärker ausfallen, als das Raster zeigt. Das Radarbild in der App zeigt die aktuelle Verteilung.'),
      block.links('Mehr', [
        { title: 'Regenradar', href: '#modul=environment&focus=wetter', note: 'Aktuelle Radarbilder zum Abspielen' },
        { title: 'DWD-Warnungen', href: 'https://www.dwd.de/DE/wetter/warnungen/warnWetter_node.html', note: 'Amtliche Warnungen' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [source('Deutscher Wetterdienst über Bright Sky (GeoNutzV)', 'https://brightsky.dev/', 'GeoNutzV')],
    limits: ['Punktvorhersage, kein flächendeckendes Radar.', 'Gewitter und Starkregen können kleinteilig sein.'],
  });
}

export async function spielplatzFinder(params) {
  const p = await resolvePlace(params);
  const [plaetze, toiletten, gastro, eis] = await Promise.all([
    nearby('spielplatz'), nearby('toilette'), nearby('essen_cafe'), nearby('essen_eis'),
  ]);
  const near = nearest(plaetze, p.lat, p.lon, 6);
  const enriched = await Promise.all(near.map(async (x) => ({ ...x, trees: await treeCountAt(x.lat, x.lon, 80).catch(() => null) })));
  const toilets = nearest(toiletten, p.lat, p.lon, 3);
  const cafes = nearest([...gastro, ...eis], p.lat, p.lon, 3);
  return report({
    title: 'Spielplatz mit Schatten',
    subtitle: p.label,
    summary: enriched.length ? `${enriched.length} Spielplätze in der Nähe; ${enriched.filter((x) => (x.trees ?? 0) >= 5).length} mit mindestens fünf Bäumen im 80-Meter-Umkreis.` : 'Keine Spielplätze im Datensatz gefunden.',
    facts: [
      { label: 'Spielplätze', value: String(enriched.length) },
      { label: 'Mit Bäumen', value: String(enriched.filter((x) => (x.trees ?? 0) >= 5).length) },
      { label: 'Toiletten in der Nähe', value: String(toilets.length) },
      { label: 'Café/Eis in der Nähe', value: String(cafes.length) },
    ],
    blocks: [
      block.list('Spielplätze', enriched.map((x) => ({ title: x.name, subtitle: [km(x.distance), x.trees != null ? `${x.trees} Bäume im 80-m-Umkreis` : null, ...(x.info ?? []).slice(0, 2)].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.list('Toiletten', toilets.map((x) => ({ title: x.name, subtitle: km(x.distance) }))),
      block.list('Café und Eis', cafes.map((x) => ({ title: x.name, subtitle: [km(x.distance), x.address].filter(Boolean).join(' · ') }))),
      block.text('Schatten ist nicht alles', 'Die Baumzahl ist ein Näherungswert aus dem Baumkataster; sie sagt nichts über Schatten zur Mittagszeit, Sonnenschutz oder die Qualität der Geräte. Öffnungszeiten und Sperrungen stehen nicht in jedem Datensatz.'),
    ],
    points: enriched.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Landeshauptstadt Stuttgart, Spielplätze und Baumkataster (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL')],
    limits: ['Keine Aussage über Gerätealter, Schatten zur Mittagszeit oder Öffnungszeiten.', 'Baumkataster enthält nur städtische Bäume.'],
  });
}

export async function picknickFinder(params) {
  const p = await resolvePlace(params);
  const { overpassQuery, nearest: nearFn } = await import('./util.mjs');
  const [parks, toilets, shops, biergarten] = await Promise.all([
    overpassQuery('[out:json][timeout:25];(way[leisure=park](around:3000,' + p.lat + ',' + p.lon + ');node[leisure=park](around:3000,' + p.lat + ',' + p.lon + '););out center tags;').catch(() => []),
    nearby('toilette'), nearby('hofladen'), nearby('essen_biergarten'),
  ]);
  const parksWithCenter = parks.map((el) => ({
    id: `${el.type}/${el.id}`, name: el.tags?.name ?? 'Park', lat: el.lat ?? el.center?.lat, lon: el.lon ?? el.center?.lon,
    tags: el.tags ?? {},
  })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
  const near = nearFn(parksWithCenter, p.lat, p.lon, 8);
  const w = await weatherNow().catch(() => null);
  return report({
    title: 'Picknickplatz',
    subtitle: p.label,
    summary: near.length ? `${near.length} Parks im Umkreis; der nächste ist ${km(near[0].distance)} entfernt.` : 'Keine Parks im OpenStreetMap-Umkreis gefunden.',
    facts: [
      { label: 'Parks', value: String(near.length) },
      { label: 'Toiletten', value: String(toilets.length) },
      { label: 'Einkauf', value: String(shops.length) },
      { label: 'Wetter', value: w ? `${numDe(w.temperature, 1)} °C, ${w.condition}` : '–' },
    ],
    blocks: [
      block.list('Parks', near.map((x) => ({ title: x.name, subtitle: [km(x.distance), x.tags?.access === 'private' ? 'privat' : null].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.list('Toiletten in der Nähe', nearest(toilets, p.lat, p.lon, 4).map((x) => ({ title: x.name, subtitle: km(x.distance) }))),
      block.list('Einkauf', nearest(shops, p.lat, p.lon, 4).map((x) => ({ title: x.name, subtitle: [km(x.distance), x.address].filter(Boolean).join(' · ') }))),
      block.list('Biergärten', nearest(biergarten, p.lat, p.lon, 4).map((x) => ({ title: x.name, subtitle: km(x.distance) }))),
      block.text('Picknick-Regeln', 'Im öffentlichen Grün ist Picknicken meist erlaubt, Grillen nur an ausgewiesenen Plätzen. Müll mitnehmen, Wege freihalten, Musik leise. Privatflächen und Naturschutzgebiete beachten.'),
    ],
    points: near.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL'), source('Deutscher Wetterdienst (GeoNutzV)', 'https://www.dwd.de/', 'GeoNutzV')],
    limits: ['OpenStreetMap ist keine amtliche Parkliste; Bänke, Grillstellen und Öffnungszeiten können fehlen.', 'Wetter ist eine Vorhersage.'],
  });
}

export async function sportImPark(params) {
  const p = await resolvePlace(params);
  const [sport, w] = await Promise.all([nearby('sport'), weatherNow().catch(() => null)]);
  const near = nearest(sport, p.lat, p.lon, 8);
  const todayName = new Date().toLocaleDateString('de-DE', { weekday: 'long' });
  const today = near.filter((x) => (x.info ?? []).some((i) => String(i).toLowerCase().includes(todayName.toLowerCase())));
  const shown = today.length ? today : near;
  return report({
    title: 'Sport im Park heute',
    subtitle: `${p.label} · ${todayName}`,
    summary: near.length ? `${near.length} kostenlose Sportangebote in der Nähe${today.length ? `, davon ${today.length} heute` : ''}.` : 'Keine Angebote im Datensatz gefunden.',
    facts: [
      { label: 'Angebote in der Nähe', value: String(near.length) },
      { label: 'Heute', value: String(today.length) },
      { label: 'Wetter', value: w ? `${numDe(w.temperature, 1)} °C, ${w.condition}` : '–' },
    ],
    blocks: [
      block.list('Angebote', shown.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance), ...(x.info ?? []).slice(0, 3)].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.text('Sport im Park', 'Die Stadt bietet im Sommer kostenlose Bewegungsangebote ohne Anmeldung. Treffpunkt und Uhrzeit stehen im Datensatz; bei Regen oder Unwetter kann ein Termin ausfallen.'),
      block.links('Mehr', [
        { title: 'Sport im Park', href: 'https://www.stuttgart.de/sport-im-park', note: 'Programm und Treffpunkte' },
        { title: 'Sportanlagen', href: '#modul=nearby&focus=sport', note: 'Alle Sportorte in der Nähe' },
      ]),
    ],
    points: shown.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Landeshauptstadt Stuttgart, Sport im Park (WFS, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0')],
    limits: ['Programm kann sich kurzfristig ändern; keine Anmeldung, keine Garantie.', 'Wetter ist eine Vorhersage.'],
  });
}

export async function grillplatzCheck(params) {
  const p = await resolvePlace(params);
  const [plaetze, w, h] = await Promise.allSettled([nearby('grillplatz'), weatherNow(), import('../../sources/hitze.mjs').then((m) => m.hitze())]);
  const items = plaetze.status === 'fulfilled' ? nearest(plaetze.value, p.lat, p.lon, 8) : [];
  const weather = w.status === 'fulfilled' ? w.value : null;
  return report({
    title: 'Grillplatz-Check',
    subtitle: p.label,
    summary: items.length ? `${items.length} Grillplätze in der Nähe; der nächste ist ${km(items[0].distance)} entfernt.` : 'Keine Grillplätze im Datensatz gefunden.',
    facts: [
      { label: 'Grillplätze', value: String(items.length) },
      { label: 'Nächster Platz', value: items[0] ? km(items[0].distance) : '–', note: items[0]?.name ?? null },
      { label: 'Wetter', value: weather ? `${numDe(weather.temperature, 1)} °C, ${weather.condition}` : '–' },
      { label: 'Waldbrandgefahr', value: h.status === 'fulfilled' && h.value?.gefahrenindex ? String(h.value.gefahrenindex) : 'keine Angabe' },
    ],
    blocks: [
      block.list('Grillplätze', items.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance), ...(x.info ?? []).slice(0, 2)].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.text('Regeln', 'Grillen ist nur an ausgewiesenen Plätzen erlaubt. Offenes Feuer, Einweggrills und Grillen im Wald oder in Naturschutzgebieten sind verboten. Bei Trockenheit und Waldbrandgefahr können die Plätze gesperrt werden. Glut vollständig löschen, Müll mitnehmen.'),
      block.links('Mehr', [
        { title: 'Grillplätze der Stadt', href: 'https://www.stuttgart.de/leben/freizeit/grillen/', note: 'Amtliche Liste und Regeln' },
        { title: 'Feuerwehr Stuttgart', href: 'https://www.feuerwehr-stuttgart.de/', note: 'Sicherheitshinweise' },
      ]),
    ],
    points: items.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Landeshauptstadt Stuttgart, Grillplätze (WFS, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('Deutscher Wetterdienst (GeoNutzV)', 'https://www.dwd.de/', 'GeoNutzV')],
    limits: ['Öffnungszeiten und Sperrungen stehen nicht in jedem Datensatz.', 'Waldbrandgefahr ist eine regionale Einordnung, keine Platzfreigabe.'],
  });
}

export async function museumRegen(params) {
  const p = await resolvePlace(params);
  const [places, w] = await Promise.all([import('../../sources/culture.mjs').then((m) => m.places()), weatherNow().catch(() => null)]);
  const museums = (places.places ?? []).filter((x) => /museum|galerie/i.test(`${x.kind} ${x.description}`)).map((x) => ({ ...x, distance: distance({ lat: p.lat, lon: p.lon }, x) })).sort((a, b) => a.distance - b.distance).slice(0, 10);
  return report({
    title: 'Museum bei Regen',
    subtitle: p.label,
    summary: museums.length ? `${museums.length} Museen und Galerien in der Nähe; das nächste ist ${km(museums[0].distance)} entfernt.` : 'Keine Museen im Wissensbestand gefunden.',
    facts: [
      { label: 'Museen/Galerien', value: String(museums.length) },
      { label: 'Nächstes', value: museums[0] ? km(museums[0].distance) : '–', note: museums[0]?.name ?? null },
      { label: 'Wetter', value: w ? `${numDe(w.temperature, 1)} °C, ${w.condition}` : '–' },
    ],
    blocks: [
      block.list('Museen', museums.map((x) => ({ title: x.name, subtitle: [km(x.distance), x.description].filter(Boolean).join(' · '), href: x.wiki ? `https://de.wikipedia.org/wiki/${encodeURIComponent(x.wiki)}` : null, lat: x.lon && x.lat ? x.lat : null, lon: x.lon ?? null }))),
      block.text('Öffnungszeiten prüfen', 'Der Datensatz enthält keine verlässlichen Öffnungszeiten. Vor dem Besuch die Website des Museums prüfen; viele Häuser sind montags geschlossen.'),
      block.links('Mehr', [
        { title: 'Museen in Stuttgart', href: 'https://www.stuttgart.de/leben/kultur/museen/', note: 'Amtliche Übersicht' },
        { title: 'Kulturmodul', href: '#modul=culture&focus=sehenswuerdigkeiten', note: 'Alle Orte auf der Karte' },
      ]),
    ],
    points: museums.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Wikidata/Wikipedia (CC0/CC BY-SA 4.0)', 'https://www.wikidata.org/', 'CC0 / CC BY-SA 4.0'), source('Deutscher Wetterdienst (GeoNutzV)', 'https://www.dwd.de/', 'GeoNutzV')],
    limits: ['Keine Öffnungszeiten oder Eintrittspreise im Datensatz.', 'Die Auswahl ist ein Wissensgraph-Ausschnitt, keine amtliche Museumsliste.'],
  });
}

export async function abendPlaner(params) {
  const p = await resolvePlace(params);
  const today = new Date().toISOString().slice(0, 10);
  const [events, w, sun] = await Promise.allSettled([
    import('../../sources/wasgeht.mjs').then((m) => m.wasGeht({ tag: today })),
    weatherNow(),
    runSource('api-sunrise-sunset', { lat: p.lat, lon: p.lon }),
  ]);
  const list = events.status === 'fulfilled' ? (events.value.events ?? []).filter((e) => {
    const h = localHour(e.start);
    return h != null && h >= 17;
  }).slice(0, 12) : [];
  const weather = w.status === 'fulfilled' ? w.value : null;
  const sunset = sun.status === 'fulfilled' ? (sun.value.rows ?? []).find((x) => /Sonnenuntergang/.test(x.Zeitpunkt))?.Wert : null;
  const sunsetTime = sunset ? timeDe(sunset) : null;
  const rain = (weather?.hourly ?? []).filter((x) => localHour(x.t) >= 17 && localHour(x.t) <= 23).reduce((s, x) => s + (Number(x.precipitation) || 0), 0);
  return report({
    title: 'Abendplaner',
    subtitle: `${p.label} · ${dateDe(today)}`,
    summary: `${list.length} Veranstaltungen ab 17 Uhr${sunsetTime ? `, Sonnenuntergang ${sunsetTime}` : ''}${rain > 0.2 ? `, abends ${numDe(rain, 1)} mm Regen möglich` : ', abends trocken'}.`,
    facts: [
      { label: 'Termine ab 17 Uhr', value: String(list.length) },
      { label: 'Sonnenuntergang', value: sunsetTime ?? '–' },
      { label: 'Regen abends', value: `${numDe(rain, 1)} mm` },
      { label: 'Temperatur abends', value: weather ? `${numDe(weather.forecast?.find((x) => localHour(x.t) >= 19)?.temperature ?? weather.temperature, 1)} °C` : '–' },
    ],
    blocks: [
      block.list('Was geht heute Abend', list.map((e) => ({ title: e.title, subtitle: [timeDe(e.start), e.venue, e.district, e.free ? 'kostenlos' : e.price].filter(Boolean).join(' · '), href: e.url }))),
      block.text('Planen', `Bei Regen: innen statt draußen. Der Sonnenuntergang ist astronomisch; Gebäude und Hügel können ihn früher verdecken. Für den Heimweg die letzte Verbindung prüfen.`),
      block.links('Mehr', [
        { title: 'Was geht – alle Termine', href: '#modul=wasgeht&focus=freizeit', note: 'Filter, Karte und Kalender' },
        { title: 'Letzte Verbindung', href: '#labor=letzte-verbindung&ort=' + encodeURIComponent(p.label), note: 'Heimweg planen' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [source('Open Stuttgart, Was geht (Quellen je Termin)', '/api/wasgeht', 'Quellen je Termin'), source('Deutscher Wetterdienst (GeoNutzV)', 'https://www.dwd.de/', 'GeoNutzV'), source('sunrise-sunset.org (CC BY 4.0)', 'https://sunrise-sunset.org/', 'CC BY 4.0')],
    limits: ['Nur Termine, die bis zum Abruf bekannt sind; Veranstaltungen können ausfallen.', 'Wetter ist eine Vorhersage; Öffnungszeiten und Einlass nicht enthalten.'],
  });
}

function optionSet(correct, spread) {
  const vals = [correct, Math.round(correct * (1 + spread)), Math.round(correct * (1 - spread * 0.7)), Math.round(correct * (1 + spread * 0.45))];
  return vals.map((v) => Math.max(1, v));
}

export async function stadtQuiz(params) {
  const district = String(params.bezirk ?? '').trim();
  if (!district) throw Object.assign(new Error('Bitte einen Stadtbezirk angeben.'), { status: 400 });
  const { factsFor } = await import('./kiez.mjs');
  const f = await factsFor(district);
  const questions = [];
  const push = (label, value, format, spread = 0.2) => {
    if (value == null || !Number.isFinite(value)) return;
    const opts = optionSet(value, spread);
    const correctIndex = questions.length % 4;
    const shuffled = opts.filter((_, i) => i !== 0);
    shuffled.splice(correctIndex, 0, opts[0]);
    questions.push({ question: `${label} in ${district}?`, options: shuffled.map((x) => format(x)), answer: correctIndex, correct: format(value) });
  };
  push('Wie viele Einwohner hat der Stadtbezirk', f.values.einwohner?.value, (x) => numDe(x, 0), 0.35);
  push('Wie viele Haushalte gibt es', f.values.haushalte?.value, (x) => numDe(x, 0), 0.25);
  push('Wie hoch ist die Arbeitslosenquote', f.values.arbeitslosenquote?.value, (x) => `${numDe(x, 1)} %`, 0.4);
  push('Wie viele Familien mit Kindern gibt es', f.values.familien?.value, (x) => numDe(x, 0), 0.3);
  push('Wie hoch ist das Nettoeinkommen je veranlagter Person', f.values.einkommen?.value, (x) => `${numDe(x, 0)} €`, 0.25);
  return report({
    title: `Stadt-Quiz: ${district}`,
    subtitle: 'Fünf Fragen aus amtlichen Daten',
    summary: questions.length ? `Fünf Schätzfragen zu ${district}. Die Auflösung steht am Ende – nicht spicken.` : 'Für diesen Stadtbezirk liegen zu wenige Werte vor.',
    blocks: [
      block.list('Fragen', questions.map((q, i) => ({ title: `${i + 1}. ${q.question}`, subtitle: q.options.map((o, j) => `${String.fromCharCode(65 + j)}) ${o}`).join('   ') }))),
      block.table('Auflösung', ['#', 'richtige Antwort'], questions.map((q, i) => [String(i + 1), `${String.fromCharCode(65 + q.answer)}) ${q.correct}`])),
      block.text('Warum ein Quiz?', 'Zahlen zu einem Stadtbezirk bleiben besser hängen, wenn man sie schätzt. Alle Werte stammen aus den amtlichen Reihen; die Jahresstände können abweichen.'),
    ],
    sources: await Promise.all([...new Set(Object.values(f.values).map((v) => v.source))].map(async (id) => {
      const { SOURCE_BY_ID } = await import('../sources.mjs');
      const s = SOURCE_BY_ID.get(id);
      return s ? source(`${s.attribution} – ${s.title}`, s.url, s.license) : null;
    })).then((list) => list.filter(Boolean)),
    limits: ['Die Distraktoren sind rechnerisch erzeugt, keine echten Werte anderer Stadtbezirke.', 'Ein Quiz ist keine Statistikschulung.'],
  });
}

export async function meinStuttgart(params) {
  const district = String(params.bezirk ?? '').trim();
  if (!district) throw Object.assign(new Error('Bitte einen Stadtbezirk angeben.'), { status: 400 });
  const { factsFor } = await import('./kiez.mjs');
  const f = await factsFor(district);
  const [events, giess] = await Promise.allSettled([
    import('../../sources/wasgeht.mjs').then((m) => m.wasGeht({ tag: new Date().toISOString().slice(0, 10) })),
    import('../../sources/natur.mjs').then((m) => m.giessRadar(48.7758, 9.1829)),
  ]);
  const evCount = events.status === 'fulfilled' ? (events.value.events ?? []).filter((e) => !district || String(e.district ?? '').toLowerCase().includes(district.toLowerCase())).length : 0;
  const facts = [
    { label: 'Einwohner', value: numDe(f.values.einwohner?.value) },
    { label: 'Haushalte', value: numDe(f.values.haushalte?.value) },
    { label: 'Arbeitslosenquote', value: f.values.arbeitslosenquote?.value != null ? `${numDe(f.values.arbeitslosenquote.value, 1)} %` : '–' },
    { label: 'Genehmigte Wohnungen', value: numDe(f.values.baugenehmigungen?.value) },
    { label: 'Termine heute im Bezirk', value: String(evCount) },
  ];
  return report({
    title: `Mein Stuttgart: ${district}`,
    subtitle: 'Ein Jahresrückblick aus Daten',
    summary: `${district} in Zahlen: ${numDe(f.values.einwohner?.value)} Einwohner, ${numDe(f.values.haushalte?.value)} Haushalte, ${f.values.arbeitslosenquote?.value != null ? `${numDe(f.values.arbeitslosenquote.value, 1)} % Arbeitslosenquote` : 'keine aktuelle Quote'}.`,
    facts: facts.slice(0, 4),
    blocks: [
      block.facts('Mein Bezirk', facts),
      block.text('Was sich verändert', `Die amtlichen Reihen zeigen den Stand ${f.year ?? 'der letzten Erhebung'}. Für einen echten Jahresrückblick fehlen persönliche Daten – diese App speichert keine Nutzung und kein Profil.`),
      block.links('Vertiefen', [
        { title: 'Kiez-Steckbrief', href: `#labor=kiez-steckbrief&bezirk=${encodeURIComponent(district)}` },
        { title: 'Kiez-Zeitreise', href: `#labor=kiez-zeitreise&bezirk=${encodeURIComponent(district)}&indikator=einwohner` },
        { title: 'Kiez-Ranking', href: '#labor=kiez-ranking&indikator=einwohner' },
      ]),
    ],
    sources: await Promise.all([...new Set(Object.values(f.values).map((v) => v.source))].map(async (id) => {
      const { SOURCE_BY_ID } = await import('../sources.mjs');
      const s = SOURCE_BY_ID.get(id);
      return s ? source(`${s.attribution} – ${s.title}`, s.url, s.license) : null;
    })).then((list) => list.filter(Boolean)),
    limits: ['Kein persönlicher Rückblick; keine Nutzungsdaten.', 'Die Daten sind amtliche Durchschnitte, keine Aussage über einzelne Menschen.'],
  });
}

export async function giessPate(params) {
  const p = await resolvePlace(params);
  const { giessRadar } = await import('../../sources/natur.mjs');
  const g = await giessRadar(p.lat, p.lon);
  const j = g.jungeBaeume ?? {};
  const regen = g.regen ?? {};
  return report({
    title: 'Gieß-Pate',
    subtitle: p.label,
    summary: `${j.anzahl ?? 0} junge Bäume im Umkreis, ${regen.summe7tage ?? '–'} mm Regen in sieben Tagen, ${regen.trockenheitTage ?? '–'} trockene Tage.`,
    facts: [
      { label: 'Junge Bäume', value: String(j.anzahl ?? 0), note: j.anzahl200m ? `${j.anzahl200m} im 200-m-Umkreis` : null },
      { label: 'Regen 7 Tage', value: `${numDe(regen.summe7tage, 1)} mm` },
      { label: 'Trockene Tage', value: String(regen.trockenheitTage ?? '–') },
      { label: 'Nächster Brunnen', value: g.brunnen?.name ?? '–', note: g.brunnen?.dist != null ? km(g.brunnen.dist) : null },
    ],
    blocks: [
      block.list('Junge Bäume', (j.items ?? []).slice(0, 8).map((x) => ({ title: `${x.art} (${x.pflanzjahr ?? 'Pflanzjahr unbekannt'})`, subtitle: `${x.dist != null ? km(x.dist) : ''} entfernt` }))),
      block.chart('Regen der letzten Tage', (regen.tage ?? []).map((x) => x.date.slice(5)), (regen.tage ?? []).map((x) => x.mm), 'mm'),
      block.text('Gießen', g.hinweis ?? 'Junge Bäume brauchen in trockenen Wochen zusätzlich Wasser. Etwa 10–20 Liter pro Baum und Woche, morgens oder abends, langsam und direkt am Stamm.'),
      block.links('Mehr', [
        { title: 'Gieß-Radar in der App', href: '#modul=nearby&focus=giess', note: 'Karte und Baumstandorte' },
        { title: 'Baumpatenschaften', href: 'https://www.stuttgart.de/leben/umwelt/stadtgruen/baeume/', note: 'Amtliche Informationen' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }, ...(g.brunnen?.lat ? [{ lat: g.brunnen.lat, lon: g.brunnen.lon, label: g.brunnen.name }] : [])],
    sources: [source('Landeshauptstadt Stuttgart, Baumkataster und Brunnen (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('Deutscher Wetterdienst über Bright Sky (GeoNutzV)', 'https://brightsky.dev/', 'GeoNutzV')],
    limits: ['Der Baumkataster enthält nur städtische Bäume; private Bäume fehlen.', 'Gießmengen sind eine Faustregel, keine Anweisung.'],
  });
}

export async function wanderRundweg(params) {
  const p = await resolvePlace(params);
  const { wanderwege } = await import('../../sources/wanderwege.mjs');
  const w = await wanderwege();
  const routes = (w.items ?? []).filter((x) => x.art !== 'downhill' && x.startStop?.lat).map((x) => ({
    ...x, distance: distance({ lat: p.lat, lon: p.lon }, { lat: x.startStop.lat, lon: x.startStop.lon }),
  })).sort((a, b) => a.distance - b.distance).slice(0, 6);
  return report({
    title: 'Rundwanderung mit Bahn',
    subtitle: p.label,
    summary: routes.length ? `${routes.length} ausgeschilderte Routen mit Start an einer Haltestelle; die nächste startet ${km(routes[0].distance)} entfernt.` : 'Keine Wanderrouten mit Haltestelle gefunden.',
    facts: [
      { label: 'Routen', value: String(routes.length) },
      { label: 'Nächster Start', value: routes[0] ? km(routes[0].distance) : '–', note: routes[0]?.startStop?.name ?? null },
      { label: 'Längste Route', value: routes.length ? `${numDe(Math.max(...routes.map((x) => x.laengeKm ?? 0)), 1)} km` : '–' },
      { label: 'Mit Bahn', value: routes.filter((x) => x.startStop?.lines?.length).length ? 'ja' : '–' },
    ],
    blocks: [
      block.list('Routen', routes.map((x) => ({ title: x.name, subtitle: [x.artLabel, x.laengeKm != null ? `${numDe(x.laengeKm, 1)} km` : null, x.aufstiegM != null ? `${numDe(x.aufstiegM)} m Aufstieg` : null, x.startStop?.name ? `Start ${x.startStop.name}` : null].filter(Boolean).join(' · '), href: '#modul=route&focus=wandern' }))),
      block.text('Rückweg', 'Die Routen starten an einer Haltestelle. Für den Rückweg die Verbindung ab dem Ziel suchen; bei Rundwegen liegt der Ausstieg oft an derselben Linie. Wetter und Schuhwerk prüfen.'),
      block.links('Mehr', [
        { title: 'Wanderwege in der App', href: '#modul=route&focus=wandern', note: 'Karte, Höhenprofil, GPX' },
        { title: 'Umland', href: '#modul=umland&focus=ziele', note: 'Ausflugsziele mit Bahn' },
      ]),
    ],
    points: routes.map((x) => ({ lat: x.startStop.lat, lon: x.startStop.lon, label: `${x.name} · ${x.startStop.name}` })),
    sources: [source('OpenStreetMap-Routenrelationen (ODbL), Geoserver Stuttgart (CC BY 4.0)', 'https://www.openstreetmap.org/', 'ODbL / CC BY 4.0'), source('VVS-Soll-Fahrplan (GTFS)', 'https://www.vvs.de/', 'CC BY 4.0')],
    limits: ['Keine Navigation mit Ansage; Höhen aus dem Datensatz.', 'Baustellen und Sperrungen sind nicht enthalten.'],
  });
}

export async function sternenhimmel(params) {
  const p = await resolvePlace(params);
  const [f, sun, w] = await Promise.allSettled([
    import('../../sources/flug.mjs').then((m) => m.flug()),
    runSource('api-sunrise-sunset', { lat: p.lat, lon: p.lon }),
    weatherNow(),
  ]);
  const fl = f.status === 'fulfilled' ? f.value : null;
  const moon = fl?.mond ?? null;
  const iss = fl?.iss ?? null;
  const sunRows = sun.status === 'fulfilled' ? sun.value.rows ?? [] : [];
  const sunset = sunRows.find((x) => /Sonnenuntergang/.test(x.Zeitpunkt))?.Wert;
  const weather = w.status === 'fulfilled' ? w.value : null;
  const cloud = Number(weather?.cloud ?? 100);
  const score = cloud < 20 ? 'sehr gut' : cloud < 50 ? 'gut' : cloud < 80 ? 'mäßig' : 'schlecht';
  return report({
    title: 'Sternenhimmel heute',
    subtitle: p.label,
    summary: `Mond: ${moon?.name ?? 'unbekannt'} (${moon?.illumination ?? '–'} % beleuchtet). Bewölkung ${Math.round(cloud)} % – Sicht ${score}.`,
    facts: [
      { label: 'Mondphase', value: moon?.name ?? '–' },
      { label: 'Beleuchtung', value: moon?.illumination != null ? `${moon.illumination} %` : '–' },
      { label: 'Sonnenuntergang', value: sunset ? timeDe(sunset) : '–' },
      { label: 'Bewölkung', value: `${Math.round(cloud)} %` },
      { label: 'ISS', value: iss?.visibility === 'visible' ? 'sichtbar' : 'nicht sichtbar', note: iss?.footprintKm ? `Fußabdruck ${numDe(iss.footprintKm)} km` : null },
    ],
    blocks: [
      block.facts('Himmel', [
        { label: 'Mondphase', value: moon?.name ?? '–' },
        { label: 'Beleuchtung', value: moon?.illumination != null ? `${moon.illumination} %` : '–' },
        { label: 'Bewölkung', value: `${Math.round(cloud)} %` },
        { label: 'Sichtweite', value: weather?.visibility != null ? km(weather.visibility * 1000) : '–' },
      ]),
      block.text('Wann lohnt es sich?', 'Nach Sonnenuntergang und bei klarem Himmel. In der Stadt überstrahlt die Straßenbeleuchtung schwache Sterne; auf den Fildern oder am Kesselrand ist der Himmel dunkler. Mondlicht kann schwache Objekte überstrahlen.'),
      block.links('Mehr', [
        { title: 'Himmel in der App', href: '#modul=environment&focus=himmel', note: 'ISS, Wetterballons, Mond' },
        { title: 'Satelliten-Überflug', href: '#labor=satelliten-ueberflug&ort=' + encodeURIComponent(p.label), note: 'Berechnete ISS-Pässe' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [source('wheretheiss.at (Open Data)', 'https://wheretheiss.at/', 'Open Data'), source('Open-Meteo/DWD (GeoNutzV)', 'https://open-meteo.com/', 'GeoNutzV'), source('sunrise-sunset.org (CC BY 4.0)', 'https://sunrise-sunset.org/', 'CC BY 4.0')],
    limits: ['Keine Planetariumsprognose; Mondphase und ISS-Position sind Momentaufnahmen.', 'Bewölkung ist eine Vorhersage, keine Beobachtung.'],
  });
}

function sunAltAt(date, lat, lon) {
  const RAD = Math.PI / 180;
  const d = date.getTime() / 86400_000 - 0.5 + 2440588 - 2451545;
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(RAD * 23.4397) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(RAD * 23.4397), Math.cos(L));
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - ra;
  const phi = RAD * lat;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  return { alt: alt / RAD, ra, dec };
}
function sunEciUnit(date) {
  const { ra, dec } = sunAltAt(date, 0, 0);
  return { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) };
}
function sunlit(positionEci, date) {
  const s = sunEciUnit(date);
  const dot = positionEci.x * s.x + positionEci.y * s.y + positionEci.z * s.z;
  if (dot > 0) return true;
  const len2 = positionEci.x ** 2 + positionEci.y ** 2 + positionEci.z ** 2;
  const perp2 = Math.max(0, len2 - dot * dot);
  return perp2 > 6371 ** 2;
}

export async function satellitenUeberflug(params) {
  const p = await resolvePlace(params);
  const satellite = await import('satellite.js');
  const tle = await runSource('api-celestrak', { limit: 1 });
  const row = tle.rows?.[0];
  if (!row?.line1 || !row?.line2) throw Object.assign(new Error('Keine aktuellen Bahndaten für die ISS.'), { status: 502 });
  const rec = satellite.twoline2satrec(row.line1, row.line2);
  const observerGd = { longitude: p.lon * Math.PI / 180, latitude: p.lat * Math.PI / 180, height: 0.25 };
  const start = Date.now();
  const end = start + 48 * 3600_000;
  const step = 30_000;
  const samples = [];
  for (let t = start; t <= end; t += step) {
    const date = new Date(t);
    const pv = satellite.propagate(rec, date);
    if (!pv?.position) continue;
    const gmst = satellite.gstime(date);
    const ecf = satellite.eciToEcf(pv.position, gmst);
    const look = satellite.ecfToLookAngles(observerGd, ecf);
    const elev = look.elevation * 180 / Math.PI;
    if (elev < 10) continue;
    const sun = sunAltAt(date, p.lat, p.lon);
    samples.push({ t, elev, az: look.azimuth * 180 / Math.PI, visible: sun.alt < -6 && sunlit(pv.position, date), dark: sun.alt < -6 });
  }
  const passes = [];
  for (const s of samples) {
    const cur = passes.at(-1);
    if (cur && s.t - cur.last <= 5 * 60_000) {
      cur.last = s.t; cur.max = Math.max(cur.max, s.elev); cur.visible = cur.visible || s.visible;
    } else {
      passes.push({ first: s.t, last: s.t, max: s.elev, visible: s.visible });
    }
  }
  const visible = passes.filter((x) => x.visible).slice(0, 6);
  const all = passes.slice(0, 8);
  return report({
    title: 'ISS-Überflug',
    subtitle: p.label,
    summary: visible.length ? `${visible.length} sichtbare ISS-Überflüge in den nächsten 48 Stunden; der nächste beginnt am ${dateDe(new Date(visible[0].first).toISOString())} um ${timeDe(new Date(visible[0].first).toISOString())}.` : 'In den nächsten 48 Stunden kein sichtbarer ISS-Überflug bei Dunkelheit.',
    facts: [
      { label: 'Sichtbare Überflüge', value: String(visible.length) },
      { label: 'Nächster sichtbarer', value: visible[0] ? `${dateDe(new Date(visible[0].first).toISOString())} ${timeDe(new Date(visible[0].first).toISOString())}` : '–' },
      { label: 'Maximale Höhe', value: visible[0] ? `${Math.round(visible[0].max)}°` : '–' },
      { label: 'Überflüge gesamt (48 h)', value: String(passes.length) },
    ],
    blocks: [
      block.table('Sichtbare Überflüge', ['Datum', 'Beginn', 'Ende', 'Max. Höhe'], visible.map((x) => [dateDe(new Date(x.first).toISOString()), timeDe(new Date(x.first).toISOString()), timeDe(new Date(x.last).toISOString()), `${Math.round(x.max)}°`])),
      block.table('Alle Überflüge über 10°', ['Datum', 'Beginn', 'Max. Höhe', 'sichtbar'], all.map((x) => [dateDe(new Date(x.first).toISOString()), timeDe(new Date(x.first).toISOString()), `${Math.round(x.max)}°`, x.visible ? 'ja' : 'nein'])),
      block.text('Warum nicht jeder Überflug sichtbar ist', 'Die ISS ist nur sichtbar, wenn sie von der Sonne beschienen wird und der Himmel am Beobachtungsort dunkel genug ist. Tagsüber oder im Erdschatten bleibt sie unsichtbar. Die Berechnung nutzt die aktuellen TLE-Bahndaten; sie ist eine Näherung.'),
      block.links('Mehr', [
        { title: 'NASA Spot the Station', href: 'https://spotthestation.nasa.gov/', note: 'Amtliche Überflugliste' },
        { title: 'Himmel in der App', href: '#modul=environment&focus=himmel', note: 'ISS-Position, Mond, Wetterballons' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [source('CelesTrak, ISS-TLE', 'https://celestrak.org/', 'CelesTrak-Nutzungsbedingungen'), source('satellite.js (SGP4)', 'https://github.com/shashwatak/satellite-js', 'MIT')],
    limits: ['SGP4-Näherung; Bahndaten veralten, besonders nach Bahnmanövern.', 'Wetter und Sichtbarkeit des Himmels sind nicht berücksichtigt.'],
  });
}
