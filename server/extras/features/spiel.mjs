// Wochenendplanung und spielerische Entdeckung: Kesselwetter, Geheimnisorte,
// Nachbarschaftstipps und Foto-Rallye.
import { report, block, source, action, numDe, km, dateDe, timeDe, haversine } from '../util.mjs';
import { runSource } from '../run-source.mjs';
import { resolvePlace, nearby, nearest, weatherNow } from './util.mjs';

function distance(a, b) { return haversine(a, b); }
function nextWeekend() {
  const now = new Date();
  const sat = new Date(now); sat.setHours(0, 0, 0, 0);
  const add = (6 - sat.getDay() + 7) % 7 || 7;
  sat.setDate(sat.getDate() + add);
  const sun = new Date(sat); sun.setDate(sun.getDate() + 1);
  return { sat, sun };
}

export async function wochenendPlaner(params) {
  const p = await resolvePlace(params);
  const { sat, sun } = nextWeekend();
  const [sa, so, w] = await Promise.allSettled([
    import('../../sources/wasgeht.mjs').then((m) => m.wasGeht({ tag: sat.toISOString().slice(0, 10) })),
    import('../../sources/wasgeht.mjs').then((m) => m.wasGeht({ tag: sun.toISOString().slice(0, 10) })),
    weatherNow(),
  ]);
  const events = (r) => r.status === 'fulfilled' ? (r.value.events ?? []).slice(0, 12) : [];
  const wetter = w.status === 'fulfilled' ? w.value : null;
  return report({
    title: 'Wochenendplaner',
    subtitle: `${dateDe(sat.toISOString())} und ${dateDe(sun.toISOString())}`,
    summary: `Termine für Samstag und Sonntag, dazu die aktuelle Wetterlage. Die Vorhersage reicht 24 Stunden; für das Wochenende die Wetterlage am Freitag erneut prüfen.`,
    facts: [
      { label: 'Samstag', value: `${events(sa).length} Termine`, note: dateDe(sat.toISOString()) },
      { label: 'Sonntag', value: `${events(so).length} Termine`, note: dateDe(sun.toISOString()) },
      { label: 'Wetter jetzt', value: wetter ? `${numDe(wetter.temperature, 1)} °C, ${wetter.condition}` : '–' },
      { label: 'Niederschlag 24 h', value: wetter ? `${numDe((wetter.hourly ?? []).reduce((s, x) => s + (Number(x.precipitation) || 0), 0), 1)} mm` : '–' },
    ],
    blocks: [
      block.list('Samstag', events(sa).map((e) => ({ title: e.title, subtitle: [timeDe(e.start), e.venue, e.free ? 'kostenlos' : e.price].filter(Boolean).join(' · '), href: e.url }))),
      block.list('Sonntag', events(so).map((e) => ({ title: e.title, subtitle: [timeDe(e.start), e.venue, e.free ? 'kostenlos' : e.price].filter(Boolean).join(' · '), href: e.url }))),
      block.text('Planen', 'Für draußen: Wetterradar am Tag selbst prüfen. Für drinnen: Museen und Ausstellungen. Für Ausflüge: Umland-Modul mit Bahnverbindung. Sonntags haben viele Geschäfte geschlossen; Bäckereien und Cafés oft geöffnet.'),
      block.links('Mehr', [
        { title: 'Was geht', href: '#modul=wasgeht&focus=freizeit', note: 'Alle Termine mit Filtern' },
        { title: 'Umland', href: '#modul=umland&focus=ziele', note: 'Ausflugsziele mit Bahn' },
        { title: 'Abendplaner', href: '#labor=abend-planer&ort=' + encodeURIComponent(p.label), note: 'Heute Abend' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [source('Open Stuttgart, Was geht (Quellen je Termin)', '/api/wasgeht', 'Quellen je Termin'), source('Deutscher Wetterdienst (GeoNutzV)', 'https://www.dwd.de/', 'GeoNutzV')],
    limits: ['Termine können ausfallen; Öffnungszeiten und Einlass nicht enthalten.', 'Wettervorhersage nur 24 Stunden, nicht für das ganze Wochenende.'],
  });
}

export async function kesselWetter() {
  const { kessel } = await import('../../sources/kessel.mjs');
  const k = await kessel();
  const hours = k.model?.hours ?? [];
  const now = Date.now();
  const cur = hours.find((h) => Date.parse(h.t) <= now && Date.parse(h.t) + 3600_000 > now) ?? hours[0] ?? null;
  const inversion = cur?.dT != null && cur.dT > 0;
  return report({
    title: 'Kessel-Wetter',
    subtitle: 'Talkessel und Höhen im Vergleich',
    summary: cur ? `Am Boden ${numDe(cur.t2, 1)} °C, in 925 hPa ${numDe(cur.t925, 1)} °C. ${inversion ? 'Inversion: Die Luft in der Höhe ist wärmer als am Boden.' : 'Keine ausgeprägte Inversion.'}` : 'Keine Modelldaten verfügbar.',
    facts: [
      { label: 'Temperatur 2 m', value: cur ? `${numDe(cur.t2, 1)} °C` : '–' },
      { label: 'Temperatur 925 hPa', value: cur ? `${numDe(cur.t925, 1)} °C` : '–' },
      { label: 'Temperaturdifferenz', value: cur?.dT != null ? `${numDe(cur.dT, 1)} K` : '–' },
      { label: 'Grenzschichthöhe', value: cur?.bl != null ? `${numDe(cur.bl)} m` : '–' },
      { label: 'Wind', value: cur?.wind != null ? `${numDe(cur.wind, 1)} km/h` : '–' },
    ],
    blocks: [
      block.chart('Temperatur am Boden und in der Höhe', hours.slice(0, 24).map((h) => new Date(h.t).toLocaleTimeString('de-DE', { hour: '2-digit' })), hours.slice(0, 24).map((h) => h.t2), '°C'),
      block.chart('Temperaturdifferenz (Inversion)', hours.slice(0, 24).map((h) => new Date(h.t).toLocaleTimeString('de-DE', { hour: '2-digit' })), hours.slice(0, 24).map((h) => h.dT), 'K'),
      block.table('Messprofil der Bürgersensoren', ['Höhenband', 'Messungen', 'Median'], (k.profile?.bands ?? []).map((b) => [`${b.from}–${b.to} m`, b.n, `${numDe(b.median, 1)} °C`])),
      block.text('Was eine Inversion bedeutet', 'Bei einer Inversion liegt wärmere Luft über kälterer Bodenluft. Der Austausch ist blockiert, Schadstoffe und Feuchte stauen sich. Im Kessel kann es dann am Boden kälter und trüber sein als auf den Fildern.'),
      block.links('Mehr', [
        { title: 'Kessel-Modul', href: '#modul=environment&focus=kessel', note: 'Kaltluft, Inversion, Abendspaziergang' },
        { title: 'Open-Meteo', href: 'https://open-meteo.com/', note: 'Modellquelle (CC BY 4.0)' },
      ]),
    ],
    sources: [source('Open-Meteo (CC BY 4.0)', 'https://open-meteo.com/', 'CC BY 4.0'), source('Sensor.Community und openSenseMap (ODbL/CC BY 4.0)', 'https://sensor.community/', 'ODbL / CC BY 4.0')],
    limits: ['Modellwerte, keine amtliche Messung.', 'Bürgersensoren sind nicht kalibriert und ungleich verteilt.'],
  });
}

export async function geheimnisOrte(params) {
  const p = await resolvePlace(params);
  const [spots, stairs, mineral, chill, engagement] = await Promise.all([
    runSource('wfs-aussichtspunkte', { lat: p.lat, lon: p.lon, r: 15, limit: 100 }).catch(() => null),
    nearby('staeffele'), nearby('mineralbrunnen'), nearby('chillorte'),
    runSource('wfs-engagement-orte', { lat: p.lat, lon: p.lon, r: 15, limit: 100 }).catch(() => null),
  ]);
  const points = [
    ...(spots?.points ?? []).map((x) => ({ ...x, kind: 'Aussicht', distance: distance({ lat: p.lat, lon: p.lon }, x) })),
    ...(engagement?.points ?? []).map((x) => ({ ...x, kind: 'Engagement', distance: distance({ lat: p.lat, lon: p.lon }, x) })),
    ...stairs.map((x) => ({ ...x, kind: 'Stäffele', distance: distance({ lat: p.lat, lon: p.lon }, x) })),
    ...mineral.map((x) => ({ ...x, kind: 'Mineralbrunnen', distance: distance({ lat: p.lat, lon: p.lon }, x) })),
    ...chill.map((x) => ({ ...x, kind: 'Chillort', distance: distance({ lat: p.lat, lon: p.lon }, x) })),
  ].sort((a, b) => a.distance - b.distance);
  return report({
    title: 'Geheimnisorte',
    subtitle: p.label,
    summary: points.length ? `${points.length} besondere Orte in der Nähe: Aussichten, Stäffele, Brunnen, Engagement und Chillorte.` : 'Keine besonderen Orte im Datensatz gefunden.',
    facts: [
      { label: 'Orte', value: String(points.length) },
      { label: 'Nächster Ort', value: points[0] ? km(points[0].distance) : '–', note: points[0]?.name ?? null },
      { label: 'Kategorien', value: String(new Set(points.map((x) => x.kind)).size) },
    ],
    blocks: [
      block.list('Orte', points.slice(0, 14).map((x) => ({ title: x.name, subtitle: [x.kind, km(x.distance), ...(x.info ?? []).slice(0, 2)].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.text('Respektvoll entdecken', 'Viele Orte sind Wohnumfeld, Arbeitsplatz oder Natur. Leise bleiben, Müll mitnehmen, Privatgrund respektieren, keine Drohnen über Menschen. Stäffele sind Treppenwege, keine Abkürzung für Autos.'),
      block.links('Mehr', [
        { title: 'Stäffele in der Nähe', href: '#modul=nearby&focus=staeffele', note: 'Alle Treppenwege' },
        { title: 'Aussichtsfinder', href: '#labor=aussicht-finder&ort=' + encodeURIComponent(p.label), note: 'Mit Sonnenuntergang' },
      ]),
    ],
    points: points.slice(0, 20).map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Landeshauptstadt Stuttgart, Aussichtspunkte, Stäffele, Brunnen (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL')],
    limits: ['Keine Garantie auf öffentliche Zugänglichkeit; Öffnungszeiten und Privatgrund beachten.', 'Orte können sich verändern.'],
  });
}

export async function nachbarschaftsTipp(params) {
  const p = await resolvePlace(params);
  const cats = [
    ['buecherschrank', 'Bücherschrank'], ['paketstation', 'Paketstation'], ['waschsalon', 'Waschsalon'],
    ['hundepark', 'Hundepark'], ['trinkbrunnen', 'Trinkbrunnen'], ['chillorte', 'Chillort'],
  ];
  const results = await Promise.all(cats.map(async ([cat, label]) => ({ label, items: await nearby(cat).catch(() => []) })));
  const all = results.flatMap((r) => r.items.map((x) => ({ ...x, kind: r.label, distance: distance({ lat: p.lat, lon: p.lon }, x) }))).sort((a, b) => a.distance - b.distance);
  return report({
    title: 'Nachbarschaftstipp',
    subtitle: p.label,
    summary: all.length ? `${all.length} kleine Alltagsorte in der Nähe – vom Bücherschrank bis zum Hundepark.` : 'Keine Alltagsorte im Datensatz gefunden.',
    facts: [
      { label: 'Orte', value: String(all.length) },
      { label: 'Nächster Tipp', value: all[0] ? km(all[0].distance) : '–', note: all[0]?.name ?? null },
      { label: 'Kategorien', value: String(new Set(all.map((x) => x.kind)).size) },
    ],
    blocks: [
      block.list('In der Nähe', all.slice(0, 14).map((x) => ({ title: x.name, subtitle: [x.kind, km(x.distance), x.address, ...(x.info ?? []).slice(0, 2)].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.text('Alltag teilen', 'Bücherschränke, Paketstationen und Waschsalons sind keine amtlichen Register; sie kommen aus OpenStreetMap und können fehlen. Bitte nichts in Bücherschränken entsorgen, was nicht hineingehört.'),
      block.links('Mehr', [
        { title: 'Nähe-Modul', href: '#modul=nearby&focus=alltag', note: 'Alle Alltagsorte' },
        { title: 'Engagement-Orte', href: '#labor=geheimnisorte&ort=' + encodeURIComponent(p.label), note: 'Ehrenamt und Nachbarschaft' },
      ]),
    ],
    points: all.slice(0, 20).map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL'), source('Landeshauptstadt Stuttgart, Einrichtungen (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0')],
    limits: ['Keine amtlichen Register für Bücherschränke, Paketstationen und Waschsalons.', 'Öffnungszeiten und Zugänglichkeit können fehlen.'],
  });
}

export async function fotoRallye(params) {
  const p = await resolvePlace(params);
  const [spots, places, sun] = await Promise.all([
    runSource('wfs-aussichtspunkte', { lat: p.lat, lon: p.lon, r: 10, limit: 100 }).catch(() => null),
    import('../../sources/culture.mjs').then((m) => m.places()).catch(() => null),
    runSource('api-sunrise-sunset', { lat: p.lat, lon: p.lon }).catch(() => null),
  ]);
  const placesNear = (places?.places ?? []).filter((x) => x.lat && x.lon).map((x) => ({ ...x, distance: distance({ lat: p.lat, lon: p.lon }, x) })).sort((a, b) => a.distance - b.distance).slice(0, 8);
  const spotsNear = (spots?.points ?? []).map((x) => ({ ...x, distance: distance({ lat: p.lat, lon: p.lon }, x) })).sort((a, b) => a.distance - b.distance).slice(0, 6);
  const sunset = sun?.rows?.find((x) => /Sonnenuntergang/.test(x.Zeitpunkt))?.Wert;
  const tasks = [
    ...spotsNear.map((x) => ({ title: `Aussicht: ${x.name}`, subtitle: `${km(x.distance)} entfernt · Weitwinkel, Horizont, Wolken` })),
    ...placesNear.slice(0, 4).map((x) => ({ title: `Motiv: ${x.name}`, subtitle: `${km(x.distance)} entfernt · Detail, Fassade, Schatten` })),
    { title: 'Alltagsdetail', subtitle: 'Ein Schild, eine Treppe, ein Brunnen – mit Datum und Ort' },
  ];
  return report({
    title: 'Foto-Rallye',
    subtitle: p.label,
    summary: `${tasks.length} Fotoaufgaben in der Nähe${sunset ? `, Sonnenuntergang ${timeDe(sunset)}` : ''}.`,
    facts: [
      { label: 'Aufgaben', value: String(tasks.length) },
      { label: 'Aussichtspunkte', value: String(spotsNear.length) },
      { label: 'Motive', value: String(placesNear.length) },
      { label: 'Sonnenuntergang', value: sunset ? timeDe(sunset) : '–' },
    ],
    blocks: [
      block.list('Aufgaben', tasks),
      block.text('Fotografieren mit Respekt', 'Keine Menschen ohne Einwilligung, keine privaten Wohnungen, keine Drohnen über Menschenmengen. Öffentliche Plätze sind meist unproblematisch; Denkmäler und Kunstwerke können eigene Rechte haben.'),
      block.links('Mehr', [
        { title: 'Historische Bilder', href: '#labor=historische-bilder&ort=' + encodeURIComponent(p.label), note: 'Vergleich mit früher' },
        { title: 'Aussichtsfinder', href: '#labor=aussicht-finder&ort=' + encodeURIComponent(p.label), note: 'Sonnenuntergang und Wetter' },
      ]),
    ],
    points: [...spotsNear, ...placesNear].slice(0, 15).map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Landeshauptstadt Stuttgart, Aussichtspunkte (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('Wikidata/Wikipedia (CC0/CC BY-SA 4.0)', 'https://www.wikidata.org/', 'CC0 / CC BY-SA 4.0'), source('sunrise-sunset.org (CC BY 4.0)', 'https://sunrise-sunset.org/', 'CC BY 4.0')],
    limits: ['Keine rechtliche Freigabe für Fotos von Personen oder geschützten Werken.', 'Sonnenuntergang ist astronomisch; Gelände und Bebauung können ihn früher verdecken.'],
  });
}

export async function schnitzeljagdBuilder(params) {
  const p = await resolvePlace(params);
  const [spots, fountains, playgrounds, engagement] = await Promise.all([
    runSource('wfs-aussichtspunkte', { lat: p.lat, lon: p.lon, r: 5, limit: 50 }).catch(() => null),
    nearby('trinkbrunnen'), nearby('spielplatz'),
    runSource('wfs-engagement-orte', { lat: p.lat, lon: p.lon, r: 5, limit: 50 }).catch(() => null),
  ]);
  const candidates = [
    ...(spots?.points ?? []).map((x) => ({ ...x, kind: 'Aussicht' })),
    ...(engagement?.points ?? []).map((x) => ({ ...x, kind: 'Engagement' })),
    ...fountains.map((x) => ({ ...x, kind: 'Brunnen' })),
    ...playgrounds.map((x) => ({ ...x, kind: 'Spielplatz' })),
  ].map((x, i) => ({ ...x, id: `${x.kind}-${i}`, distance: distance({ lat: p.lat, lon: p.lon }, x) })).sort((a, b) => a.distance - b.distance);
  const chosen = [];
  for (const c of candidates) {
    if (chosen.length >= 5) break;
    if (chosen.some((x) => distance({ lat: x.lat, lon: x.lon }, c) < 250)) continue;
    chosen.push(c);
  }
  let total = 0;
  for (let i = 1; i < chosen.length; i++) total += distance({ lat: chosen[i - 1].lat, lon: chosen[i - 1].lon }, chosen[i]);
  const tasks = [
    'Finde die Station und notiere eine Besonderheit.',
    'Mache ein Foto aus einer ungewöhnlichen Perspektive.',
    'Suche nach einem Detail, das du beim ersten Blick übersehen hast.',
    'Erkläre einer anderen Person, warum dieser Ort wichtig ist.',
    'Finde heraus, wann der Ort entstanden ist.',
  ];
  return report({
    title: 'Schnitzeljagd',
    subtitle: p.label,
    summary: chosen.length ? `${chosen.length} Stationen, rund ${km(total + (chosen[0]?.distance ?? 0))} Fußweg.` : 'Zu wenige Orte für eine Route gefunden.',
    facts: [
      { label: 'Stationen', value: String(chosen.length) },
      { label: 'Fußweg', value: km(total + (chosen[0]?.distance ?? 0)) },
      { label: 'Start', value: chosen[0]?.name ?? '–' },
      { label: 'Ziel', value: chosen.at(-1)?.name ?? '–' },
    ],
    blocks: [
      block.list('Stationen', chosen.map((x, i) => ({ title: `${i + 1}. ${x.name}`, subtitle: [x.kind, km(x.distance), i === 0 ? 'Start' : null].filter(Boolean).join(' · '), lat: x.lat, lon: x.lon }))),
      block.list('Aufgaben', tasks.slice(0, chosen.length).map((t, i) => ({ title: `Station ${i + 1}`, subtitle: t }))),
      block.text('Regeln', 'Öffentliche Wege nutzen, nichts beschädigen, keine Privatgrundstücke betreten, Müll mitnehmen. Für Kinder: Erwachsene begleiten und Treffpunkt ausmachen.'),
      block.links('Mehr', [
        { title: 'Stadtspiel', href: '#modul=spiel&focus=routen', note: 'Fertige Routen mit Lösungswort' },
        { title: 'Geheimnisorte', href: '#labor=geheimnisorte&ort=' + encodeURIComponent(p.label), note: 'Weitere besondere Orte' },
      ]),
    ],
    points: chosen.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Landeshauptstadt Stuttgart, Aussichtspunkte, Brunnen, Spielplätze (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('OpenStreetMap-Mitwirkende (ODbL)', 'https://www.openstreetmap.org/', 'ODbL')],
    limits: ['Die Route ist ein Vorschlag, keine ausgeschilderte Strecke.', 'Streckenlänge ist Luftlinie plus Startweg, nicht der tatsächliche Fußweg.'],
  });
}
