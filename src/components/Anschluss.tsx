// „Schaffe ich den Anschluss?“ am Hauptbahnhof: ankommende Fahrt und gewünschte Linie wählen,
// Ergebnis als Ampel mit einem Satz. Rechnung im Server (server/sources/anschluss.mjs).
import { useMemo, useState } from 'react';
import { usePolling } from '../lib/api';
import { fmtTime } from '../lib/format';
import { ErrorNote, Section, Source } from './ui';
import { LineBadge } from './LineBadge';
import '../styles/bahn.css';

type Art = 'zug' | 'sbahn' | 'stadtbahn' | 'zahnrad' | 'bus';

interface Fahrt {
  key: string;
  linie: string;
  art: Art;
  herkunft?: string | null;
  ziel?: string | null;
  teil: 'oben' | 'tief' | 'klett';
  teilName: string;
  steig: string | null;
  soll: string;
  ist: string;
  verspaetung: number | null;
  echtzeit: 'EFA-BW' | 'DB' | null;
  ausfall: boolean;
}

interface AnkuenfteAntwort {
  ankuenfte: Fahrt[];
  linien: { linie: string; art: Art; ziel: string | null; teil: string; steige: string[] }[];
  echtzeitHinweis: string | null;
  stand: string;
  quelle: string;
}

interface AnschlussAntwort {
  zubringer: Fahrt;
  anschluss: Fahrt;
  fussweg_min: number;
  fussweg: { von: string; nach: string; wegMin: number; zuschlagMin: number; aufzugGestoert: boolean; geschaetzt: boolean; quelle: string };
  puffer_min: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
  satz: string;
  naechste: (Fahrt & { puffer_min: number }) | null;
  hinweise: string[];
  grenzen: string[];
  stand: string;
  quelle: string;
}

const ART_NAME: Record<Art, string> = { zug: 'Züge', sbahn: 'S-Bahn', stadtbahn: 'Stadtbahn', zahnrad: 'Zahnradbahn', bus: 'Bus' };
const ART_FOLGE: Art[] = ['sbahn', 'zug', 'stadtbahn', 'zahnrad', 'bus'];
const AMPEL_TEXT = { gruen: 'Erreichbar', gelb: 'Knapp', rot: 'Nicht erreichbar' } as const;

const steig = (s: string | null) => (s == null ? '' : /^\d+$/.test(s) ? `Gleis ${s}` : s);
const badgeArt = (a: Art) => (a === 'zug' ? 'zug' : a);

function ankunftText(a: Fahrt) {
  const v = a.ausfall ? ' (fällt aus)' : a.verspaetung ? ` (${a.verspaetung > 0 ? '+' : ''}${a.verspaetung})` : '';
  return `${fmtTime(a.soll)} ${a.linie} aus ${a.herkunft ?? 'unbekannt'}, ${steig(a.steig)}${v}`;
}

export function Anschluss() {
  const liste = usePolling<AnkuenfteAntwort>('/api/anschluss/ankuenfte', 60_000);
  const [ankunft, setAnkunft] = useState('');
  const [linie, setLinie] = useState(''); // „Linie|Ziel“

  const [lin, ziel] = linie ? linie.split('|') : ['', ''];
  const url = ankunft && lin
    ? `/api/anschluss?ankunft=${encodeURIComponent(ankunft)}&linie=${encodeURIComponent(lin)}${ziel ? `&ziel=${encodeURIComponent(ziel)}` : ''}`
    : null;
  const ergebnis = usePolling<AnschlussAntwort>(url, 60_000);

  const ankGruppen = useMemo(() => {
    const g = new Map<Art, Fahrt[]>();
    for (const a of liste.data?.ankuenfte ?? []) {
      if (!g.has(a.art)) g.set(a.art, []);
      g.get(a.art)!.push(a);
    }
    return ART_FOLGE.filter((k) => g.has(k)).map((k) => [k, g.get(k)!] as const);
  }, [liste.data]);

  const linGruppen = useMemo(() => {
    const g = new Map<Art, AnkuenfteAntwort['linien']>();
    for (const l of liste.data?.linien ?? []) {
      if (!g.has(l.art)) g.set(l.art, []);
      g.get(l.art)!.push(l);
    }
    return ART_FOLGE.filter((k) => g.has(k)).map((k) => [k, g.get(k)!] as const);
  }, [liste.data]);

  const gewaehlt = liste.data?.ankuenfte.find((a) => a.key === ankunft) ?? null;
  const r = ergebnis.data;

  return (
    <Section title="Anschluss am Hauptbahnhof" explain="anschluss">
      <p className="muted small bahn-intro">
        Prüft, ob ein Umstieg am Stuttgarter Hauptbahnhof (oben, tief und Arnulf-Klett-Platz) mit der aktuellen Verspätung
        noch erreichbar ist.
      </p>
      {liste.error && !liste.data && <ErrorNote text={`Ankünfte nicht verfügbar: ${liste.error}`} onRetry={liste.reload} />}
      {liste.loading && !liste.data && <span className="skeleton" style={{ width: '100%', height: 64, display: 'block' }} />}
      {liste.data && (
        <div className="anschluss-form">
          <label className="anschluss-feld">
            <span>Ankommende Fahrt</span>
            <select value={ankunft} onChange={(e) => setAnkunft(e.target.value)}>
              <option value="">Bitte wählen</option>
              {ankGruppen.map(([art, fahrten]) => (
                <optgroup key={art} label={ART_NAME[art]}>
                  {fahrten.map((a) => (
                    <option key={a.key} value={a.key}>{ankunftText(a)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="anschluss-feld">
            <span>Gewünschte Linie</span>
            <select value={linie} onChange={(e) => setLinie(e.target.value)}>
              <option value="">Bitte wählen</option>
              {linGruppen.map(([art, ls]) => (
                <optgroup key={art} label={ART_NAME[art]}>
                  {ls.map((l) => (
                    <option key={`${l.linie}|${l.ziel}`} value={`${l.linie}|${l.ziel ?? ''}`}>
                      {l.linie} Richtung {l.ziel ?? 'unbekannt'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      )}
      {liste.data?.echtzeitHinweis && <p className="notice small">{liste.data.echtzeitHinweis}</p>}

      {gewaehlt?.ausfall && <p className="notice small">Die gewählte Fahrt fällt laut Auskunft aus.</p>}
      {url && ergebnis.error && <ErrorNote text={ergebnis.error} onRetry={ergebnis.reload} />}
      {url && ergebnis.loading && !r && <span className="skeleton" style={{ width: '100%', height: 80, display: 'block' }} />}
      {url && r && (
        <div className={`anschluss-ergebnis ampel-${r.ampel}`} role="status" aria-live="polite">
          <div className="ampel-kopf">
            <span className="ampel-punkt" aria-hidden />
            <strong>{AMPEL_TEXT[r.ampel]}</strong>
            {r.puffer_min != null && <span className="muted small">Puffer {r.puffer_min} min</span>}
          </div>
          <p className="anschluss-satz">{r.satz}</p>
          <dl className="anschluss-werte">
            <div>
              <dt>Ankunft</dt>
              <dd>
                <LineBadge line={r.zubringer.linie} kind={badgeArt(r.zubringer.art)} size="sm" />{' '}
                {fmtTime(r.zubringer.ist)}{r.zubringer.echtzeit ? '' : ' (Fahrplan)'}, {steig(r.zubringer.steig)}, {r.zubringer.teilName}
              </dd>
            </div>
            <div>
              <dt>Anschluss</dt>
              <dd>
                <LineBadge line={r.anschluss.linie} kind={badgeArt(r.anschluss.art)} size="sm" />{' '}
                {fmtTime(r.anschluss.ist)}{r.anschluss.echtzeit ? '' : ' (Fahrplan)'} Richtung {r.anschluss.ziel}, {steig(r.anschluss.steig)}
              </dd>
            </div>
            <div>
              <dt>Fußweg</dt>
              <dd>
                {r.fussweg_min} min ({r.fussweg.wegMin} min Weg{r.fussweg.geschaetzt ? ', geschätzt' : ''}, {r.fussweg.zuschlagMin} min Zuschlag
                {r.fussweg.aufzugGestoert ? ' einschließlich gestörtem Aufzug' : ' für das Aussteigen'})
              </dd>
            </div>
            {r.naechste && (
              <div>
                <dt>Nächste Fahrt</dt>
                <dd>{fmtTime(r.naechste.ist)} Richtung {r.naechste.ziel}, Puffer {r.naechste.puffer_min} min</dd>
              </div>
            )}
          </dl>
          {r.hinweise.length > 0 && (
            <ul className="anschluss-hinweise small">
              {r.hinweise.map((h) => <li key={h}>{h}</li>)}
            </ul>
          )}
        </div>
      )}
      <p className="muted small anschluss-grenzen">
        Grenzen der Rechnung: Fußwege sind Richtwerte je Bahnhofsteil, nicht je Gleis. Die Position am Bahnsteig, Gedränge und
        Umwege ohne Treppe sind nicht berücksichtigt. Ohne Echtzeitdaten wird mit dem Fahrplan gerechnet. Die Angabe ist eine
        Einschätzung, keine Zusage der Verkehrsunternehmen.
      </p>
      <Source>
        Fahrplan- und Echtzeitdaten: EFA-BW (NVBW), DL-DE-BY-2.0. Verspätungsdaten DB: Deutsche Bahn (CC BY 4.0).
        Aufzugsstatus: DB InfraGO OpenStation. Abfrage höchstens jede Minute.
      </Source>
    </Section>
  );
}
