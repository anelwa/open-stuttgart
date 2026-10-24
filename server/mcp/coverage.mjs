// Ehrliche Abdeckung: welche Domäne ist live, zwischengespeichert, nur verlinkt oder gar nicht da.
// Wird über das Werkzeug `about` und die Ressource `stuttgart://coverage` veröffentlicht.
export const COVERAGE = {
  domains: [
    { id: 'mobility', label: 'Weg, Abfahrten, Bahn, Verkehr', status: 'live', note: 'EFA-BW, GTFS-RT, DB, DATEX II, Valhalla/OSRM' },
    { id: 'parking', label: 'Parken, P+R, B+R, Sharing, Laden', status: 'live', note: 'ParkAPI, GBFS, OCPDB über MobiData BW' },
    { id: 'verwaltung', label: 'Leistungen, Stellen, Bürgerbüros', status: 'live', note: 'stuttgart.de, Live-Wartezeiten' },
    { id: 'events', label: 'Termine, Szene, Kultur', status: 'live', note: 'Stadtkalender, Hausseiten, offenes Register' },
    { id: 'umland', label: 'Ausflugsziele im Umland', status: 'live', note: 'redaktionelle Auswahl, VVS, Open-Meteo, Wikipedia' },
    { id: 'environment', label: 'Wetter, Luft, Pegel, Warnungen, Radar', status: 'live', note: 'DWD, UBA, PEGELONLINE, BBK' },
    { id: 'health', label: 'Pollen, UV, Hitze, Stromnetz, Grünstrom', status: 'live', note: 'DWD, TransnetBW, Fraunhofer ISE' },
    { id: 'address', label: 'Adressprofil', status: 'cached', note: 'Geoserver, Statistisches Amt; 30 Tage je Ort' },
    { id: 'knowledge', label: 'Seiten, Dokumente, Kontakte', status: 'cached', note: 'lokale SQLite/FTS5-Suche' },
    { id: 'open_data', label: 'WFS-Layer und offene Kataloge', status: 'live', note: 'Geoserver, GovData, CKAN, KOMUNIS' },
    { id: 'nature', label: 'Arten, Bäume, Fairteiler', status: 'live', note: 'iNaturalist, GBIF, Baumkataster, foodsharing' },
    { id: 'participation', label: 'Bebauungspläne, Wahlen, Verfahren', status: 'mixed', note: 'Geodaten und amtliche Dateien; Beteiligungsportal ohne offenen Feed' },
    { id: 'booking', label: 'Terminbuchung', status: 'link-only', note: 'keine offene API für freie Slots; nur Link' },
    { id: 'applications', label: 'Anträge und Zahlungen', status: 'missing', note: 'keine Authentifizierung, keine Übermittlung' },
    { id: 'live_audio', label: 'Sprache und Live-Audio', status: 'missing', note: 'nicht Teil des MCP-Servers' },
  ],
  updatedAt: new Date().toISOString(),
};

export const LIMITS = [
  'Nur lesend: keine Buchungen, Anträge, Zahlungen oder Änderungen.',
  'Angaben ohne Gewähr; maßgeblich sind die verlinkten Originalquellen.',
  'Live-Werte (Wartezeiten, Parken, Sharing, Abfahrten) können sich minütlich ändern.',
  'Der Server ist kein amtlicher Auskunftsdienst und ersetzt keine Rechts- oder Medizinberatung.',
  'Keine Standortabfrage ohne ausdrückliche Koordinaten oder Adresse im Aufruf.',
];
