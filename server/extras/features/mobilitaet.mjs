// Mobilitätswerkzeuge: letzte Verbindung, Anschlussrisiko, Baustellen und Unfälle
// auf der Route, Steigungsprofil, Tanken und Flugverkehr.
import { report, block, source, action, numDe, km, dateDe, timeDe, haversine } from '../util.mjs';
import {
  nearest, nearestStop, resolvePlace, routeLines, pointLineMeters, targetTime,
} from './util.mjs';

function placeParam(value) {
  const s = String(value ?? '').trim();
  return s || null;
}

export async function letzteVerbindung(params) {
  const p = await resolvePlace(params);
  const stop = await nearestStop(p.lat, p.lon);
  if (!stop) throw Object.assign(new Error('Keine Haltestelle in der Nähe gefunden.'), { status: 404 });
  const when = targetTime(params.zeit, '23:30');
  const { departures } = await import('../../sources/efa.mjs');
  const d = await departures(stop.id, when.toISOString());
  const list = (d.departures ?? []).slice(0, 12);
  return report({
    title: 'Letzte Verbindung',
    subtitle: `${stop.name} · ${dateDe(when.toISOString())}`,
    summary: list.length ? `Ab ${stop.name}: ${list.length} Fahrten ab ${timeDe(departures?.[0]?.estimated ?? departures?.[0]?.planned ?? when.toISOString()) ?? 'jetzt'}.` : 'Keine Abfahrten in der angefragten Zeit gefunden.',
    facts: [
      { label: 'Haltestelle', value: stop.name },
      { label: 'Abfragezeit', value: timeDe(when.toISOString()) ?? '–' },
      { label: 'Nächste Fahrt', value: list[0] ? `${list[0].line} → ${list[0].destination}` : '–', note: list[0] ? timeDe(list[0].estimated ?? list[0].planned) ?? null : null },
      { label: 'Letzte Fahrt', value: list.at(-1) ? `${list.at(-1).line} → ${list.at(-1).destination}` : '–', note: list.at(-1) ? timeDe(list.at(-1).estimated ?? list.at(-1).planned) ?? null : null },
    ],
    blocks: [
      block.table('Abfahrten', ['Zeit', 'Linie', 'Ziel', 'Steig', 'Echtzeit'], list.map((x) => [timeDe(x.estimated ?? x.planned) ?? '–', x.line, x.destination, x.platform ?? '–', x.estimated ? (x.delayMin ? `+${x.delayMin} min` : 'pünktlich') : 'Soll'])),
      block.text('Heimweg planen', 'Die Liste zeigt die nächsten Abfahrten ab der Haltestelle. Für eine Tür-zu-Tür-Verbindung das Weg-Modul nutzen; für späte Fahrten auf Nachtbusse und die letzte Verbindung achten. Die EFA-Auskunft ist keine Garantie für Anschlüsse.'),
      block.links('Mehr', [
        { title: 'Verbindung suchen', href: '#modul=route&focus=route', note: 'Tür zu Tür mit Echtzeit' },
        { title: 'Abfahrten live', href: '#modul=mobility&focus=abfahrten', note: 'Alle Linien und Störungen' },
      ]),
    ],
    points: [{ lat: stop.lat, lon: stop.lon, label: stop.name }],
    sources: [source('EFA-BW (NVBW), Fahrplanauskunft', 'https://www.efa-bw.de/', 'Datenlizenz Deutschland – Namensnennung 2.0')],
    limits: ['Nur die nächsten Abfahrten; keine Garantie für Anschlüsse oder Nachtverkehr.', 'Echtzeit kann fehlen; dann gilt die Sollzeit.'],
  });
}

export async function anschlussRisiko(params) {
  const hhmm = String(params.ankunft ?? '').trim();
  const linie = String(params.linie ?? '').trim();
  if (!linie) throw Object.assign(new Error('Bitte eine Anschlusslinie angeben.'), { status: 400 });
  const { ankuenfteHbf, anschluss } = await import('../../sources/anschluss.mjs');
  const a = await ankuenfteHbf();
  const arrivals = a.ankuenfte ?? [];
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  let arrival = null;
  if (m) {
    const target = new Date(); target.setHours(Number(m[1]), Number(m[2]), 0, 0);
    arrival = [...arrivals].sort((x, y) => Math.abs(Date.parse(x.soll) - +target) - Math.abs(Date.parse(y.soll) - +target))[0] ?? null;
  } else {
    arrival = arrivals[0] ?? null;
  }
  if (!arrival) throw Object.assign(new Error('Keine passende Ankunft am Hauptbahnhof gefunden.'), { status: 404 });
  const r = await anschluss(arrival.key, linie, String(params.ziel ?? '').trim() || undefined);
  const amp = r.ampel === 'gruen' ? 'grün' : r.ampel === 'gelb' ? 'gelb' : 'rot';
  return report({
    title: 'Anschluss-Risiko',
    subtitle: `${arrival.linie} aus ${arrival.herkunft} → ${linie}`,
    summary: r.satz,
    facts: [
      { label: 'Ampel', value: amp },
      { label: 'Puffer', value: r.puffer_min != null ? `${r.puffer_min} min` : '–' },
      { label: 'Fußweg', value: `${r.fussweg_min} min` },
      { label: 'Anschluss', value: r.anschluss ? `${r.anschluss.linie} → ${r.anschluss.ziel}` : '–', note: r.anschluss ? timeDe(r.anschluss.ist) ?? null : null },
    ],
    blocks: [
      block.facts('Bewertung', [
        { label: 'Ampel', value: amp },
        { label: 'Puffer', value: r.puffer_min != null ? `${r.puffer_min} min` : '–' },
        { label: 'Fußweg', value: `${r.fussweg_min} min`, note: r.fussweg?.aufzugGestoert ? 'Aufzug gestört, Zuschlag eingerechnet' : null },
        { label: 'Nächste erreichbare Fahrt', value: r.naechste ? `${r.naechste.linie} → ${r.naechste.ziel}` : 'keine in der Liste', note: r.naechste ? `${timeDe(r.naechste.ist) ?? ''} (Puffer ${r.naechste.puffer_min} min)` : null },
      ]),
      block.text('Was die Ampel sagt', 'Grün: mindestens zwei Minuten Puffer. Gelb: knapp, aber nach aktueller Schätzung erreichbar. Rot: nicht erreichbar oder eine Fahrt fällt aus. Der Fußweg ist teilweise geschätzt; Aufzüge und Baustellen können ihn verlängern.'),
      block.list('Hinweise', (r.hinweise ?? []).map((h) => ({ title: h }))),
      block.links('Mehr', [
        { title: 'Anschluss am Hauptbahnhof', href: '#modul=mobility&focus=bahn', note: 'Ankünfte und Abfahrten live' },
        { title: 'Barrierefreie Route', href: '#labor=barrierefreie-route&von=Stuttgart%20Hauptbahnhof&nach=Charlottenplatz', note: 'Stufenloser Weg' },
      ]),
    ],
    points: [{ lat: 48.7838, lon: 9.1817, label: 'Stuttgart Hauptbahnhof' }],
    sources: [source('EFA-BW, DB und eigene Fußwegtabelle', 'https://www.efa-bw.de/', 'Datenlizenz Deutschland – Namensnennung 2.0')],
    limits: [r.grenzen ?? 'Fußwege sind teilweise geschätzt.', 'Die Ankunftsliste ist eine Momentaufnahme.'],
  });
}

async function corridorRoute(params, modus = 'auto') {
  const von = placeParam(params.von);
  const nach = placeParam(params.nach);
  if (!von || !nach) throw Object.assign(new Error('Bitte Start und Ziel angeben.'), { status: 400 });
  const [a, b] = await Promise.all([resolvePlace({ q: von }), resolvePlace({ q: nach })]);
  const { route } = await import('../../sources/routing.mjs');
  const r = await route({ von: `${a.lat},${a.lon}`, nach: `${b.lat},${b.lon}`, modus });
  const v = r.varianten?.[0];
  if (!v) throw Object.assign(new Error('Keine Route gefunden.'), { status: 404 });
  return { a, b, r, v, lines: routeLines(r) };
}

export async function baustellenRoute(params) {
  const { a, b, r, v, lines } = await corridorRoute(params, 'auto');
  const { roadworks } = await import('../../sources/roadworks.mjs');
  const rw = await roadworks();
  const hits = (rw.items ?? []).map((x) => {
    let dist = Infinity;
    for (const line of lines) dist = Math.min(dist, pointLineMeters([x.lon, x.lat], line));
    return { ...x, corridor: Math.round(dist) };
  }).filter((x) => x.corridor <= 150).sort((x, y) => x.corridor - y.corridor);
  return report({
    title: 'Baustellen auf der Route',
    subtitle: `${a.label} → ${b.label}`,
    summary: hits.length ? `${hits.length} Baustelle(n) im 150-Meter-Korridor der ${v.dauerMin}-Minuten-Route.` : 'Keine Baustelle im 150-Meter-Korridor der Route.',
    facts: [
      { label: 'Fahrzeit', value: `${v.dauerMin} min` },
      { label: 'Strecke', value: km(v.meter) },
      { label: 'Baustellen am Korridor', value: String(hits.length) },
      { label: 'Aktive Sperrungen', value: String(hits.filter((x) => x.status === 'active').length) },
    ],
    blocks: [
      block.list('Baustellen', hits.slice(0, 12).map((x) => ({ title: `${x.street ?? 'Baustelle'}${x.where ? ` – ${x.where}` : ''}`, subtitle: [x.work, x.corridor != null ? `${x.corridor} m zur Route` : null, x.from ? `ab ${dateDe(x.from)}` : null].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.text('Was das für die Fahrt heißt', 'Der Korridor ist eine Näherung: Eine Baustelle 100 Meter neben der Route kann die Fahrt trotzdem nicht betreffen, eine Sperrung auf der Route aber übersehen werden. Maßgeblich sind die Verkehrsmeldungen und die Beschilderung.'),
      block.links('Mehr', [
        { title: 'Route im Weg-Modul', href: '#modul=route&focus=route', note: 'Verbindung mit Echtzeit' },
        { title: 'Verkehrsmeldungen', href: '#modul=mobility&focus=verkehr', note: 'Sperrungen und Staus' },
      ]),
    ],
    points: hits.slice(0, 12).map((x) => ({ lat: x.lat, lon: x.lon, label: x.street ?? 'Baustelle' })),
    sources: [source('Landeshauptstadt Stuttgart, Baustellen (WFS, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('Valhalla/OSRM, OpenStreetMap (ODbL)', 'https://valhalla1.openstreetmap.de/', 'ODbL')],
    limits: ['Korridor-Näherung, keine amtliche Sperrungsprüfung.', 'Die Route ist eine Momentaufnahme ohne aktuelle Verkehrslage.'],
  });
}

export async function unfallRoute(params) {
  const { a, b, v, lines } = await corridorRoute(params, 'auto');
  const { unfaelle } = await import('../../sources/unfall.mjs');
  const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
  const radius = Math.max(1500, Math.round((v.meter ?? 3000) / 2 + 1000));
  const u = await unfaelle({ lat: mid.lat, lon: mid.lon, r: radius, limit: 500 });
  const hits = (u.items ?? []).map((x) => {
    let dist = Infinity;
    for (const line of lines) dist = Math.min(dist, pointLineMeters([x.lon, x.lat], line));
    return { ...x, corridor: Math.round(dist) };
  }).filter((x) => x.corridor <= 30).sort((x, y) => x.corridor - y.corridor);
  const severe = hits.filter((x) => x.kategorie <= 2);
  return report({
    title: 'Unfallschwerpunkte auf der Route',
    subtitle: `${a.label} → ${b.label}`,
    summary: hits.length ? `${hits.length} Unfälle mit Personenschaden im 30-Meter-Korridor, davon ${severe.length} mit schweren oder tödlichen Folgen.` : 'Keine Unfälle im 30-Meter-Korridor der Route im Unfallatlas.',
    facts: [
      { label: 'Unfälle am Korridor', value: String(hits.length) },
      { label: 'Schwer/tödlich', value: String(severe.length) },
      { label: 'Mit Rad', value: String(hits.filter((x) => x.rad).length) },
      { label: 'Mit Fuß', value: String(hits.filter((x) => x.fuss).length) },
    ],
    blocks: [
      block.table(
        'Unfälle',
        ['Jahr', 'Kategorie', 'Beteiligt', 'Abstand'],
        hits.slice(0, 20).map((x) => [
          x.jahr,
          x.kategorie === 1 ? 'tödlich' : x.kategorie === 2 ? 'schwer' : 'leicht',
          [x.rad ? 'Rad' : null, x.fuss ? 'Fuß' : null, x.pkw ? 'Pkw' : null, x.krad ? 'Krad' : null, x.gkfz ? 'Güterkraft' : null].filter(Boolean).join(', '),
          `${x.corridor} m`,
        ]),
      ),
      block.text('Einordnung', 'Der Unfallatlas enthält nur Unfälle mit Personenschaden. Ein Korridor von 30 Metern ist eine Näherung; die tatsächliche Unfallstelle kann an einer anderen Straßenseite liegen. Die Zahl ist kein Sicherheitsurteil über die Route.'),
      block.links('Mehr', [
        { title: 'Unfallatlas', href: 'https://www.unfallatlas.statistikportal.de/', note: 'Amtliche Daten, dl-de/by-2-0' },
        { title: 'Sicher unterwegs', href: '#modul=mobility&focus=verkehr', note: 'Verkehrs- und Gefahrenlage' },
      ]),
    ],
    points: hits.slice(0, 20).map((x) => ({ lat: x.lat, lon: x.lon, label: `Unfall ${x.jahr}` })),
    sources: [source('Unfallatlas der Statistischen Ämter (dl-de/by-2-0)', 'https://www.unfallatlas.statistikportal.de/', 'dl-de/by-2-0'), source('Valhalla/OSRM, OpenStreetMap (ODbL)', 'https://valhalla1.openstreetmap.de/', 'ODbL')],
    limits: ['Nur Unfälle mit Personenschaden; keine Sachschäden.', 'Korridor-Näherung, keine Unfallursachen.'],
  });
}

export async function steigungsProfil(params) {
  const ziel = placeParam(params.nach);
  if (!ziel) throw Object.assign(new Error('Bitte ein Ziel angeben.'), { status: 400 });
  const p = await resolvePlace(params);
  const b = await resolvePlace({ q: ziel });
  const { route } = await import('../../sources/routing.mjs');
  const r = await route({ von: `${p.lat},${p.lon}`, nach: `${b.lat},${b.lon}`, modus: 'fuss' });
  const v = r.varianten?.[0];
  if (!v) throw Object.assign(new Error('Keine Fußroute gefunden.'), { status: 404 });
  const h = v.hoehenprofil?.werte ?? [];
  const interval = v.hoehenprofil?.intervallMeter ?? 30;
  const steep = [];
  for (let i = 1; i < h.length; i++) {
    const slope = ((h[i] - h[i - 1]) / interval) * 100;
    if (Math.abs(slope) >= 8) steep.push({ bei: i * interval, slope: +slope.toFixed(1) });
  }
  return report({
    title: 'Steigungsprofil',
    subtitle: `${p.label} → ${b.label}`,
    summary: `${km(v.meter)} zu Fuß, ${v.dauerMin} Minuten, ${numDe(v.anstiegMeter)} m Aufstieg und ${numDe(v.abstiegMeter)} m Abstieg.`,
    facts: [
      { label: 'Strecke', value: km(v.meter) },
      { label: 'Dauer', value: `${v.dauerMin} min` },
      { label: 'Aufstieg', value: `${numDe(v.anstiegMeter)} m` },
      { label: 'Steile Abschnitte', value: String(steep.length) },
    ],
    blocks: [
      block.chart('Höhenprofil', h.map((_, i) => `${((i * interval) / 1000).toFixed(1)} km`), h, 'm'),
      block.table('Steile Abschnitte (ab 8 %)', ['bei', 'Steigung'], steep.slice(0, 15).map((x) => [km(x.bei), `${x.slope > 0 ? '+' : ''}${x.slope} %`])),
      block.text('Was das heißt', 'Das Höhenprofil stammt aus dem Geländemodell von Valhalla (30-m-Raster). Kurze Rampen und Treppen können darin untergehen. Bei Rollstuhl oder Kinderwagen das Profil „stufenlos“ im Weg-Modul verwenden.'),
      block.links('Mehr', [
        { title: 'Route planen', href: '#modul=route&focus=route', note: 'Fuß, Rad, ÖPNV, Auto' },
        { title: 'Wanderwege', href: '#modul=route&focus=wandern', note: 'Rundwege mit Höhenprofil' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }, { lat: b.lat, lon: b.lon, label: b.label }],
    sources: [source('Valhalla (FOSSGIS), Höhenmodell (ODbL)', 'https://valhalla1.openstreetmap.de/', 'ODbL')],
    limits: ['30-m-Raster; Treppen und kurze Rampen können fehlen.', 'Keine Berücksichtigung von Baustellen oder Sperrungen.'],
  });
}

export async function tankOptimierer(params) {
  const p = await resolvePlace(params);
  const { tankpreise } = await import('../../sources/tanken.mjs');
  const t = await tankpreise();
  const items = (t.items ?? []).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon)).map((x) => ({ ...x, distance: haversine({ lat: p.lat, lon: p.lon }, { lat: x.lat, lon: x.lon }) }));
  const radius = Number(params.r ?? params.radius ?? 5000);
  const near = items.filter((x) => x.distance <= radius).sort((a, b) => (a.e5 ?? 99) - (b.e5 ?? 99));
  const cheapest = near[0] ?? null;
  return report({
    title: 'Günstigste Tankstelle',
    subtitle: p.label,
    summary: cheapest ? `${cheapest.name} ist mit ${cheapest.e5 != null ? `${cheapest.e5.toFixed(3).replace('.', ',')} €/l (E5)` : 'aktuellem Preis'} die günstigste im Umkreis.` : 'Keine Tankpreise im Umkreis verfügbar.',
    facts: [
      { label: 'Tankstellen im Umkreis', value: String(near.length) },
      { label: 'Günstigste E5', value: cheapest?.e5 != null ? `${cheapest.e5.toFixed(3).replace('.', ',')} €` : '–', note: cheapest?.name ?? null },
      { label: 'Günstigste E10', value: cheapest?.e10 != null ? `${cheapest.e10.toFixed(3).replace('.', ',')} €` : '–' },
      { label: 'Günstigster Diesel', value: cheapest?.diesel != null ? `${cheapest.diesel.toFixed(3).replace('.', ',')} €` : '–' },
    ],
    blocks: [
      block.table('Preise im Umkreis', ['Tankstelle', 'E5', 'E10', 'Diesel', 'Entfernung'], near.slice(0, 12).map((x) => [x.name, x.e5 != null ? x.e5.toFixed(3).replace('.', ',') : '–', x.e10 != null ? x.e10.toFixed(3).replace('.', ',') : '–', x.diesel != null ? x.diesel.toFixed(3).replace('.', ',') : '–', km(x.distance)])),
      block.text('Preisvergleich', 'Die Preise stammen aus der Markttransparenzstelle für Kraftstoffe und können sich mehrmals täglich ändern. Die günstigste Tankstelle ist nicht automatisch die beste Wahl, wenn der Umweg mehr kostet als die Ersparnis.'),
      block.links('Mehr', [
        { title: 'Tanken in der App', href: '#modul=nearby&focus=tanken', note: 'Preise, Öffnungszeiten, Karte' },
        { title: 'MTS-K', href: 'https://www.bundeskartellamt.de/DE/Markttransparenzstelle/markttransparenzstelle_node.html', note: 'Amtliche Preistransparenz' },
      ]),
    ],
    points: near.slice(0, 10).map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Markttransparenzstelle für Kraftstoffe / Tankerkönig', 'https://www.tankerkönig.de/', 'Quellenangabe')],
    limits: ['Momentaufnahme; Preise können sich ändern.', 'Keine Prognose und keine Preisgeschichte.'],
  });
}

export async function flugAnalyse() {
  const { flug } = await import('../../sources/flug.mjs');
  const f = await flug();
  const aircraft = [...(f.aircraft ?? [])].sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9)).slice(0, 15);
  const low = aircraft.filter((x) => x.niedrig || (x.altFt != null && x.altFt < 3000));
  return report({
    title: 'Flug über mir',
    subtitle: f.edds?.betriebsrichtung ? `Piste ${f.edds.betriebsrichtung} in Betrieb` : 'Flughafen EDDS',
    summary: `${f.count ?? aircraft.length} Luftfahrzeuge im Umkreis von 30 km; ${low.length} fliegen niedrig.`,
    facts: [
      { label: 'Luftfahrzeuge', value: String(f.count ?? aircraft.length) },
      { label: 'Niedrig', value: String(low.length) },
      { label: 'Hubschrauber', value: String((f.hubschrauber ?? []).length) },
      { label: 'Piste', value: f.edds?.betriebsrichtung ?? 'unbekannt', note: f.edds?.wind ? `Wind ${f.edds.wind}` : null },
    ],
    blocks: [
      block.table('Aktuell im Umkreis', ['Callsign', 'Typ', 'Höhe', 'Geschwindigkeit', 'Entfernung'], aircraft.map((x) => [x.callsign ?? x.hex, x.type ?? x.reg ?? '–', x.altFt != null ? `${numDe(x.altFt)} ft` : '–', x.gsKt != null ? `${numDe(x.gsKt)} kt` : '–', x.dist != null ? km(x.dist) : '–'])),
      block.list('Niedrig fliegend', low.map((x) => ({ title: x.callsign ?? x.hex, subtitle: [x.type, x.altFt != null ? `${numDe(x.altFt)} ft` : null, x.dist != null ? km(x.dist) : null].filter(Boolean).join(' · ') }))),
      block.text('Einordnung', 'Die Positionen stammen aus dem offenen ADS-B-Netz und können mehrere Sekunden alt sein. Nicht jede Drohne, jeder Hubschrauber und jeder Militärflug ist sichtbar. Aus den Daten lässt sich keine Einsatzart ableiten.'),
      block.links('Mehr', [
        { title: 'Himmel über Stuttgart', href: '#modul=environment&focus=himmel', note: 'Karte, ISS, Wetterballons' },
        { title: 'Flughafen Stuttgart', href: 'https://www.flughafen-stuttgart.de/', note: 'Amtliche Informationen' },
      ]),
    ],
    points: aircraft.filter((x) => x.lat && x.lon).map((x) => ({ lat: x.lat, lon: x.lon, label: x.callsign ?? x.hex })),
    sources: [source('adsb.lol (ODbL)', 'https://adsb.lol/', 'ODbL'), source('NOAA Aviation Weather / METAR', 'https://aviationweather.gov/', 'US Government Open Data')],
    limits: ['ADS-B ist unvollständig; keine Identifikation von Einsatzflügen.', 'Höhen und Positionen können veraltet sein.'],
  });
}

export async function barrierefreieRoute(params) {
  const von = String(params.von ?? '').trim();
  const nach = String(params.nach ?? '').trim();
  if (!von || !nach) throw Object.assign(new Error('Bitte Start und Ziel angeben.'), { status: 400 });
  const [a, b] = await Promise.all([resolvePlace({ q: von }), resolvePlace({ q: nach })]);
  const { route } = await import('../../sources/routing.mjs');
  const r = await route({ von: `${a.lat},${a.lon}`, nach: `${b.lat},${b.lon}`, modus: 'oepnv', profil: 'rollstuhl' });
  const v = r.varianten?.[0];
  if (!v) throw Object.assign(new Error('Keine barrierefreie Route gefunden.'), { status: 404 });
  let aufzuege = null;
  try { const m = await import('../../sources/aufzuege.mjs'); aufzuege = await m.aufzuege(); } catch { /* optional */ }
  const stoerungen = (aufzuege?.items ?? aufzuege?.stoerungen ?? []).filter((x) => x.status && !/ok|normal|betrieb/i.test(String(x.status))).slice(0, 8);
  return report({
    title: 'Barrierefreie Route',
    subtitle: `${a.label} → ${b.label}`,
    summary: `${v.dauerMin} Minuten, ${v.umstiege} Umstieg(e), Profil stufenlos. ${stoerungen.length ? `${stoerungen.length} Aufzugsstörungen gemeldet.` : 'Keine Aufzugsstörung in der aktuellen Liste.'}`,
    facts: [
      { label: 'Dauer', value: `${v.dauerMin} min` },
      { label: 'Umstiege', value: String(v.umstiege ?? 0) },
      { label: 'Gehstrecke', value: km(v.fussMeter) },
      { label: 'Aufzugsstörungen', value: String(stoerungen.length) },
    ],
    blocks: [
      block.table('Abschnitte', ['Abschnitt', 'Dauer', 'Hinweis'], (v.abschnitte ?? []).map((x) => [x.art ?? '–', x.dauerMin != null ? `${x.dauerMin} min` : '–', x.hinweis ?? ''])),
      ...(stoerungen.length ? [block.list('Aufzugsstörungen', stoerungen.map((x) => ({ title: x.station ?? x.name ?? 'Aufzug', subtitle: [x.status, x.text].filter(Boolean).join(' · ') })))] : []),
      block.text('Barrierefrei planen', 'Das Profil „stufenlos“ berücksichtigt Aufzüge und Rampen, soweit sie in den Daten stehen. Baustellen, defekte Aufzüge und kurzfristige Sperrungen können die Route unbenutzbar machen. Vor der Fahrt die Aufzugsstörungen prüfen.'),
      block.links('Mehr', [
        { title: 'Aufzüge live', href: '#modul=mobility&focus=aufzuege', note: 'Status der DB-Stationen' },
        { title: 'Barriere-Check', href: '#labor=barriere-check&ort=' + encodeURIComponent(a.label), note: 'Toiletten und Einrichtungen' },
      ]),
    ],
    points: [{ lat: a.lat, lon: a.lon, label: a.label }, { lat: b.lat, lon: b.lon, label: b.label }],
    sources: [source('EFA-BW (NVBW), Profil stufenlos', 'https://www.efa-bw.de/', 'Datenlizenz Deutschland – Namensnennung 2.0'), source('DB Aufzugsstatus (Quellenangabe)', 'https://www.bahnhof.de/', 'Quellenangabe')],
    limits: ['Datenlage zu Aufzügen und Rampen ist nicht vollständig.', 'Kurzfristige Störungen können fehlen.'],
  });
}

export async function isochron15(params) {
  const p = await resolvePlace(params);
  const modus = String(params.modus ?? 'fuss') === 'rad' ? 'bicycle' : 'pedestrian';
  const { cached } = await import('../../cache.mjs');
  const key = `labor-isochron-${p.lat.toFixed(5)}-${p.lon.toFixed(5)}-${modus}`;
  const { value } = await cached(key, 30 * 60_000, async () => {
    const res = await fetch('https://valhalla1.openstreetmap.de/isochrone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'open-stuttgart/0.2 (nicht kommerzielles Open-Source-Projekt)' },
      body: JSON.stringify({ locations: [{ lat: p.lat, lon: p.lon }], contours: [{ time: 15, color: 'ffb300' }], costing: modus, polygons: true }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`Isochrone antwortet mit ${res.status}`);
    const j = await res.json();
    if (!j.features?.length) throw new Error('Keine Isochrone geliefert');
    return j;
  });
  const fc = { type: 'FeatureCollection', features: value.features };
  const ring = value.features[0]?.geometry?.coordinates?.[0] ?? [];
  const area = (() => {
    if (ring.length < 3) return null;
    const R = 6_371_000;
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]; const b = ring[(i + 1) % ring.length];
      sum += (b[0] - a[0]) * Math.PI / 180 * (2 + Math.sin(a[1] * Math.PI / 180) + Math.sin(b[1] * Math.PI / 180));
    }
    return Math.abs(sum * R * R / 2) / 1e6;
  })();
  return report({
    title: '15-Minuten-Radius',
    subtitle: `${p.label} · ${modus === 'bicycle' ? 'Fahrrad' : 'zu Fuß'}`,
    summary: `In 15 Minuten ${modus === 'bicycle' ? 'mit dem Rad' : 'zu Fuß'} erreichbar: rund ${area ? `${numDe(area, 1)} km²` : 'ein Gebiet'} rund um ${p.label}.`,
    facts: [
      { label: 'Fortbewegung', value: modus === 'bicycle' ? 'Fahrrad' : 'zu Fuß' },
      { label: 'Zeit', value: '15 Minuten' },
      { label: 'Fläche', value: area ? `${numDe(area, 1)} km²` : '–' },
      { label: 'Start', value: p.label },
    ],
    blocks: [
      block.text('Was der Radius zeigt', 'Die Fläche ist keine Garantie: Steigungen, Ampeln, Baustellen und fehlende Wege können den tatsächlichen Radius verkleinern. Für ÖPNV-Reisezeiten das Weg-Modul mit Verbindungssuche nutzen.'),
      block.links('Mehr', [
        { title: 'Route planen', href: '#modul=route&focus=route', note: 'Fuß, Rad, ÖPNV, Auto' },
        { title: 'Steigungsprofil', href: '#labor=steigungs-profil&ort=' + encodeURIComponent(p.label) + '&nach=Karlsh%C3%B6he', note: 'Höhenmeter prüfen' },
      ]),
    ],
    geojson: fc,
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [source('Valhalla (FOSSGIS), OpenStreetMap (ODbL)', 'https://valhalla1.openstreetmap.de/', 'ODbL')],
    limits: ['Modellradius ohne aktuelle Baustellen, Ampeln oder Wetter.', 'Nur zu Fuß und mit dem Rad; keine ÖPNV-Isochrone.'],
  });
}

export async function parkdruck(params) {
  const p = await resolvePlace(params);
  const { parking } = await import('../../sources/parking.mjs');
  const park = await parking();
  const sites = (park.sites ?? []).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon)).map((x) => ({ ...x, distance: haversine({ lat: p.lat, lon: p.lon }, { lat: x.lat, lon: x.lon }) })).sort((a, b) => a.distance - b.distance);
  const near = sites.filter((x) => x.distance <= 1200);
  const free = near.reduce((s, x) => s + (x.free ?? 0), 0);
  const capacity = near.reduce((s, x) => s + (x.capacity ?? 0), 0);
  let events = [];
  try {
    const { wasGeht } = await import('../../sources/wasgeht.mjs');
    const e = await wasGeht({ tag: new Date().toISOString().slice(0, 10) });
    events = (e.events ?? []).filter((x) => x.lat && x.lon && haversine({ lat: p.lat, lon: p.lon }, { lat: x.lat, lon: x.lon }) <= 1000).slice(0, 6);
  } catch { /* Termine optional */ }
  return report({
    title: 'Parkdruck am Ziel',
    subtitle: p.label,
    summary: near.length ? `${near.length} Parkhäuser im Umkreis, ${free.toLocaleString('de-DE')} freie Plätze von ${capacity.toLocaleString('de-DE')}. ${events.length ? `${events.length} Termine in der Nähe.` : ''}` : 'Keine Parkhäuser im Datensatz in der Nähe.',
    facts: [
      { label: 'Parkhäuser', value: String(near.length) },
      { label: 'Freie Plätze', value: free.toLocaleString('de-DE') },
      { label: 'Kapazität', value: capacity.toLocaleString('de-DE') },
      { label: 'Termine in der Nähe', value: String(events.length) },
    ],
    blocks: [
      block.table('Parkhäuser', ['Parkhaus', 'Frei', 'Kapazität', 'Entfernung'], near.slice(0, 10).map((x) => [x.name, x.free != null ? String(x.free) : '–', x.capacity != null ? String(x.capacity) : '–', km(x.distance)])),
      ...(events.length ? [block.list('Termine in der Nähe', events.map((e) => ({ title: e.title, subtitle: [timeDe(e.start), e.venue].filter(Boolean).join(' · '), href: e.url })))] : []),
      block.text('Parkdruck einordnen', 'Die Live-Belegung ist eine Momentaufnahme. Bei Veranstaltungen in Stadion, Halle oder Wasen steigt der Druck deutlich früher als die Anzeige vermuten lässt. Alternativen: P+R, Bike+Ride, ÖPNV.'),
      block.links('Mehr', [
        { title: 'Parken in der App', href: '#modul=mobility&focus=parken', note: 'Live-Karte und Alternativen' },
        { title: 'P+R und Bike+Ride', href: '#modul=mobility&focus=parken', note: 'Pendlerangebote' },
      ]),
    ],
    points: near.slice(0, 12).map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('ParkAPI v3 über MobiData BW (dl-de/by-2-0)', 'https://www.mobidata-bw.de/', 'dl-de/by-2-0')],
    limits: ['Live-Werte können veraltet sein; keine Prognose.', 'Parkhäuser außerhalb des städtischen Datensatzes fehlen.'],
  });
}

export async function ladeOptimierer(params) {
  const p = await resolvePlace(params);
  const { laden, gruenstrom } = await import('../../sources/nearby.mjs');
  const l = await laden(p.lat, p.lon, '70173');
  const g = await gruenstrom('70173');
  const items = (l.items ?? []).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon)).map((x) => ({ ...x, distance: haversine({ lat: p.lat, lon: p.lon }, { lat: x.lat, lon: x.lon }) })).sort((a, b) => a.distance - b.distance).slice(0, 10);
  const best = g.bestesFenster;
  return report({
    title: 'Laden mit Grünstrom',
    subtitle: p.label,
    summary: items.length ? `${items.length} Ladepunkte in der Nähe. Bester Grünstrom-Anteil: ${best ? `${Math.round(best.share)} % zwischen ${timeDe(new Date(best.von).toISOString())} und ${timeDe(new Date(best.bis).toISOString())}` : 'keine Angabe'}.` : 'Keine Ladepunkte im Datensatz in der Nähe.',
    facts: [
      { label: 'Ladepunkte', value: String(items.length) },
      { label: 'Grünstrom jetzt', value: g.aktuell?.share != null ? `${Math.round(g.aktuell.share)} %` : '–' },
      { label: 'Bestes Fenster', value: best ? `${timeDe(new Date(best.von).toISOString())}–${timeDe(new Date(best.bis).toISOString())}` : '–' },
      { label: 'Maximalleistung', value: items[0]?.maxKw != null ? `${items[0].maxKw} kW` : '–' },
    ],
    blocks: [
      block.table('Ladepunkte', ['Standort', 'Anschlüsse', 'Leistung', 'Betreiber', 'Entfernung'], items.map((x) => [x.name, String(x.total ?? '–'), x.maxKw != null ? `${x.maxKw} kW` : '–', x.operator ?? '–', km(x.distance)])),
      block.chart('Grünstromanteil der nächsten Stunden', (g.reihe ?? []).slice(0, 16).map((x) => timeDe(new Date(x.t).toISOString()) ?? ''), (g.reihe ?? []).slice(0, 16).map((x) => x.share), '%'),
      block.text('Laden planen', 'Wer zeitlich flexibel ist, lädt in Fenstern mit hohem Anteil erneuerbarer Energien. Das entlastet das Netz, ist aber keine Garantie für einen niedrigeren Preis. Die Belegung der Ladepunkte ist nicht in allen Datensätzen live.'),
      block.links('Mehr', [
        { title: 'Laden in der App', href: '#modul=nearby&focus=laden', note: 'Karte und Filter' },
        { title: 'StromGedacht', href: 'https://www.stromgedacht.de/', note: 'Netzlage und Prognose' },
      ]),
    ],
    points: items.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('OCPDB über MobiData BW (dl-de/by-2-0)', 'https://www.mobidata-bw.de/', 'dl-de/by-2-0'), source('Fraunhofer ISE Energy-Charts (CC BY 4.0)', 'https://www.energy-charts.info/', 'CC BY 4.0')],
    limits: ['Belegung nicht überall live.', 'Grünstromanteil ist regional, nicht pro Ladepunkt.'],
  });
}

export async function radtourPlaner(params) {
  const ziel = String(params.nach ?? '').trim();
  if (!ziel) throw Object.assign(new Error('Bitte ein Ziel angeben.'), { status: 400 });
  const p = await resolvePlace(params);
  const b = await resolvePlace({ q: ziel });
  const { route } = await import('../../sources/routing.mjs');
  const r = await route({ von: `${p.lat},${p.lon}`, nach: `${b.lat},${b.lon}`, modus: 'rad' });
  const v = r.varianten?.[0];
  if (!v) throw Object.assign(new Error('Keine Radroute gefunden.'), { status: 404 });
  return report({
    title: 'Radtour mit Rückweg',
    subtitle: `${p.label} → ${b.label}`,
    summary: `${km(v.meter)} mit dem Rad, ${v.dauerMin} Minuten, ${numDe(v.anstiegMeter)} m Aufstieg.`,
    facts: [
      { label: 'Strecke', value: km(v.meter) },
      { label: 'Dauer', value: `${v.dauerMin} min` },
      { label: 'Aufstieg', value: `${numDe(v.anstiegMeter)} m` },
      { label: 'Abstieg', value: `${numDe(v.abstiegMeter)} m` },
    ],
    blocks: [
      block.chart('Höhenprofil', (v.hoehenprofil?.werte ?? []).map((_, i) => `${((i * (v.hoehenprofil?.intervallMeter ?? 30)) / 1000).toFixed(1)} km`), v.hoehenprofil?.werte ?? [], 'm'),
      block.text('Rückweg', 'Für die Rückfahrt mit der Bahn die nächste Haltestelle am Ziel nutzen; das Rad kann in vielen Stadtbahnen außerhalb der Stoßzeiten mitgenommen werden. Alternativ eine Rundroute planen.'),
      block.links('Mehr', [
        { title: 'Route im Weg-Modul', href: '#modul=route&focus=route', note: 'Rad, ÖPNV, Auto' },
        { title: 'Hauptradrouten', href: '#modul=mobility&focus=rad', note: 'Ausgeschilderte Wege' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }, { lat: b.lat, lon: b.lon, label: b.label }],
    sources: [source('Valhalla/OSRM, OpenStreetMap (ODbL)', 'https://valhalla1.openstreetmap.de/', 'ODbL')],
    limits: ['Keine Berücksichtigung von Baustellen, Wetter oder Radmitnahme-Regeln.', 'Höhen aus 30-m-Raster.'],
  });
}
