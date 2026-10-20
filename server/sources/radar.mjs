// Niederschlagsradar des DWD (RADOLAN RV, 5-Minuten-Raster, etwa 1 km) über Bright Sky:
// rund eine Stunde Rückblick und eine Stunde Vorhersage für das Stadtgebiet. Ein Abruf alle 5 Minuten für alle Nutzer.
import { cached, fetchJson } from '../cache.mjs';

export async function radar() {
  const { value, at, fresh } = await cached('radar', 5 * 60_000, async () => {
    const d = await fetchJson('https://api.brightsky.dev/radar?lat=48.7784&lon=9.18&distance=16000&format=plain', { timeout: 20000 });
    const frames = (d.radar ?? []).map((f) => ({ t: f.timestamp, source: f.source, v: f.precipitation_5 }));
    return {
      // Ecken des Rasters: oben links, unten links, unten rechts, oben rechts
      corners: d.geometry?.coordinates ?? [],
      rows: frames[0]?.v.length ?? 0,
      cols: frames[0]?.v[0]?.length ?? 0,
      frames,
    };
  });
  return { ...value, fetchedAt: new Date(at).toISOString(), fresh, unit: '0,01 mm je 5 min', source: 'Deutscher Wetterdienst (RADOLAN) über Bright Sky' };
}
