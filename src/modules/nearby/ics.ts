// Abfuhrtermine als Kalenderdatei (RFC 5545), ganztägig, im Browser erzeugt. Nichts wird an den Server geschickt.
type Waste = { street: string; nr: string; dates: { type: string; date: string }[] };

const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`);

export function icsFile(w: Waste) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Open Stuttgart//Abfuhrtermine//DE', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(`Abfuhr ${w.street} ${w.nr}`)}`];
  for (const d of w.dates) {
    const day = d.date.replace(/-/g, '');
    const next = new Date(`${d.date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    lines.push('BEGIN:VEVENT', `UID:${day}-${d.type.replace(/\W/g, '')}-${w.street.replace(/\W/g, '')}${w.nr}@open-stuttgart`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`,
      `SUMMARY:${esc(d.type)}`, `DESCRIPTION:${esc(`Abfuhr ${w.street} ${w.nr}. Quelle: Abfallwirtschaft Stuttgart.`)}`,
      'BEGIN:VALARM', 'TRIGGER:-PT6H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(d.type)} morgen`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `abfuhr-${w.street}-${w.nr}.ics`.replace(/\s+/g, '-').toLowerCase();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
