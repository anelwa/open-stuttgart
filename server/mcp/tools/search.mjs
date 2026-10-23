// Werkzeuge für Suche, Dokumente, Kontakte und offene Kataloge.
import {
  documentDetail, related, search, suggest, SEARCH_TYPES,
} from '../../sources/search.mjs';
import {
  kontaktDetail, kontakteSuche, kontakteStats, KONTAKT_GRUPPEN,
} from '../../sources/kontakte.mjs';
import {
  bibliothek, dcatKatalog, fragdenstaat, komunis, komunisDoc, stadtKatalog, wikidataGaps,
} from '../../sources/schnittstellen.mjs';
import { beteiligungen, bebauungsplaene, wahlergebnisse } from '../../sources/beteiligung.mjs';
import { toolError } from '../util.mjs';
import {
  COORD, bool, defineTool, enumStr, int, obj, resolvePlace, str,
} from './shared.mjs';

const SEARCH_TYPE_VALUES = ['all', ...Object.keys(SEARCH_TYPES)];
const CONTACT_KINDS = ['notruf', 'notdienst', 'beratung', 'technik', 'tier', 'behoerde', 'buergerbuero', 'bildung', 'dienststelle'];
const CONTACT_GROUPS = Object.keys(KONTAKT_GRUPPEN);

export const searchTools = [
  defineTool({
    name: 'search_stuttgart',
    title: 'Alles durchsuchen',
    description: 'Volltextsuche über Seiten, Leistungen, Dienststellen, Online-Dienste, Dokumente und Kontakte der Landeshauptstadt Stuttgart (lokale SQLite/FTS5-Datenbank, rund 10.300 Einträge). Ohne Suchbegriff kommen die zuletzt geänderten Dokumente. Mit mode="suggest" nur Titelvorschläge für die Autovervollständigung. Beispiele: „Personalausweis verlängern“, „Hund anmelden“, „Sperrmüll“, „Ausländerbehörde“.',
    sources: ['stuttgart'],
    cost: 1,
    inputSchema: obj({
      q: str('Suchbegriffe, Alltagssprache ist in Ordnung.', { maxLength: 200 }),
      type: enumStr('Nur diesen Dokumenttyp durchsuchen.', SEARCH_TYPE_VALUES, { default: 'all' }),
      mode: enumStr('search = Volltext, suggest = kurze Titelliste.', ['search', 'suggest'], { default: 'search' }),
      limit: int('Maximale Anzahl Treffer (1–50).', { minimum: 1, maximum: 50, default: 15 }),
      offset: int('Treffer ab dieser Position (Pagination, 0–2000).', { minimum: 0, maximum: 2000, default: 0 }),
    }),
    async execute(a) {
      const type = a.type && a.type !== 'all' ? a.type : null;
      if (a.mode === 'suggest') {
        const r = suggest(a.q);
        return { data: r, sources: [{ name: 'Landeshauptstadt Stuttgart, stuttgart.de', url: 'https://www.stuttgart.de/', license: 'Quellenangabe' }] };
      }
      const r = search({ q: a.q, type, limit: a.limit, offset: a.offset });
      return {
        data: r,
        limits: [r.total === 0 ? 'Keine Treffer. Andere Schreibweise oder Alltagsbegriff versuchen.' : null],
      };
    },
  }),

  defineTool({
    name: 'get_document',
    title: 'Dokument oder Leistungsseite lesen',
    description: 'Liest einen Treffer aus search_stuttgart vollständig: Zusammenfassung, Text, Leistungsablauf, Unterlagen, Gebühren, Zuständigkeit, Bezugsquellen, Backlinks und verwandte Dokumente. Die ID stammt aus search_stuttgart (Feld id). Beispiele: eine Leistungsseite zum Personalausweis oder eine Dienststelle.',
    sources: ['stuttgart'],
    cost: 2,
    inputSchema: obj({
      id: int('Dokument-ID aus search_stuttgart.', { minimum: 1 }),
      include_related: bool('Verwandte Dokumente mitliefern (Standard true).', { default: true }),
    }, ['id']),
    async execute(a) {
      const doc = documentDetail(a.id);
      if (!doc) throw toolError(`Dokument ${a.id} nicht gefunden. Die ID muss aus search_stuttgart stammen.`);
      const rel = a.include_related === false ? null : related(a.id);
      return {
        data: { ...doc, ...(rel ? { related: rel.items } : {}) },
        limits: doc.chunks?.length >= 12 ? ['Der Text ist auf die ersten Abschnitte gekürzt; die vollständige Seite ist verlinkt.'] : [],
      };
    },
  }),

  defineTool({
    name: 'contacts',
    title: 'Kontakte und Notdienste',
    description: 'Durchsucht das Kontaktregister der Stadt Stuttgart (rund 5.400 Dienststellen, Beratungs- und Notdienste) mit Telefon, E-Mail, Adresse, Öffnungszeiten und Leistungen. Ohne Suchbegriff stehen Notrufe und die wichtigsten Dienste oben. Mit id wird ein einzelner Kontakt geladen. Im Notfall gilt immer die 112.',
    sources: ['stuttgart'],
    cost: 1,
    inputSchema: obj({
      q: str('Name, Stichwort oder Leistung, z. B. „Giftnotruf“, „Elternberatung“, „Bürgerbüro West“.', { maxLength: 200 }),
      id: { type: ['string', 'integer'], description: 'Kontakt-ID aus contacts oder search_stuttgart (z. B. „notruf-giftnotruf“ oder 10292).' },
      kind: enumStr('Nur diese Kontaktart.', ['all', ...CONTACT_KINDS], { default: 'all' }),
      gruppe: enumStr('Nur diese Gruppe.', ['all', ...CONTACT_GROUPS], { default: 'all' }),
      limit: int('Maximale Anzahl Treffer (1–100).', { minimum: 1, maximum: 100, default: 20 }),
      offset: int('Treffer ab dieser Position.', { minimum: 0, maximum: 5000, default: 0 }),
      stats: bool('Nur Kennzahlen und Gruppen liefern.', { default: false }),
    }),
    async execute(a) {
      if (a.stats) return { data: kontakteStats() };
      if (a.id) {
        const hit = kontaktDetail(a.id);
        if (!hit) throw toolError(`Kontakt ${a.id} nicht gefunden.`);
        return { data: hit };
      }
      const r = kontakteSuche({
        q: a.q ?? '',
        kind: a.kind && a.kind !== 'all' ? a.kind : null,
        gruppe: a.gruppe && a.gruppe !== 'all' ? a.gruppe : null,
        limit: a.limit,
        offset: a.offset,
      });
      return {
        data: r,
        limits: [r.total === 0 ? 'Keine Treffer. Im Notfall 112 wählen; die Nummer ist unabhängig vom Register.' : null],
      };
    },
  }),

  defineTool({
    name: 'datasets',
    title: 'Offene Daten und Kataloge',
    description: 'Recherchiert in offenen Datenkatalogen und Registern: GovData (Stuttgart-Datensätze), OpenData@Stuttgart (CKAN mit Download-Links), KOMUNIS-Statistik des Statistischen Amts (mit XLSX-Anhängen), Wikidata-Lücken, K10plus-Bibliothekskatalog und FragDenStaat-Anfragen. Quelle „library“ braucht q; „komunis“ navigiert mit start (z. B. „3.1“) oder lädt mit unid ein Dokument.',
    sources: ['govdata', 'opendataStuttgart', 'komunis', 'wikidata', 'k10plus', 'fragdenstaat'],
    cost: 2,
    timeoutMs: 45_000,
    inputSchema: obj({
      source: enumStr('Katalog oder Register.', ['govdata', 'stuttgart', 'komunis', 'wikidata', 'library', 'fragdenstaat'], { default: 'stuttgart' }),
      q: str('Suchbegriff (nur library und optional für andere Quellen).', { maxLength: 200 }),
      start: str('KOMUNIS-Position, z. B. „3.1“ oder „3.1.2“.', { maxLength: 40 }),
      unid: str('KOMUNIS-Dokument-ID für die XLSX-Anhänge.', { maxLength: 60 }),
      limit: int('Maximale Anzahl Einträge (1–100).', { minimum: 1, maximum: 100, default: 25 }),
      status: str('FragDenStaat-Statusfilter, z. B. „awaiting_response“.', { maxLength: 40 }),
    }),
    async execute(a) {
      switch (a.source) {
        case 'govdata': {
          const r = await dcatKatalog();
          return { data: { ...r, items: r.items.slice(0, a.limit ?? 25) } };
        }
        case 'stuttgart': {
          const r = await stadtKatalog();
          return { data: { ...r, items: r.items.slice(0, a.limit ?? 25) } };
        }
        case 'komunis':
          if (a.unid) return { data: await komunisDoc(a.unid) };
          return { data: await komunis(a.start ?? '') };
        case 'wikidata':
          return { data: await wikidataGaps() };
        case 'library':
          if (!a.q) throw toolError('Für source="library" wird q benötigt, z. B. „Stadtgeschichte Stuttgart“.');
          return { data: await bibliothek(a.q) };
        case 'fragdenstaat':
          return { data: await fragdenstaat(a.limit ?? 20, a.status ?? '') };
        default:
          throw toolError('Unbekannte Quelle.');
      }
    },
  }),

  defineTool({
    name: 'participation',
    title: 'Beteiligung, Bebauungspläne und Wahlen',
    description: 'Zeigt Bebauungspläne und laufende Planauslegungen an einem Ort, Wahlergebnisse je Stadtbezirk (jüngste Wahl) oder die vorhandenen Beteiligungsangebote. Für topic="plans" werden Adresse oder lat/lon benötigt; der Radius ist auf 1.500 m begrenzt.',
    sources: ['stuttgart', 'stuttgartGeo'],
    cost: 3,
    timeoutMs: 45_000,
    inputSchema: obj({
      topic: enumStr('Thema.', ['plans', 'elections', 'procedures'], { default: 'plans' }),
      address: str('Adresse für topic="plans", z. B. „Marienplatz 1“.', { maxLength: 200 }),
      ...COORD,
      radius: int('Radius in Metern für Bebauungspläne (20–1500, Standard 300).', { minimum: 20, maximum: 1500, default: 300 }),
      district: str('Stadtbezirk für topic="elections", z. B. „Mitte“ oder „Bad Cannstatt“.', { maxLength: 80 }),
    }),
    async execute(a) {
      if (a.topic === 'elections') return { data: await wahlergebnisse(a.district ?? '') };
      if (a.topic === 'procedures') return { data: await beteiligungen() };
      let center = null;
      if (Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lon))) center = { lat: Number(a.lat), lon: Number(a.lon) };
      else if (a.address) center = await resolvePlace(a.address);
      if (!center) throw toolError('Für Bebauungspläne bitte address oder lat/lon angeben.');
      return { data: await bebauungsplaene(center.lat, center.lon, a.radius ?? 300) };
    },
  }),
];
