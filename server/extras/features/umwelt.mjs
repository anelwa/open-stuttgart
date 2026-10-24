// Umwelt- und Gesundheitswerkzeuge: Erdbeben, Luft, Pollen, Wasser, Warnungen,
// Trinkwasser, Schutzgebiete und Hitze. Alle Antworten nennen Messzeit, Quelle
// und die Grenzen der Ableitung.
import { report, block, source, action, numDe, km, haversine, dateDe, timeDe } from '../util.mjs';
import { runSource } from '../run-source.mjs';
import { resolvePlace, nearby, nearest, weatherNow, warnNow } from './util.mjs';

const STUTTGART = { lat: 48.7758, lon: 9.1829 };

function distance(a, b) { return haversine(a, b); }

export async function erdbebenCheck() {
  const [emsc, usgs] = await Promise.allSettled([
    runSource('api-emsc-erdbeben', { limit: 20 }),
    runSource('api-usgs-erdbeben', { limit: 20 }),
  ]);
  const items = [];
  for (const r of [emsc, usgs]) {
    if (r.status !== 'fulfilled') continue;
    for (const x of r.value.items ?? []) {
      const d = distance(STUTTGART, { lat: x.lat, lon: x.lon });
      items.push({ ...x, distance: d, provider: x.badge });
    }
  }
  const unique = [...new Map(items.map((x) => [`${x.date}-${x.lat?.toFixed(2)}-${x.lon?.toFixed(2)}`, x])).values()]
    .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
  const strong = unique.filter((x) => (x.extra?.magnitude ?? 0) >= 2.5).slice(0, 10);
  return report({
    title: 'Erdbeben in der Region',
    subtitle: 'EMSC und USGS, Ereignisse der letzten 90 Tage',
    summary: unique.length ? `${unique.length} Ereignisse im Umkreis von 300 km; das nächste lag ${km(unique[0].distance)} entfernt.` : 'Keine Ereignisse im abgefragten Fenster.',
    facts: [
      { label: 'Ereignisse im Fenster', value: String(unique.length) },
      { label: 'Nächstes Ereignis', value: unique[0] ? `${km(unique[0].distance)} entfernt` : '–', note: unique[0]?.date ? dateDe(unique[0].date) : null },
      { label: 'Stärkstes Ereignis', value: unique.length ? `M ${Math.max(...unique.map((x) => x.extra?.magnitude ?? 0)).toFixed(1)}` : '–' },
    ],
    blocks: [
      block.list('Nächste Ereignisse', unique.slice(0, 12).map((x) => ({ title: x.title, subtitle: [dateDe(x.date), km(x.distance), x.provider].filter(Boolean).join(' · '), href: x.href, lat: x.lat, lon: x.lon }))),
      block.list('Spürbar (ab Magnitude 2,5)', strong.map((x) => ({ title: x.title, subtitle: [dateDe(x.date), km(x.distance)].filter(Boolean).join(' · '), href: x.href }))),
      block.text('Einordnung', 'Der Oberrheingraben und die Schwäbische Alb sind seismisch aktiv. Kleine Beben sind häufig und meist nicht spürbar; die Magnitude allein sagt wenig über Schäden. Maßgeblich sind die Meldungen des Landeserdbebendienstes und der Feuerwehr.'),
      block.links('Amtliche Quellen', [
        { title: 'Erdbeben in Baden-Württemberg', href: 'https://www.lubw.baden-wuerttemberg.de/erdbeben', note: 'LUBW-Landeserdbebendienst' },
        { title: 'EMSC', href: 'https://www.seismicportal.eu/', note: 'Europäisch-mediterranes Erdbebenzentrum' },
      ]),
    ],
    points: unique.slice(0, 15).filter((x) => x.lat && x.lon).map((x) => ({ lat: x.lat, lon: x.lon, label: x.title })),
    sources: [
      source('EMSC-CSEM, FDSN-Webservice (CC BY 4.0)', 'https://www.seismicportal.eu/', 'CC BY 4.0'),
      source('USGS Earthquake Hazards Program (Public Domain)', 'https://earthquake.usgs.gov/', 'Public Domain'),
    ],
    limits: ['Automatische Messnetze; Magnituden und Lagen können nachträglich korrigiert werden.', 'Nicht jedes Ereignis wird in beiden Netzen gleich erfasst.'],
  });
}

export async function neckarPegel() {
  const { water } = await import('../../sources/environment.mjs');
  const w = await water();
  const values = (w.series ?? []).map((x) => x.v);
  const first = values[0];
  const trend = first != null && w.value != null ? w.value - first : null;
  return report({
    title: 'Neckarpegel & Trend',
    subtitle: `${w.station} · ${dateDe(w.measuredAt)} ${timeDe(w.measuredAt) ?? ''}`,
    summary: `Aktuell ${numDe(w.value)} ${w.unit}; ${trend == null ? 'kein Vergleich' : trend === 0 ? 'unverändert' : `${trend > 0 ? '+' : ''}${numDe(trend)} ${w.unit} seit gestern`}. Zustand: ${w.state ?? 'unbekannt'}.`,
    facts: [
      { label: 'Wasserstand', value: `${numDe(w.value)} ${w.unit}` },
      { label: 'Zustand', value: w.state ?? 'unbekannt' },
      { label: 'Veränderung 24 h', value: trend == null ? '–' : `${trend > 0 ? '+' : ''}${numDe(trend)} ${w.unit}` },
      { label: 'Messzeit', value: `${dateDe(w.measuredAt)} ${timeDe(w.measuredAt) ?? ''}` },
    ],
    blocks: [
      block.chart('Pegelverlauf', (w.series ?? []).map((x) => x.t.slice(11, 16)), values, w.unit),
      block.text('Was der Pegel bedeutet', 'Der Pegel Cannstatt misst den Wasserstand des Neckars. Er ist kein Hochwasserwarnsystem; bei Hochwasser gelten die Meldungen der Hochwasserzentrale und der Feuerwehr. Der Zustand „normal“ ist eine Einordnung der Quelle.'),
      block.links('Amtliche Warnungen', [
        { title: 'Hochwasserzentrale Baden-Württemberg', href: 'https://www.hochwasserzentralen.de/', note: 'Amtliche Lage und Warnungen' },
        { title: 'PEGELONLINE', href: 'https://www.pegelonline.wsv.de/', note: 'Rohdaten und weitere Pegel' },
      ]),
    ],
    points: [{ lat: w.lat, lon: w.lon, label: w.station }],
    sources: [source('PEGELONLINE, WSV (dl-de/by-2-0)', 'https://www.pegelonline.wsv.de/', 'dl-de/by-2-0')],
    limits: ['Nur ein Pegel; der Neckar hat weitere Pegel und Zuflüsse.', 'Keine Hochwasserprognose.'],
  });
}

export async function luftVerlauf(params) {
  const p = await resolvePlace(params);
  const { air } = await import('../../sources/environment.mjs');
  const [a, forecast] = await Promise.allSettled([air(), runSource('api-open-meteo-luft', { limit: 48 })]);
  const stations = a.status === 'fulfilled' ? a.value.stations ?? [] : [];
  const nearestStation = nearest(stations, p.lat, p.lon, 1)[0] ?? stations[0];
  const history = nearestStation?.history ?? [];
  const rows = forecast.status === 'fulfilled' ? forecast.value.rows ?? [] : [];
  const facts = [
    { label: 'Nächste Messstation', value: nearestStation?.name ?? '–', note: nearestStation?.distance != null ? km(nearestStation.distance) : null },
    { label: 'Aktueller Index', value: nearestStation?.index != null ? `${nearestStation.index} (${nearestStation.label ?? ''})` : '–', note: nearestStation?.measuredAt ?? null },
    { label: 'Feinstaub PM2,5', value: nearestStation?.components?.find((c) => /PM2,5/.test(c.name))?.value != null ? `${nearestStation.components.find((c) => /PM2,5/.test(c.name)).value} µg/m³` : '–' },
    { label: 'Stickstoffdioxid', value: nearestStation?.components?.find((c) => /NO₂/.test(c.name))?.value != null ? `${nearestStation.components.find((c) => /NO₂/.test(c.name)).value} µg/m³` : '–' },
  ];
  return report({
    title: 'Luftqualität im Verlauf',
    subtitle: p.label,
    summary: nearestStation ? `Nächste Station ${nearestStation.name}: Index ${nearestStation.index ?? '–'} (${nearestStation.label ?? 'ohne Einordnung'}).` : 'Keine Messstation in der Nähe.',
    facts,
    blocks: [
      block.facts('Messwerte', facts),
      block.chart('Index der letzten Stunden', history.map((x) => x.t.slice(11, 16)), history.map((x) => x.index), 'Index'),
      block.table('Prognose (Open-Meteo/CAMS)', ['Zeit', 'EU-AQI', 'PM2,5', 'PM10'], rows.slice(0, 12).map((r) => [r.Zeit, r['AQI (EU)'], r['PM2,5 µg/m³'], r['PM10 µg/m³']])),
      block.text('Einordnung', 'Der UBA-Luftqualitätsindex reicht von 1 (sehr gut) bis 5 (sehr schlecht). Die Prognose ist ein Modell, keine amtliche Messung. Menschen mit Atemwegs- oder Herz-Kreislauf-Erkrankungen sollten bei hohen Werten Anstrengung im Freien reduzieren.'),
      block.links('Mehr', [
        { title: 'Luftdaten der Stadt', href: 'https://www.stuttgart.de/leben/umwelt/luft/', note: 'Amtliche Messwerte und Berichte' },
        { title: 'Umweltbundesamt', href: 'https://www.umweltbundesamt.de/themen/luft', note: 'Hintergründe und Grenzwerte' },
      ]),
    ],
    points: nearestStation ? [{ lat: nearestStation.lat, lon: nearestStation.lon, label: nearestStation.name }] : [],
    sources: [
      source('Umweltbundesamt mit LUBW-Daten (dl-de/by-2-0)', 'https://www.umweltbundesamt.de/', 'dl-de/by-2-0'),
      source('Open-Meteo / CAMS (CC BY 4.0)', 'https://open-meteo.com/', 'CC BY 4.0'),
    ],
    limits: ['Eine Station repräsentiert nicht die ganze Stadt.', 'Prognosewerte sind Modellwerte; amtliche Grenzwerte gelten für Messungen.'],
  });
}

export async function pollenRisiko(params) {
  const p = await resolvePlace(params);
  const { pollenKarte } = await import('../../sources/natur.mjs');
  const [pollen, weather] = await Promise.allSettled([pollenKarte(), weatherNow()]);
  const pv = pollen.status === 'fulfilled' ? pollen.value : { pollen: [], bestand: [], hotspots: [] };
  const w = weather.status === 'fulfilled' ? weather.value : null;
  const active = (pv.pollen ?? []).filter((x) => Number(x.today) > 0);
  const trees = (pv.bestand ?? []).filter((x) => Number(x.pollenHeute) > 0);
  const facts = [
    { label: 'Aktive Pollenarten', value: String(active.length) },
    { label: 'Stärkste Belastung', value: active.length ? `${active[0].name} (${active[0].today})` : 'keine gemeldet' },
    { label: 'Wind', value: w ? `${Math.round(w.wind)} km/h aus ${w.windDirection}°` : '–' },
    { label: 'Wetter', value: w ? `${numDe(w.temperature, 1)} °C, ${w.condition}` : '–' },
  ];
  return report({
    title: 'Pollenrisiko heute',
    subtitle: p.label,
    summary: active.length ? `Der DWD meldet für die Region: ${active.map((x) => `${x.name} ${x.today}`).join(', ')}.` : 'Der DWD meldet heute keine Belastung der erfassten Pollenarten.',
    facts,
    blocks: [
      block.facts('Lage', facts),
      block.table('Pollenflug (DWD)', ['Art', 'heute', 'morgen'], (pv.pollen ?? []).map((x) => [x.name, x.today, x.tomorrow])),
      block.list('Bäume mit Belastung im Stadtgebiet', trees.slice(0, 10).map((x) => ({ title: x.art, subtitle: `${x.anzahl} Bäume im Kataster · ${x.pollenText}` }))),
      block.text('Was hilft', 'Bei Pollenflug: Fenster in den Morgenstunden lüften, abends duschen, Kleidung nicht im Schlafzimmer. Die Angaben ersetzen keine ärztliche Beratung.'),
      block.links('Mehr', [
        { title: 'DWD-Pollenflug', href: 'https://www.dwd.de/DE/leistungen/pollenflug/pollenflug.html', note: 'Amtliche Vorhersage' },
        { title: 'Pollenkarte der App', href: '#modul=environment&focus=wetter', note: 'Baumstandorte und Hotspots' },
      ]),
    ],
    sources: [
      source('Deutscher Wetterdienst, Pollenflug (GeoNutzV/CC BY 4.0)', 'https://www.dwd.de/', 'GeoNutzV / CC BY 4.0'),
      source('Landeshauptstadt Stuttgart, Baumkataster (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'),
    ],
    limits: ['Regionale DWD-Vorhersage, keine individuelle Messung.', 'Der Baumkataster enthält nur städtische Bäume; private Grünflächen fehlen.'],
  });
}

export async function warnlage(params) {
  const p = await resolvePlace(params);
  const [w, weather] = await Promise.allSettled([warnNow(), weatherNow()]);
  const data = w.status === 'fulfilled' ? w.value : { items: [], activeCount: 0 };
  const items = data.items ?? [];
  return report({
    title: 'Warnlage',
    subtitle: p.label,
    summary: items.length ? `${items.length} aktive Warnung(en) für Stuttgart.` : 'Derzeit keine amtliche Warnung für Stuttgart.',
    facts: [
      { label: 'Aktive Warnungen', value: String(items.length) },
      { label: 'Wetter', value: weather.status === 'fulfilled' ? `${numDe(weather.value.temperature, 1)} °C, ${weather.value.condition}` : '–' },
      { label: 'Stand', value: new Date(data.fetchedAt ?? Date.now()).toLocaleString('de-DE') },
    ],
    blocks: [
      ...(items.length ? [block.list('Aktive Warnungen', items.map((x) => ({ title: x.headline ?? x.event ?? 'Warnung', subtitle: [x.sender ?? null, x.severity ?? null, x.onset ? dateDe(x.onset) : null].filter(Boolean).join(' · '), note: x.description ? String(x.description).slice(0, 300) : null })))] : []),
      block.list('Was jetzt zu tun ist', [
        { title: 'Amtliche Warnungen prüfen', subtitle: 'NINA-App, Rundfunk, Warn-SMS', href: 'https://www.bbk.bund.de/' },
        { title: 'Notfall-Treffpunkt und Leuchtturm', subtitle: 'In der Nähe und außerhalb des Gefahrenbereichs', href: '#labor=notfall-karte&ort=' + encodeURIComponent(p.label) },
        { title: 'Wetter und Regen', subtitle: 'Radar und Vorhersage', href: '#modul=environment&focus=wetter' },
      ]),
      block.text('Bei akuter Gefahr', 'Notruf 112. Bei Unwetter: feste Gebäude aufsuchen, Unterführungen und Bäume meiden, Fahrzeuge nicht in Senken abstellen. Die App ersetzt keine amtliche Warnung.'),
    ],
    points: items.filter((x) => x.lat && x.lon).map((x) => ({ lat: x.lat, lon: x.lon, label: x.headline ?? 'Warngebiet' })),
    sources: [source('BBK NINA/MoWaS (dl-de/by-2-0)', 'https://warnung.bund.de/', 'dl-de/by-2-0'), source('Deutscher Wetterdienst', 'https://www.dwd.de/', 'GeoNutzV')],
    limits: ['Die App zeigt nur Warnungen, die über NINA/MoWaS abrufbar sind.', 'Lokale Gefahren (z. B. Stromausfall) können fehlen.'],
  });
}

export async function trinkwasserCheck(params) {
  const p = await resolvePlace(params);
  const [brunnen, kuehl, wasser] = await Promise.allSettled([
    nearby('trinkbrunnen'), nearby('kuehl'), import('../../sources/environment.mjs').then((m) => m.water()),
  ]);
  const b = brunnen.status === 'fulfilled' ? brunnen.value : [];
  const nearestB = nearest(b, p.lat, p.lon, 5);
  return report({
    title: 'Trinkwasser & Brunnen',
    subtitle: p.label,
    summary: b.length ? `${b.length} Trinkbrunnen im Umkreis; der nächste ist ${km(nearestB[0]?.distance)} entfernt.` : 'Keine Trinkbrunnen im Datensatz in der Nähe.',
    facts: [
      { label: 'Trinkbrunnen im Umkreis', value: String(b.length) },
      { label: 'Nächster Brunnen', value: nearestB[0]?.distance != null ? km(nearestB[0].distance) : '–', note: nearestB[0]?.name ?? null },
      { label: 'Neckarpegel', value: wasser.status === 'fulfilled' ? `${numDe(wasser.value.value)} ${wasser.value.unit}` : '–' },
    ],
    blocks: [
      block.list('Nächste Trinkbrunnen', nearestB.map((x) => ({ title: x.name ?? 'Trinkbrunnen', subtitle: [x.address, x.distance != null ? km(x.distance) : null, ...(x.info ?? [])].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.list('Kühle Orte mit Wasser', (kuehl.status === 'fulfilled' ? nearest(kuehl.value.filter((x) => /trinkwasser/i.test((x.info ?? []).join(' '))), p.lat, p.lon, 4) : []).map((x) => ({ title: x.name, subtitle: [x.address, x.distance != null ? km(x.distance) : null].filter(Boolean).join(' · ') }))),
      block.text('Leitungswasser', 'Stuttgarter Leitungswasser wird regelmäßig kontrolliert; die Wasserhärte liegt je nach Stadtteil meist im mittleren bis harten Bereich. Trinkbrunnen sind Saisonbetriebe und können außerhalb der Sommermonate abgestellt sein.'),
      block.links('Mehr', [
        { title: 'Trinkwasserqualität der Stadt', href: 'https://www.stuttgart.de/leben/umwelt/wasser/trinkwasser/', note: 'Amtliche Informationen' },
        { title: 'Gieß-Radar', href: '#labor=giess-pate&ort=' + encodeURIComponent(p.label), note: 'Junge Bäume brauchen Wasser' },
      ]),
    ],
    points: nearestB.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name ?? 'Trinkbrunnen' })),
    sources: [source('Landeshauptstadt Stuttgart, Trinkbrunnen (WFS, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('PEGELONLINE (dl-de/by-2-0)', 'https://www.pegelonline.wsv.de/', 'dl-de/by-2-0')],
    limits: ['Keine Wasserqualitätsmessung pro Brunnen; Angaben zur Betriebszeit können fehlen.', 'Nicht jeder Brunnen ist ganzjährig in Betrieb.'],
  });
}

export async function naturschutzCheck(params) {
  const p = await resolvePlace(params);
  const ids = ['lubw-naturschutzgebiet', 'lubw-landschaftsschutzgebiet', 'lubw-ffh', 'lubw-vogelschutz', 'lubw-wasserschutzgebiet', 'lubw-ueberschwemmungsgebiet'];
  const results = await Promise.allSettled(ids.map((id) => runSource(id, { lat: p.lat, lon: p.lon, r: 10, limit: 200 })));
  const groups = [];
  for (let i = 0; i < ids.length; i++) {
    const r = results[i];
    if (r.status !== 'fulfilled') continue;
    const points = (r.value.points ?? []).map((x) => ({ ...x, distance: distance({ lat: p.lat, lon: p.lon }, x) })).sort((a, b) => a.distance - b.distance);
    groups.push({ id: ids[i], title: r.value.title, count: r.value.features?.length ?? points.length, nearest: points[0] ?? null, points });
  }
  const total = groups.reduce((s, g) => s + g.count, 0);
  return report({
    title: 'Schutzgebiete am Ort',
    subtitle: p.label,
    summary: `${total} Schutzgebietsflächen im 10-km-Umkreis, davon ${groups.filter((g) => g.count > 0).length} Kategorien.`,
    facts: [
      { label: 'Schutzgebietsflächen', value: String(total) },
      { label: 'Kategorien', value: String(groups.length) },
      { label: 'Nächstes Schutzgebiet', value: groups.map((g) => g.nearest).filter(Boolean).sort((a, b) => a.distance - b.distance)[0]?.distance != null ? km(groups.map((g) => g.nearest).filter(Boolean).sort((a, b) => a.distance - b.distance)[0].distance) : '–' },
    ],
    blocks: [
      block.table('Schutzgebiete im Umkreis', ['Kategorie', 'Flächen', 'nächste'], groups.map((g) => [g.title, String(g.count), g.nearest ? `${km(g.nearest.distance)} (${g.nearest.name})` : '–'])),
      block.list('Nächste Gebiete', groups.filter((g) => g.nearest).sort((a, b) => a.nearest.distance - b.nearest.distance).map((g) => ({ title: g.title, subtitle: `${km(g.nearest.distance)} entfernt`, lat: g.nearest.lat, lon: g.nearest.lon }))),
      block.text('Was die Kategorien bedeuten', 'Naturschutzgebiete sind streng geschützt; Landschaftsschutzgebiete dienen dem Schutz von Natur und Landschaft; FFH- und Vogelschutzgebiete sind europäische Natura-2000-Flächen; Wasserschutzgebiete sichern Trinkwasser; Überschwemmungsgebiete sind Hochwasserflächen. Betreten und Nutzung können eingeschränkt sein.'),
      block.links('Mehr', [
        { title: 'LUBW Schutzgebiete', href: 'https://www.lubw.baden-wuerttemberg.de/natur-und-landschaft/schutzgebiete', note: 'Amtliche Übersicht' },
        { title: 'Natura 2000', href: 'https://www.natura2000-bw.de/', note: 'Europäische Schutzgebiete' },
      ]),
    ],
    points: groups.flatMap((g) => g.points.slice(0, 3)).slice(0, 30).map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('LUBW, Schutzgebiets-WFS (dl-de/by-2-0)', 'https://rips-gdi.lubw.baden-wuerttemberg.de/', 'dl-de/by-2-0')],
    limits: ['Der Ausschnitt ist ein 10-km-Radius, keine Parzellenschärfe.', 'Schutzstatus und Betretungsregeln ergeben sich aus der Verordnung, nicht aus dieser Karte.'],
  });
}

export async function hitzeCheck(params) {
  const p = await resolvePlace(params);
  const [h, kuehl, profil] = await Promise.allSettled([
    import('../../sources/hitze.mjs').then((m) => m.hitze()),
    nearby('kuehl'),
    import('../../sources/adresse.mjs').then((m) => m.profil(p.lat, p.lon)),
  ]);
  const hit = h.status === 'fulfilled' ? h.value : null;
  const today = hit?.trend?.tage?.[0] ?? null;
  const trees = profil.status === 'fulfilled' ? profil.value.baeume ?? {} : {};
  const cool = kuehl.status === 'fulfilled' ? nearest(kuehl.value, p.lat, p.lon, 5) : [];
  return report({
    title: 'Hitze-Check',
    subtitle: p.label,
    summary: hit?.warnung ? `Amtliche Hitzewarnung: ${hit.warnung.headline ?? hit.warnung.event ?? 'Hitzewarnung'}.` : `Keine amtliche Hitzewarnung. Hitzetrend heute: ${today?.text ?? 'keine Angabe'}.`,
    facts: [
      { label: 'Hitzewarnung', value: hit?.warnung ? 'aktiv' : 'keine' },
      { label: 'Hitzetrend', value: today?.text ?? 'keine Angabe' },
      { label: 'Bäume im 150-m-Umkreis', value: trees.anzahl150m != null ? numDe(trees.anzahl150m) : 'keine Angabe' },
      { label: 'Kühle Orte in der Nähe', value: String(cool.length) },
    ],
    blocks: [
      block.facts('Lage', [
        { label: 'Hitzewarnung', value: hit?.warnung ? 'aktiv' : 'keine' },
        { label: 'Hitzetrend', value: today?.text ?? 'keine Angabe' },
        { label: 'Höchsttemperatur', value: hit?.hoechsttemperatur != null ? `${numDe(hit.hoechsttemperatur, 1)} °C` : 'keine Angabe' },
        { label: 'Bäume im Umkreis', value: trees.anzahl150m != null ? numDe(trees.anzahl150m) : 'keine Angabe' },
      ]),
      block.list('Kühle Orte', cool.map((x) => ({ title: x.name, subtitle: [x.address, x.distance != null ? km(x.distance) : null, ...(x.info ?? []).slice(0, 2)].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.text('Was hilft', 'Mittagshitze meiden, ausreichend Wasser trinken, leichte Kleidung, Wohnung morgens lüften und tagsüber abdunkeln. Besonders gefährdet sind ältere Menschen, kleine Kinder und Menschen mit Vorerkrankungen. Nachbarn und Angehörige anrufen.'),
      block.links('Mehr', [
        { title: 'Hitzeschutz der Stadt', href: 'https://www.stuttgart.de/leben/gesundheit/hitze/', note: 'Amtliche Tipps und Angebote' },
        { title: 'Kühle Orte auf der Karte', href: '#modul=nearby&focus=kuehl', note: 'Schatten, Wasser, Aufenthalt' },
      ]),
    ],
    points: cool.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Deutscher Wetterdienst, Hitzewarnungen und Biowetter', 'https://www.dwd.de/', 'GeoNutzV'), source('Landeshauptstadt Stuttgart, kühle Orte und Baumkataster (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0')],
    limits: ['Der Hitzetrend ist eine regionale Einordnung, keine Messung am Wohnort.', 'Kühle Orte können geschlossen sein; Öffnungszeiten prüfen.'],
  });
}

export async function defiCheck(params) {
  const p = await resolvePlace(params);
  const { overpassQuery, nearest } = await import('./util.mjs');
  const els = await overpassQuery('[out:json][timeout:25];(node[emergency=defibrillator](around:2500,' + p.lat + ',' + p.lon + ');way[emergency=defibrillator](around:2500,' + p.lat + ',' + p.lon + '););out center tags;');
  const items = els.map((el) => ({
    id: `${el.type}/${el.id}`, name: el.tags?.name ?? el.tags?.operator ?? 'Defibrillator',
    lat: el.lat ?? el.center?.lat, lon: el.lon ?? el.center?.lon,
    address: [el.tags?.['addr:street'], el.tags?.['addr:housenumber']].filter(Boolean).join(' '),
    access: el.tags?.access ?? null, indoor: el.tags?.indoor ?? null,
    opening: el.tags?.opening_hours ?? null,
  })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
  const near = nearest(items, p.lat, p.lon, 10);
  return report({
    title: 'Defibrillator in der Nähe',
    subtitle: p.label,
    summary: near.length ? `${near.length} AED-Standorte im Umkreis; der nächste ist ${km(near[0].distance)} entfernt.` : 'Keine AED-Standorte im OpenStreetMap-Umkreis gefunden.',
    facts: [
      { label: 'AED im Umkreis', value: String(items.length) },
      { label: 'Nächster AED', value: near[0] ? km(near[0].distance) : '–', note: near[0]?.name ?? null },
      { label: 'Zugang', value: near[0]?.access ?? 'unbekannt' },
    ],
    blocks: [
      block.list('Nächste Standorte', near.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance), x.opening, x.indoor === 'yes' ? 'innen' : null].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.text('Im Notfall', 'Zuerst 112 anrufen. Den Anweisungen der Leitstelle folgen. Bei Herzstillstand sofort mit Herzdruckmassage beginnen; ein AED gibt Sprachanweisungen. Keine Scheu vor Fehlanwendung – das Gerät analysiert den Rhythmus selbst.'),
      block.links('Mehr', [
        { title: 'Erste Hilfe: DRK', href: 'https://www.drk.de/hilfe-in-deutschland/erste-hilfe/', note: 'Anleitung und Kurse' },
        { title: 'Defibrillatoren in Stuttgart', href: 'https://www.stuttgart.de/leben/gesundheit/rettungsdienst/', note: 'Amtliche Hinweise' },
      ]),
    ],
    points: near.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL')],
    limits: ['OpenStreetMap ist kein amtliches AED-Register; Standorte können fehlen oder veraltet sein.', 'Im Notfall gilt 112.'],
  });
}

export async function notfallKarte(params) {
  const p = await resolvePlace(params);
  const { overpassQuery, nearest } = await import('./util.mjs');
  const query = '[out:json][timeout:25];('
    + 'node[emergency=defibrillator](around:1500,' + p.lat + ',' + p.lon + ');'
    + 'node[amenity=hospital](around:4000,' + p.lat + ',' + p.lon + ');'
    + 'node[amenity=police](around:3000,' + p.lat + ',' + p.lon + ');'
    + 'node[amenity=fire_station](around:3000,' + p.lat + ',' + p.lon + ');'
    + 'node[amenity=pharmacy](around:1500,' + p.lat + ',' + p.lon + ');'
    + ');out center tags;';
  const els = await overpassQuery(query);
  const kindOf = (t) => t?.emergency === 'defibrillator' ? 'AED' : t?.amenity === 'hospital' ? 'Klinik' : t?.amenity === 'police' ? 'Polizei' : t?.amenity === 'fire_station' ? 'Feuerwehr' : t?.amenity === 'pharmacy' ? 'Apotheke' : 'Einrichtung';
  const items = els.map((el) => ({
    id: `${el.type}/${el.id}`, kind: kindOf(el.tags), name: el.tags?.name ?? kindOf(el.tags),
    lat: el.lat ?? el.center?.lat, lon: el.lon ?? el.center?.lon,
    address: [el.tags?.['addr:street'], el.tags?.['addr:housenumber']].filter(Boolean).join(' '),
    phone: el.tags?.phone ?? null,
  })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
  const groups = ['AED', 'Klinik', 'Polizei', 'Feuerwehr', 'Apotheke'].map((kind) => ({ kind, items: nearest(items.filter((x) => x.kind === kind), p.lat, p.lon, 4) }));
  const [notfall, warn] = await Promise.allSettled([nearby('notfall'), warnNow()]);
  const treffpunkte = notfall.status === 'fulfilled' ? nearest(notfall.value, p.lat, p.lon, 3) : [];
  const warnings = warn.status === 'fulfilled' ? warn.value.items ?? [] : [];
  return report({
    title: 'Notfallkarte',
    subtitle: p.label,
    summary: `${items.length} Notfall- und Versorgungsorte im Umkreis; ${warnings.length} aktive Warnung(en).`,
    facts: [
      { label: 'AED', value: String(items.filter((x) => x.kind === 'AED').length) },
      { label: 'Kliniken', value: String(items.filter((x) => x.kind === 'Klinik').length) },
      { label: 'Polizei', value: String(items.filter((x) => x.kind === 'Polizei').length) },
      { label: 'Notfall-Treffpunkte', value: String(treffpunkte.length) },
    ],
    blocks: [
      block.text('Notrufe', '112 – Feuerwehr und Rettungsdienst (auch bei medizinischen Notfällen). 110 – Polizei. 116117 – ärztlicher Bereitschaftsdienst (kein Notfall). 0761 19240 – Giftnotruf Freiburg.'),
      ...groups.filter((g) => g.items.length).map((g) => block.list(g.kind, g.items.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance), x.phone].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon })))),
      block.list('Notfall-Treffpunkte', treffpunkte.map((x) => ({ title: x.name, subtitle: [x.address, km(x.distance)].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.text('Bei akuter Gefahr', 'Ruhe bewahren, Notruf wählen, Ort und Lage nennen, Anweisungen folgen. Bei Feuer: Rauchmelder, Fluchtweg, keine Aufzüge. Bei Gas: keine Schalter, Fenster öffnen, Gebäude verlassen, 112.'),
    ],
    points: items.slice(0, 30).map((x) => ({ lat: x.lat, lon: x.lon, label: `${x.kind}: ${x.name}` })),
    sources: [source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL'), source('Landeshauptstadt Stuttgart, Notfall-Treffpunkte (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0')],
    limits: ['OpenStreetMap ist kein amtliches Rettungsregister; im Notfall gilt die Leitstelle.', 'Öffnungszeiten und Telefonnummern können sich ändern.'],
  });
}

export async function aussichtFinder(params) {
  const p = await resolvePlace(params);
  const [spots, w, sun] = await Promise.allSettled([
    runSource('wfs-aussichtspunkte', { lat: p.lat, lon: p.lon, r: 25, limit: 100 }),
    weatherNow(),
    runSource('api-sunrise-sunset', { lat: p.lat, lon: p.lon }),
  ]);
  const points = spots.status === 'fulfilled' ? (spots.value.points ?? []).map((x) => ({ ...x, distance: distance({ lat: p.lat, lon: p.lon }, x) })).sort((a, b) => a.distance - b.distance) : [];
  const weather = w.status === 'fulfilled' ? w.value : null;
  const sunRows = sun.status === 'fulfilled' ? sun.value.rows ?? [] : [];
  const sunset = sunRows.find((x) => /Sonnenuntergang/.test(x.Zeitpunkt))?.Wert ?? null;
  const sunsetTime = sunset ? new Date(sunset).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
  return report({
    title: 'Aussichtsfinder',
    subtitle: p.label,
    summary: points.length ? `${points.length} Aussichtspunkte im Umkreis; der nächste ist ${km(points[0].distance)} entfernt.${sunsetTime ? ` Sonnenuntergang gegen ${sunsetTime}.` : ''}` : 'Keine Aussichtspunkte im Datensatz gefunden.',
    facts: [
      { label: 'Aussichtspunkte', value: String(points.length) },
      { label: 'Nächster Punkt', value: points[0] ? km(points[0].distance) : '–', note: points[0]?.name ?? null },
      { label: 'Sonnenuntergang', value: sunsetTime ?? '–' },
      { label: 'Bewölkung', value: weather ? `${Math.round(weather.cloud)} %` : '–' },
    ],
    blocks: [
      block.list('Aussichtspunkte', points.slice(0, 12).map((x) => ({ title: x.name, subtitle: km(x.distance), lat: x.lat, lon: x.lon }))),
      block.text('Lohnt sich der Blick?', weather ? `Aktuell ${numDe(weather.temperature, 1)} °C, Bewölkung ${Math.round(weather.cloud)} %, Sichtweite ${weather.visibility ? km(weather.visibility * 1000) : 'unbekannt'}. Bei geschlossener Wolkendecke ist die Fernsicht eingeschränkt; nach Regen ist die Luft oft klarer.` : 'Keine Wetterdaten verfügbar.'),
      block.links('Mehr', [
        { title: 'Sonne-Modul', href: '#modul=sun&focus=verschattung', note: 'Schatten und Abendsonne' },
        { title: 'Innenstadtrundweg', href: '#labor=denkmal-erklaerer&ort=' + encodeURIComponent(p.label), note: 'Geschichte und Aussicht verbinden' },
      ]),
    ],
    points: points.slice(0, 20).map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Landeshauptstadt Stuttgart, Aussichtspunkte (WFS, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('Deutscher Wetterdienst (GeoNutzV)', 'https://www.dwd.de/', 'GeoNutzV'), source('sunrise-sunset.org (CC BY 4.0)', 'https://sunrise-sunset.org/', 'CC BY 4.0')],
    limits: ['Aussichtspunkte sind amtlich erfasst, aber nicht auf Barrierefreiheit oder Öffnungszeiten geprüft.', 'Sonnenuntergang ist astronomisch; Gelände und Bebauung können ihn früher verdecken.'],
  });
}

export async function hochwasserRoute(params) {
  const von = String(params.von ?? '').trim();
  const nach = String(params.nach ?? '').trim();
  if (!von || !nach) throw Object.assign(new Error('Bitte Start und Ziel angeben.'), { status: 400 });
  const [a, b] = await Promise.all([resolvePlace({ q: von }), resolvePlace({ q: nach })]);
  const [pa, pb] = await Promise.allSettled([
    import('../../sources/adresse.mjs').then((m) => m.profil(a.lat, a.lon)),
    import('../../sources/adresse.mjs').then((m) => m.profil(b.lat, b.lon)),
  ]);
  const risk = (p, label) => {
    if (p.status !== 'fulfilled') return { label, error: true };
    const s = p.value.starkregen ?? {};
    return {
      label,
      extrem: s.flaechen?.find((x) => /extrem/.test(x.szenario))?.betroffen ?? null,
      aussergewoehnlich: s.flaechen?.find((x) => /außergewöhnlich/.test(x.szenario))?.betroffen ?? null,
      hq100: s.hq100?.betroffen ?? null,
      fliessweg: s.fliessweg ?? null,
    };
  };
  const ra = risk(pa, a.label); const rb = risk(pb, b.label);
  const { route } = await import('../../sources/routing.mjs');
  let routeInfo = null;
  try {
    const r = await route({ von: `${a.lat},${a.lon}`, nach: `${b.lat},${b.lon}`, modus: 'auto' });
    routeInfo = r.varianten?.[0] ?? null;
  } catch { /* Route ist optional */ }
  return report({
    title: 'Hochwasser-Route',
    subtitle: `${a.label} → ${b.label}`,
    summary: `Start: ${ra.hq100 ? 'HQ100-Fläche betroffen' : 'keine HQ100-Fläche am Punkt'}; Ziel: ${rb.hq100 ? 'HQ100-Fläche betroffen' : 'keine HQ100-Fläche am Punkt'}.`,
    facts: [
      { label: 'Start HQ100', value: ra.hq100 == null ? 'keine Angabe' : ra.hq100 ? 'betroffen' : 'nicht betroffen' },
      { label: 'Ziel HQ100', value: rb.hq100 == null ? 'keine Angabe' : rb.hq100 ? 'betroffen' : 'nicht betroffen' },
      { label: 'Start Starkregen extrem', value: ra.extrem == null ? 'keine Angabe' : ra.extrem ? 'betroffen' : 'nicht betroffen' },
      { label: 'Ziel Starkregen extrem', value: rb.extrem == null ? 'keine Angabe' : rb.extrem ? 'betroffen' : 'nicht betroffen' },
      { label: 'Fahrzeit', value: routeInfo ? `${routeInfo.dauerMin} min` : '–' },
    ],
    blocks: [
      block.facts('Gefährdung an Start und Ziel', [
        { label: `HQ100 ${a.label}`, value: ra.hq100 == null ? 'keine Angabe' : ra.hq100 ? 'betroffen' : 'nicht betroffen' },
        { label: `HQ100 ${b.label}`, value: rb.hq100 == null ? 'keine Angabe' : rb.hq100 ? 'betroffen' : 'nicht betroffen' },
        { label: `Starkregen ${a.label}`, value: ra.extrem == null ? 'keine Angabe' : ra.extrem ? 'extrem betroffen' : 'nicht betroffen', note: ra.fliessweg != null ? `Fließweg ${ra.fliessweg} m` : null },
        { label: `Starkregen ${b.label}`, value: rb.extrem == null ? 'keine Angabe' : rb.extrem ? 'extrem betroffen' : 'nicht betroffen', note: rb.fliessweg != null ? `Fließweg ${rb.fliessweg} m` : null },
      ]),
      block.text('Was zu tun ist', 'Bei Hochwasser warnen die Behörden über NINA und die Hochwasserzentrale. Fahrten durch überflutete Straßen vermeiden; bereits 30 cm Wasser können Fahrzeuge abtreiben. Im Gebäude: Strom abschalten, keine Keller betreten, Anweisungen der Feuerwehr befolgen.'),
      block.links('Mehr', [
        { title: 'Hochwasserzentrale BW', href: 'https://www.hochwasserzentralen.de/', note: 'Amtliche Warnungen' },
        { title: 'Starkregen in der App', href: '#modul=nearby&focus=adresse', note: 'Adressprofil mit Starkregen' },
      ]),
    ],
    points: [{ lat: a.lat, lon: a.lon, label: a.label }, { lat: b.lat, lon: b.lon, label: b.label }],
    sources: [source('Landeshauptstadt Stuttgart, Starkregen und HQ100 (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('Hochwasserzentrale Baden-Württemberg', 'https://www.hochwasserzentralen.de/', 'Quellenangabe')],
    limits: ['Punktprüfung an Start und Ziel; die Strecke dazwischen wird nicht auf Überflutung geprüft.', 'Modellhafte Starkregenkarten, keine Live-Warnung.'],
  });
}

function radarAt(r, lat, lon) {
  if (!r?.frames?.length || !r.corners?.length) return null;
  const [[lonTL, latTL], [lonBL], [, ], [lonTR]] = r.corners;
  const x = Math.max(0, Math.min(r.cols - 1, Math.round(((lon - lonTL) / (lonTR - lonTL)) * (r.cols - 1))));
  const y = Math.max(0, Math.min(r.rows - 1, Math.round(((latTL - lat) / (latTL - r.corners[1][1])) * (r.rows - 1))));
  const frame = r.frames.at(-1);
  return { value: frame?.v?.[y]?.[x] ?? null, time: frame?.t ?? null, unit: r.unit ?? 'mm/h' };
}

export async function gewitterRadar(params) {
  const p = await resolvePlace(params);
  const [w, warn, radar] = await Promise.allSettled([weatherNow(), warnNow(), import('../../sources/radar.mjs').then((m) => m.radar())]);
  const weather = w.status === 'fulfilled' ? w.value : null;
  const warnings = warn.status === 'fulfilled' ? (warn.value.items ?? []) : [];
  const rad = radar.status === 'fulfilled' ? radar.value : null;
  const cell = rad ? radarAt(rad, p.lat, p.lon) : null;
  const recent = (rad?.frames ?? []).slice(-3).map((f) => {
    const x = Math.max(0, Math.min(rad.cols - 1, Math.round(((p.lon - rad.corners[0][0]) / (rad.corners[3][0] - rad.corners[0][0])) * (rad.cols - 1))));
    const y = Math.max(0, Math.min(rad.rows - 1, Math.round(((rad.corners[0][1] - p.lat) / (rad.corners[0][1] - rad.corners[1][1])) * (rad.rows - 1))));
    return { t: f.t, value: f.v?.[y]?.[x] ?? null };
  });
  const mm = cell?.value ?? 0;
  const level = mm >= 20 ? 'stark' : mm >= 5 ? 'mäßig' : mm > 0.1 ? 'leicht' : 'trocken';
  return report({
    title: 'Gewitter-Radar',
    subtitle: p.label,
    summary: `Aktuell ${level}: ${numDe(mm, 1)} mm/h im Radarpixel. ${warnings.length ? `${warnings.length} amtliche Warnung(en).` : 'Keine amtliche Warnung.'}`,
    facts: [
      { label: 'Radarintensität', value: `${numDe(mm, 1)} mm/h` },
      { label: 'Einordnung', value: level },
      { label: 'Windböen', value: weather?.gust != null ? `${Math.round(weather.gust)} km/h` : '–' },
      { label: 'Amtliche Warnungen', value: String(warnings.length) },
    ],
    blocks: [
      block.chart('Radar der letzten Minuten', recent.map((x) => timeDe(x.t) ?? ''), recent.map((x) => x.value ?? 0), 'mm/h'),
      block.table('Weitere Werte', ['Zeit', 'mm/h'], recent.map((x) => [timeDe(x.t) ?? '–', numDe(x.value, 1)])),
      ...(warnings.length ? [block.list('Warnungen', warnings.map((x) => ({ title: x.headline ?? x.event ?? 'Warnung', subtitle: [x.sender, x.severity].filter(Boolean).join(' · '), note: x.description ? String(x.description).slice(0, 240) : null })))] : []),
      block.text('Bei Gewitter', 'Feste Gebäude aufsuchen, Bäume und Unterführungen meiden, keine offenen Flächen. Bei Starkregen überflutete Straßen nicht befahren. Der Radarwert ist eine Momentaufnahme, keine Warnung.'),
      block.links('Mehr', [
        { title: 'Wetter in der App', href: '#modul=environment&focus=wetter', note: 'Radar und Vorhersage' },
        { title: 'DWD-Warnungen', href: 'https://www.dwd.de/DE/wetter/warnungen/warnWetter_node.html', note: 'Amtlich' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [source('DWD-Radar über Bright Sky (GeoNutzV)', 'https://brightsky.dev/', 'GeoNutzV'), source('BBK NINA/MoWaS (dl-de/by-2-0)', 'https://warnung.bund.de/', 'dl-de/by-2-0')],
    limits: ['Radarpixel sind grob; lokale Starkregenzellen können zwischen den Pixeln liegen.', 'Keine Blitzortung integriert.'],
  });
}

export async function waldbrandCheck(params) {
  const p = await resolvePlace(params);
  const [g, w] = await Promise.allSettled([
    import('../../sources/natur.mjs').then((m) => m.giessRadar(p.lat, p.lon)),
    weatherNow(),
  ]);
  const regen = g.status === 'fulfilled' ? g.value.regen ?? {} : {};
  const weather = w.status === 'fulfilled' ? w.value : null;
  const rain7 = Number(regen.summe7tage ?? 0);
  const dryDays = Number(regen.trockenheitTage ?? 0);
  const humidity = Number(weather?.humidity ?? 60);
  const wind = Number(weather?.wind ?? 0);
  const temp = Number(weather?.temperature ?? 15);
  const score = (rain7 < 5 ? 2 : rain7 < 15 ? 1 : 0) + (humidity < 45 ? 2 : humidity < 65 ? 1 : 0) + (wind > 25 ? 2 : wind > 12 ? 1 : 0) + (temp > 25 ? 1 : 0) + (dryDays > 5 ? 1 : 0);
  const level = score >= 5 ? 'hoch' : score >= 3 ? 'mittel' : 'niedrig';
  return report({
    title: 'Waldbrand-Check',
    subtitle: p.label,
    summary: `Einschätzung: ${level}. In den letzten sieben Tagen ${numDe(rain7, 1)} mm Regen, ${dryDays} trockene Tage.`,
    facts: [
      { label: 'Einschätzung', value: level },
      { label: 'Regen 7 Tage', value: `${numDe(rain7, 1)} mm` },
      { label: 'Trockene Tage', value: String(dryDays) },
      { label: 'Luftfeuchte', value: `${Math.round(humidity)} %` },
      { label: 'Wind', value: `${Math.round(wind)} km/h` },
    ],
    blocks: [
      block.facts('Indikatoren', [
        { label: 'Regen 7 Tage', value: `${numDe(rain7, 1)} mm` },
        { label: 'Trockene Tage', value: String(dryDays) },
        { label: 'Luftfeuchte', value: `${Math.round(humidity)} %` },
        { label: 'Wind', value: `${Math.round(wind)} km/h` },
      ]),
      block.text('Was die Einschätzung ist', 'Diese Einschätzung ist aus Wetter und Regen der letzten Tage abgeleitet – keine amtliche Waldbrandgefahrenstufe. Maßgeblich ist der Waldbrandgefahrenindex des DWD und die Hinweise der Forstbehörde. Bei hoher Gefahr: kein offenes Feuer, nicht rauchen, Fahrzeuge nicht auf trockenem Gras abstellen, Zufahrten freihalten.'),
      block.links('Mehr', [
        { title: 'DWD-Waldbrandgefahr', href: 'https://www.dwd.de/DE/leistungen/waldbrandgefahr/waldbrandgefahr.html', note: 'Amtliche Karte' },
        { title: 'Wald in Stuttgart', href: '#modul=environment&focus=natur', note: 'Schutzgebiete und Natur' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [source('Deutscher Wetterdienst (GeoNutzV)', 'https://www.dwd.de/', 'GeoNutzV'), source('Landeshauptstadt Stuttgart, Baumkataster (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0')],
    limits: ['Keine amtliche Waldbrandstufe; nur Heuristik aus Wetter und Regen.', 'Lokale Waldverhältnisse und Sperrungen sind nicht enthalten.'],
  });
}
