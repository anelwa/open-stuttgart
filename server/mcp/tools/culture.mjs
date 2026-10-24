// Werkzeuge für Termine, Kultur, Mensen, Meldungen und Freizeit.
import { events as cityEvents, places, wikiSummary } from '../../sources/culture.mjs';
import { wasGeht, orte as venueList } from '../../sources/wasgeht/termine.mjs';
import { news as stadtNews } from '../../sources/wasgeht/news.mjs';
import { stadtgedaechtnis } from '../../sources/stadtgedaechtnis.mjs';
import { mensen } from '../../sources/mensa.mjs';
import { geocaches } from '../../sources/geocaching.mjs';
import { baeder } from '../../sources/nearby.mjs';
import { wanderwege } from '../../sources/wanderwege.mjs';
import { bartour, bartouren } from '../../sources/bartouren.mjs';
import { spielRoute, spielRouten } from '../../sources/spiel.mjs';
import { umlandZiel, umlandZiele } from '../../sources/umland.mjs';
import { flug } from '../../sources/flug.mjs';
import { stadtpalais } from '../../sources/stadtpalais.mjs';
import { freizeitRouten } from '../../sources/nearby.mjs';
import { todayBerlin, toolError } from '../util.mjs';
import { rememberEvents } from '../resources.mjs';
import {
  COORD, bool, defineTool, enumStr, int, obj, optionalCenter, str, takeWithNote,
} from './shared.mjs';

const DATE = str('Datum als YYYY-MM-DD; leer = heute (Europe/Berlin).', { maxLength: 10 });


export const cultureTools = [
  defineTool({
    name: 'events',
    title: 'Termine und Was geht',
    description: 'Veranstaltungen in Stuttgart: source="city" ist der städtische Kulturkalender mit Stadtbibliothek, Stuttgart-Marketing und VfB-Heimspielen; source="scene" ist „Was geht“ mit Clubs, Bühnen, Hochschulen, Kollektiven und offenen Registern. Filter nach Tag, Abend, Wochenende, Szene (konzert, party, comedy, hochschule, flohmarkt, popup, kneipe, buehne, jugend, sonstiges), jungem Publikum, kostenlos und Höchstpreis. Jeder Termin nennt Quelle und Link.',
    sources: ['veranstaltungen', 'stadtmarketing', 'stadtbibliothek', 'szene', 'gancio'],
    cost: 4,
    timeoutMs: 90_000,
    inputSchema: obj({
      date: DATE,
      source: enumStr('Kalender oder Szene.', ['scene', 'city', 'all'], { default: 'scene' }),
      span: enumStr('Zeitraum für source="scene": Tag, Abend oder Wochenende.', ['tag', 'abend', 'wochenende'], { default: 'tag' }),
      scene: str('Szene(n), kommasepariert, z. B. „konzert,party“ oder „comedy“.', { maxLength: 120 }),
      audience: enumStr('Publikum.', ['alle', 'jung'], { default: 'alle' }),
      free: bool('Nur kostenlose Termine.', { default: false }),
      max_price: int('Höchstpreis in Euro (nur wenn bekannt).', { minimum: 0, maximum: 500 }),
      limit: int('Maximale Anzahl Termine je Quelle (1–50).', { minimum: 1, maximum: 50, default: 15 }),
    }),
    async execute(a) {
      const limit = a.limit ?? 15;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(a.date ?? '') ? a.date : todayBerlin();
      const errors = [];
      const out = {};
      if (a.source === 'city' || a.source === 'all') {
        try {
          const r = await cityEvents(date);
          rememberEvents(r.events ?? []);
          const { shown, limits } = takeWithNote(r.events ?? [], limit, 'Termine');
          out.city = { ...r, events: shown };
          errors.push(...limits);
        } catch (err) {
          errors.push(`Städtischer Kalender: ${err.message}`);
          out.city = { date, events: [], error: err.message };
        }
      }
      if (a.source === 'scene' || a.source === 'all') {
        try {
          const r = await wasGeht({
            tag: date,
            span: a.span,
            szene: a.scene,
            jung: a.audience === 'jung',
            free: a.free,
            maxPrice: a.max_price,
          });
          rememberEvents(r.events ?? []);
          const { shown, limits } = takeWithNote(r.events ?? [], limit, 'Termine');
          out.scene = { ...r, events: shown };
          errors.push(...limits);
        } catch (err) {
          errors.push(`Was geht: ${err.message}`);
          out.scene = { date, events: [], error: err.message };
        }
      }
      return {
        data: { date, ...out },
        limits: [...errors, 'Angaben ohne Gewähr; maßgeblich ist der Veranstalter bzw. die verlinkte Quelle.'],
      };
    },
  }),

  defineTool({
    name: 'places',
    title: 'Sehenswürdigkeiten',
    description: 'Rund 260 Museen, Bühnen, Aussichtspunkte, Parks, Denkmäler und Kirchen in Stuttgart aus Wikidata, mit Koordinaten, kurzem Wikipedia-Text, Bild und Artikel. Optional nach Art (museum, buehne, aussicht, gruen, kirche, denkmal) und Name filtern. Für einen einzelnen Ort wiki mit dem Titel aufrufen.',
    sources: ['wikidata', 'wikipedia', 'commons'],
    cost: 3,
    timeoutMs: 60_000,
    inputSchema: obj({
      kind: enumStr('Art.', ['all', 'museum', 'buehne', 'aussicht', 'gruen', 'kirche', 'denkmal'], { default: 'all' }),
      q: str('Namensfilter, z. B. „Schloss“ oder „Wilhelma“.', { maxLength: 120 }),
      limit: int('Maximale Anzahl Orte (1–100).', { minimum: 1, maximum: 100, default: 25 }),
    }),
    async execute(a) {
      const r = await places();
      let items = r.places ?? [];
      if (a.kind && a.kind !== 'all') items = items.filter((p) => p.kind === a.kind);
      if (a.q) {
        const q = a.q.toLowerCase();
        items = items.filter((p) => `${p.name} ${p.description ?? ''}`.toLowerCase().includes(q));
      }
      const { shown, limits } = takeWithNote(items, a.limit ?? 25, 'Orte');
      return { data: { ...r, places: shown, gesamt: items.length }, limits };
    },
  }),

  defineTool({
    name: 'wiki',
    title: 'Wikipedia-Kurztext',
    description: 'Liefert die Zusammenfassung eines deutschsprachigen Wikipedia-Artikels mit Link, Bild und Lizenz. Nützlich für Sehenswürdigkeiten, Stadtteile, Bauwerke und Persönlichkeiten. Titel wie in der Wikipedia, z. B. „Stuttgarter Schlossplatz“ oder „Wilhelma“.',
    sources: ['wikipedia'],
    cost: 1,
    inputSchema: obj({
      title: str('Wikipedia-Titel oder Stichwort.', { maxLength: 200 }),
    }, ['title']),
    async execute(a) {
      const r = await wikiSummary(a.title);
      if (!r?.extract) throw toolError(`Kein Wikipedia-Artikel zu „${a.title}“ gefunden.`);
      return { data: r };
    },
  }),

  defineTool({
    name: 'umland',
    title: 'Ausflugsziele im Umland',
    description: 'Kuratierte Ausflugsziele in der Region Stuttgart: Schlösser, Burgen, Klöster, Museen, Altstädte, Natur, Seen, Weinorte und Thermen. Ohne id eine Liste mit Filtern nach Kategorie, Landkreis, Stichwort, Nähe und Familiengeeignetheit; mit id der Steckbrief inklusive nächster VVS-Haltestelle, Wetter am Ziel und Wikipedia-Kurztext. Deckt die Landkreise Böblingen, Esslingen, Göppingen, Ludwigsburg und den Rems-Murr-Kreis ab.',
    sources: ['Ausflugsziele im Umland (redaktionell)', 'VVS-Fahrplan', 'Wikipedia', 'Wikimedia Commons', 'Open-Meteo', 'OpenStreetMap'],
    cost: 2,
    timeoutMs: 45_000,
    inputSchema: obj({
      id: str('ID eines Ziels für den Steckbrief, z. B. „ebnisee“ oder „residenzschloss-ludwigsburg“.', { maxLength: 120 }),
      kategorie: enumStr('Kategorie.', ['alle', 'schloss', 'kloster', 'museum', 'stadt', 'natur', 'see', 'wein', 'therme'], { default: 'alle' }),
      kreis: enumStr('Landkreis.', ['alle', 'Böblingen', 'Esslingen', 'Göppingen', 'Ludwigsburg', 'Rems-Murr-Kreis'], { default: 'alle' }),
      q: str('Stichwort in Name, Kurztext, Gemeinde oder Kreis, z. B. „Schloss“ oder „See“.', { maxLength: 120 }),
      ...COORD,
      radius_m: int('Radius um lat/lon in Metern (1.000–120.000).', { minimum: 1000, maximum: 120000, default: 50000 }),
      familie: bool('Nur Ziele, die für Familien geeignet sind.', { default: false }),
      limit: int('Maximale Anzahl Ziele (1–60).', { minimum: 1, maximum: 60, default: 20 }),
    }),
    async execute(a) {
      if (a.id) {
        const detail = await umlandZiel(String(a.id), { lat: a.lat, lon: a.lon });
        return { data: detail, limits: ['Öffnungszeiten, Preise und Zugänglichkeit vor dem Besuch prüfen; das Wetter ist eine Modellvorhersage.'] };
      }
      const r = umlandZiele({
        kategorie: a.kategorie, kreis: a.kreis, q: a.q, lat: a.lat, lon: a.lon,
        r: a.radius_m, familie: a.familie, limit: a.limit,
      });
      const { shown, limits } = takeWithNote(r.items, a.limit ?? 20, 'Ziele');
      return { data: { ...r, items: shown }, limits: [...limits, 'Die Auswahl ist redaktionell und nicht vollständig; maßgeblich sind die Angaben der Anbieter.'] };
    },
  }),

  defineTool({
    name: 'mensa',
    title: 'Mensen und Tagesgerichte',
    description: 'Tagesgerichte der sechs Stuttgarter Mensen mit Studierenden- und Gästepreis, vegan/vegetarisch und Allergenen. Datum als YYYY-MM-DD; leer = heute. Beispiele: „Universität Stuttgart“, „Hochschule der Medien“.',
    sources: ['openmensa'],
    cost: 2,
    timeoutMs: 30_000,
    inputSchema: obj({
      date: DATE,
    }),
    async execute(a) {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(a.date ?? '') ? a.date : todayBerlin();
      return { data: await mensen(d), limits: ['Speisepläne können sich kurzfristig ändern; maßgeblich ist die Mensa vor Ort.'] };
    },
  }),

  defineTool({
    name: 'news',
    title: 'Meldungen und Stadtgedächtnis',
    description: 'Aktuelle Meldungen aus offenen Feeds (Stadt Stuttgart, Feuerwehr, SWR, Polizei, Bundespolizei, Kessel.TV) und/oder das Stadtgedächtnis mit amtlichen Bekanntmachungen, neuen OpenStreetMap-Orten und Änderungen an Verwaltungsseiten. source="feeds" (Standard), "memory" oder "both"; Filter nach Thema und Stadtbezirk, Zeitraum in Tagen.',
    sources: ['stuttgart', 'osm', 'szene'],
    cost: 2,
    timeoutMs: 45_000,
    inputSchema: obj({
      source: enumStr('Quelle.', ['feeds', 'memory', 'both'], { default: 'feeds' }),
      topic: str('Thema, z. B. verkehr, kultur, verwaltung, blaulicht oder ein Stichwort.', { maxLength: 80 }),
      district: str('Stadtbezirk oder Stadtteil, z. B. „Mitte“, „Degerloch“.', { maxLength: 80 }),
      days: int('Zeitraum in Tagen (1–90).', { minimum: 1, maximum: 90, default: 14 }),
      limit: int('Maximale Anzahl Einträge (1–60).', { minimum: 1, maximum: 60, default: 20 }),
    }),
    async execute(a) {
      const out = {};
      const limits = [];
      if (a.source === 'feeds' || a.source === 'both') {
        try {
          out.feeds = await stadtNews({ topic: a.topic, district: a.district, limit: a.limit ?? 20, days: a.days ?? 14 });
        } catch (err) {
          limits.push(`Meldungen: ${err.message}`);
          out.feeds = { items: [], error: err.message };
        }
      }
      if (a.source === 'memory' || a.source === 'both') {
        try {
          out.memory = await stadtgedaechtnis({ days: a.days ?? 14, district: a.district, topic: a.topic, limit: a.limit ?? 20 });
        } catch (err) {
          limits.push(`Stadtgedächtnis: ${err.message}`);
          out.memory = { items: [], error: err.message };
        }
      }
      return { data: out, limits };
    },
  }),

  defineTool({
    name: 'leisure',
    title: 'Freizeit, Wandern, Bars, Geocaching',
    description: 'Freizeitangebote und kuratierte Routen: kind="hiking" ausgeschilderte Wanderwege (Blaustrümpflerweg, Weinwanderwege, HW5 …) mit Länge, Höhenmetern und Haltestellen; "freizeit" Weinwanderwege, Innenstadtrundweg und Downhill; "bar_tours" sieben kuratierte Bar-Touren (optional id); "geocaches" Opencaching.de im Umkreis; "pools" Besucherzahlen der Bäder; "flights" Luftfahrzeuge, ISS, Wetterballons und Mondphase; "stadtpalais" Programm und Ausstellungen; "game" Stadtspiel-Routen; "venues" Veranstaltungsorte.',
    sources: ['stuttgartGeo', 'osm', 'opencaching', 'adsb', 'wheretheiss', 'stadtpalais'],
    cost: 4,
    timeoutMs: 60_000,
    inputSchema: obj({
      kind: enumStr('Angebot.', ['hiking', 'freizeit', 'bar_tours', 'geocaches', 'pools', 'flights', 'stadtpalais', 'game', 'venues'], { default: 'hiking' }),
      id: str('ID für eine einzelne Bar-Tour oder Spiel-Route.', { maxLength: 80 }),
      address: str('Nähe zu dieser Adresse (geocaches); alternativ lat/lon.', { maxLength: 200 }),
      ...COORD,
      radius: int('Umkreis in Metern für Geocaches (500–20000).', { minimum: 500, maximum: 20000, default: 5000 }),
      limit: int('Maximale Anzahl Einträge (1–50).', { minimum: 1, maximum: 50, default: 12 }),
    }),
    async execute(a) {
      const limit = a.limit ?? 12;
      switch (a.kind) {
        case 'hiking': {
          const r = await wanderwege();
          return { data: { ...r, items: (r.items ?? []).slice(0, limit) } };
        }
        case 'freizeit': {
          const r = await freizeitRouten();
          return { data: { ...r, items: (r.items ?? []).slice(0, limit) } };
        }
        case 'bar_tours': {
          if (a.id) {
            const t = bartour(a.id);
            if (!t) throw toolError(`Bar-Tour „${a.id}“ nicht gefunden.`);
            return { data: t };
          }
          const r = await bartouren();
          return { data: { ...r, items: (r.items ?? []).slice(0, limit) } };
        }
        case 'geocaches': {
          const center = await optionalCenter({ lat: a.lat, lon: a.lon, near: a.address }) ?? { lat: 48.7758, lon: 9.1829 };
          return { data: await geocaches({ lat: center.lat, lon: center.lon, r: a.radius ?? 5000, limit }) };
        }
        case 'pools': {
          const r = await baeder();
          return { data: { ...r, items: (r.items ?? []).slice(0, limit) }, limits: ['Besucherzahlen melden nur geöffnete Bäder.'] };
        }
        case 'flights':
          return { data: await flug(), limits: ['ADS-B ist eine Community-Quelle, keine amtliche Flugverkehrsdaten; Positionen können fehlen.'] };
        case 'stadtpalais':
          return { data: await stadtpalais() };
        case 'game': {
          if (a.id) return { data: await spielRoute(a.id) };
          const r = await spielRouten();
          return { data: { ...r, routes: (r.routes ?? []).slice(0, limit) } };
        }
        case 'venues': {
          const r = venueList();
          return { data: { orte: (r ?? []).slice(0, limit), gesamt: r?.length ?? 0 } };
        }
        default:
          throw toolError('Unbekanntes Freizeitangebot.');
      }
    },
  }),
];
