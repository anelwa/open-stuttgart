// Eisenbahn am Stuttgarter Hauptbahnhof: Abfahrten und Ankünfte mit Verspätungsgrund, Ausfall und Gleiswechsel,
// die häufigsten Gründe im aktuellen Änderungsstand der DB und der Monatsverlauf der Pünktlichkeit seit 2024.
import { useMemo, useState } from 'react';
import { usePolling, useNow } from '../lib/api';
import { ago, fmtTime } from '../lib/format';
import { ErrorNote, LiveDot, Section, Source } from './ui';
import { LineBadge } from './LineBadge';
import { Sparkline } from './Sparkline';
import '../styles/bahn.css';

interface Zug {
  zug: string;
  linie: string;
  gattung: 'S' | 'Regio' | 'Fern';
  ziel?: string | null;
  herkunft?: string | null;
  gleisSoll: string | null;
  gleis: string | null;
  gleiswechsel: boolean;
  soll: string;
  ist: string;
  verspaetung: number | null;
  istBekannt: boolean;
  ausfall: boolean;
  zusatzfahrt: boolean;
  station: string;
  gruende: string[];
}

interface BahnAntwort {
  abfahrten: Zug[];
  ankuenfte: Zug[];
  gruendeHaeufig: { grund: string; zuege: number }[];
  quelle: string;
  offiziell: boolean;
  stand: string | null;
  hinweise: string[];
}

interface Monatswert { halte: number; puenktlich: number | null; ankunftPuenktlich: number | null; ausfaelle: number; ausfallAnteil: number | null; mittelMin: number | null }
type Gattung = 'S' | 'RE-RB' | 'Fern';
interface Historie {
  quelle: string;
  lizenz: string;
  definitionen: Record<string, string>;
  grenzen: string[];
  monate: ({ monat: string } & Record<Gattung, Monatswert>)[];
}

const GATTUNG_NAME: Record<Gattung, string> = { S: 'S-Bahn', 'RE-RB': 'Regionalverkehr', Fern: 'Fernverkehr' };
const MONAT = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monatText = (m: string) => MONAT.format(new Date(`${m}-01T00:00:00Z`));
const prozent = (x: number | null | undefined) => (x == null ? '–' : `${Math.round(x * 100)} %`);

function ZugZeile({ z, richtung, now }: { z: Zug; richtung: 'ab' | 'an'; now: number }) {
  const ort = richtung === 'ab' ? z.ziel : z.herkunft;
  const min = Math.round((Date.parse(z.ist) - now) / 60000);
  return (
    <li className={`dep-row bahn-zeile ${z.ausfall ? 'is-cancelled' : ''}`}>
      <LineBadge line={z.linie} kind={z.gattung === 'S' ? 'sbahn' : 'zug'} />
      <span className="dep-dest">
        <span className="dest">{richtung === 'an' ? `aus ${ort ?? 'unbekannt'}` : ort ?? 'unbekannt'}</span>
        <span className="dep-sub">
          {fmtTime(z.soll)}
          {!z.ausfall && z.verspaetung != null && z.verspaetung > 0 && (
            <span className={`delay ${z.verspaetung >= 6 ? 'crit' : 'warn'}`}> +{z.verspaetung}</span>
          )}
          {!z.ausfall && z.verspaetung === 0 && z.istBekannt && <span className="ontime"> pünktlich</span>}
          {z.gleis && (
            z.gleiswechsel
              ? <span className="bahn-gleiswechsel"> · Gleis {z.gleis} statt {z.gleisSoll}</span>
              : <span> · Gleis {z.gleis}</span>
          )}
          {z.zug !== z.linie && <span className="muted"> · {z.zug}</span>}
          {z.zusatzfahrt && <span> · Zusatzfahrt</span>}
        </span>
        {z.gruende.length > 0 && <span className="bahn-grund">{z.gruende[0]}{z.gruende.length > 1 ? ` (und ${z.gruende.length - 1} weitere Meldung${z.gruende.length > 2 ? 'en' : ''})` : ''}</span>}
      </span>
      <span className="dep-time">
        {z.ausfall ? <span className="cancelled">fällt aus</span> : min <= 0 ? <strong>jetzt</strong> : min < 60 ? <><strong>{min}</strong><small> min</small></> : <strong>{fmtTime(z.ist)}</strong>}
      </span>
    </li>
  );
}

function Gruende({ liste }: { liste: BahnAntwort['gruendeHaeufig'] }) {
  if (!liste.length) return <p className="muted small">Derzeit keine Verspätungsgründe gemeldet.</p>;
  const max = Math.max(...liste.map((g) => g.zuege));
  return (
    <ul className="bahn-gruende">
      {liste.map((g) => (
        <li key={g.grund}>
          <span className="bahn-gruende-text">{g.grund}</span>
          <span className="bahn-gruende-balken" aria-hidden><span style={{ width: `${(g.zuege / max) * 100}%` }} /></span>
          <span className="bahn-gruende-zahl">{g.zuege}</span>
        </li>
      ))}
    </ul>
  );
}

function Verlauf({ h }: { h: Historie }) {
  const [g, setG] = useState<Gattung>('S');
  const werte = h.monate.filter((m) => m[g]?.puenktlich != null);
  const zahlen = werte.map((m) => m[g].puenktlich! * 100);
  const letzter = werte.at(-1);
  const vorjahr = letzter ? werte.find((m) => m.monat === `${+letzter.monat.slice(0, 4) - 1}${letzter.monat.slice(4)}`) : undefined;
  const min = Math.floor(Math.min(...zahlen, 50) / 10) * 10;
  return (
    <div className="bahn-verlauf">
      <div className="seg small" role="tablist" aria-label="Gattung wählen">
        {(Object.keys(GATTUNG_NAME) as Gattung[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={g === k} className={g === k ? 'active' : ''} onClick={() => setG(k)}>{GATTUNG_NAME[k]}</button>
        ))}
      </div>
      {letzter && (
        <p className="small">
          {monatText(letzter.monat)}: {prozent(letzter[g].puenktlich)} der Halte pünktlich (unter 6 Minuten),
          Ausfälle {prozent(letzter[g].ausfallAnteil)}.
          {vorjahr && <> Vorjahresmonat: {prozent(vorjahr[g].puenktlich)}.</>}
        </p>
      )}
      <Sparkline values={zahlen} width={280} height={40} label={`Pünktlichkeit ${GATTUNG_NAME[g]} am Hauptbahnhof je Monat`} />
      <div className="bahn-balken" role="img" aria-label={`Monatswerte Pünktlichkeit ${GATTUNG_NAME[g]}, ${werte.map((m) => `${monatText(m.monat)} ${prozent(m[g].puenktlich)}`).join(', ')}`}>
        {werte.map((m) => {
          const v = m[g].puenktlich! * 100;
          return (
            <span key={m.monat} className="bahn-balken-monat" title={`${monatText(m.monat)}: ${prozent(m[g].puenktlich)} pünktlich, ${m[g].halte} Halte, ${m[g].ausfaelle} Ausfälle`}>
              <span style={{ height: `${Math.max(2, ((v - min) / (100 - min)) * 100)}%` }} />
            </span>
          );
        })}
      </div>
      <div className="bahn-balken-achse small muted">
        <span>{werte[0] ? monatText(werte[0].monat) : ''}</span>
        <span>Skala {min} bis 100 %</span>
        <span>{letzter ? monatText(letzter.monat) : ''}</span>
      </div>
      <p className="muted small">{h.grenzen.join(' ')}</p>
    </div>
  );
}

export function BahnHbf({ className }: { className?: string }) {
  const { data, error, loading, updatedAt, reload } = usePolling<BahnAntwort>('/api/bahn/hbf', 60_000);
  const hist = usePolling<Historie>('/api/bahn/historie', 6 * 3600_000);
  const now = useNow(15_000);
  const [richtung, setRichtung] = useState<'ab' | 'an'>('ab');
  const [nurS, setNurS] = useState(false);

  const liste = useMemo(() => {
    const l = (richtung === 'ab' ? data?.abfahrten : data?.ankuenfte) ?? [];
    return l.filter((z) => (!nurS || z.gattung === 'S') && Date.parse(z.ist) > now - 60_000).slice(0, 20);
  }, [data, richtung, nurS, now]);

  const ausfaelle = (data?.abfahrten ?? []).filter((z) => z.ausfall).length;
  const wechsel = (data?.abfahrten ?? []).filter((z) => z.gleiswechsel).length;

  return (
    <>
      <Section className={className} title="Eisenbahn am Hauptbahnhof" explain="bahnHbf">
        <div className="dep-toolbar">
          <span className="live-label">
            <LiveDot stale={!!error} /> {updatedAt ? `Stand der DB ${data?.stand ? fmtTime(data.stand) : ''}, abgerufen ${ago(updatedAt, now)}` : 'Lade Daten …'}
          </span>
          <div className="seg small" role="tablist" aria-label="Richtung">
            <button type="button" role="tab" aria-selected={richtung === 'ab'} className={richtung === 'ab' ? 'active' : ''} onClick={() => setRichtung('ab')}>Abfahrten</button>
            <button type="button" role="tab" aria-selected={richtung === 'an'} className={richtung === 'an' ? 'active' : ''} onClick={() => setRichtung('an')}>Ankünfte</button>
          </div>
        </div>
        <label className="bahn-filter small">
          <input type="checkbox" checked={nurS} onChange={(e) => setNurS(e.target.checked)} /> Nur S-Bahn
        </label>
        {data && (ausfaelle > 0 || wechsel > 0) && (
          <p className="small">In den nächsten 90 Minuten: {ausfaelle} {ausfaelle === 1 ? 'Ausfall' : 'Ausfälle'}, {wechsel} Gleiswechsel bei den Abfahrten.</p>
        )}
        {data && !data.offiziell && (
          <p className="notice small">Übergangsweise über eine nicht offiziell angebotene Schnittstelle der DB. Die Daten können ohne Ankündigung ausbleiben.</p>
        )}
        {error && !data && <ErrorNote text={`Daten der DB nicht verfügbar: ${error}`} onRetry={reload} />}
        {loading && !data && (
          <ul className="dep-list">{Array.from({ length: 6 }, (_, i) => <li key={i} className="dep-row"><span className="skeleton" style={{ width: '100%', height: 22 }} /></li>)}</ul>
        )}
        {data && liste.length === 0 && <p className="muted">Keine Fahrten in den nächsten 90 Minuten.</p>}
        <ul className="dep-list">
          {liste.map((z, i) => <ZugZeile key={`${z.zug}-${z.soll}-${i}`} z={z} richtung={richtung} now={now} />)}
        </ul>
      </Section>

      <Section className={className} title="Häufigste Verspätungsgründe" aside={<span className="muted small">Züge mit Meldung</span>}>
        {data ? <Gruende liste={data.gruendeHaeufig} /> : <span className="skeleton" style={{ width: '100%', height: 60, display: 'block' }} />}
        <p className="muted small">Gezählt werden Züge am Hauptbahnhof (oben und tief) mit mindestens einer Meldung im aktuellen Änderungsstand der DB. Ein Zug kann mehrere Gründe haben.</p>
      </Section>

      <Section className={className} title="Pünktlichkeit am Hauptbahnhof seit 2024" explain="bahnHistorie">
        {hist.error && !hist.data && <ErrorNote text={`Monatswerte nicht verfügbar: ${hist.error}`} onRetry={hist.reload} />}
        {hist.data && <Verlauf h={hist.data} />}
        <Source>Verspätungsdaten DB: Deutsche Bahn (CC BY 4.0), aufbereitet im Datensatz piebro/deutsche-bahn-data; eigene Auswertung für Stuttgart Hbf.</Source>
        <Source>{data?.quelle ?? 'Verspätungsdaten DB: Deutsche Bahn (CC BY 4.0)'}. Änderungen höchstens alle 3 Minuten, Sollfahrplan stündlich.</Source>
      </Section>
    </>
  );
}
