// Werkzeuge für das Erweiterungsprogramm: über 100 Quellen und 100 Stadtlabor-Werkzeuge.
import { featureCatalog, runFeature, runSource, sourceCatalog } from '../../extras/index.mjs';
import { toolError } from '../util.mjs';
import { COORD, defineTool, int, num, obj, str } from './shared.mjs';

const COMMON = {
  ...COORD,
  ort: str('Ort oder Adresse, z. B. „Charlottenplatz“ oder „Stuttgart-Mitte“.', { maxLength: 200 }),
  bezirk: str('Stadtbezirk, z. B. „Mitte“ oder „Bad Cannstatt“.', { maxLength: 80 }),
};

export const laborTools = [
  defineTool({
    name: 'labor_werkzeug',
    title: 'Stadtlabor: 100 Werkzeuge',
    description: 'Führt eines der 100 neuen Stadtlabor-Werkzeuge aus oder durchsucht den Werkzeugkatalog. Werkzeuge beantworten konkrete Fragen: Kiez-Steckbrief, Familien-Check, Adress-Zeugnis, Erdbeben, historische Bilder, Bibliothekssuche, Quellen-Check, Lizenz-Finder, Datenexport und mehr. Jedes Ergebnis nennt Quellen, Lizenz und Grenzen.',
    sources: [],
    cost: 8,
    timeoutMs: 120_000,
    inputSchema: obj({
      werkzeug: str('Werkzeug-ID aus dem Katalog, z. B. „kiez-steckbrief“, „familien-check“, „erdbeben-check“.', { maxLength: 80 }),
      q: str('Freitext, je nach Werkzeug: Stichwort, Straße, Anliegen oder Suchbegriff.', { maxLength: 200 }),
      ...COMMON,
      bezirk2: str('Zweiter Stadtbezirk für „kiez-vergleich“.', { maxLength: 80 }),
      indikator: str('Indikator für Kiez-Werkzeuge, z. B. „einwohner“, „arbeitslosenquote“, „einkommen“.', { maxLength: 80 }),
      quelle: str('Quellen-ID für Datenwerkzeuge, z. B. „ckan-einwohner-altersgruppen“.', { maxLength: 80 }),
      limit: int('Maximale Trefferzahl, wo das Werkzeug sie unterstützt (1–100).', { minimum: 1, maximum: 100, default: 20 }),
      radius: num('Radius in Kilometern, wo das Werkzeug ihn unterstützt.', { minimum: 0.1, maximum: 50 }),
    }),
    async execute(a) {
      if (!a.werkzeug) {
        const cat = featureCatalog();
        const q = String(a.q ?? '').toLowerCase();
        const items = cat.features.filter((f) => !q || `${f.id} ${f.title} ${f.summary} ${f.category}`.toLowerCase().includes(q)).slice(0, 60);
        return {
          data: {
            count: cat.count, live: cat.live, planned: cat.planned,
            categories: cat.categories, werkzeuge: items,
            hinweis: 'Werkzeug-ID auswählen und mit den passenden Parametern erneut aufrufen.',
          },
        };
      }
      const params = { ...a, lat: a.lat, lon: a.lon, r: a.radius != null ? a.radius * 1000 : undefined };
      try {
        const r = await runFeature(a.werkzeug, params);
        return {
          data: {
            id: r.id, title: r.title, subtitle: r.subtitle, summary: r.summary,
            facts: r.facts, blocks: r.blocks, points: r.points,
            sources: r.sources, limits: r.limits, updated: r.updated,
          },
          sources: r.sources,
          limits: r.limits,
        };
      } catch (err) {
        if (err?.status === 404) throw toolError('Unbekanntes Werkzeug. Ohne „werkzeug“ liefert der Aufruf den Katalog.');
        if (err?.status === 501) throw toolError('Dieses Werkzeug ist noch in Vorbereitung. Der Katalog nennt den Status.');
        throw err;
      }
    },
  }),

  defineTool({
    name: 'labor_quelle',
    title: 'Stadtlabor: über 100 Quellen',
    description: 'Durchsucht die über 100 neuen öffentlichen Quellen oder ruft eine Quelle direkt ab: amtliche CKAN-Statistik, Stuttgarter WFS-Layer, LUBW-/LGL-BW-Daten, Erdbeben-, Wetter-, Satelliten-, Kultur- und Wissens-APIs. Jede Antwort nennt Lizenz, Quellenangabe, Abrufzeit und Grenzen.',
    sources: [],
    cost: 6,
    timeoutMs: 90_000,
    inputSchema: obj({
      id: str('Quellen-ID aus dem Katalog, z. B. „ckan-einwohner-altersgruppen“, „lubw-naturschutzgebiet“, „api-emsc-erdbeben“.', { maxLength: 80 }),
      q: str('Stichwort, um Quellen zu suchen (Titel, Lizenz, Typ).', { maxLength: 120 }),
      ...COORD,
      radius: num('Radius in Kilometern für Geo-Quellen.', { minimum: 0.1, maximum: 30 }),
      limit: int('Maximale Zeilen/Objekte (1–200).', { minimum: 1, maximum: 200, default: 20 }),
    }),
    async execute(a) {
      if (!a.id) {
        const cat = sourceCatalog();
        const q = String(a.q ?? '').toLowerCase();
        const list = cat.sources.filter((s) => !q || `${s.id} ${s.title} ${s.summary} ${s.license} ${s.kind}`.toLowerCase().includes(q)).slice(0, 80);
        return { data: { count: cat.count, live: cat.live, quellen: list, hinweis: 'Quellen-ID auswählen und erneut aufrufen.' } };
      }
      try {
        const r = await runSource(a.id, { ...a, r: a.radius != null ? a.radius : undefined, limit: Math.min(a.limit ?? 20, 200) });
        const data = {
          id: r.id, title: r.title, subtitle: r.subtitle, kind: r.kind, license: r.license,
          attribution: r.attribution, sourceUrl: r.sourceUrl, note: r.note, fetchedAt: r.fetchedAt,
          type: r.type, limits: r.limits,
          ...(r.type === 'table' ? { columns: r.columns, rows: (r.rows ?? []).slice(0, 40), rowCount: r.rowCount, totalRows: r.totalRows, dataset: r.dataset } : {}),
          ...(r.type === 'geojson' ? { features: (r.features ?? []).slice(0, 40), featureCount: r.features?.length ?? 0, bbox: r.bbox } : {}),
          ...(r.type === 'points' || r.type === 'json' ? { items: (r.items ?? []).slice(0, 40), points: (r.points ?? []).slice(0, 40) } : {}),
        };
        const limits = [...(r.limits ?? [])];
        if ((r.rows?.length ?? r.items?.length ?? 0) > 40) limits.push('Für die MCP-Antwort auf 40 Einträge gekürzt; die API liefert mehr.');
        return {
          data,
          sources: [{ name: `${r.attribution} – ${r.title}`, url: r.sourceUrl ?? '', license: r.license }],
          limits,
        };
      } catch (err) {
        if (err?.status === 404) throw toolError('Unbekannte Quelle. Ohne „id“ liefert der Aufruf den Katalog.');
        throw err;
      }
    },
  }),
];
