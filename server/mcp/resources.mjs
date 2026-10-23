// MCP-Ressourcen: Katalog, Abdeckung, Lizenzen, WFS-Layer sowie einzelne Termine,
// Leistungen, Kontakte, Dokumente und Haltestellen. Ressourcen sind read-only.
import { COVERAGE, LIMITS } from './coverage.mjs';
import { LICENSE_LIST } from './sources.mjs';
import { CACHE, ERROR, SERVER_VERSION, SUPPORTED_VERSIONS, modernResult } from './protocol.mjs';
import { McpError, todayBerlin } from './util.mjs';
import { kontaktDetail } from '../sources/kontakte.mjs';
import { documentDetail } from '../sources/search.mjs';
import { verwaltungLeistung } from '../sources/verwaltung.mjs';
import { wfsKatalog } from '../sources/schnittstellen.mjs';
import { departures } from '../sources/efa.mjs';
import { events as cityEvents } from '../sources/culture.mjs';
import { wasGeht } from '../sources/wasgeht/termine.mjs';
import { resolveStop } from './tools/shared.mjs';

const JSON_MIME = 'application/json';

/** Zuletzt von Werkzeugen gesehene Termine, damit `stuttgart://event/{id}` schnell auflöst. */
const eventCache = new Map();

export function rememberEvents(items = []) {
  for (const e of items) {
    if (e?.id) eventCache.set(String(e.id), { ...e, _cachedAt: new Date().toISOString() });
  }
  if (eventCache.size > 2000) {
    for (const key of [...eventCache.keys()].slice(0, 500)) eventCache.delete(key);
  }
}

const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function findEvent(id) {
  const cached = eventCache.get(String(id));
  if (cached) return cached;
  const today = todayBerlin();
  for (let i = 0; i < 14; i += 1) {
    const date = addDays(today, i);
    try {
      const r = await cityEvents(date);
      rememberEvents(r.events ?? []);
      const hit = eventCache.get(String(id));
      if (hit) return hit;
    } catch { /* nächster Tag */ }
  }
  // Szene-Termine sind teurer; nur heute und morgen nachsehen.
  for (let i = 0; i < 2; i += 1) {
    const date = addDays(today, i);
    try {
      const r = await wasGeht({ tag: date });
      rememberEvents(r.events ?? []);
      const hit = eventCache.get(String(id));
      if (hit) return hit;
    } catch { /* nächster Tag */ }
  }
  return null;
}

function content(uri, data, cacheTtlMs = CACHE.liveResource) {
  return {
    contents: [{ uri, mimeType: JSON_MIME, text: JSON.stringify(data, null, 2) }],
    ttlMs: cacheTtlMs,
    cacheScope: 'public',
  };
}

export function createResources({ tools, prompts }) {
  const resources = [
    {
      uri: 'stuttgart://catalog',
      name: 'Werkzeugkatalog',
      title: 'Werkzeug-, Ressourcen- und Prompt-Katalog',
      description: 'Alle Werkzeuge mit JSON-Schema, alle Ressourcen und Prompts sowie Version und Grenzen des Servers.',
      mimeType: JSON_MIME,
    },
    {
      uri: 'stuttgart://coverage',
      name: 'Datenabdeckung',
      title: 'Datenabdeckung',
      description: 'Welche Domäne live, zwischengespeichert, gemischt, nur verlinkt oder gar nicht verfügbar ist.',
      mimeType: JSON_MIME,
    },
    {
      uri: 'stuttgart://licenses',
      name: 'Quellen und Lizenzen',
      title: 'Quellen- und Lizenzregister',
      description: 'Alle Datenquellen mit Lizenz, Link und Hinweis zur Weiterverwendung.',
      mimeType: JSON_MIME,
    },
    {
      uri: 'stuttgart://layers',
      name: 'WFS-Layer',
      title: 'WFS-Layer des Stadtmessungsamts',
      description: 'Der vollständige Katalog der rund 458 Stadt-Layer mit Freigabestatus und Bounding-Box.',
      mimeType: JSON_MIME,
    },
  ];

  const resourceTemplates = [
    {
      uriTemplate: 'stuttgart://layer/{name}',
      name: 'Stadt-Layer',
      title: 'Metadaten eines WFS-Layers',
      description: 'Name aus stuttgart://layers oder wfs_catalog, z. B. stuttgart://layer/GEOLINE_FLEX:A12_GBE_WAHLLOKALE_EPSG25832.',
      mimeType: JSON_MIME,
    },
    {
      uriTemplate: 'stuttgart://service/{id}',
      name: 'Verwaltungsleistung',
      title: 'Leistung mit Ablauf, Gebühren und Stellen',
      description: 'Leistungs-ID oder URL aus search_stuttgart bzw. services.',
      mimeType: JSON_MIME,
    },
    {
      uriTemplate: 'stuttgart://event/{id}',
      name: 'Termin',
      title: 'Einzelner Termin',
      description: 'Termin-ID aus events. Der Server löst sie aus dem Zwischenspeicher oder dem Kalender der nächsten 14 Tage auf.',
      mimeType: JSON_MIME,
    },
    {
      uriTemplate: 'stuttgart://contact/{id}',
      name: 'Kontakt',
      title: 'Kontakt mit Telefon, Zeiten und Leistungen',
      description: 'Kontakt-ID aus contacts oder search_stuttgart.',
      mimeType: JSON_MIME,
    },
    {
      uriTemplate: 'stuttgart://document/{id}',
      name: 'Dokument',
      title: 'Dokument oder Seite',
      description: 'Dokument-ID aus search_stuttgart.',
      mimeType: JSON_MIME,
    },
    {
      uriTemplate: 'stuttgart://stop/{id}',
      name: 'Haltestelle',
      title: 'Haltestelle mit nächsten Abfahrten',
      description: 'EFA-ID (de:08111:6115) oder Haltestellenname, z. B. stuttgart://stop/Charlottenplatz.',
      mimeType: JSON_MIME,
    },
  ];

  async function read(uri) {
    let u;
    try { u = new URL(String(uri)); } catch { throw new McpError(`Ungültige Ressourcen-URI: ${uri}`, { code: ERROR.INVALID_PARAMS, status: 400 }); }
    if (u.protocol !== 'stuttgart:') throw new McpError(`Unbekanntes Schema: ${u.protocol}`, { code: ERROR.INVALID_PARAMS, status: 400 });
    const host = u.hostname;
    const rest = u.pathname.split('/').filter(Boolean).map((x) => decodeURIComponent(x));
    const name = rest.join('/');

    if (host === 'catalog' && !name) {
      return content(uri, {
        name: 'Open Stuttgart',
        version: SERVER_VERSION,
        supportedVersions: SUPPORTED_VERSIONS,
        tools: tools.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: t.annotations,
          cost: t.cost,
        })),
        resources,
        resourceTemplates,
        prompts: prompts.map((p) => ({ name: p.name, title: p.title, description: p.description, arguments: p.arguments })),
        limits: LIMITS,
      }, CACHE.list);
    }
    if (host === 'coverage' && !name) return content(uri, { ...COVERAGE, limits: LIMITS }, CACHE.liveResource);
    if (host === 'licenses' && !name) return content(uri, { sources: LICENSE_LIST, note: 'Quellenangabe und Lizenz je Datensatz beachten; einzelne Quellen können strengere Bedingungen haben.' }, CACHE.staticResource);
    if (host === 'layers' && !name) {
      const r = await wfsKatalog();
      return content(uri, r, CACHE.staticResource);
    }
    if (host === 'layer' && name) {
      const r = await wfsKatalog();
      const layer = r.layers.find((l) => l.name === name);
      if (!layer) throw new McpError(`Layer „${name}“ nicht im Katalog.`, { code: ERROR.INVALID_PARAMS, status: 404 });
      return content(uri, { ...layer, source: r.source, hinweis: r.hinweis }, CACHE.staticResource);
    }
    if (host === 'service' && name) {
      try {
        return content(uri, await verwaltungLeistung(name), CACHE.staticResource);
      } catch (err) {
        throw new McpError(`Leistung „${name}“ nicht gefunden (${err.message}).`, { code: ERROR.INVALID_PARAMS, status: 404 });
      }
    }
    if (host === 'event' && name) {
      const event = await findEvent(name);
      if (!event) throw new McpError(`Termin „${name}“ nicht gefunden. IDs stammen aus events; der Zwischenspeicher hält die zuletzt gesehenen Termine.`, { code: ERROR.INVALID_PARAMS, status: 404 });
      return content(uri, event, CACHE.liveResource);
    }
    if (host === 'contact' && name) {
      const hit = kontaktDetail(name);
      if (!hit) throw new McpError(`Kontakt „${name}“ nicht gefunden.`, { code: ERROR.INVALID_PARAMS, status: 404 });
      return content(uri, hit, CACHE.staticResource);
    }
    if (host === 'document' && name) {
      const hit = documentDetail(name);
      if (!hit) throw new McpError(`Dokument „${name}“ nicht gefunden.`, { code: ERROR.INVALID_PARAMS, status: 404 });
      return content(uri, hit, CACHE.staticResource);
    }
    if (host === 'stop' && name) {
      const stop = await resolveStop(name);
      const d = await departures(stop.id);
      return content(uri, { ...d, stop: { ...d.stop, name: d.stop?.name ?? stop.name } }, 20_000);
    }
    throw new McpError(`Unbekannte Ressource: ${uri}`, { code: ERROR.INVALID_PARAMS, status: 404 });
  }

  return { resources, resourceTemplates, read };
}

export function resourceResult(modern, result) {
  return modern ? modernResult(result, { cacheTtlMs: result.ttlMs ?? CACHE.liveResource, cacheScope: 'public' }) : result;
}
