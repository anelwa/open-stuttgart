// Wissens- und BildungsWerkzeuge: Bibliothek, historische Bilder, Denkmäler,
// Stadtteilgeschichte und Baumarten. Sie verbinden amtliche Daten mit offenen
// Wissensgraphen und Archiven – jede Aussage mit Quelle.
import { report, block, source, action, clean, numDe, haversine, km } from '../util.mjs';
import { runSource } from '../run-source.mjs';
import { resolvePlace, districtAt, sourceInfo, nearest } from './util.mjs';

const distance = (a, b) => haversine(a, b);

function listItems(items, label = 'Eintrag') {
  return items.map((x) => ({
    title: x.title ?? x.name ?? label,
    subtitle: [x.subtitle, x.badge].filter(Boolean).join(' · '),
    href: x.href ?? x.url ?? null,
    lat: x.lat ?? null,
    lon: x.lon ?? null,
  }));
}

function nearbyItems(items, lat, lon) {
  return items.filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon))
    .map((x) => ({ ...x, distance: distance({ lat, lon }, { lat: x.lat, lon: x.lon }) }))
    .sort((a, b) => a.distance - b.distance);
}

export async function bibliothekSuche(params) {
  const q = String(params.q ?? '').trim();
  if (q.length < 2) throw Object.assign(new Error('Bitte einen Suchbegriff angeben.'), { status: 400 });
  const [k10, openlib, archive] = await Promise.allSettled([
    import('../../sources/schnittstellen.mjs').then((m) => m.bibliothek(q)),
    runSource('api-openlibrary', { q }),
    runSource('api-internet-archive', { q }),
  ]);
  const k10items = k10.status === 'fulfilled' ? (k10.value.items ?? []).map((x) => ({ title: x.title, subtitle: [x.author, x.year, 'K10plus'].filter(Boolean).join(' · '), href: x.url })) : [];
  const openItems = openlib.status === 'fulfilled' ? listItems(openlib.value.items ?? [], 'Buch') : [];
  const archiveItems = archive.status === 'fulfilled' ? listItems((archive.value.items ?? []).filter((x) => String(x.title ?? '').toLowerCase().includes(q.toLowerCase()) || true).slice(0, 8), 'Digitalisat') : [];
  return report({
    title: `Bibliothekssuche: ${q}`,
    subtitle: `${k10items.length + openItems.length + archiveItems.length} Treffer`,
    summary: 'Bücher, Medien und Digitalisate zu einem Ort oder Thema – mit Bibliothekslink und Quellenangabe.',
    blocks: [
      block.list('K10plus / Südwestdeutscher Bibliotheksverbund', k10items.slice(0, 8)),
      block.list('Open Library', openItems.slice(0, 8)),
      block.list('Internet Archive', archiveItems),
      block.text('Hinweis', 'Die Treffer sind Katalogmetadaten. Ob ein Buch in einer Stuttgarter Bibliothek ausleihbar ist, steht nicht in jedem Datensatz; der Link führt in den Katalog.'),
    ],
    sources: [
      source('K10plus / Südwestdeutscher Bibliotheksverbund (SRU)', 'https://sru.k10plus.de/', 'Metadaten, Quellenangabe'),
      source('Open Library / Internet Archive', 'https://openlibrary.org/', 'CC0 / je Objekt'),
    ],
    limits: ['Keine Verfügbarkeits- oder Ausleihprüfung.', 'Open Library und K10plus können denselben Titel mehrfach führen.'],
  });
}

export async function wissensLuecken(params) {
  const p = await resolvePlace(params);
  const { wikidataGaps } = await import('../../sources/schnittstellen.mjs');
  const gaps = await wikidataGaps();
  const near = nearbyItems(gaps.items ?? [], p.lat, p.lon);
  const within = near.filter((x) => x.distance <= 5000);
  const shown = (within.length ? within : near).slice(0, 15);
  return report({
    title: 'Wissenslücken in der Nähe',
    subtitle: `${within.length} Orte im 5-km-Umkreis`,
    summary: 'Orte mit Wikidata-Koordinate, aber ohne verlinkten Wikipedia-Artikel – ein Qualitätscheck für die Wissensbasis der Stadt.',
    blocks: [
      block.list('Orte ohne Artikel', shown.map((x) => ({ title: x.name, subtitle: `${km(x.distance)} entfernt · ${x.id}`, href: x.url, lat: x.lat, lon: x.lon }))),
      block.text('Was du tun kannst', 'Wenn du einen Ort gut kennst: Wikipedia-Artikel anlegen oder den Wikidata-Eintrag ergänzen. Beides ist offen und kostenlos; Quellen bitte angeben.'),
      block.links('Mitmachen', [
        { title: 'Wikidata-Eintrag suchen', href: 'https://www.wikidata.org/', note: 'Freie Wissensdatenbank, CC0' },
        { title: 'Wikipedia: Artikel schreiben', href: 'https://de.wikipedia.org/wiki/Wikipedia:Neuer_Artikel', note: 'Anleitung für neue Artikel' },
      ]),
    ],
    points: shown.map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [
      source('Wikidata Query Service (CC0)', 'https://query.wikidata.org/', 'CC0 1.0'),
    ],
    limits: ['Die Abfrage ist eine Momentaufnahme und deckt nur Objekte mit Bezug zu Stuttgart (P131 = Q1022) ab.', 'Ein fehlender Artikel ist kein Qualitätsurteil über den Ort.'],
  });
}

export async function historischeBilder(params) {
  const p = await resolvePlace(params);
  const [commons, wiki, archive] = await Promise.allSettled([
    runSource('api-commons-geosuche', { lat: p.lat, lon: p.lon }),
    runSource('api-wikipedia-geosuche', { lat: p.lat, lon: p.lon }),
    runSource('api-internet-archive', { q: p.label }),
  ]);
  const commonsItems = commons.status === 'fulfilled' ? listItems(commons.value.items ?? []) : [];
  const wikiItems = wiki.status === 'fulfilled' ? listItems(wiki.value.items ?? []) : [];
  const archiveItems = archive.status === 'fulfilled' ? listItems(archive.value.items ?? [], 'Digitalisat') : [];
  return report({
    title: 'Historische Bilder und Quellen',
    subtitle: p.label,
    summary: 'Fotos, Karten und Digitalisate aus offenen Archiven – mit Link zur Originalseite und Rechtehinweis.',
    blocks: [
      block.list('Wikimedia Commons', commonsItems.slice(0, 12)),
      block.list('Wikipedia-Artikel in der Nähe', wikiItems.slice(0, 12)),
      block.list('Internet Archive', archiveItems.slice(0, 8)),
      block.text('Rechte', 'Commons-Dateien stehen unter unterschiedlichen freien Lizenzen; die Dateiseite nennt Autor, Lizenz und Bedingungen. Internet-Archive-Objekte können urheberrechtlich geschützt sein. Vor der Weiterverwendung die Objektseite prüfen.'),
    ],
    points: [...commonsItems, ...wikiItems].filter((x) => x.lat && x.lon).slice(0, 20).map((x) => ({ lat: x.lat, lon: x.lon, label: x.title })),
    sources: [
      source('Wikimedia Commons', 'https://commons.wikimedia.org/', 'Je Datei (CC BY/CC0)'),
      source('Wikipedia', 'https://de.wikipedia.org/', 'CC BY-SA 4.0'),
      source('Internet Archive', 'https://archive.org/', 'Je Objekt'),
    ],
    limits: ['Die Geosuche findet Objekte in der Nähe, nicht zwingend zu diesem Gebäude.', 'Historische Bilder können falsch datiert oder verortet sein.'],
  });
}

export async function stadtarchivQuellen(params) {
  const q = String(params.q ?? '').trim();
  if (q.length < 2) throw Object.assign(new Error('Bitte Straße, Gebäude oder Thema angeben.'), { status: 400 });
  const [k10, ol, archive] = await Promise.allSettled([
    import('../../sources/schnittstellen.mjs').then((m) => m.bibliothek(q)),
    runSource('api-openlibrary', { q }),
    runSource('api-internet-archive', { q }),
  ]);
  const k10items = k10.status === 'fulfilled' ? (k10.value.items ?? []).map((x) => ({ title: x.title, subtitle: [x.author, x.year, 'K10plus'].filter(Boolean).join(' · '), href: x.url })) : [];
  const olItems = ol.status === 'fulfilled' ? listItems(ol.value.items ?? []) : [];
  const archiveItems = archive.status === 'fulfilled' ? listItems(archive.value.items ?? []) : [];
  return report({
    title: `Quellen zu „${q}“`,
    subtitle: 'Bibliothek, Open Library und Internet Archive',
    summary: 'Bücher, Aufsätze und Digitalisate für die Spurensuche zu einer Straße oder einem Gebäude.',
    blocks: [
      block.list('K10plus', k10items.slice(0, 10)),
      block.list('Open Library', olItems.slice(0, 8)),
      block.list('Internet Archive', archiveItems.slice(0, 8)),
      block.links('Archive und Bibliotheken', [
        { title: 'Stadtarchiv Stuttgart', href: 'https://www.stuttgart.de/stadtarchiv/', note: 'Amtliche Bestände und Findmittel' },
        { title: 'Württembergische Landesbibliothek', href: 'https://www.wlb-stuttgart.de/', note: 'Landesbibliothek mit Digitalisaten' },
        { title: 'K10plus', href: 'https://kxp.k10plus.de/', note: 'Bibliothekskatalog' },
      ]),
    ],
    sources: [
      source('K10plus (SRU)', 'https://sru.k10plus.de/', 'Metadaten, Quellenangabe'),
      source('Open Library / Internet Archive', 'https://openlibrary.org/', 'CC0 / je Objekt'),
    ],
    limits: ['Keine Garantie, dass ein Werk im Stadtarchiv vorhanden ist.', 'Digitalisate können gesperrt oder nur vor Ort einsehbar sein.'],
  });
}

export async function strassenGeschichte(params) {
  const q = String(params.q ?? '').trim();
  if (q.length < 2) throw Object.assign(new Error('Bitte einen Straßennamen angeben.'), { status: 400 });
  const p = await resolvePlace({ q });
  const [wiki, commons, k10] = await Promise.allSettled([
    runSource('api-wikipedia-geosuche', { lat: p.lat, lon: p.lon }),
    runSource('api-commons-geosuche', { lat: p.lat, lon: p.lon }),
    import('../../sources/schnittstellen.mjs').then((m) => m.bibliothek(`${q} Stuttgart`)),
  ]);
  const wikiItems = wiki.status === 'fulfilled' ? listItems(wiki.value.items ?? []) : [];
  const commonsItems = commons.status === 'fulfilled' ? listItems(commons.value.items ?? []) : [];
  const k10items = k10.status === 'fulfilled' ? (k10.value.items ?? []).map((x) => ({ title: x.title, subtitle: [x.author, x.year].filter(Boolean).join(' · '), href: x.url })) : [];
  return report({
    title: `Straßenname: ${q}`,
    subtitle: p.label,
    summary: 'Hinweise zur Herkunft und Geschichte eines Straßennamens aus offenen Wissensquellen.',
    blocks: [
      block.list('Wikipedia in der Nähe', wikiItems.slice(0, 8)),
      block.list('Bilder und Karten', commonsItems.slice(0, 8)),
      block.list('Literatur', k10items.slice(0, 8)),
      block.text('Hinweis', 'Eine Straße kann nach einer Person, einem Ort, einer Funktion oder einem historischen Ereignis benannt sein. Die Geosuche liefert nur Artikel in der Nähe; für die genaue Namensherkunft ist oft ein Stadtlexikon oder das Stadtarchiv die bessere Quelle.'),
      block.links('Nachschlagen', [
        { title: 'Stadtlexikon Stuttgart', href: 'https://www.stadtlexikon-stuttgart.de/', note: 'Historisches Lexikon der Stadt' },
        { title: 'Wikidata', href: 'https://www.wikidata.org/', note: 'Strukturierte Orts- und Straßendaten' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: q }],
    sources: [
      source('Wikipedia (CC BY-SA 4.0)', 'https://de.wikipedia.org/', 'CC BY-SA 4.0'),
      source('Wikimedia Commons', 'https://commons.wikimedia.org/', 'Je Datei'),
      source('K10plus (SRU)', 'https://sru.k10plus.de/', 'Metadaten'),
    ],
    limits: ['Die Geosuche ist keine etymologische Quelle.', 'Straßennamen können umbenannt oder mehrfach vergeben sein.'],
  });
}

export async function denkmalErklaerer(params) {
  const p = await resolvePlace(params);
  const [art, commons, wiki] = await Promise.allSettled([
    runSource('api-wikidata-kunst'),
    runSource('api-commons-geosuche', { lat: p.lat, lon: p.lon }),
    runSource('api-wikipedia-geosuche', { lat: p.lat, lon: p.lon }),
  ]);
  const artItems = art.status === 'fulfilled' ? nearbyItems(art.value.items ?? [], p.lat, p.lon) : [];
  const commonsItems = commons.status === 'fulfilled' ? listItems(commons.value.items ?? []) : [];
  const wikiItems = wiki.status === 'fulfilled' ? listItems(wiki.value.items ?? []) : [];
  return report({
    title: 'Denkmäler und öffentliche Kunst',
    subtitle: p.label,
    summary: 'Denkmäler, Gedenkstätten und Kunstwerke in der Nähe – mit Wissensgraph und Bildern.',
    blocks: [
      block.list('Objekte in der Nähe', artItems.slice(0, 10).map((x) => ({ title: x.title, subtitle: `${km(x.distance)} entfernt · ${x.subtitle ?? ''}`, href: x.href, lat: x.lat, lon: x.lon }))),
      block.list('Bilder in der Nähe', commonsItems.slice(0, 8)),
      block.list('Artikel in der Nähe', wikiItems.slice(0, 8)),
      block.text('Einordnung', 'Die Wikidata-Abfrage umfasst öffentliche Kunst, Denkmäler und Gedenktafeln mit Koordinate. Sie ist keine amtliche Denkmalliste; die Einträge werden von der Community gepflegt.'),
    ],
    points: artItems.slice(0, 10).map((x) => ({ lat: x.lat, lon: x.lon, label: x.title })),
    sources: [
      source('Wikidata (CC0)', 'https://www.wikidata.org/', 'CC0 1.0'),
      source('Wikimedia Commons', 'https://commons.wikimedia.org/', 'Je Datei'),
      source('Wikipedia (CC BY-SA 4.0)', 'https://de.wikipedia.org/', 'CC BY-SA 4.0'),
    ],
    limits: ['Keine amtliche Denkmalliste.', 'Standorte können sich durch Umbauten geändert haben.'],
  });
}

export async function baumArten(params) {
  const p = await resolvePlace(params);
  const prof = await import('../../sources/adresse.mjs').then((m) => m.profil(p.lat, p.lon));
  const b = prof.baeume ?? {};
  const top = (b.topArten ?? []).filter((x) => x.art && !/unbekannt/i.test(x.art));
  return report({
    title: 'Baumarten vor Ort',
    subtitle: p.label,
    summary: b.anzahl150m != null ? `${b.anzahl150m} Bäume im 150-Meter-Umkreis; ${top.length ? `häufigste Art: ${top[0].art}` : 'Arten teilweise nicht erfasst'}.` : 'Für diesen Punkt liegen keine Baumdaten vor.',
    facts: [
      { label: 'Bäume im 150-m-Umkreis', value: b.anzahl150m != null ? numDe(b.anzahl150m) : 'keine Angabe' },
      { label: 'Junge Bäume seit 2020', value: b.jungeBaeume150m != null ? numDe(b.jungeBaeume150m) : 'keine Angabe' },
      { label: 'Naturdenkmäler', value: b.naturdenkmaeler != null ? numDe(b.naturdenkmaeler) : 'keine Angabe' },
      { label: 'Ältester Baum', value: b.aeltesterBaum ? `${b.aeltesterBaum.art} (${b.aeltesterBaum.pflanzjahr})` : 'keine Angabe' },
    ],
    blocks: [
      block.facts('Baumbestand', [
        { label: 'Bäume im 150-m-Umkreis', value: b.anzahl150m != null ? numDe(b.anzahl150m) : 'keine Angabe' },
        { label: 'Junge Bäume', value: b.jungeBaeume150m != null ? numDe(b.jungeBaeume150m) : 'keine Angabe' },
        { label: 'Naturdenkmäler', value: b.naturdenkmaeler != null ? numDe(b.naturdenkmaeler) : 'keine Angabe' },
      ]),
      block.list('Häufige Arten', top.map((x) => ({ title: x.art, subtitle: `${x.anzahl} Bäume im Umkreis` }))),
      block.list('Pollenbäume', Object.entries(b.pollenBaeume ?? {}).map(([art, n]) => ({ title: art, subtitle: `${n} Bäume im Umkreis` }))),
      block.text('Was das bedeutet', 'Das Baumkataster erfasst städtische Bäume; private Bäume fehlen. Die Artenangabe ist nicht bei jedem Baum gepflegt. Für Allergiker ist die Zahl der Pollenbäume eine Orientierung, keine medizinische Bewertung.'),
      block.links('Mehr', [
        { title: 'Gieß-Radar', href: '#labor=giess-pate', note: 'Junge Bäume brauchen Wasser' },
        { title: 'Baumkataster der Stadt', href: 'https://www.stuttgart.de/leben/umwelt/stadtgruen/baeume/', note: 'Amtliche Informationen' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [
      source('Landeshauptstadt Stuttgart, Baumkataster (WFS, CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'),
    ],
    limits: ['Nur städtische Bäume; private und nicht kartierte Bäume fehlen.', 'Artangaben können veraltet sein.'],
  });
}

export async function stadtteilErklaert(params) {
  const district = String(params.bezirk ?? '').trim();
  if (!district) throw Object.assign(new Error('Bitte einen Stadtbezirk angeben.'), { status: 400 });
  const { kiezSteckbrief } = await import('./kiez.mjs');
  const base = await kiezSteckbrief({ bezirk: district });
  const { wikiSummary } = await import('../../sources/culture.mjs');
  let summary = null;
  try {
    const r = await wikiSummary(`Stuttgart-${district}`) ?? await wikiSummary(district);
    summary = r?.extract ?? r?.summary ?? null;
  } catch { /* Wikipedia ist optional */ }
  const p = await resolvePlace({ q: `${district}, Stuttgart` });
  const [wiki, commons] = await Promise.allSettled([
    runSource('api-wikipedia-geosuche', { lat: p.lat, lon: p.lon }),
    runSource('api-commons-geosuche', { lat: p.lat, lon: p.lon }),
  ]);
  const wikiItems = wiki.status === 'fulfilled' ? listItems(wiki.value.items ?? []) : [];
  const commonsItems = commons.status === 'fulfilled' ? listItems(commons.value.items ?? []) : [];
  return report({
    title: `Stadtteil in Zahlen: ${base.title.replace(/^Kiez-Steckbrief:\s*/, '')}`,
    subtitle: 'Amtliche Statistik, Wikipedia und Bilder',
    summary: summary ? clean(summary, 500) : base.summary,
    facts: base.facts,
    blocks: [
      ...(summary ? [block.text('Kurzporträt', clean(summary, 1200))] : []),
      ...base.blocks.filter((b) => b.type !== 'text' || !/Einordnung/.test(String(b.title))).slice(0, 2),
      block.list('Artikel in der Nähe', wikiItems.slice(0, 8)),
      block.list('Bilder in der Nähe', commonsItems.slice(0, 8)),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: district }, ...wikiItems.filter((x) => x.lat && x.lon).slice(0, 10).map((x) => ({ lat: x.lat, lon: x.lon, label: x.title }))],
    sources: [
      ...base.sources,
      source('Wikipedia (CC BY-SA 4.0)', 'https://de.wikipedia.org/', 'CC BY-SA 4.0'),
      source('Wikimedia Commons', 'https://commons.wikimedia.org/', 'Je Datei'),
    ],
    limits: ['Der Wikipedia-Text ist eine Community-Quelle, keine amtliche Beschreibung.', 'Die Statistik bezieht sich auf den Stadtbezirk, nicht auf einzelne Quartiere.'],
  });
}

export async function zeitkapsel(params) {
  const p = await resolvePlace(params);
  const [commons, wiki] = await Promise.allSettled([
    runSource('api-commons-geosuche', { lat: p.lat, lon: p.lon }),
    runSource('api-wikipedia-geosuche', { lat: p.lat, lon: p.lon }),
  ]);
  const commonsItems = commons.status === 'fulfilled' ? listItems(commons.value.items ?? []) : [];
  const wikiItems = wiki.status === 'fulfilled' ? listItems(wiki.value.items ?? []) : [];
  const maps = [
    { title: 'Historischer Stadtplan 1914', subtitle: 'OpenData@Stuttgart, Rasterkarte', href: 'https://opendata.stuttgart.de/dataset/historischer-stadtplan-stuttgart-1914' },
    { title: 'Historischer Stadtplan 2008', subtitle: 'OpenData@Stuttgart, Rasterkarte', href: 'https://opendata.stuttgart.de/dataset/historischer-stadtplan-stuttgart-2008' },
    { title: 'Historischer Stadtplan 2021', subtitle: 'OpenData@Stuttgart, Rasterkarte', href: 'https://opendata.stuttgart.de/dataset/historischer-stadtplan-stuttgart-2021' },
    { title: 'Luftbilder 2006–2025', subtitle: 'Stadtmessungsamt, WMS in der App', href: '#modul=wissen&focus=karte' },
  ];
  return report({
    title: 'Zeitkapsel',
    subtitle: p.label,
    summary: 'Historische Karten, Luftbilder und Bilder im Vergleich – ein Blick auf denselben Ort zu verschiedenen Zeiten.',
    blocks: [
      block.list('Karten und Luftbilder', maps),
      block.list('Bilder in der Nähe', commonsItems.slice(0, 10)),
      block.list('Geschichte in der Nähe', wikiItems.slice(0, 8)),
      block.text('So funktioniert der Vergleich', 'Historische Karten sind oft nicht georeferenziert. Die Luftbilder der Stadt sind als WMS eingebunden und lassen sich in der App über die Karte legen; die Jahreswahl zeigt den Wandel. Für exakte Vergleiche die Bildmittelpunkte und Maßstäbe prüfen.'),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }, ...commonsItems.filter((x) => x.lat && x.lon).slice(0, 10).map((x) => ({ lat: x.lat, lon: x.lon, label: x.title }))],
    sources: [source('OpenData@Stuttgart, historische Stadtpläne (CC BY 4.0)', 'https://opendata.stuttgart.de/', 'CC BY 4.0'), source('Landeshauptstadt Stuttgart, Luftbilder (CC BY 4.0)', 'https://geoserver.stuttgart.de/', 'CC BY 4.0'), source('Wikimedia Commons (je Datei)', 'https://commons.wikimedia.org/', 'Je Datei')],
    limits: ['Historische Karten sind nicht immer maßstabsgetreu oder georeferenziert.', 'Die Luftbilder zeigen nicht jedes Jahr.'],
  });
}
