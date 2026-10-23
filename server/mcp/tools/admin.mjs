// Werkzeuge für Adressprofil, Abfall, Schule, Verwaltungsleistungen, Bürgerbüros und Nähe.
import { profil } from '../../sources/adresse.mjs';
import { abfall, buergerbueros, categories, facilities, schulbezirk } from '../../sources/nearby.mjs';
import { verwaltungLeistung, verwaltungSuche, verwaltungWo } from '../../sources/verwaltung.mjs';
import { distanceMeters, toolError } from '../util.mjs';
import {
  COORD, bool, defineTool, enumStr, int, obj, optionalCenter, resolvePlace, str, takeWithNote,
} from './shared.mjs';

function byDistance(items, center, radius = Infinity) {
  if (!center) return items;
  return items
    .map((x) => ({ ...x, distanzM: Number.isFinite(x.lat) && Number.isFinite(x.lon) ? distanceMeters(center.lat, center.lon, x.lat, x.lon) : null }))
    .filter((x) => x.distanzM == null || x.distanzM <= radius)
    .sort((a, b) => (a.distanzM ?? 1e9) - (b.distanzM ?? 1e9));
}

export const adminTools = [
  defineTool({
    name: 'address_profile',
    title: 'Was die Stadt über eine Adresse weiß',
    description: 'Liefert das Adressprofil der Landeshauptstadt: Stadtbezirk und Wahlbezirk, Wahllokal, Starkregen- und Hochwassergefahr, Lärm an der Fassade, kommunale Wärmeplanung, Solar- und Gründachpotenzial, Geothermie, Mietspiegel-Wohnlage, Soziale Erhaltungssatzung, Baumschutz, Denkmal, Jodprophylaxe, Bewohnerparken, E-Scooter-Regeln, Klimatop, Baumkataster im Umkreis, Unfallschwerpunkte sowie nächste Verwaltungsstelle, Trinkbrunnen und Toilette. Koordinaten oder Adresse angeben.',
    sources: ['stuttgartGeo', 'stuttgart', 'unfallatlas', 'dwd'],
    cost: 6,
    timeoutMs: 120_000,
    annotations: { idempotentHint: true },
    inputSchema: obj({
      address: str('Adresse in Stuttgart, z. B. „Marienplatz 1“; alternativ lat/lon.', { maxLength: 200 }),
      ...COORD,
      compact: bool('Nur die Kernaussagen statt aller Fachdaten (Standard false).', { default: false }),
    }),
    async execute(a) {
      let center = null;
      if (Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lon))) center = { lat: Number(a.lat), lon: Number(a.lon), label: 'Koordinaten' };
      else if (a.address) center = await resolvePlace(a.address);
      if (!center) throw toolError('Bitte address oder lat/lon angeben.');
      const p = await profil(center.lat, center.lon);
      if (a.compact) {
        const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] != null).map((k) => [k, o[k]]));
        return {
          data: {
            adresse: center.label,
            stadtbezirk: p.wahl?.stadtbezirk ?? null,
            wahlbezirk: p.wahl?.bezirk ?? null,
            wahllokal: p.wahl?.lokal ?? null,
            starkregen: pick(p.starkregen, ['fliessweg', 'hq100', 'imUmkreis100m', 'gefaehrdung']),
            laerm: pick(p.laerm?.strasse ?? {}, ['lden', 'lnight']) || pick(p.laerm?.schiene ?? {}, ['lden', 'lnight']),
            solar: p.solar ? pick(p.solar, ['dachflaeche', 'kwp', 'ertrag', 'co2']) : null,
            gruendach: p.gruendach ? pick(p.gruendach, ['flaeche', 'gruenflaeche', 'retention']) : null,
            wohnlage: p.wohnlage ?? null,
            milieuschutz: p.milieuschutz ?? null,
            bewohnerparken: p.bewohnerparken ?? null,
            klima: p.klima ?? null,
            naechsteStelle: p.verwaltung?.[0] ?? null,
            notfallTreffpunkt: p.notfall ?? null,
            source: p.source,
          },
        };
      }
      return {
        data: p,
        limits: [
          'Das Profil ist eine Auswahl; die vollständige Ansicht steht unter „Meine Adresse“ in der App.',
          'Die Daten stammen aus verschiedenen Fachverfahren mit unterschiedlichem Stand; verbindlich sind die verlinkten Originalquellen.',
        ],
      };
    },
  }),

  defineTool({
    name: 'waste',
    title: 'Abfuhrtermine',
    description: 'Nennt die nächsten Abfuhrtermine der Abfallwirtschaft Stuttgart für eine Straße und Hausnummer: Restabfall, Bioabfall, Altpapier und Gelber Sack, jeweils mit Rhythmus. Die Schreibweise muss der Adresse im Abfallkalender entsprechen (z. B. „Eberhardstr.“).',
    sources: ['stuttgart'],
    cost: 2,
    inputSchema: obj({
      street: str('Straße mit Schreibweise wie im Abfallkalender, z. B. „Eberhardstr.“.', { maxLength: 120 }),
      house_number: str('Hausnummer, z. B. „5“ oder „12a“.', { maxLength: 20 }),
    }, ['street', 'house_number']),
    async execute(a) {
      const r = await abfall(a.street, a.house_number);
      if (r?.error) throw toolError(r.error, { hint: 'Schreibweise wie auf dem Abfallkalender verwenden oder die Straße über geocode prüfen.' });
      return { data: r, limits: ['Termine ändern sich bei Feiertagen und Sonderfahrten; maßgeblich ist der Abfallkalender der AWS.'] };
    },
  }),

  defineTool({
    name: 'school_district',
    title: 'Grundschulbezirk',
    description: 'Ermittelt den Grundschulbezirk für eine Adresse oder Koordinate in Stuttgart und, wenn bekannt, die zugehörige Schule mit Standort. Nützlich für Familien, die den Schulweg planen.',
    sources: ['stuttgartGeo'],
    cost: 4,
    timeoutMs: 60_000,
    inputSchema: obj({
      address: str('Adresse in Stuttgart; alternativ lat/lon.', { maxLength: 200 }),
      ...COORD,
    }),
    async execute(a) {
      let center = null;
      if (Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lon))) center = { lat: Number(a.lat), lon: Number(a.lon), label: 'Koordinaten' };
      else if (a.address) center = await resolvePlace(a.address);
      if (!center) throw toolError('Bitte address oder lat/lon angeben.');
      const r = await schulbezirk(center.lat, center.lon);
      return {
        data: { ...r, adresse: center.label, lat: center.lat, lon: center.lon },
        limits: [r.school ? null : 'Für diesen Punkt wurde kein Grundschulbezirk gefunden; die Schule kann außerhalb des Stadtgebiets liegen.'],
      };
    },
  }),

  defineTool({
    name: 'services',
    title: 'Verwaltungsleistungen',
    description: 'Sucht Leistungen und zuständige Stellen der Stadt Stuttgart (topic="search", z. B. „Personalausweis“, „Wohnsitz anmelden“, „Gewerbe“), lädt eine Leistung mit Voraussetzungen, Unterlagen, Gebühren, Fristen, Online-Diensten und Terminbuchung (topic="detail") oder zeigt, wo man sie erledigen kann (topic="where"). IDs/URLs stammen aus der Suche.',
    sources: ['stuttgart'],
    cost: 2,
    inputSchema: obj({
      topic: enumStr('search = suchen, detail = Leistung laden, where = zuständige Stellen.', ['search', 'detail', 'where'], { default: 'search' }),
      q: str('Suchbegriff für topic="search", z. B. „Personalausweis verlängern“.', { maxLength: 200 }),
      id: str('Leistungs-ID oder URL aus der Suche.', { maxLength: 400 }),
      address: str('Standort für topic="where" (Adresse); alternativ lat/lon.', { maxLength: 200 }),
      ...COORD,
    }),
    async execute(a) {
      if (a.topic === 'search') {
        if (!a.q) throw toolError('Für topic="search" wird q benötigt.');
        const r = await verwaltungSuche(a.q);
        return { data: r, limits: [r.total === 0 ? 'Keine Leistung gefunden; konkreteres Anliegen oder Schreibweise versuchen.' : null] };
      }
      if (!a.id) throw toolError('Für topic="detail" oder "where" wird id (Leistungs-ID oder URL) benötigt.');
      if (a.topic === 'detail') return { data: await verwaltungLeistung(a.id) };
      let center = null;
      if (Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lon))) center = { lat: Number(a.lat), lon: Number(a.lon) };
      else if (a.address) center = await resolvePlace(a.address);
      return { data: await verwaltungWo(a.id, center?.lat, center?.lon) };
    },
  }),

  defineTool({
    name: 'offices',
    title: 'Bürgerbüros und Wartezeiten',
    description: 'Live-Wartezeiten der Stuttgarter Bürgerbüros mit Adresse, Öffnungsstatus und „üblich um diese Zeit“. Mit service (Leistungs-ID oder URL) werden die für diese Leistung zuständigen Bürgerbüros nach Entfernung sortiert; ohne service kommt die Übersicht. Optional nach Adresse oder Koordinaten sortieren.',
    sources: ['stuttgart'],
    cost: 3,
    timeoutMs: 45_000,
    inputSchema: obj({
      service: str('Leistungs-ID oder URL, z. B. aus services.', { maxLength: 400 }),
      address: str('Standort für die Entfernung; alternativ lat/lon.', { maxLength: 200 }),
      ...COORD,
      limit: int('Maximale Anzahl Büros (1–30).', { minimum: 1, maximum: 30, default: 12 }),
    }),
    async execute(a) {
      let center = null;
      if (Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lon))) center = { lat: Number(a.lat), lon: Number(a.lon) };
      else if (a.address) center = await resolvePlace(a.address);
      if (a.service) {
        const r = await verwaltungWo(a.service, center?.lat, center?.lon);
        return { data: { ...r, orte: (r.orte ?? []).slice(0, a.limit ?? 12) } };
      }
      const r = await buergerbueros();
      const items = byDistance(r.items ?? [], center, Infinity).slice(0, a.limit ?? 12);
      return {
        data: { ...r, items },
        limits: ['Wartezeit-Stufen sind die Live-Anzeige der Stadt; sie können sich minütlich ändern.'],
      };
    },
  }),

  defineTool({
    name: 'nearby',
    title: 'In der Nähe',
    description: 'Findet Einrichtungen und Orte in der Nähe: Cafés, Restaurants, Imbisse, Kneipen, Biergärten (mit vegan/vegetarisch), Kitas, Schulen, Spielplätze, Toiletten, Trinkbrunnen, Bäder, Kinos, Supermärkte, Bäckereien, Banken, Geldautomaten, Tankstellen, Defibrillatoren, Paketstationen, Ladepunkte, Behindertenparkplätze, Wertstoffhöfe und mehr. Ohne lat/lon werden die ersten Einträge geliefert; für „in meiner Nähe“ Koordinaten übergeben.',
    sources: ['stuttgartGeo', 'osm', 'openmensa'],
    cost: 3,
    timeoutMs: 45_000,
    inputSchema: obj({
      category: str('Kategorie-ID oder Bezeichnung, z. B. „cafe“, „Kita“, „Toilette“, „Spielplatz“.', { maxLength: 80 }),
      address: str('Nähe zu dieser Adresse; alternativ lat/lon.', { maxLength: 200 }),
      ...COORD,
      radius: int('Umkreis in Metern (100–5000).', { minimum: 100, maximum: 5000, default: 1500 }),
      diet: enumStr('Nur bei Essen: vegan oder vegetarisch.', ['all', 'vegan', 'vegetarisch'], { default: 'all' }),
      limit: int('Maximale Anzahl Treffer (1–50).', { minimum: 1, maximum: 50, default: 12 }),
    }, ['category']),
    async execute(a) {
      const all = categories();
      const q = String(a.category ?? '').toLowerCase().trim();
      const cat = all.find((c) => c.id.toLowerCase() === q)
        ?? all.find((c) => c.label.toLowerCase() === q)
        ?? all.find((c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
      if (!cat) {
        throw toolError(`Kategorie „${a.category}“ unbekannt.`, {
          hint: `Verfügbar: ${all.slice(0, 40).map((c) => c.id).join(', ')} …`,
        });
      }
      const r = await facilities(cat.id, { diet: a.diet && a.diet !== 'all' ? a.diet : null });
      const center = await optionalCenter({ lat: a.lat, lon: a.lon, near: a.address });
      let items = r.items ?? [];
      if (center) items = byDistance(items, center, a.radius ?? 1500);
      const { shown, limits } = takeWithNote(items, a.limit ?? 12, 'Treffer');
      return {
        data: { ...r, items: shown, kategorie: cat },
        limits: [...limits, center ? null : 'Ohne Standort sind die ersten Einträge der Quelle geliefert.'],
      };
    },
  }),
];
