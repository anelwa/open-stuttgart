// Stadt-Natur in Echtzeit: was in der Nähe fotografiert wurde (iNaturalist-Community, Fotos unter freien Lizenzen).
import { usePolling } from '../lib/api';
import { Explain } from '../lib/info';
import type { Facility } from '../lib/types';
import { ErrorNote, Section, Source } from './ui';

type NatItem = {
  id: number; name: string; wissenschaftlich: string | null; gruppe: string | null;
  datum: string | null; ort: string | null; lat: number | null; lon: number | null;
  foto: string | null; autor: string | null; url: string;
};

export function NaturSection({ center, flyTo }: { center: [number, number]; flyTo: (c: [number, number], z?: number) => void }) {
  const nat = usePolling<{ items: NatItem[]; radiusKm: number; source: string }>(
    `/api/natur?lat=${center[1].toFixed(4)}&lon=${center[0].toFixed(4)}&r=2`, 15 * 60_000,
  );
  const items = nat.data?.items ?? [];
  if (!items.length && !nat.error) return null;
  return (
    <Section title="Stadt-Natur in der Nähe" explain="natur" aside={nat.data ? `${items.length} Beobachtungen im Umkreis von ${nat.data.radiusKm} km` : undefined}>
      {nat.error && !nat.data && <ErrorNote text="Artenbeobachtungen derzeit nicht abrufbar." onRetry={nat.reload} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {items.slice(0, 8).map((o) => (
          <button key={o.id} type="button" style={{ width: 108, textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: o.lat != null ? 'pointer' : 'default' }}
            onClick={() => o.lat != null && o.lon != null && flyTo([o.lon, o.lat], 16)}>
            {o.foto
              ? <img src={o.foto} alt={o.name} loading="lazy" style={{ width: 108, height: 81, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              : <span className="skeleton block" style={{ width: 108, height: 81 }} />}
            <span className="near-name" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>{o.name}</span>
            <span className="muted" style={{ fontSize: 11, display: 'block' }}>{o.datum ? new Date(`${o.datum}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }) : ''}</span>
          </button>
        ))}
      </div>
      <p className="muted small">
        Zuletzt in der Nähe fotografierte Arten – beim Anklicken springt die Karte zur Beobachtung.
      </p>
      <Source>
        iNaturalist (CC BY 4.0): verifizierte Beobachtungen mit Fotos unter cc0, CC BY oder CC BY-SA. Rechte liegen bei den jeweiligen Urheberinnen und Urhebern.
      </Source>
    </Section>
  );
}

// Parks und grüne Orte bekommen zusätzlich die Natur vor der Tür gezeigt
const GRUEN = /park|garten|wald|grün|ufer|see|wiese|freibad|sportplatz|spielplatz|uferweg/i;
const GRUEN_CATS = ['chillorte', 'sport', 'grillplatz', 'staeffele', 'kuehl', 'bad', 'spielplatz'];

/** „In den letzten Tagen hier fotografiert“ für Parks und grüne Orte */
export function NaturHinweis({ f }: { f: Facility }) {
  const sinnvoll = GRUEN.test(f.name ?? '') || GRUEN_CATS.includes(f.cat);
  const nat = usePolling<{ items: NatItem[] }>(sinnvoll ? `/api/natur?lat=${f.lat.toFixed(4)}&lon=${f.lon.toFixed(4)}&r=0.8` : null, 15 * 60_000);
  const items = nat.data?.items ?? [];
  if (!sinnvoll || !items.length) return null;
  return (
    <section className="section">
      <header className="section-head"><h3>Stadt-Natur hier</h3><Explain id="natur" /></header>
      <p className="small">
        In der Nähe zuletzt fotografiert: {items.slice(0, 4).map((o) => o.name).join(', ')}.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {items.slice(0, 4).filter((o) => o.foto).map((o) => (
          <a key={o.id} href={o.url} target="_blank" rel="noreferrer" title={o.name}>
            <img src={o.foto!} alt={o.name} loading="lazy" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
          </a>
        ))}
      </div>
    </section>
  );
}
