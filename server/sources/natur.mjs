// Stadt-Natur im Kessel: Gieß-Radar für junge Bäume, Pollen-Hotspots aus dem Baumkataster der Stadt
// und Artenbeobachtungen der iNaturalist-Community (Fotos cc0 / cc-by / cc-by-sa).
// Baumkataster und Brunnen: Landeshauptstadt Stuttgart (CC BY 4.0), Niederschlag: DWD über Bright Sky,
// Pollenflug: DWD (partregion 112 „Württembergischer Wald“), Beobachtungen: iNaturalist (CC BY 4.0).
import { cached, fetchJson } from '../cache.mjs';

const wfsUrl = (ws) => `https://geoserver.stuttgart.de/geoserver/${ws}/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326`;

/** Merkmale einer Ebene in einem Quadrat von 2r Metern um den Punkt (sortierbar, z. B. nach Pflanzjahr). */
async function box(layer, lat, lon, r, count = 400, ws = 'GEOLINE_FLEX', suffix = '_EPSG25832', sortBy = null) {
  const dLat = r / 111_320; const dLon = r / (111_320 * Math.cos((lat * Math.PI) / 180));
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((x) => x.toFixed(6)).join(',');
  const sort = sortBy ? `&sortBy=${encodeURIComponent(sortBy)}` : '';
  const j = await fetchJson(`${wfsUrl(ws)}&typeNames=${ws}:${layer}${suffix}&count=${count}${sort}&bbox=${bbox},urn:ogc:def:crs:EPSG::4326`, { timeout: 25000 });
  return j.features ?? [];
}

const R = 6371000;
const dist = (a, b) => {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180; const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const point = (g) => (g?.type === 'Point' ? g.coordinates : g?.type === 'MultiPoint' ? g.coordinates[0] : null);
const pflanzjahr = (v) => {
  const y = Number(String(v ?? '').trim());
  return Number.isFinite(y) && y > 1750 && y <= new Date().getFullYear() ? y : null;
};
const berlinDate = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d);

// ---------- Niederschlag der letzten sieben Tage (DWD über Bright Sky) ----------
async function regen(lat, lon) {
  const { value } = await cached(`regen7-${lat.toFixed(3)}-${lon.toFixed(3)}`, 60 * 60_000, async () => {
    const from = berlinDate(new Date(Date.now() - 7 * 86400_000));
    const to = berlinDate();
    const d = await fetchJson(`https://api.brightsky.dev/weather?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&date=${from}&last_date=${to}`, { timeout: 25000 });
    const hours = d.weather ?? [];
    const tage = new Map();
    for (const h of hours) {
      const day = berlinDate(new Date(h.timestamp));
      tage.set(day, (tage.get(day) ?? 0) + (Number(h.precipitation) || 0));
    }
    const list = [...tage.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, mm]) => ({ date, mm: +mm.toFixed(1) }));
    const trockeneTage = list.filter((t) => t.mm < 1).length;
    const letzterRegen = [...list].reverse().find((t) => t.mm >= 1)?.date ?? null;
    const trockenheit = letzterRegen ? Math.max(0, Math.round((Date.now() - Date.parse(`${letzterRegen}T12:00:00Z`)) / 86400_000)) : null;
    return {
      summe7tage: +list.reduce((s, t) => s + t.mm, 0).toFixed(1),
      tage: list,
      trockeneTage,
      letzterRegen,
      trockenheitTage: trockenheit,
    };
  });
  return value;
}

// ---------- Gieß-Radar: junge Bäume, Regenbilanz und nächster Brunnen ----------
export async function giessRadar(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw Object.assign(new Error('lat und lon angeben'), { status: 400 });
  const pt = [lon, lat];
  const grenze = new Date().getFullYear() - 6; // „Jungbaum“: in den letzten sechs Jahren gepflanzt
  const [baeumeRes, brunnenRes, regenWert] = await Promise.allSettled([
    // Nach Pflanzjahr absteigend: die jüngsten Bäume zuerst (PFLANZJAHR „0000“ = unbekannt)
    box('A67_GFM_BAUM_PLUS', lat, lon, 400, 250, 'Base', '_EPSG25832', 'PFLANZJAHR D'),
    box('A62_BRU_BRUNNEN_Brunnen_in_Betr', lat, lon, 800, 60),
    regen(lat, lon),
  ]);

  const alle = baeumeRes.status === 'fulfilled' ? baeumeRes.value : [];
  const junge = alle
    .map((f) => {
      const c = point(f.geometry);
      const jahr = pflanzjahr(f.properties?.PFLANZJAHR);
      if (!c || jahr == null || jahr < 2020) return null;
      return {
        art: String(f.properties?.BAUMART ?? '').trim() || 'Unbekannte Art',
        bot: String(f.properties?.BAUMART_BOT ?? '').trim() || null,
        pflanzjahr: jahr,
        dist: Math.round(dist(pt, c)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dist - b.dist);

  const nachArt = new Map();
  for (const b of junge) nachArt.set(b.art, (nachArt.get(b.art) ?? 0) + 1);
  const topArten = [...nachArt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([art, anzahl]) => ({ art, anzahl }));

  const brunnen = (brunnenRes.status === 'fulfilled' ? brunnenRes.value : [])
    .map((f) => {
      const c = point(f.geometry);
      const p = f.properties ?? {};
      return c ? {
        name: p.NAME ?? 'Brunnen',
        standort: p.BEZEICHNUNG_STANDORT ?? null,
        anlagenart: p.ANLAGENART ?? null,
        trinkwasser: p.TRINKWASSER ?? null,
        // Zum Gießen geeignet: Schöpf- und Tiefbrunnen sowie Anlagen mit Trinkwasser, keine reinen Wasserspiele
        giessgeeignet: /trinkwasser/i.test(String(p.TRINKWASSER ?? '')) || /brunnen|quell/i.test(String(p.ANLAGENART ?? '')),
        dist: Math.round(dist(pt, c)),
        lat: +c[1].toFixed(6), lon: +c[0].toFixed(6),
      } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.giessgeeignet) - Number(a.giessgeeignet) || a.dist - b.dist);

  const r = regenWert.status === 'fulfilled' ? regenWert.value : null;
  const jung = junge.filter((b) => b.dist <= 200);
  const hinweise = [];
  if (jung.length) {
    const arten = jung.slice(0, 2).map((b) => b.art).join(', ');
    hinweise.push(`Vor der Haustür stehen ${jung.length} junge ${jung.length === 1 ? 'Baum' : 'Bäume'}${arten ? ` (${arten})` : ''}, gepflanzt seit 2020 – flache Wurzeln, hoher Gießbedarf.`);
  }
  if (r?.trockenheitTage != null && r.trockenheitTage >= 4) {
    hinweise.push(`Seit ${r.trockenheitTage} Tagen ohne nennenswerten Regen – Jungbäume gießen hilft.`);
  } else if (r?.summe7tage != null) {
    hinweise.push(`Niederschlag der letzten sieben Tage: ${r.summe7tage.toLocaleString('de-DE')} mm.`);
  }
  if (brunnen[0] && brunnen[0].dist <= 400) {
    hinweise.push(`Nächster Wasserbrunnen: ${brunnen[0].name}, ${brunnen[0].dist} m.`);
  }

  return {
    jungeBaeume: {
      anzahl: junge.length,
      anzahl200m: jung.length,
      topArten,
      items: junge.slice(0, 8),
    },
    regen: r,
    brunnen: brunnen[0] ?? null,
    hinweis: hinweise.join(' '),
    source: 'Baumkataster und Brunnen: Landeshauptstadt Stuttgart (CC BY 4.0); Niederschlag: Deutscher Wetterdienst über Bright Sky',
  };
}

// ---------- Pollen-Hotspots: DWD-Tageswerte × Standorte der Bäume im Baumkataster ----------
const POLLEN_ARTEN = [
  { name: 'Birke', layer: 'A67_GFM_Birke', bot: 'Betula' },
  { name: 'Esche', layer: 'A67_GFM_Esche', bot: 'Fraxinus' },
  { name: 'Erle', layer: 'A67_GFM_Erle', bot: 'Alnus' },
];
const LEVEL = { '0': 0, '0-1': 0.5, '1': 1, '1-2': 1.5, '2': 2, '2-3': 2.5, '3': 3 };
const LEVEL_TXT = { '0': 'keine', '0-1': 'keine bis gering', '1': 'gering', '1-2': 'gering bis mittel', '2': 'mittel', '2-3': 'mittel bis hoch', '3': 'hoch' };

export async function pollenKarte() {
  const { value } = await cached('pollen-karte', 3 * 3600_000, async () => {
    const dwd = await fetchJson('https://opendata.dwd.de/climate_environment/health/alerts/s31fg.json', { timeout: 20000 });
    const region = dwd.content?.find((x) => x.partregion_id === 112) ?? null;
    const pollen = region
      ? Object.entries(region.Pollen).map(([k, v]) => ({ name: k, today: v.today, tomorrow: v.tomorrow }))
      : [];

    const hotspots = [];
    const bestand = [];
    for (const art of POLLEN_ARTEN) {
      const wert = pollen.find((p) => p.name === art.name)?.today ?? '0';
      const stufe = LEVEL[wert] ?? 0;
      let fs = [];
      try {
        fs = await box(art.layer, 48.779, 9.18, 20000, 20000);
      } catch { /* Ebene nicht erreichbar */ }
      bestand.push({ art: art.name, anzahl: fs.length, pollenHeute: wert, pollenText: LEVEL_TXT[wert] ?? wert });
      if (stufe < 1 || !fs.length) continue;
      // Rasterzellen von etwa 450 m Kantenlänge: dort viele Bäume = Hotspot
      const zellen = new Map();
      for (const f of fs) {
        const c = f.geometry?.type === 'Point' ? f.geometry.coordinates : null;
        if (!c) continue;
        const key = `${Math.round(c[1] / 0.004)},${Math.round(c[0] / 0.006)}`;
        const z = zellen.get(key) ?? { lat: 0, lon: 0, n: 0 };
        z.lat += c[1]; z.lon += c[0]; z.n += 1;
        zellen.set(key, z);
      }
      for (const z of zellen.values()) {
        if (z.n < 5) continue;
        hotspots.push({
          art: art.name,
          anzahl: z.n,
          lat: +(z.lat / z.n).toFixed(5),
          lon: +(z.lon / z.n).toFixed(5),
          pollenHeute: wert,
          pollenText: LEVEL_TXT[wert] ?? wert,
        });
      }
    }
    hotspots.sort((a, b) => b.anzahl - a.anzahl);
    return {
      pollen,
      bestand,
      hotspots: hotspots.slice(0, 15),
      hinweis: hotspots.length
        ? 'Hotspots zeigen Rasterfelder von etwa 450 m mit vielen Bäumen der jeweiligen Gattung. Bei starkem Pollenflug diese Parks und Wege meiden.'
        : 'Für heute ist keine Pollenbelastung der im Baumkataster erfassten Gattungen gemeldet.',
    };
  });
  return {
    ...value,
    source: 'Pollenflug: Deutscher Wetterdienst (partregion 112); Baumstandorte: Landeshauptstadt Stuttgart, Baumkataster (CC BY 4.0)',
  };
}

// ---------- Artenbeobachtungen (iNaturalist, Fotos unter freien Lizenzen) ----------
export async function beobachtungen(lat, lon, r = 2) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw Object.assign(new Error('lat und lon angeben'), { status: 400 });
  const radius = Math.min(10, Math.max(0.3, Number(r) || 2));
  const key = `inat-${lat.toFixed(3)}-${lon.toFixed(3)}-${radius}`;
  const { value, at } = await cached(key, 15 * 60_000, async () => {
    const d = await fetchJson(
      `https://api.inaturalist.org/v1/observations?lat=${lat.toFixed(4)}&lng=${lon.toFixed(4)}&radius=${radius}` +
      '&quality_grade=research&locale=de&order_by=observed_on&order=desc&per_page=15&photo_license=cc0,cc-by,cc-by-sa',
      { timeout: 20000 },
    );
    return (d.results ?? []).map((o) => {
      const t = o.taxon ?? {};
      const photo = (o.photos ?? [])[0];
      return {
        id: o.id,
        name: t.preferred_common_name ?? o.species_guess ?? 'Unbekannte Art',
        wissenschaftlich: t.name ?? null,
        gruppe: t.iconic_taxon_name ?? null,
        datum: o.observed_on ?? o.created_at?.slice(0, 10),
        ort: o.place_guess ?? null,
        lat: o.location ? +Number(o.location.split(',')[0]).toFixed(6) : null,
        lon: o.location ? +Number(o.location.split(',')[1]).toFixed(6) : null,
        foto: photo ? photo.url?.replace('/square.', '/medium.') ?? null : null,
        autor: photo?.attribution ?? null,
        url: `https://www.inaturalist.org/observations/${o.id}`,
      };
    }).filter((o) => o.foto || o.name);
  });
  return {
    items: value,
    radiusKm: radius,
    fetchedAt: new Date(at).toISOString(),
    source: 'iNaturalist-Community (Fotos cc0 / CC BY / CC BY-SA), zuletzt verifizierte Beobachtungen',
  };
}
