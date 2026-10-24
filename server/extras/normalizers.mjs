// Normalisierer für die externen Quellen. Sie machen aus sehr unterschiedlichen
// Antwortformaten eine gemeinsame, kleine Liste (Titel, Zeit, Link, Koordinate) und
// behalten die Rohdaten nur dort, wo sie für ein Werkzeug gebraucht werden.
import { fetchJson } from '../cache.mjs';
import { clean, geometryCenter, parseNum } from './util.mjs';

const item = (title, extra = {}) => ({ title: clean(title, 220), ...extra });
const parseCoord = (value) => {
  const m = /Point\(([-0-9.]+) ([-0-9.]+)\)/.exec(String(value ?? ''));
  return m ? { lon: +m[1], lat: +m[2] } : null;
};
const dateOf = (value) => {
  if (!value) return null;
  if (typeof value === 'number' || /^\d{12,}$/.test(String(value))) {
    const ms = Number(value) < 1e12 ? Number(value) * 1000 : Number(value);
    const d = new Date(ms);
    return Number.isNaN(+d) ? null : d.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(+d) ? null : d.toISOString();
};

function eq(value) {
  return value == null ? null : String(value);
}

export const NORMALIZERS = {
  emsc(j) {
    const items = (j.features ?? []).map((f) => {
      const p = f.properties ?? {};
      const [lon, lat] = f.geometry?.coordinates ?? [];
      return item(`M ${Number(p.mag).toFixed(1)} · ${p.place ?? 'Erdbeben'}`, {
        subtitle: dateOf(p.time),
        date: dateOf(p.time),
        href: p.url ?? null,
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        badge: 'Erdbeben',
        extra: { magnitude: p.mag, depth: p.depth, region: p.flynn_region ?? null },
      });
    }).filter((x) => x.date);
    return { items, json: { count: items.length }, limits: ['Nur Ereignisse ab Magnitude 1,5 im Fenster 46,5–50,5° N / 6,5–11,5° O.'] };
  },

  usgs(j) {
    const items = (j.features ?? []).map((f) => {
      const p = f.properties ?? {};
      const [lon, lat] = f.geometry?.coordinates ?? [];
      return item(`M ${Number(p.mag).toFixed(1)} · ${p.place ?? 'Erdbeben'}`, {
        subtitle: dateOf(p.time),
        date: dateOf(p.time),
        href: p.url ?? null,
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        badge: 'USGS',
        extra: { magnitude: p.mag, depth: f.geometry?.coordinates?.[2] ?? null },
      });
    });
    return { items, json: { count: items.length } };
  },

  openMeteoDaily(j) {
    const d = j.daily ?? {};
    const rows = (d.time ?? []).map((t, i) => ({
      Datum: t,
      'Max °C': d.temperature_2m_max?.[i] ?? null,
      'Min °C': d.temperature_2m_min?.[i] ?? null,
      'Regen mm': d.precipitation_sum?.[i] ?? null,
    }));
    return {
      items: rows.slice(0, 31).map((r) => item(`Wetter am ${r.Datum}`, { subtitle: `${r['Min °C']}–${r['Max °C']} °C · ${r['Regen mm']} mm`, date: r.Datum, badge: 'Open-Meteo' })),
      rows, columns: Object.keys(rows[0] ?? {}), json: { timezone: j.timezone ?? null },
    };
  },

  openMeteoFlood(j) {
    const d = j.daily ?? {};
    const rows = (d.time ?? []).map((t, i) => ({
      Datum: t,
      'Abfluss m³/s': d.river_discharge?.[i] ?? null,
      'Mittel m³/s': d.river_discharge_mean?.[i] ?? null,
    }));
    return {
      items: rows.map((r) => item(`Abfluss am ${r.Datum}`, { subtitle: `${r['Abfluss m³/s']} m³/s`, date: r.Datum, badge: 'GloFAS' })),
      rows, columns: Object.keys(rows[0] ?? {}),
      limits: ['Modellwert (GloFAS), kein amtlicher Pegel. Maßgeblich ist PEGELONLINE.'],
    };
  },

  openMeteoAir(j) {
    const h = j.hourly ?? {};
    const rows = (h.time ?? []).slice(0, 72).map((t, i) => ({
      Zeit: t,
      'AQI (EU)': h.european_aqi?.[i] ?? null,
      'PM2,5 µg/m³': h.pm2_5?.[i] ?? null,
      'PM10 µg/m³': h.pm10?.[i] ?? null,
    }));
    return {
      items: rows.slice(0, 12).map((r) => item(`Luftqualität ${r.Zeit.slice(11)}`, { subtitle: `EU-AQI ${r['AQI (EU)']} · PM2,5 ${r['PM2,5 µg/m³']} µg/m³`, date: r.Zeit, badge: 'CAMS' })),
      rows, columns: Object.keys(rows[0] ?? {}),
      limits: ['Modellprognose, kein amtlicher Messwert. Amtliche Werte liefert das UBA.'],
    };
  },

  openMeteoClimate(j) {
    const d = j.daily ?? {};
    const years = new Map();
    (d.time ?? []).forEach((t, i) => {
      const y = t.slice(0, 4);
      const cur = years.get(y) ?? { Jahr: y, 'Max °C': 0, 'Min °C': 0, 'Regen mm': 0, n: 0 };
      cur['Max °C'] += Number(d.temperature_2m_max?.[i] ?? 0);
      cur['Min °C'] += Number(d.temperature_2m_min?.[i] ?? 0);
      cur['Regen mm'] += Number(d.precipitation_sum?.[i] ?? 0);
      cur.n++;
      years.set(y, cur);
    });
    const rows = [...years.values()].map((y) => ({
      Jahr: y.Jahr,
      'Max °C': +(y['Max °C'] / y.n).toFixed(1),
      'Min °C': +(y['Min °C'] / y.n).toFixed(1),
      'Regen mm': +y['Regen mm'].toFixed(0),
    }));
    return { items: rows.map((r) => item(`Klimamodell ${r.Jahr}`, { subtitle: `${r['Min °C']}–${r['Max °C']} °C · ${r['Regen mm']} mm`, badge: 'CMIP6' })), rows, columns: Object.keys(rows[0] ?? {}) };
  },

  metNo(j) {
    const series = j.properties?.timeseries ?? [];
    const items = series.slice(0, 24).map((s) => {
      const d = s.data?.instant?.details ?? {};
      const next = s.data?.next_1_hours?.details ?? {};
      return item(new Date(s.time).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' }), {
        subtitle: `${Math.round(d.air_temperature)} °C · ${next.precipitation_amount ?? 0} mm · Wind ${Math.round((d.wind_speed ?? 0) * 3.6)} km/h`,
        date: s.time, badge: 'MET Norway',
      });
    });
    return { items, json: { updated: j.properties?.meta?.updated_at ?? null }, limits: ['Modellvorhersage; maßgeblich sind die amtlichen DWD-Warnungen.'] };
  },

  rainviewer(j) {
    const frames = [...(j.radar?.past ?? []), ...(j.radar?.nowcast ?? [])];
    const items = frames.slice(-12).map((f) => item(new Date(f.time * 1000).toLocaleString('de-DE'), {
      subtitle: 'Radarbild verfügbar', date: new Date(f.time * 1000).toISOString(), badge: 'Radar',
      extra: { path: f.path },
    }));
    return { items, json: { host: j.host, generated: j.generated }, limits: ['Radar nur als Bild; keine amtliche Warnung.'] };
  },

  transitous(j) {
    const itineraries = [...(j.direct ?? []), ...(j.itineraries ?? [])].slice(0, 5);
    const items = itineraries.map((it) => {
      const legs = it.legs ?? [];
      const modes = [...new Set(legs.map((l) => l.mode).filter(Boolean))].join(', ');
      const depart = legs[0]?.from?.departure ?? it.startTime;
      const arrive = legs.at(-1)?.to?.arrival ?? it.endTime;
      return item(`${depart?.slice(11, 16) ?? '?'} → ${arrive?.slice(11, 16) ?? '?'} · ${Math.round((it.duration ?? 0) / 60)} min`, {
        subtitle: `${it.transfers ?? Math.max(0, legs.length - 1)} Umstiege · ${modes}`,
        date: depart, badge: 'Transitous',
      });
    });
    return { items, json: { itineraries: itineraries.length }, limits: ['Open-Source-Routing; keine Garantie für Anschlüsse.'] };
  },

  tle(text) {
    const lines = String(text).trim().split(/\r?\n/);
    const rows = [];
    for (let i = 0; i + 2 < lines.length; i += 3) {
      rows.push({ name: lines[i].trim(), line1: lines[i + 1].trim(), line2: lines[i + 2].trim() });
    }
    return {
      items: rows.map((r) => item(r.name, { subtitle: r.line2.slice(0, 60), badge: 'TLE' })),
      rows, columns: ['name', 'line1', 'line2'],
      limits: ['TLE-Bahndaten veralten; für Überflüge nur wenige Tage im Voraus rechnen.'],
    };
  },

  gibs(text) {
    const layers = [];
    for (const m of String(text).matchAll(/<Layer>([\s\S]*?)<\/Layer>/g)) {
      const b = m[1];
      const title = /<ows:Title[^>]*>([\s\S]*?)<\/ows:Title>/.exec(b)?.[1] ?? /<Title[^>]*>([\s\S]*?)<\/Title>/.exec(b)?.[1];
      const id = /<ows:Identifier[^>]*>([\s\S]*?)<\/ows:Identifier>/.exec(b)?.[1] ?? /<Identifier[^>]*>([\s\S]*?)<\/Identifier>/.exec(b)?.[1];
      if (id && title) layers.push({ id, title });
      if (layers.length >= 80) break;
    }
    return { items: layers.map((l) => item(l.title, { subtitle: l.id, badge: 'NASA GIBS' })), json: { layers: layers.length }, limits: ['Nur die ersten 80 Ebenen werden gelistet.'] };
  },

  eonet(j) {
    const items = (j.events ?? []).map((e) => {
      const geo = e.geometry?.at(-1);
      const point = geo?.type === 'Point' ? { lon: geo.coordinates[0], lat: geo.coordinates[1] } : geometryCenter(geo);
      return item(e.title ?? 'Naturereignis', {
        subtitle: [e.categories?.[0]?.title, dateOf(geo?.date)].filter(Boolean).join(' · '),
        date: dateOf(geo?.date), href: e.sources?.[0]?.url ?? e.link ?? null,
        lat: point?.lat ?? null, lon: point?.lon ?? null, badge: 'EONET',
      });
    });
    return { items, json: { count: items.length } };
  },

  gdacs(text) {
    const items = [];
    for (const m of String(text).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const b = m[1];
      const pick = (tag) => clean(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(b)?.[1] ?? '', 300);
      const title = pick('title');
      if (!title) continue;
      const geo = /<georss:point>([-0-9.]+) ([-0-9.]+)<\/georss:point>/.exec(b);
      items.push(item(title, {
        subtitle: [pick('gdacs:eventtype'), pick('gdacs:alertlevel'), pick('pubDate')].filter(Boolean).join(' · '),
        date: dateOf(pick('pubDate')), href: pick('link'),
        lat: geo ? +geo[1] : null, lon: geo ? +geo[2] : null, badge: 'GDACS',
      }));
    }
    return { items: items.slice(0, 30), json: { count: items.length } };
  },

  async smard(j) {
    const stamps = j.timestamps ?? [];
    if (!stamps.length) return { items: [], json: {} };
    const last = stamps.at(-1);
    let data = null;
    try {
      data = await fetchJson(`https://www.smard.de/app/chart_data/1223/DE/1223_DE_hour_${last}.json`, { timeout: 30_000 });
    } catch { /* Index reicht als Hinweis */ }
    const series = (data?.series ?? []).filter(([, v]) => v != null).slice(-72);
    const rows = series.map(([t, v]) => ({ Zeit: new Date(t).toISOString(), 'MW': +(Number(v) / 1000).toFixed(2) }));
    return {
      items: rows.slice(-24).map((r) => item(`Stromverbrauch ${r.Zeit.slice(11, 16)}`, { subtitle: `${r.MW.toLocaleString('de-DE')} MW`, date: r.Zeit, badge: 'SMARD' })),
      rows, columns: Object.keys(rows[0] ?? {}), json: { stamps: stamps.length },
      limits: ['Gesamtdeutscher Wert; keine regionale Zuordnung.'],
    };
  },

  opensky(j) {
    const rows = (j.states ?? []).map((s) => ({
      icao: s[0], callsign: String(s[1] ?? '').trim(), country: s[2], lon: s[5], lat: s[6],
      altitude: s[7] ?? s[13] ?? null, velocity: s[9] ?? null, heading: s[10] ?? null, onGround: s[8],
    })).filter((r) => !r.onGround && Number.isFinite(r.lat) && Number.isFinite(r.lon));
    return {
      items: rows.slice(0, 40).map((r) => item(r.callsign || r.icao, {
        subtitle: `${r.country ?? ''} · ${r.altitude != null ? `${Math.round(r.altitude)} m` : 'Höhe unbekannt'}`,
        lat: r.lat, lon: r.lon, badge: 'OpenSky',
      })),
      rows: rows.slice(0, 40), columns: Object.keys(rows[0] ?? {}), json: { time: j.time },
      limits: ['Positionen können mehrere Sekunden alt sein; keine Identifikation von Einsatzflügen.'],
    };
  },

  commons(j) {
    const items = (j.query?.geosearch ?? []).map((g) => item(g.title, {
      subtitle: `Datei · ${Math.round(g.dist)} m entfernt`,
      lat: g.lat, lon: g.lon,
      href: `https://commons.wikimedia.org/wiki/${encodeURIComponent(g.title.replace(/ /g, '_'))}`,
      badge: 'Commons',
    }));
    return { items, json: { count: items.length }, limits: ['Fotos und Karten; Rechte je Dateiseite prüfen.'] };
  },

  wikipediaGeo(j) {
    const items = (j.query?.geosearch ?? []).map((g) => item(g.title, {
      subtitle: `${Math.round(g.dist)} m entfernt`,
      lat: g.lat, lon: g.lon,
      href: `https://de.wikipedia.org/wiki/${encodeURIComponent(g.title.replace(/ /g, '_'))}`,
      badge: 'Wikipedia',
    }));
    return { items, json: { count: items.length } };
  },

  pageviews(j) {
    const rows = (j.items ?? []).map((x) => ({ Datum: `${x.timestamp.slice(0, 4)}-${x.timestamp.slice(4, 6)}-${x.timestamp.slice(6, 8)}`, Aufrufe: x.views }));
    return {
      items: rows.slice(-14).map((r) => item(`${r.Aufrufe.toLocaleString('de-DE')} Aufrufe`, { subtitle: r.Datum, date: r.Datum, badge: 'Wikipedia' })),
      rows, columns: ['Datum', 'Aufrufe'],
    };
  },

  wikidataArt(j) {
    const items = (j.results?.bindings ?? []).map((b) => {
      const coord = parseCoord(b.coord?.value);
      const qid = b.item?.value?.split('/').pop() ?? null;
      return item(b.itemLabel?.value ?? qid ?? 'Objekt', {
        subtitle: b.typeLabel?.value ?? 'Kunstwerk / Denkmal',
        lat: coord?.lat ?? null, lon: coord?.lon ?? null,
        href: qid ? `https://www.wikidata.org/wiki/${qid}` : null, badge: 'Wikidata',
      });
    });
    return { items, json: { count: items.length }, limits: ['Wikidata ist eine Community-Datenbank, keine amtliche Denkmalliste.'] };
  },

  openlibrary(j) {
    const items = (j.docs ?? []).map((d) => item(d.title ?? 'Titel unbekannt', {
      subtitle: [d.author_name?.[0], d.first_publish_year].filter(Boolean).join(' · '),
      href: d.key ? `https://openlibrary.org${d.key}` : null,
      date: d.first_publish_year ? `${d.first_publish_year}-01-01` : null, badge: 'Open Library',
    }));
    return { items, json: { total: j.numFound ?? items.length } };
  },

  archive(j) {
    const items = (j.response?.docs ?? []).map((d) => item(d.title ?? d.identifier, {
      subtitle: [d.creator, d.year].filter(Boolean).join(' · '),
      href: `https://archive.org/details/${encodeURIComponent(d.identifier)}`,
      badge: 'Internet Archive',
    }));
    return { items, json: { total: j.response?.numFound ?? items.length } };
  },

  tagesschau(j) {
    const items = (j.news ?? []).slice(0, 30).map((n) => item(n.title ?? 'Meldung', {
      subtitle: [n.topline, n.date ? new Date(n.date).toLocaleString('de-DE') : null].filter(Boolean).join(' · '),
      date: dateOf(n.date),
      href: n.shareURL ?? n.detailsweb ?? n.details ?? null,
      badge: n.ressort ?? 'Nachricht',
    }));
    return { items, json: { count: items.length }, limits: ['Nur Titel und Link; keine Volltexte.'] };
  },

  abgeordnetenwatch(j) {
    const items = (j.data ?? []).map((p) => item(p.label ?? p.label_external_long ?? 'Parlament', {
      subtitle: p.label_external_long ?? p.entity_type ?? null,
      href: p.abgeordnetenwatch_url ?? null,
      badge: 'Abgeordnetenwatch',
    }));
    return { items, json: { total: j.meta?.result?.total ?? items.length } };
  },

  dataEuropa(j) {
    const results = j.result?.results ?? [];
    const items = results.map((r) => item(r.title?.de ?? r.title?.en ?? r.title ?? r.id ?? 'Datensatz', {
      subtitle: [r.catalog?.title?.de ?? r.catalog?.title?.en, r.modified].filter(Boolean).join(' · '),
      date: dateOf(r.modified),
      href: r.resources?.[0]?.access_url ?? (r.id ? `https://data.europa.eu/data/datasets/${encodeURIComponent(r.id)}` : null),
      badge: 'data.europa.eu',
    }));
    return { items, json: { total: j.result?.count ?? items.length } };
  },

  feiertage(j) {
    const rows = Object.entries(j ?? {}).map(([name, v]) => ({ Feiertag: name, Datum: v?.datum ?? null, Hinweis: v?.hinweis ?? null }));
    return {
      items: rows.map((r) => item(r.Feiertag, { subtitle: r.Datum, date: r.Datum, badge: 'Feiertag' })),
      rows, columns: ['Feiertag', 'Datum', 'Hinweis'],
    };
  },

  photon(j) {
    const items = (j.features ?? []).map((f) => {
      const [lon, lat] = f.geometry?.coordinates ?? [];
      const p = f.properties ?? {};
      return item(p.name ?? p.street ?? 'Ort', {
        subtitle: [p.street, p.housenumber, p.postcode, p.city, p.state].filter(Boolean).join(' · '),
        lat: Number.isFinite(lat) ? lat : null, lon: Number.isFinite(lon) ? lon : null,
        badge: p.osm_value ?? 'Photon',
      });
    });
    return { items, json: { count: items.length }, limits: ['OpenStreetMap-basiert; kein amtlicher Geocoder.'] };
  },

  geojsonGeneric(j) {
    const items = (j.features ?? []).map((f) => {
      const c = geometryCenter(f.geometry);
      const p = f.properties ?? {};
      const title = p.name ?? p.NAME ?? p.title ?? p.TITEL ?? p.bezeichnung ?? p.BEZEICHNUNG ?? 'Objekt';
      return item(title, { subtitle: p.description ?? p.BESCHREIBUNG ?? null, lat: c?.lat ?? null, lon: c?.lon ?? null, badge: p.layer ?? null, extra: p });
    });
    return { items, features: j.features ?? [], json: { count: items.length }, limits: ['Ausschnitt; nicht alle Attribute werden angezeigt.'] };
  },

  pvgis(j) {
    const monthly = j.outputs?.monthly?.fixed ?? [];
    const rows = monthly.map((m) => ({ Monat: m.month, 'kWh/kWp': m.E_m, 'Globalstrahlung kWh/m²': m['H(i)_m'] }));
    const total = rows.reduce((s, r) => s + (Number(r['kWh/kWp']) || 0), 0);
    return {
      items: rows.map((r) => item(`Monat ${r.Monat}: ${r['kWh/kWp']} kWh/kWp`, { badge: 'PVGIS' })),
      rows, columns: Object.keys(rows[0] ?? {}),
      json: { yearlyKwhPerKwp: +total.toFixed(0), elevation: j.inputs?.location?.elevation ?? null, database: j.inputs?.meteo_data?.radiation_db ?? null },
      limits: ['Modellwert für 1 kWp, 14 % Systemverlust, optimale Südausrichtung; keine Dachflächenprüfung.'],
    };
  },

  col(j) {
    const items = (j.result ?? j.results ?? []).map((d) => item(d.title ?? d.alias ?? 'Datensatz', {
      subtitle: [d.alias, d.version].filter(Boolean).join(' · '), href: d.url ?? null, badge: 'Catalogue of Life',
    }));
    return { items, json: { count: items.length } };
  },

  sunrise(j) {
    const r = j.results ?? {};
    const rows = [['Sonnenaufgang', r.sunrise], ['Sonnenuntergang', r.sunset], ['Bürgerliche Dämmerung', r.civil_twilight_end], ['Tageslänge (s)', r.day_length]].map(([label, value]) => ({ Zeitpunkt: label, Wert: value }));
    return {
      items: rows.map((x) => item(x.Zeitpunkt, { subtitle: String(x.Wert), badge: 'Sunrise-Sunset' })),
      rows, columns: ['Zeitpunkt', 'Wert'], json: r,
    };
  },

  horizons(j) {
    const text = String(j.result ?? '');
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*\d{4}-[A-Z][a-z]{2}-\d{2}/.test(line)) rows.push({ Zeile: line.trim() });
    }
    return {
      items: rows.slice(0, 10).map((r) => item('Ephemeride', { subtitle: r.Zeile.slice(0, 120), badge: 'JPL Horizons' })),
      rows, columns: ['Zeile'], json: { source: j.signature?.source ?? null },
      limits: ['Geozentrische Ephemeride; keine lokale Sichtbarkeits- oder Wetterprüfung.'],
    };
  },

  crossref(j) {
    const items = (j.message?.items ?? []).map((w) => item(w.title?.[0] ?? 'Werk', {
      subtitle: [w.author?.[0]?.family, w.issued?.['date-parts']?.[0]?.[0]].filter(Boolean).join(' · '),
      href: w.URL ?? (w.DOI ? `https://doi.org/${w.DOI}` : null), badge: 'Crossref',
    }));
    return { items, json: { total: j.message?.['total-results'] ?? items.length } };
  },

  openalex(j) {
    const items = (j.results ?? []).map((w) => item(w.title ?? 'Werk', {
      subtitle: [w.publication_year, w.authorships?.[0]?.author?.display_name].filter(Boolean).join(' · '),
      href: w.doi ?? w.id ?? null, badge: 'OpenAlex',
    }));
    return { items, json: { total: j.meta?.count ?? items.length }, limits: ['Metadaten; Volltexte können kostenpflichtig sein.'] };
  },

  europeana(j) {
    const items = (j.items ?? []).map((o) => item(o.title?.[0] ?? 'Objekt', {
      subtitle: [o.dcCreator?.[0], o.year?.[0], o.dataProvider?.[0]].filter(Boolean).join(' · '),
      href: o.guid ?? o.link ?? null, badge: 'Europeana',
    }));
    return { items, json: { total: j.totalResults ?? items.length }, limits: ['Rechte je Objekt; nicht alle Objekte sind frei nachnutzbar.'] };
  },
};

export { item, dateOf, parseCoord, eq, parseNum };
