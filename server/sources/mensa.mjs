// Mensen und Hochschulgastronomie in Stuttgart (OpenMensa v2, CC BY-SA 4.0, ohne API-Schlüssel):
// Tagesgerichte mit Studierenden- und Gästepreis sowie Kennzeichnung vegan/vegetarisch.
import { cached, fetchJson } from '../cache.mjs';

const CANTEENS = [
  { id: 392, kurz: 'Mensa 1', ort: 'Stadtmitte' },
  { id: 1202, kurz: 'Mensa Central', ort: 'Stadtmitte' },
  { id: 395, kurz: 'Musikhochschule', ort: 'Stadtmitte' },
  { id: 394, kurz: 'Kunstakademie Weißenhof', ort: 'Nord' },
  { id: 399, kurz: 'Mensa Vaihingen', ort: 'Vaihingen' },
  { id: 1765, kurz: 'Mensa Hohenheim', ort: 'Hohenheim' },
];

const berlinDate = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d);

export async function mensen(d) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? '')) ? String(d) : berlinDate();
  const { value, at, fresh } = await cached(`mensa-${date}`, 60 * 60_000, async () => {
    const items = await Promise.all(CANTEENS.map(async (c) => {
      const [infoRes, mealsRes] = await Promise.allSettled([
        cached(`mensa-info-${c.id}`, 7 * 86400_000, () => fetchJson(`https://openmensa.org/api/v2/canteens/${c.id}`, { timeout: 12000 })),
        fetchJson(`https://openmensa.org/api/v2/canteens/${c.id}/days/${date}/meals`, { timeout: 12000 }).catch(() => []),
      ]);
      const info = infoRes.status === 'fulfilled' ? infoRes.value.value ?? {} : {};
      const raw = mealsRes.status === 'fulfilled' && Array.isArray(mealsRes.value) ? mealsRes.value : [];
      const meals = raw.map((m) => {
        const notes = (m.notes ?? []).map(String);
        const kat = String(m.category ?? '');
        const text = `${kat} ${notes.join(' ')}`;
        return {
          name: m.name,
          kategorie: m.category ?? null,
          preisStudierende: m.prices?.students ?? null,
          preisGaeste: m.prices?.others ?? null,
          vegan: /vegan/i.test(text),
          vegetarisch: /vegetar/i.test(text) || /vegan/i.test(text),
          hinweise: notes.filter((n) => !/vegetar|vegan|nährwerte/i.test(n)).slice(0, 4),
        };
      });
      return {
        id: c.id,
        kurz: c.kurz,
        ort: c.ort,
        name: info.name ?? `Mensa ${c.kurz}`,
        address: [info.address, info.city].filter(Boolean).join(', ') || null,
        lat: info.coordinates?.[0] ?? null,
        lon: info.coordinates?.[1] ?? null,
        url: `https://openmensa.org/canteens/${c.id}`,
        closed: meals.length === 0,
        meals,
      };
    }));
    return items;
  });
  return {
    date,
    items: value,
    fetchedAt: new Date(at).toISOString(),
    fresh,
    source: 'OpenMensa (CC BY-SA 4.0), Daten der Studierendenwerke; Preise können abweichen',
  };
}
