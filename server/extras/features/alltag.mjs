// Alltag und Verwaltung: Abfall, Termine, zuständige Stellen und Transparenz.
import { report, block, source, action, numDe, km, dateDe, haversine } from '../util.mjs';
import { nearest, resolvePlace } from './util.mjs';

export async function abfallKalender(params) {
  const strasse = String(params.strasse ?? '').trim();
  const nr = String(params.nr ?? '').trim();
  if (!strasse || !nr) throw Object.assign(new Error('Bitte Straße und Hausnummer angeben.'), { status: 400 });
  const { abfall } = await import('../../sources/nearby.mjs');
  const a = await abfall(strasse, nr);
  const dates = (a.dates ?? []).filter((x) => x.date >= new Date().toISOString().slice(0, 10)).slice(0, 20);
  const next = dates[0];
  return report({
    title: 'Abfuhrkalender',
    subtitle: `${a.street ?? strasse} ${a.nr ?? nr}`,
    summary: next ? `Nächster Termin: ${next.type} am ${dateDe(next.date)} (${next.rhythm ?? 'Rhythmus unbekannt'}).` : 'Keine kommenden Termine gefunden.',
    facts: [
      { label: 'Nächster Termin', value: next ? `${next.type}` : '–', note: next ? dateDe(next.date) : null },
      { label: 'Weitere Termine', value: String(Math.max(0, dates.length - 1)) },
      { label: 'Adresse', value: `${a.street ?? strasse} ${a.nr ?? nr}` },
    ],
    blocks: [
      block.table('Kommende Termine', ['Datum', 'Abholung', 'Rhythmus'], dates.map((x) => [dateDe(x.date), x.type, x.rhythm ?? '–'])),
      block.text('Was wann gehört', 'Restabfall in die graue Tonne, Bioabfall in die braune Tonne, Altpapier in die blaue Tonne, Gelber Sack für Verpackungen. Sperrmüll und Sonderabfall werden separat angemeldet; Elektrogeräte gehören nicht in den Restabfall.'),
      block.links('Mehr', [
        { title: 'Abfallwirtschaft Stuttgart', href: 'https://www.stuttgart.de/leben/umwelt/abfall/', note: 'Amtliche Informationen und Anmeldung' },
        { title: 'Sperrmüll und Sonderabfall', href: '#labor=sperrmuell-check&ort=' + encodeURIComponent(`${strasse} ${nr}`), note: 'Nächste Annahmestellen' },
      ]),
    ],
    sources: [source('Abfallwirtschaft Stuttgart (AWS), Abfuhrtermine', 'https://www.stuttgart.de/leben/umwelt/abfall/', 'Quellenangabe')],
    limits: ['Termine können sich durch Feiertage, Streik oder Baustellen verschieben; maßgeblich ist der AWS-Kalender.', 'Die Straße wird automatisch normalisiert; bei mehrdeutigen Straßennamen prüfen.'],
  });
}

export async function terminOptimierer(params) {
  const p = await resolvePlace(params);
  const { buergerbueros } = await import('../../sources/nearby.mjs');
  const b = await buergerbueros();
  const items = (b.items ?? []).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon)).map((x) => ({
    ...x, distance: haversine({ lat: p.lat, lon: p.lon }, { lat: x.lat, lon: x.lon }),
  }));
  const sorted = [...items].sort((a, b2) => (a.waitMin ?? 999) - (b2.waitMin ?? 999) || a.distance - b2.distance);
  const nearestOffice = [...items].sort((a, b2) => a.distance - b2.distance)[0];
  const best = sorted.find((x) => x.waitMin != null) ?? sorted[0];
  return report({
    title: 'Termin-Optimierer',
    subtitle: p.label,
    summary: best ? `${best.name}: ${best.waitMin != null ? `${best.waitMin} Minuten Wartezeit` : best.text ?? 'keine Live-Wartezeit'} · ${km(best.distance)} entfernt.` : 'Keine Bürgerbüro-Daten verfügbar.',
    facts: [
      { label: 'Nächstes Bürgerbüro', value: nearestOffice?.name ?? '–', note: nearestOffice ? km(nearestOffice.distance) : null },
      { label: 'Kürzeste Wartezeit', value: best?.waitMin != null ? `${best.waitMin} min` : 'keine Live-Daten', note: best?.name ?? null },
      { label: 'Geöffnet', value: best?.open === true ? 'ja' : best?.open === false ? 'nein' : 'unbekannt' },
    ],
    blocks: [
      block.table('Bürgerbüros', ['Büro', 'Wartezeit', 'Entfernung', 'Hinweis'], sorted.map((x) => [x.name, x.waitMin != null ? `${x.waitMin} min` : x.text ?? '–', km(x.distance), (x.notes ?? []).slice(0, 1).join('')])),
      block.text('Besser planen', 'Die Wartezeiten sind Live-Werte und schwanken. Dienstag- und Donnerstagnachmittag ist oft mehr los; viele Leistungen lassen sich online erledigen. Termine lassen sich über den Buchungslink vereinbaren.'),
      block.links('Mehr', [
        { title: 'Termin buchen', href: 'https://stuttgart.konsentas.de/', note: 'Offizielles Terminportal' },
        { title: 'Verwaltung in der App', href: '#modul=verwaltung&focus=leistung', note: 'Leistungen und Gebäude' },
      ]),
    ],
    points: sorted.slice(0, 8).map((x) => ({ lat: x.lat, lon: x.lon, label: x.name })),
    sources: [source('Landeshauptstadt Stuttgart, Bürgerbüros und Live-Wartezeiten', 'https://www.stuttgart.de/', 'Quellenangabe')],
    limits: ['Live-Wartezeiten sind eine Momentaufnahme und keine garantierte Bearbeitungszeit.', 'Die Anreise kann länger dauern als der Wartezeitvorteil.'],
  });
}

export async function amtFinder(params) {
  const q = String(params.q ?? '').trim();
  if (q.length < 2) throw Object.assign(new Error('Bitte ein Anliegen angeben.'), { status: 400 });
  const { verwaltungSuche } = await import('../../sources/verwaltung.mjs');
  const r = await verwaltungSuche(q);
  const list = r.leistungen ?? r.items ?? [];
  return report({
    title: `Zuständige Stelle: ${q}`,
    subtitle: `${list.length} Leistungen gefunden`,
    summary: list.length ? `Zuerst prüfen: ${list[0].name} (${list[0].zustaendig ?? 'Zuständigkeit unbekannt'}).` : 'Keine passende Leistung gefunden.',
    facts: [
      { label: 'Treffer', value: String(list.length) },
      { label: 'Erste Leistung', value: list[0]?.name ?? '–' },
      { label: 'Zuständig', value: list[0]?.zustaendig ?? '–' },
      { label: 'Online möglich', value: list[0]?.online ? 'ja' : 'nein / unklar' },
    ],
    blocks: [
      block.list('Leistungen', list.slice(0, 12).map((x) => ({ title: x.name, subtitle: [x.zustaendig, x.leika ? `LEIKA ${x.leika}` : null, x.online ? 'online möglich' : null].filter(Boolean).join(' · '), href: x.url, note: x.kurz ? String(x.kurz).slice(0, 200) : null }))),
      block.text('Nächster Schritt', 'Leistung auswählen, Unterlagen prüfen und – wenn möglich – den Online-Dienst nutzen. Für einen Termin vor Ort das Bürgerbüro mit der kürzesten Wartezeit wählen.'),
      block.links('Mehr', [
        { title: 'Leistungen der Stadt', href: 'https://www.stuttgart.de/organigramm/leistungen/', note: 'Amtlicher Leistungskatalog' },
        { title: 'Termin-Optimierer', href: '#labor=termin-optimierer&ort=Stuttgart', note: 'Wartezeiten und Anfahrt' },
      ]),
    ],
    sources: [source('Landeshauptstadt Stuttgart, Leistungskatalog', 'https://www.stuttgart.de/', 'Quellenangabe')],
    limits: ['Die Suche ist eine Volltextsuche über den Leistungskatalog, keine Rechtsberatung.', 'Zuständigkeiten können sich ändern; maßgeblich ist die Leistungsseite.'],
  });
}

export async function ifgRadar() {
  const { fragdenstaat } = await import('../../sources/schnittstellen.mjs');
  const r = await fragdenstaat(50);
  const items = r.items ?? [];
  const counts = new Map();
  for (const x of items) counts.set(x.statusLabel ?? x.status, (counts.get(x.statusLabel ?? x.status) ?? 0) + 1);
  return report({
    title: 'IFG-Radar',
    subtitle: `${r.total ?? items.length} öffentliche Anfragen an die Stadt`,
    summary: 'Was Bürgerinnen und Bürger über Informationsfreiheit erfragen – mit Status und Link zur vollständigen Anfrage.',
    facts: [
      { label: 'Anfragen gesamt', value: String(r.total ?? items.length) },
      { label: 'Status „offen“', value: String([...counts.entries()].filter(([k]) => /wartet|muss/.test(k)).reduce((s, [, v]) => s + v, 0)) },
      { label: 'Beantwortet', value: String([...counts.entries()].filter(([k]) => /Antwort|erledigt|erfolgreich/.test(k)).reduce((s, [, v]) => s + v, 0)) },
    ],
    blocks: [
      block.list('Status', [...counts.entries()].map(([label, n]) => ({ title: label, subtitle: `${n} Anfragen` }))),
      block.list('Anfragen', items.slice(0, 15).map((x) => ({ title: x.title, subtitle: [x.statusLabel, dateDe(x.lastMessage || x.created), x.publicBody].filter(Boolean).join(' · '), href: x.url }))),
      block.text('Was IFG bedeutet', 'Das Informationsfreiheitsgesetz gibt jeder Person einen Anspruch auf Zugang zu amtlichen Informationen. Die Anfragen hier sind öffentlich; Antworten können fehlen oder unvollständig sein.'),
      block.links('Mehr', [
        { title: 'FragDenStaat', href: r.portal ?? 'https://fragdenstaat.de/', note: 'Anfragen stellen und lesen' },
        { title: 'Alle Anfragen als RSS', href: '/api/stadt/fragdenstaat.rss', note: 'Abonnierbarer Feed' },
      ]),
    ],
    sources: [source('FragDenStaat (Open Knowledge Foundation), IFG-Anfragen an die Stadt Stuttgart', 'https://fragdenstaat.de/', 'Quellenangabe')],
    limits: ['Nur öffentliche Anfragen; nicht jede Anfrage ist beantwortet.', 'Die Darstellung ist keine Rechtsberatung.'],
  });
}

export async function dokumentenCheckliste(params) {
  const q = String(params.q ?? '').trim();
  if (q.length < 2) throw Object.assign(new Error('Bitte eine Leistung angeben.'), { status: 400 });
  const { verwaltungSuche, verwaltungLeistung } = await import('../../sources/verwaltung.mjs');
  const s = await verwaltungSuche(q);
  const first = s.leistungen?.[0];
  if (!first) throw Object.assign(new Error('Keine passende Leistung gefunden.'), { status: 404 });
  const d = await verwaltungLeistung(first.url);
  const abschnitte = d.abschnitte ?? {};
  const unterlagen = String(abschnitte['Benötigte Unterlagen'] ?? '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
  return report({
    title: `Dokumenten-Checkliste: ${d.name ?? first.name}`,
    subtitle: [d.zustaendig ?? first.zustaendig, d.leika ? `LEIKA ${d.leika}` : null].filter(Boolean).join(' · '),
    summary: unterlagen.length ? `${unterlagen.length} Unterlagen und ${Object.keys(abschnitte).length} Abschnitte aus dem amtlichen Leistungskatalog.` : 'Der Leistungseintrag enthält keine Liste der Unterlagen.',
    facts: [
      { label: 'Zuständig', value: d.zustaendig ?? first.zustaendig ?? '–' },
      { label: 'Gebühren', value: abschnitte.Gebühren ? String(abschnitte.Gebühren).slice(0, 120) : 'keine Angabe' },
      { label: 'Bearbeitungsdauer', value: abschnitte['Bearbeitungsdauer'] ? String(abschnitte['Bearbeitungsdauer']).slice(0, 120) : 'keine Angabe' },
      { label: 'Online möglich', value: (d.onlineAngebote ?? []).some((x) => /online/i.test(x.art ?? '')) ? 'ja' : 'nicht ausgewiesen' },
    ],
    blocks: [
      block.list('Unterlagen', unterlagen.map((u) => ({ title: u }))),
      ...Object.entries(abschnitte).filter(([k]) => !/Benötigte Unterlagen/i.test(k)).map(([k, v]) => block.text(k, String(v))),
      block.links('Mehr', [
        { title: 'Leistungsseite der Stadt', href: d.url ?? first.url, note: 'Amtliche Quelle' },
        { title: 'Termin buchen', href: d.booking ?? first.booking ?? 'https://stuttgart.konsentas.de/', note: 'Terminportal' },
      ]),
    ],
    sources: [source('Landeshauptstadt Stuttgart, Leistungskatalog', 'https://www.stuttgart.de/', 'Quellenangabe')],
    limits: ['Die Liste ist eine automatische Auslese des Leistungseintrags; maßgeblich ist die verlinkte Seite.', 'Unterlagen können sich ändern.'],
  });
}
