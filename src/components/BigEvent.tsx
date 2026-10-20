// Hinweis auf Großveranstaltungen des Tages (Stadion, Hallen am NeckarPark, Liederhalle, Messe):
// Zeitfenster für An- und Abreise, Belegung der Parkhäuser im Umfeld, Niederschlag zum Ende.
import { useState } from 'react';
import { useData } from '../lib/data';
import { useNow } from '../lib/api';
import { within } from '../lib/geo';
import { berlinDate, fmtTime } from '../lib/format';
import { weatherAt, isRainy } from '../lib/weather';
import type { CultureEvent, Selection } from '../lib/types';
import { Icon } from './Icon';

const VENUE = /MHP|Mercedes-Benz Arena|Mercedesstra(ß|ss)e (6\d|7\d|8\d)\b|Porsche-Arena|Schleyer|Cannstatter Wasen|Liederhalle|Berliner Platz 1\b|Messepiazza|Messe Stuttgart/i;

function endOf(e: CultureEvent) {
  const s = Date.parse(e.start!);
  if (e.end && Date.parse(e.end) > s) return Date.parse(e.end);
  return s + (/fußball/i.test(e.title) ? 115 : 150) * 60_000;
}

export function BigEventBanner({ select, flyTo }: { select: (s: Selection) => void; flyTo: (c: [number, number], z?: number) => void }) {
  const { events, parking, weather } = useData();
  const now = useNow(60_000);
  const [hidden, setHidden] = useState<string | null>(null);
  if (!events.data || events.data.date !== berlinDate(now)) return null;
  const big = events.data.events
    .filter((e) => e.start && !e.allDay && e.lon != null && VENUE.test(`${e.venue ?? ''} ${e.location ?? ''}`))
    .filter((e) => !/\(U\d+\)/.test(e.title)) // Nachwuchsspiele ohne Großandrang
    .filter((e) => endOf(e) + 90 * 60_000 > now)
    .sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!))[0];
  if (!big || hidden === big.id) return null;
  const start = Date.parse(big.start!);
  const end = endOf(big);
  const from = start - 2 * 3600_000, to = end + 90 * 60_000;
  const phase = now < from ? 'vorher' : now < start ? 'Anreise' : now < end ? 'Veranstaltung läuft' : 'Abreise';
  const parks = within((parking.data?.sites ?? []).filter((p) => p.free != null && p.capacity), [big.lon!, big.lat!], 1500).map((x) => x.item);
  const cap = parks.reduce((s, p) => s + p.capacity!, 0);
  const used = cap ? Math.round((1 - parks.reduce((s, p) => s + p.free!, 0) / cap) * 100) : null;
  const wxEnd = weatherAt(weather.data, end);
  return (
    <div className="big-event" role="status">
      <Icon name="warn" size={20} />
      <button type="button" className="big-main" onClick={() => { select({ type: 'event', id: big.id }); flyTo([big.lon!, big.lat!], 15); }}>
        <strong>Großveranstaltung heute {fmtTime(start)} Uhr: {big.title}</strong>
        <span>
          {phase === 'vorher' ? `Erhöhtes Verkehrsaufkommen im Umfeld voraussichtlich ${fmtTime(from)} bis ${fmtTime(to)} Uhr.` : `${phase}, erhöhtes Verkehrsaufkommen bis etwa ${fmtTime(to)} Uhr.`}
          {used != null && ` Parkhäuser im Umkreis von 1,5 km: ${used} % belegt.`}
          {wxEnd && ` Zum Ende (ca. ${fmtTime(end)} Uhr): ${isRainy(wxEnd) ? 'Niederschlag erwartet' : 'kein Niederschlag erwartet'}.`}
        </span>
      </button>
      <button type="button" className="icon-btn ghost" onClick={() => setHidden(big.id)} aria-label="Hinweis ausblenden"><Icon name="close" size={18} /></button>
    </div>
  );
}
