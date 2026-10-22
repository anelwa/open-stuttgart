// Mensen und Hochschulgastronomie der Stadt (OpenMensa): Tagesgerichte mit Studierenden- und Gästepreis.
import { useMemo } from 'react';
import { usePolling } from '../lib/api';
import { distM } from '../lib/geo';
import { Explain } from '../lib/info';
import { Icon } from './Icon';
import { Section, Source } from './ui';

type MensaMeal = {
  name: string; kategorie: string | null; preisStudierende: number | null; preisGaeste: number | null;
  vegan: boolean; vegetarisch: boolean; hinweise: string[];
};
type MensaCanteen = {
  id: number; kurz: string; ort: string; name: string; address: string | null;
  lat: number | null; lon: number | null; url: string; closed: boolean; meals: MensaMeal[];
};

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`);
const euro = (v: number | null) => (v == null ? '–' : `${v.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`);
/** Tagesgerichte zuerst, Suppen und Beilagen ausblenden */
const hauptgerichte = (meals: MensaMeal[]) => {
  const haupt = meals.filter((m) => /tages|haupt|wahlessen|abend/i.test(m.kategorie ?? ''));
  return (haupt.length ? haupt : meals.filter((m) => !/suppe|beilage|dessert|salat|vorspeise/i.test(m.kategorie ?? ''))).slice(0, 3);
};

export function MensaSection({ lngLat, compact = false }: { lngLat: [number, number]; compact?: boolean }) {
  const mensa = usePolling<{ date: string; items: MensaCanteen[]; source: string }>('/api/mensa', 60 * 60_000);
  const items = useMemo(() => (mensa.data?.items ?? [])
    .map((c) => ({ c, d: c.lat != null && c.lon != null ? distM(lngLat, [c.lon, c.lat]) : Infinity }))
    .sort((a, b) => a.d - b.d), [mensa.data, lngLat]);
  if (!items.length) return null;
  const offen = items.filter((x) => !x.c.closed);

  if (compact) {
    const naechste = offen[0] ?? items[0];
    const gericht = hauptgerichte(naechste.c.meals)[0];
    return (
      <p className="small">
        <Icon name="ticket" size={14} />{' '}
        {gericht
          ? <>Mensa-Tipp: {gericht.name} in der {naechste.c.kurz}{Number.isFinite(naechste.d) ? ` (${fmtDist(naechste.d)})` : ''} – {euro(gericht.preisStudierende)} für Studierende, {euro(gericht.preisGaeste)} für Gäste{gericht.vegan ? ' · vegan' : gericht.vegetarisch ? ' · vegetarisch' : ''}.</>
          : <>Heute in den Mensen ({offen.length} geöffnet) kein Tagesgericht gemeldet.</>}
      </p>
    );
  }

  return (
    <Section title="Mensen und Hochschulgastronomie" explain="mensa" aside={`${offen.length} von ${items.length} heute geöffnet`}>
      <ul className="near-list">
        {items.slice(0, 5).map(({ c, d }) => (
          <li key={c.id}>
            <a href={c.url} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '6px 0' }}>
              <span className="near-main">
                <span className="near-name">{c.name}</span>
                <span className="near-sub">
                  {[Number.isFinite(d) ? fmtDist(d) : null, c.address].filter(Boolean).join(' · ') || c.ort}
                  {c.closed ? ' · heute geschlossen oder kein Angebot' : ''}
                </span>
                {hauptgerichte(c.meals).map((m) => (
                  <span key={m.name} className="near-sub">
                    {m.name}{m.vegan ? ' · vegan' : m.vegetarisch ? ' · vegetarisch' : ''} – {euro(m.preisStudierende)} Studierende / {euro(m.preisGaeste)} Gäste
                  </span>
                ))}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <Source>
        Speisepläne: OpenMensa (CC BY-SA 4.0), Daten der Studierendenwerke. Preise und Gerichte ohne Gewähr,
        Allergene und Zusatzstoffe auf den Seiten der Einrichtungen.
      </Source>
    </Section>
  );
}
