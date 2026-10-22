// Pollen-Hotspots: Tageswerte des DWD verknüpft mit den Standorten der Bäume im städtischen Baumkataster.
// Bei Pollenflug zeigt die Liste, in welchen Rasterfeldern viele Bäume der belasteten Gattung stehen.
import { usePolling } from '../lib/api';
import { fmtNum } from '../lib/format';
import { Explain } from '../lib/info';
import { Icon } from './Icon';
import { Section, Source } from './ui';

type Hotspot = { art: string; anzahl: number; lat: number; lon: number; pollenHeute: string; pollenText: string };
type Bestand = { art: string; anzahl: number; pollenHeute: string; pollenText: string };
type PollenDaten = {
  pollen: { name: string; today: string; tomorrow: string }[];
  bestand: Bestand[];
  hotspots: Hotspot[];
  hinweis: string;
  source: string;
};

export function Pollenkarte({ flyTo }: { flyTo: (c: [number, number], z?: number) => void }) {
  const p = usePolling<PollenDaten>('/api/pollenkarte', 3 * 3600_000);
  const d = p.data;
  if (!d) return null;
  return (
    <Section title="Pollen-Hotspots aus dem Baumkataster" explain="pollen" aside={d.hotspots.length ? `${d.hotspots.length} Hotspots` : 'keine Belastung'}>
      <dl className="facts">
        {d.bestand.map((b) => (
          <div key={b.art}>
            <dt>{b.art} <Explain id="pollen" /></dt>
            <dd>
              {fmtNum(b.anzahl)} Bäume im Stadtgebiet · Pollenflug heute: {b.pollenText}
              {b.pollenHeute !== '0' ? ' – bei Belastung Orte mit vielen Bäumen dieser Gattung meiden' : ''}
            </dd>
          </div>
        ))}
      </dl>
      {d.hotspots.length > 0 && (
        <ul className="near-list">
          {d.hotspots.slice(0, 6).map((h, i) => (
            <li key={`${h.art}-${i}`}>
              <button type="button" onClick={() => flyTo([h.lon, h.lat], 15)}>
                <span className="near-main">
                  <span className="near-name">{h.anzahl}× {h.art} in einem Rasterfeld</span>
                  <span className="near-sub">Pollenflug heute: {h.pollenText} · bei {h.lat.toFixed(3)}, {h.lon.toFixed(3)}</span>
                </span>
                <Icon name="chevron" size={16} className="muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">{d.hinweis}</p>
      <Source>
        Pollenflug: Deutscher Wetterdienst (Teilregion 112). Baumstandorte: Landeshauptstadt Stuttgart, Baumkataster (CC BY 4.0).
        Hotspots sind Rasterfelder von etwa 450 m mit mindestens fünf Bäumen der jeweiligen Gattung, keine Messwerte am Ort.
      </Source>
    </Section>
  );
}
