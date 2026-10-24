// Teilen, Sprache und Zugang: QR-Schild, Kiosk, Embed, Feeds, Webhook,
// Social-Post, Vorlesen und Leichte Sprache.
import { report, block, source, action, clean } from '../util.mjs';
import { resolvePlace } from './util.mjs';

const PUBLIC_ORIGIN = process.env.OS_PUBLIC_ORIGIN ?? 'https://openstuttgart.de';

async function featureText(id, params = {}) {
  const { FEATURE_BY_ID } = await import('./registry.mjs');
  if (!FEATURE_BY_ID.has(id)) return null;
  const { runFeature } = await import('./index.mjs');
  return runFeature(id, params);
}

export async function vorlesen(params) {
  const input = String(params.text ?? '').trim();
  if (!input) throw Object.assign(new Error('Bitte Text oder eine Werkzeug-ID angeben.'), { status: 400 });
  const { FEATURE_BY_ID } = await import('./registry.mjs');
  if (FEATURE_BY_ID.has(input)) {
    const meta = FEATURE_BY_ID.get(input);
    let r = null;
    try { r = await featureText(input, params); } catch { /* Pflichtfelder fehlen – Kurzfassung aus dem Register */ }
    if (r) {
      const text = `${r.title}. ${r.summary} ${(r.facts ?? []).map((f) => `${f.label}: ${f.value}.`).join(' ')}`;
      return report({
        title: `Vorlesen: ${r.title}`,
        subtitle: 'Text zur Sprachausgabe',
        summary: 'Der Text ist für die Browser-Sprachausgabe aufbereitet. Es werden keine Audiodaten gespeichert.',
        blocks: [block.text('Vorlesetext', clean(text, 3000)), block.list('Inhalt', (r.blocks ?? []).filter((b) => b.type === 'text').map((b) => ({ title: b.title, subtitle: clean(b.text, 220) })))],
        sources: r.sources,
        speech: clean(text, 3000),
        limits: ['Die Sprachausgabe hängt vom Browser und der installierten Stimme ab.', 'Keine Cloud, keine Speicherung.'],
      });
    }
    return report({
      title: `Vorlesen: ${meta.title}`,
      subtitle: 'Kurzfassung aus dem Werkzeugkatalog',
      summary: 'Für dieses Werkzeug fehlen noch Eingaben. Die Kurzbeschreibung kann trotzdem vorgelesen werden.',
      blocks: [block.text('Vorlesetext', `${meta.title}. ${meta.summary}`)],
      sources: [source('Open Stuttgart, Werkzeugkatalog', '/api/labor/werkzeuge', 'EUPL-1.2')],
      speech: `${meta.title}. ${meta.summary}`,
      limits: ['Für ein vollständiges Ergebnis das Werkzeug mit seinen Eingaben öffnen.'],
    });
  }
  return report({
    title: 'Vorlesen',
    subtitle: 'Freier Text',
    summary: 'Der eingegebene Text kann direkt vorgelesen werden.',
    blocks: [block.text('Text', clean(input, 3000))],
    sources: [source('Open Stuttgart, Vorlesen (Web Speech API im Browser)', '/', 'EUPL-1.2')],
    speech: clean(input, 3000),
    limits: ['Der Text wird nicht gespeichert.', 'Die Stimme wird vom Browser bereitgestellt.'],
  });
}

export async function leichteSprache(params) {
  const input = String(params.text ?? '').trim();
  if (!input) throw Object.assign(new Error('Bitte Text oder eine Werkzeug-ID angeben.'), { status: 400 });
  let title = 'Leichte Sprache';
  let short = '';
  let facts = [];
  let sources = [];
  const { FEATURE_BY_ID } = await import('./registry.mjs');
  if (FEATURE_BY_ID.has(input)) {
    const meta = FEATURE_BY_ID.get(input);
    let r = null;
    try { r = await featureText(input, params); } catch { /* Pflichtfelder fehlen */ }
    if (r) {
      title = `Leichte Sprache: ${r.title}`;
      facts = (r.facts ?? []).slice(0, 6);
      short = [
        r.summary,
        ...facts.map((f) => `${f.label}: ${String(f.value).replace(/\./g, ',')}.`),
        'Die Angaben kommen aus offenen Daten. Sie können sich ändern.',
      ].join(' ');
      sources = r.sources ?? [];
    } else {
      title = `Leichte Sprache: ${meta.title}`;
      short = `${meta.title}. ${meta.summary} Für ein vollständiges Ergebnis das Werkzeug mit seinen Eingaben öffnen.`;
      sources = [source('Open Stuttgart, Werkzeugkatalog', '/api/labor/werkzeuge', 'EUPL-1.2')];
    }
  } else {
    short = clean(input, 2000);
  }
  return report({
    title,
    subtitle: 'Kurze Sätze, klare Wörter',
    summary: 'Derselbe Inhalt in Leichter Sprache. Zahlen und Quellen bleiben erhalten.',
    blocks: [
      block.text('In Leichter Sprache', short),
      block.list('Wichtige Angaben', facts.map((f) => ({ title: String(f.label), subtitle: String(f.value) }))),
      block.text('Hinweis', 'Leichte Sprache folgt eigenen Regeln (kurze Sätze, bekannte Wörter, ein Gedanke pro Satz). Diese automatische Fassung ist ein Angebot, kein geprüfter Text.'),
    ],
    sources,
    speech: short,
    limits: ['Automatisch vereinfacht; keine geprüfte Leichte-Sprache-Fassung.', 'Fachbegriffe können vereinfacht oder weggelassen sein.'],
  });
}

export async function qrSchild(params) {
  const p = await resolvePlace(params);
  const title = String(params.titel ?? '').trim() || `Open Stuttgart · ${p.label}`;
  const target = `${PUBLIC_ORIGIN}/#labor=adress-zeugnis&ort=${encodeURIComponent(p.label)}`;
  const QRCode = (await import('qrcode')).default;
  const dataUrl = await QRCode.toDataURL(target, { margin: 1, width: 640, color: { dark: '#26262C', light: '#FFFFFF' } });
  return report({
    title: 'QR-Schild',
    subtitle: title,
    summary: 'Ein druckfertiger QR-Code führt direkt zum Adress-Zeugnis dieses Ortes.',
    facts: [
      { label: 'Ziel', value: p.label },
      { label: 'Link', value: target },
      { label: 'Format', value: 'PNG, 640 × 640 px, hohe Fehlerkorrektur' },
    ],
    blocks: [
      { type: 'image', title: 'QR-Code', src: dataUrl, alt: `QR-Code zu ${p.label}` },
      block.text('Drucken', 'Den QR-Code herunterladen, auf ein DIN-A6-Schild drucken und am Ort anbringen. Der Link bleibt gültig, solange die App unter dieser Adresse erreichbar ist.'),
      block.links('Weiter', [
        { title: 'Adress-Zeugnis öffnen', href: `#labor=adress-zeugnis&ort=${encodeURIComponent(p.label)}` },
        { title: 'Schild in der App drucken', href: '#modul=wissen&focus=ausgabe', note: 'Druckfunktion mit QR-Code' },
      ]),
    ],
    points: [{ lat: p.lat, lon: p.lon, label: p.label }],
    sources: [source('Open Stuttgart, QR-Schild', '/', 'EUPL-1.2')],
    limits: ['Der QR-Code enthält keine personenbezogenen Daten.', 'Die Zielseite muss öffentlich erreichbar sein.'],
  });
}

export async function kioskBuilder(params) {
  const p = await resolvePlace(params);
  const base = `${PUBLIC_ORIGIN}/?display=kiosk`;
  return report({
    title: 'Kiosk-Builder',
    subtitle: p.label,
    summary: 'Eine öffentliche Bildschirmansicht mit Wetter, Wartezeiten, Terminen und Parken – ohne Bedienelemente.',
    facts: [
      { label: 'Kiosk-Link', value: base },
      { label: 'Ort', value: p.label },
      { label: 'Rotation', value: 'alle 12 Sekunden' },
    ],
    blocks: [
      block.links('Links', [
        { title: 'Kiosk-Modus öffnen', href: base, note: 'Für Bürgerbüros, Bibliotheken und Hochschulen' },
        { title: 'Kiosk mit Karte', href: `${base}#karte=13/${p.lat.toFixed(4)}/${p.lon.toFixed(4)}`, note: 'Startausschnitt am Ort' },
        { title: 'Normale Ansicht', href: `${PUBLIC_ORIGIN}/`, note: 'Zum Vergleich' },
      ]),
      block.text('Einrichten', 'Browser im Vollbild/Kiosk-Modus starten, Bildschirmschoner deaktivieren, Link als Startseite setzen. Die Ansicht benötigt keine Anmeldung und speichert keine personenbezogenen Daten.'),
    ],
    sources: [source('Open Stuttgart, Kiosk-Modus', '/', 'EUPL-1.2')],
    limits: ['Die Kiosk-Ansicht zeigt keine individuellen Daten.', 'Für den Betrieb ist ein dauerhaft erreichbarer Browser nötig.'],
  });
}

export async function embedWidget(params) {
  const url = String(params.url ?? '').trim();
  if (!url) throw Object.assign(new Error('Bitte eine URL angeben, z. B. https://openstuttgart.de/?display=kiosk'), { status: 400 });
  const safe = url.replace(/"/g, '&quot;');
  const snippet = `<iframe src="${safe}" title="Open Stuttgart" width="100%" height="640" style="border:0;border-radius:16px" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
  return report({
    title: 'Embed-Widget',
    subtitle: 'Einbettung für Vereins- oder Schulseiten',
    summary: 'Ein iframe-Schnipsel, der eine Karte, den Kiosk oder eine Ansicht einbettet.',
    blocks: [{ type: 'text', title: 'Schnipsel', text: snippet }, block.text('Hinweis', 'Die eingebettete Seite bleibt unter der Kontrolle von Open Stuttgart. Keine personenbezogenen Daten, keine Werbung. Für Barrierefreiheit einen aussagekräftigen Titel setzen.')],
    sources: [source('Open Stuttgart, Embed', '/', 'EUPL-1.2')],
    limits: ['Die Zielseite muss iframe-Einbettung erlauben.', 'Keine Anpassung von Farben oder Inhalten.'],
  });
}

const FEEDS = [
  { title: 'Was geht (iCal)', href: '/api/wasgeht.ics', note: 'Termine als Kalenderabo', tags: ['termin', 'kultur', 'was geht', 'ical'] },
  { title: 'Stadtgedächtnis (RSS)', href: '/api/stadtgedaechtnis.rss', note: 'Meldungen, Bekanntmachungen, OSM-Orte', tags: ['stadt', 'news', 'rss'] },
  { title: 'FragDenStaat (RSS)', href: '/api/stadt/fragdenstaat.rss', note: 'IFG-Anfragen an die Stadt', tags: ['transparenz', 'ifg', 'rss'] },
  { title: 'Stadt-Layer (RSS)', href: '/api/stadt/wfs.rss?layer=GEOLINE_FLEX:A62_BRU_BRUNNEN_Brunnen_in_Betr_EPSG25832', note: 'WFS-Layer als Feed', tags: ['wfs', 'layer', 'rss'] },
  { title: 'Archiv (CSV)', href: '/api/archiv', note: 'Besucherzahlen und Wartezeiten', tags: ['archiv', 'csv'] },
  { title: 'Unfallatlas (JSON)', href: '/api/unfaelle', note: 'Unfälle mit Personenschaden', tags: ['unfall', 'verkehr', 'json'] },
  { title: 'Pünktlichkeit (JSON)', href: '/api/puenktlichkeit', note: 'Pünktlichkeit der letzten Stunde', tags: ['verkehr', 'puenktlichkeit'] },
  { title: 'Warnungen (JSON)', href: '/api/warnungen', note: 'BBK NINA/MoWaS', tags: ['warnung', 'nina'] },
];

export async function rssBuilder(params) {
  const q = String(params.q ?? '').trim().toLowerCase();
  const feeds = q ? FEEDS.filter((f) => `${f.title} ${f.note} ${f.tags.join(' ')}`.toLowerCase().includes(q)) : FEEDS;
  return report({
    title: q ? `RSS-Feeds zu „${q}“` : 'RSS- und Datenfeeds',
    subtitle: `${feeds.length} Feeds`,
    summary: 'Stabile Endpunkte zum Abonnieren oder Weiterverarbeiten.',
    blocks: [
      block.list('Feeds', feeds.map((f) => ({ title: f.title, subtitle: `${f.note} · ${f.href}`, href: f.href }))),
      block.text('Filter', 'Viele Endpunkte akzeptieren Filter, z. B. `/api/wasgeht.ics?date=2026-10-24` oder `/api/stadt/wfs.rss?layer=…`. Die Filter stehen in der README und in der API-Dokumentation.'),
    ],
    sources: [source('Open Stuttgart, Feeds', '/', 'EUPL-1.2')],
    limits: ['Feeds sind read-only und ohne Anmeldung.', 'Bitte Fair-Use beachten; keine Massenabrufe.'],
  });
}

export async function icalBuilder(params) {
  const q = String(params.q ?? '').trim().toLowerCase();
  const feeds = FEEDS.filter((f) => /ical|kalender|termin/i.test(`${f.title} ${f.note} ${f.tags.join(' ')}`));
  const chosen = q ? feeds.filter((f) => `${f.title} ${f.note}`.toLowerCase().includes(q)) : feeds;
  return report({
    title: q ? `iCal zu „${q}“` : 'iCal-Export',
    subtitle: `${chosen.length} Kalender`,
    summary: 'Termine als Kalenderdatei abonnieren oder herunterladen.',
    blocks: [
      block.list('Kalender', chosen.map((f) => ({ title: f.title, subtitle: f.note, href: f.href }))),
      block.text('Abo einrichten', 'Die URL in Kalender-App als „Abo“ oder „Internet-Kalender“ hinzufügen. Die App aktualisiert den Feed regelmäßig; Änderungen erscheinen beim nächsten Abruf.'),
    ],
    sources: [source('Open Stuttgart, iCal', '/', 'EUPL-1.2')],
    limits: ['Nur Termine, die die App kennt.', 'Keine Einladungen, keine Erinnerungen.'],
  });
}

export async function webhookBuilder(params) {
  const q = String(params.q ?? '').trim() || 'stuttgart';
  const slug = q.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const topic = `open-stuttgart-${slug}-${Math.abs([...q].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))}`;
  return report({
    title: 'Webhook & ntfy',
    subtitle: topic,
    summary: 'Benachrichtigungen ohne App: ntfy-Topic abonnieren oder einen Webhook einrichten.',
    facts: [
      { label: 'Topic', value: topic },
      { label: 'ntfy-URL', value: `https://ntfy.sh/${topic}` },
      { label: 'Thema', value: q },
    ],
    blocks: [
      block.links('Abonnieren', [
        { title: 'ntfy-Topic öffnen', href: `https://ntfy.sh/${topic}`, note: 'Im Browser oder in der ntfy-App abonnieren' },
        { title: 'ntfy-App', href: 'https://ntfy.sh/', note: 'Open Source, selbst hostbar' },
      ]),
      block.text('Wie es funktioniert', 'Ein Publisher sendet eine HTTP-POST an `https://ntfy.sh/<topic>`. Abonnenten erhalten die Nachricht auf Smartphone oder Desktop. Für Open Stuttgart ist noch kein automatischer Publisher eingerichtet; der Kanal ist eine dokumentierte Möglichkeit, keine bestehende Zusage.'),
      block.text('Datenschutz', 'Topics sind öffentlich, wenn sie nicht durch einen Zugang geschützt sind. Keine personenbezogenen Daten in Topic oder Nachricht schreiben. Für den Betrieb einen eigenen ntfy-Server erwägen.'),
    ],
    sources: [source('ntfy (Open Source)', 'https://ntfy.sh/', 'Apache-2.0 / selbst hostbar')],
    limits: ['Kein automatischer Versand eingerichtet.', 'Öffentliche Topics sind einsehbar.'],
  });
}

export async function socialPost(params) {
  const q = String(params.q ?? '').trim();
  if (!q) throw Object.assign(new Error('Bitte ein Thema oder eine Quellen-ID angeben.'), { status: 400 });
  const { findSources } = await import('./daten.mjs');
  const matches = findSources(q);
  const s = matches[0] ?? null;
  const text = s
    ? `${s.title}: ${s.summary} Quelle: ${s.attribution}. ${s.url} #OpenData #Stuttgart`
    : `${q} – Open Stuttgart, offene Daten der Landeshauptstadt. https://openstuttgart.de/ #OpenData #Stuttgart`;
  return report({
    title: 'Social-Post',
    subtitle: s ? s.title : q,
    summary: 'Ein fertiger Beitrag mit Quellenangabe und Lizenzhinweis.',
    blocks: [
      block.text('Beitrag', clean(text, 1200)),
      block.text('Alt-Text', clean(`${s ? s.title : q}. ${s ? s.summary : 'Offene Daten der Landeshauptstadt Stuttgart.'}`, 400)),
      block.links('Quelle', s ? [{ title: s.title, href: s.url, note: s.license }] : [{ title: 'Open Stuttgart', href: 'https://openstuttgart.de/' }]),
    ],
    sources: s ? [source(`${s.attribution} – ${s.title}`, s.url, s.license)] : [],
    speech: clean(text, 1200),
    limits: ['Kein automatisches Posten; Text kopieren und selbst veröffentlichen.', 'Lizenz und Quellenangabe vor dem Posten prüfen.'],
  });
}
