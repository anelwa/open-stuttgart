// Pollenflug und UV-Index (DWD) sowie der regionale Netzzustand (TransnetBW StromGedacht)
import { usePolling } from '../lib/api';
import { fmtTime } from '../lib/format';
import { Section } from './ui';

type G = {
  pollen?: { region: string; next: string; items: { name: string; today: string; tomorrow: string }[] };
  uv?: { today: number; tomorrow: number };
  strom?: { from: string; to: string; state: number }[];
};
type H = {
  warnung: { stufe: string | number; text: string; beschreibung?: string; hinweis?: string; von?: string; bis?: string } | null;
  trend?: { tage: { datum: string; code: number; text: string }[] };
  biowetter?: { abschnitt: string; effekte: { name: string; wert: string }[] }[];
  gefahrenindex?: { werte: { datum: string; uhrzeit: string; belastung: string }[] };
  hoechsttemperatur?: { station: string; tage: { datum: string; grad: number }[] };
};
const POLLEN: Record<string, string> = { Graeser: 'Gräser', Beifuss: 'Beifuß' };
const LEVEL: Record<string, string> = { '0': 'keine', '0-1': 'keine bis gering', '1': 'gering', '1-2': 'gering bis mittel', '2': 'mittel', '2-3': 'mittel bis hoch', '3': 'hoch' };
const uvText = (v: number) => (v <= 2 ? 'niedrig' : v <= 5 ? 'mäßig' : v <= 7 ? 'hoch' : v <= 10 ? 'sehr hoch' : 'extrem');
// Zustände der StromGedacht-API: -1 supergrün, 1 grün (normal), 3 orange, 4 rot
const STROM: Record<number, string> = { 1: 'Normalbetrieb', 3: 'Verbrauch möglichst verschieben', 4: 'Verbrauch möglichst reduzieren', [-1]: 'Viel erneuerbarer Strom: Verbrauch vorziehen' };

export function HealthEnergy() {
  const { data } = usePolling<G>('/api/gesundheit', 30 * 60_000);
  const heat = usePolling<H>('/api/hitze', 30 * 60_000).data;
  if (!data) return null;
  const tx = heat?.hoechsttemperatur?.tage ?? [];
  const hot = !!heat?.warnung || tx.slice(0, 2).some((t) => t.grad >= 28);
  const befinden = heat?.biowetter?.[0]?.effekte.find((e) => /allgemeine Befinden/.test(e.name));
  const kreislauf = heat?.biowetter?.[0]?.effekte.filter((e) => /Herz|Kreislauf/.test(e.name) && e.wert !== 'kein Einfluss') ?? [];
  const trendNext = heat?.trend?.tage.find((t) => t.code > 0);
  const active = (data.pollen?.items ?? []).filter((p) => p.today !== '0' || p.tomorrow !== '0');
  const now = Date.now();
  const cur = data.strom?.find((s) => Date.parse(s.from) <= now && Date.parse(s.to) > now) ?? data.strom?.[0];
  const next = data.strom?.find((s) => Date.parse(s.from) > now && s.state !== cur?.state);
  return (
    <Section title="Gesundheit, Hitze und Stromnetz" aside="DWD, TransnetBW" explain="pollen">
      {heat?.warnung && (
        <div className="warn-box" role="status">
          <strong>Amtliche Hitzewarnung des DWD{heat.warnung.von ? ` ab ${fmtTime(heat.warnung.von)} Uhr` : ''}</strong>
          <p>{heat.warnung.text}{heat.warnung.beschreibung ? `. ${heat.warnung.beschreibung}` : ''}</p>
        </div>
      )}
      {hot && (
        <p className="small heat-hint">
          Bei Hitze: Kühle Orte, Trinkbrunnen und öffentliche Toiletten mit Öffnungszeiten zeigt der Bereich „Nähe“, sortiert nach Entfernung.
          Die Schattenkarte im Bereich „Sonne“ zeigt, wo das Gelände nachmittags Schatten wirft.
        </p>
      )}
      <dl className="facts">
        {tx.length > 0 && <div><dt>Höchsttemperatur</dt><dd>heute {Math.round(tx[0].grad)} °C{tx[1] ? `, morgen ${Math.round(tx[1].grad)} °C` : ''}</dd></div>}
        {heat && <div><dt>Hitzewarnung</dt><dd>{heat.warnung ? 'liegt vor' : trendNext ? `keine; Hitzetrend ab ${new Date(`${trendNext.datum}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long' })}: ${trendNext.text}` : 'keine, auch kein Hitzetrend für die nächsten Tage'}</dd></div>}
        {befinden && <div><dt>Biowetter</dt><dd>{befinden.name.replace('Wettereinfluss auf das ', '')}: {befinden.wert}{kreislauf.length ? `; ${kreislauf.map((k) => `${k.name.replace('Wettereinfluss auf ', '')}: ${k.wert}`).join('; ')}` : ''}</dd></div>}
        {data.uv && <div><dt>UV-Index heute</dt><dd>{data.uv.today} ({uvText(data.uv.today)}), morgen {data.uv.tomorrow}</dd></div>}
        {data.pollen && <div><dt>Pollenflug</dt><dd>{active.length ? active.map((p) => `${POLLEN[p.name] ?? p.name} ${LEVEL[p.today] ?? p.today}`).join(', ') : 'keine Belastung heute und morgen'}</dd></div>}
        {cur && <div><dt>Stromnetz Region</dt><dd>{STROM[cur.state] ?? `Zustand ${cur.state}`}{next ? `, ab ${fmtTime(next.from)} Uhr: ${STROM[next.state] ?? next.state}` : ''}</dd></div>}
      </dl>
      <p className="muted small">Höchsttemperatur: DWD-Vorhersage (MOSMIX) für die Station Stuttgart-Echterdingen auf den Fildern; in der tiefer gelegenen Innenstadt ist es meist wärmer. Pollenflug für {data.pollen?.region ?? 'die Region'}. Stromnetz: Prognose von TransnetBW (StromGedacht) für Postleitzahl 70173.</p>
    </Section>
  );
}
