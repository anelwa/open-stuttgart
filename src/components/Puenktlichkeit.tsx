// Panel "Pünktlichkeit jetzt": Halte der letzten 60 Minuten im Raum Stuttgart aus dem
// GTFS-RT-Feed von gtfs.de (siehe server/sources/gtfsrt.mjs). Erwartet GET /api/puenktlichkeit.
import { usePolling } from '../lib/api';
import { fmtDec, fmtNum, fmtTime } from '../lib/format';
import { LineBadge } from './LineBadge';
import { ErrorNote, Section, Source } from './ui';
import '../styles/puenktlichkeit.css';

export type Verkehrsart = 'Stadtbahn' | 'Bus' | 'S-Bahn' | 'Regional/Fern';

export interface PuenktlichkeitArt {
  art: Verkehrsart;
  halte: number;
  /** Anteil der Halte mit weniger als 3 Minuten Verspätung, in Prozent */
  puenktlich3: number | null;
  /** mittlere Verspätung in Minuten */
  mittel: number | null;
  p90?: number | null;
  ausfaelle?: number;
}

export interface PuenktlichkeitLinie {
  linie: string;
  art: Verkehrsart;
  mittel: number;
  p90: number;
  /** Anteil der Halte mit 3 Minuten Verspätung oder mehr, in Prozent */
  anteil3: number;
  n: number;
  ausfaelle?: number;
}

export interface PuenktlichkeitJetzt {
  aktiv?: boolean;
  stand: string | null;
  fenster_min?: number;
  verkehrsmittel: PuenktlichkeitArt[];
  linien: PuenktlichkeitLinie[];
  definition?: string;
  veraltet?: boolean;
  hinweis?: string;
  quelle: string;
}

export interface PuenktlichkeitTage {
  tage: { datum: string; verkehrsmittel: PuenktlichkeitArt[] }[];
  von: string | null;
  bis: string | null;
  verkehrsmittel: PuenktlichkeitArt[];
  linien: (PuenktlichkeitLinie & { ausfaelle: number })[];
  definition: string;
  hinweis: string;
  quelle: string;
}

const DEFINITION = 'Pünktlich: weniger als 3 Minuten Verspätung an der Abfahrt (an Endhalten: Ankunft), gezählt über alle Halte im Raum Stuttgart in den letzten 60 Minuten. Verfrühungen zählen als 0. Ausgefallene Halte sind nicht eingerechnet.';
const QUELLE = 'Echtzeitdaten: NVBW/MobiData BW (DL-DE-BY-2.0) über gtfs.de (CC BY-SA 4.0)';

const badgeKind = (art: Verkehrsart) => (art === 'Regional/Fern' ? 'zug' : undefined);
const stufe = (p: number | null) => (p == null ? 'leer' : p >= 90 ? 'gut' : p >= 75 ? 'mittel' : 'schlecht');

export function PuenktlichkeitSection() {
  const { data, error, loading, reload } = usePolling<PuenktlichkeitJetzt>('/api/puenktlichkeit', 180_000);
  const d = data;
  if (d && d.aktiv === false) return null;
  const linien = (d?.linien ?? []).slice(0, 5);

  return (
    <Section title="Pünktlichkeit jetzt" explain="puenktlichkeit" aside={d?.stand ? `Stand ${fmtTime(d.stand)} Uhr` : undefined}>
      {error && !d && <ErrorNote text="Echtzeitdaten derzeit nicht verfügbar." onRetry={reload} />}
      {!d && loading && <span className="skeleton block" style={{ height: 96 }} />}
      {d && (
        <>
          {d.veraltet && <p className="muted small">Die Daten sind älter als 15 Minuten.</p>}
          <ul className="pk-kacheln" aria-label="Anteil pünktlicher Halte je Verkehrsmittel">
            {d.verkehrsmittel.map((v) => (
              <li key={v.art} className={`pk-kachel pk-${stufe(v.puenktlich3)}`} title={d.definition ?? DEFINITION}>
                <span className="pk-art">{v.art}</span>
                <strong className="pk-wert">{v.puenktlich3 != null ? `${fmtDec(v.puenktlich3, 0)} %` : '–'}</strong>
                <span className="pk-meta">
                  {v.halte > 0 ? <>pünktlich · Ø {fmtDec(v.mittel ?? 0)} min · {fmtNum(v.halte)} Halte</> : 'keine Halte erfasst'}
                </span>
              </li>
            ))}
          </ul>
          <p className="muted small pk-definition">{DEFINITION}</p>

          {linien.length > 0 && (
            <>
              <h4 className="list-head">Linien mit der höchsten mittleren Verspätung</h4>
              <ol className="pk-linien">
                {linien.map((l) => (
                  <li key={`${l.art}-${l.linie}`}>
                    <LineBadge line={l.linie} kind={badgeKind(l.art)} size="sm" />
                    <span className="pk-linie-art">{l.art}</span>
                    <span className="pk-linie-wert">
                      Ø {fmtDec(l.mittel)} min
                      <small> · p90 {fmtDec(l.p90)} min · {fmtDec(l.anteil3, 0)} % ab 3 min · {fmtNum(l.n)} Halte</small>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="muted small">Berücksichtigt sind Linien mit mindestens 20 erfassten Halten im Zeitraum.</p>
            </>
          )}
        </>
      )}
      <Source>{d?.quelle ?? QUELLE}</Source>
    </Section>
  );
}
