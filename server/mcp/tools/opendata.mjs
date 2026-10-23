// Werkzeuge für den WFS-Katalog und freigegebene Stadt-Layer.
import { wfsFeatures, wfsKatalog, wfsRss } from '../../sources/schnittstellen.mjs';
import { toolError } from '../util.mjs';
import {
  COORD, bool, defineTool, int, num, obj, resolvePlace, str, takeWithNote,
} from './shared.mjs';

export const openDataTools = [
  defineTool({
    name: 'wfs_catalog',
    title: 'Stadt-Layer-Katalog',
    description: 'Durchsucht den WFS-Katalog des Stuttgarter Stadtmessungsamts (rund 458 Layer). Zeigt Name, Titel, Kurzbeschreibung, Workspace, CRS, Bounding-Box und ob der Layer als Open Data freigegeben ist. Nur freigegebene Layer dürfen mit wfs_features geladen werden. Suche nach Stichwort, Workspace oder „nur freigegebene“.',
    sources: ['stuttgartGeo'],
    cost: 3,
    timeoutMs: 60_000,
    inputSchema: obj({
      q: str('Stichwort in Name, Titel oder Beschreibung, z. B. „Baum“, „Wahllokal“, „Lärm“.', { maxLength: 120 }),
      workspace: str('Nur diesen Workspace, z. B. „A61“ oder „GEOLINE_FLEX“.', { maxLength: 60 }),
      free_only: bool('Nur als Open Data freigegebene Layer (Standard true).', { default: true }),
      limit: int('Maximale Anzahl Layer (1–100).', { minimum: 1, maximum: 100, default: 40 }),
    }),
    async execute(a) {
      const r = await wfsKatalog();
      let layers = r.layers ?? [];
      if (a.free_only !== false) layers = layers.filter((l) => l.frei);
      if (a.workspace) layers = layers.filter((l) => l.workspace.toLowerCase() === String(a.workspace).toLowerCase());
      if (a.q) {
        const q = a.q.toLowerCase();
        layers = layers.filter((l) => `${l.name} ${l.title} ${l.abstract}`.toLowerCase().includes(q));
      }
      const { shown, limits } = takeWithNote(layers, a.limit ?? 40, 'Layer');
      return {
        data: {
          count: r.count,
          frei: r.frei,
          gefiltert: layers.length,
          workspaces: r.workspaces,
          layers: shown,
          stand: r.stand,
          hinweis: r.hinweis,
          source: r.source,
        },
        limits,
      };
    },
  }),

  defineTool({
    name: 'wfs_features',
    title: 'Stadt-Layer als GeoJSON',
    description: 'Lädt einen freigegebenen WFS-Layer als GeoJSON im Umkreis einer Adresse oder Koordinate (Radius bis 10 km, höchstens 1.000 Objekte). Nur Layer mit „frei“ im Katalog sind erlaubt. Beispiele: Baumkataster, Wahllokale, Spielplätze, Lärmpegel, Bebauungspläne. Liefert Quelle, Lizenz und Bounding-Box.',
    sources: ['stuttgartGeo'],
    cost: 6,
    timeoutMs: 90_000,
    inputSchema: obj({
      layer: str('Layer-Name aus wfs_catalog, z. B. „GEOLINE_FLEX:A12_GBE_WAHLLOKALE_EPSG25832“.', { maxLength: 200 }),
      address: str('Zentrum als Adresse oder Ort; alternativ lat/lon.', { maxLength: 200 }),
      ...COORD,
      radius: num('Radius in Kilometern (0,1–10), Standard 1.', { minimum: 0.1, maximum: 10, default: 1 }),
      limit: int('Maximale Anzahl Objekte (1–1000).', { minimum: 1, maximum: 1000, default: 200 }),
    }, ['layer']),
    async execute(a) {
      let center = null;
      if (Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lon))) center = { lat: Number(a.lat), lon: Number(a.lon) };
      else if (a.address) center = await resolvePlace(a.address);
      else center = { lat: 48.7758, lon: 9.1829 };
      try {
        return { data: await wfsFeatures({ layer: a.layer, lat: center.lat, lon: center.lon, r: a.radius ?? 1, limit: a.limit ?? 200 }) };
      } catch (err) {
        if (err?.status === 403) throw toolError('Dieser Layer ist nicht als Open Data freigegeben. Bitte im wfs_catalog nach freien Layern suchen.');
        if (err?.status === 404) throw toolError('Layer nicht im Katalog. Bitte den exakten Namen aus wfs_catalog verwenden.');
        throw err;
      }
    },
  }),

  defineTool({
    name: 'wfs_feed',
    title: 'Stadt-Layer als RSS',
    description: 'Erzeugt einen RSS-Feed für einen freigegebenen WFS-Layer (Titel, Link, Kurzbeschreibung). Nützlich, um Änderungen in einem Layer zu abonnieren; die eigentlichen Daten liefert wfs_features. Mit layer aus wfs_catalog.',
    sources: ['stuttgartGeo'],
    cost: 4,
    timeoutMs: 60_000,
    inputSchema: obj({
      layer: str('Layer-Name aus wfs_catalog.', { maxLength: 200 }),
    }, ['layer']),
    async execute(a) {
      const xml = await wfsRss({ layer: a.layer });
      return { data: { layer: a.layer, format: 'RSS 2.0', xml }, hint: 'XML kann direkt weitergegeben oder in einen Feed-Reader übernommen werden.' };
    },
  }),
];
