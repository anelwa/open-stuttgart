// MCP-Prompts: kuratierte Arbeitsanweisungen für häufige Aufgaben. Sie nennen die
// passenden Werkzeuge, verlangen Quellen und halten die Grenzen des Servers fest.
const PROMPTS = [
  {
    name: 'stadt-check',
    title: 'Adresse prüfen',
    description: 'Prüft, was die Stadt über eine Adresse weiß: Bezirk, Wahllokal, Starkregen, Lärm, Solar, Schulbezirk, Abfall und nächste Stellen – mit Quellen.',
    arguments: [
      { name: 'adresse', description: 'Adresse in Stuttgart, z. B. „Marienplatz 1“.', required: true },
      { name: 'anliegen', description: 'Optionaler Anlass, z. B. „Umzug“, „Solaranlage“, „Schulweg“.', required: false },
    ],
    build: ({ adresse, anliegen }) => `Prüfe die Adresse „${adresse}“${anliegen ? ` im Hinblick auf: ${anliegen}` : ''}.

Vorgehen:
1. Verorte die Adresse mit geocode (scope="auto").
2. Rufe address_profile mit den Koordinaten auf. Ergänze bei Bedarf school_district und waste (Straße und Hausnummer aus der Adresse).
3. Fasse die wichtigsten Punkte in höchstens acht Zeilen zusammen: Stadtbezirk, Wahllokal, Starkregen/Hochwasser, Lärm, Solar/Gründach, nächste Verwaltungsstelle, Notfall-Treffpunkt.
4. Nenne zu jedem Punkt die Quelle und den Zeitstand. Weise auf Unsicherheiten hin (z. B. „Profil ist eine Auswahl“).
5. Keine rechtliche oder finanzielle Beratung; verweise auf die verlinkten Originalseiten.`,
  },
  {
    name: 'route-planen',
    title: 'Route planen',
    description: 'Plant eine Route mit ÖPNV, Rad, Auto oder zu Fuß – inklusive Barrierefreiheit, Parken am Ziel und Hinweisen.',
    arguments: [
      { name: 'von', description: 'Startadresse oder Ort.', required: true },
      { name: 'nach', description: 'Zieladresse oder Ort.', required: true },
      { name: 'modus', description: 'oepnv, rad, auto oder fuss (Standard oepnv).', required: false },
    ],
    build: ({ von, nach, modus }) => `Plane eine Route von „${von}“ nach „${nach}“ mit dem Modus „${modus || 'oepnv'}“.

Vorgehen:
1. Rufe plan_route mit from, to und mode auf. Bei Bedarf profile="rollstuhl" oder "kinderwagen" und time/arrive_by für einen Termin.
2. Gib die beste Variante mit Dauer, Ab-/Ankunft, Umstiegen und Fußweg an; nenne eine Alternative, wenn vorhanden.
3. Nenne Hinweise zu Baustellen, Ausfällen, Aufzügen oder Parken am Ziel, sofern das Werkzeug sie liefert.
4. Zitiere EFA-BW/OSRM als Quelle und weise darauf hin, dass die Angaben ohne Gewähr sind.`,
  },
  {
    name: 'verwaltungsweg',
    title: 'Verwaltungsweg',
    description: 'Findet die passende Leistung, Unterlagen, Gebühren, Online-Dienst und das schnellste Bürgerbüro.',
    arguments: [
      { name: 'anliegen', description: 'Was soll erledigt werden? z. B. „Personalausweis verlängern“.', required: true },
      { name: 'adresse', description: 'Wohnadresse für die Zuständigkeit (optional).', required: false },
    ],
    build: ({ anliegen, adresse }) => `Ich möchte Folgendes erledigen: ${anliegen}.${adresse ? ` Meine Adresse ist ${adresse}.` : ''}

Vorgehen:
1. Suche mit services (topic="search") nach der Leistung. Wenn mehrere Treffer: die zwei besten nennen und nachfragen, sonst den besten nehmen.
2. Lade mit services (topic="detail") Voraussetzungen, Unterlagen, Gebühren, Fristen, Online-Dienst und Terminbuchung.
3. Bestimme mit services (topic="where") oder offices die zuständigen Stellen. Wenn eine Adresse vorliegt, sortiere nach Entfernung und nenne die Live-Wartezeit.
4. Fasse den Weg in nummerierten Schritten zusammen. Nenne Quelle und Stand; keine Buchung und keine Antragstellung durch dich.
5. Wenn Angaben fehlen, sage das offen und verweise auf die Leistungsseite.`,
  },
  {
    name: 'abendplan',
    title: 'Abendplan',
    description: 'Stellt aus Terminen, Wetter, Gastro und Heimweg einen konkreten Abendplan zusammen.',
    arguments: [
      { name: 'datum', description: 'Datum YYYY-MM-DD (optional, Standard heute).', required: false },
      { name: 'szene', description: 'z. B. konzert, party, comedy, buehne, kneipe.', required: false },
      { name: 'publikum', description: 'alle oder jung.', required: false },
    ],
    build: ({ datum, szene, publikum }) => `Plane einen Abend in Stuttgart${datum ? ` am ${datum}` : ' heute'}${szene ? ` im Bereich ${szene}` : ''}${publikum === 'jung' ? ' für ein junges Publikum' : ''}.

Vorgehen:
1. Rufe events mit source="scene", passendem date/span/scene und audience auf.
2. Prüfe das Wetter mit weather (include_radar=true, wenn Regen wahrscheinlich ist) und nenne eine Regenvariante.
3. Schlage zwei bis drei Termine mit Uhrzeit, Ort, Preis (falls bekannt) und Quelle vor. Nenne einen passenden Ort zum Essen aus nearby (Kategorie „restaurant“ oder „kneipe“) in der Nähe.
4. Prüfe den Heimweg mit departures an der nächsten Haltestelle; nenne die letzte sinnvolle Verbindung.
5. Alle Angaben mit Quelle und Hinweis „ohne Gewähr“. Keine Reservierung, kein Ticketkauf.`,
  },
  {
    name: 'wochenendplan',
    title: 'Wochenendplan',
    description: 'Plant ein Wochenende mit Terminen, Natur, Sehenswürdigkeiten und Ausflügen in Stuttgart.',
    arguments: [
      { name: 'interessen', description: 'z. B. „Kinder“, „Wandern“, „Kultur“, „Fotografie“.', required: false },
      { name: 'stadtbezirk', description: 'Startbezirk, z. B. „Mitte“ oder „Degerloch“.', required: false },
    ],
    build: ({ interessen, stadtbezirk }) => `Plane ein Wochenende in Stuttgart${stadtbezirk ? ` ab ${stadtbezirk}` : ''}${interessen ? ` mit den Interessen: ${interessen}` : ''}.

Vorgehen:
1. Rufe events mit source="all", span="wochenende" auf.
2. Ergänze je nach Interessen: places (Sehenswürdigkeiten), leisure (hiking oder freizeit), nature (Beobachtungen) und bei Regen ein Museum.
3. Prüfe das Wetter für beide Tage und nenne eine Schlechtwetter-Alternative.
4. Baue einen realistischen Ablauf mit Uhrzeiten, Orten, Wegen (plan_route oder departures) und Quellen.
5. Kennzeichne Annahmen und Angaben ohne Gewähr; keine Buchungen.`,
  },
  {
    name: 'datenquellen',
    title: 'Datenquellen prüfen',
    description: 'Erklärt, welche Quelle hinter einer Angabe steht, wie aktuell sie ist und unter welcher Lizenz sie weiterverwendet werden darf.',
    arguments: [
      { name: 'thema', description: 'Thema oder konkrete Angabe, z. B. „Wartezeit Bürgerbüro“ oder „Luftqualität“.', required: true },
    ],
    build: ({ thema }) => `Erkläre die Datenquelle(n) zu: ${thema}.

Vorgehen:
1. Rufe about mit detail="licenses" auf und suche die passenden Quellen.
2. Rufe bei Bedarf das zuständige Werkzeug auf und prüfe das Feld source/fetchedAt.
3. Nenne Quelle, Lizenz, Zeitstand, Grenzen und den Link zur Originalquelle.
4. Wenn die Angabe nur verlinkt oder gar nicht verfügbar ist, sage das klar (about → coverage).
5. Keine Lizenzberatung: bei unklarer Rechtslage auf die Quelle verweisen.`,
  },
];

export const prompts = PROMPTS.map(({ build, ...p }) => p);

export function getPrompt(name, args = {}) {
  const p = PROMPTS.find((x) => x.name === name);
  if (!p) return null;
  const missing = p.arguments.filter((x) => x.required && !String(args[x.name] ?? '').trim());
  if (missing.length) {
    return { error: `Pflichtargument fehlt: ${missing.map((x) => x.name).join(', ')}` };
  }
  const text = p.build(args);
  return {
    description: p.description,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
