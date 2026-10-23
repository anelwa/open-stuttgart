// Quellen- und Lizenzregister. Jede Werkzeugantwort nennt die Quellen; `stuttgart://licenses`
// veröffentlicht das Register maschinenlesbar. Die Angaben folgen dem, was die App selbst anzeigt.
export const SOURCES = {
  stuttgart: {
    name: 'Landeshauptstadt Stuttgart, stuttgart.de',
    url: 'https://www.stuttgart.de/',
    license: 'Amtliche Werke und Seiteninhalte; Quellenangabe. Details je Seite.',
    note: 'Verwaltung, Seiten, Dokumente, Kontakte und Bekanntmachungen.',
  },
  stuttgartGeo: {
    name: 'Landeshauptstadt Stuttgart, Stadtmessungsamt, Geoserver',
    url: 'https://geoserver.stuttgart.de/',
    license: 'CC BY 4.0 / Open Data, soweit freigegeben',
    note: 'WFS 2.0.0 mit 458 Layern; nicht jeder Layer ist als Open Data freigegeben.',
  },
  gis6: {
    name: 'Landeshauptstadt Stuttgart, gis6 Location Finder',
    url: 'https://gis6.stuttgart.de/',
    license: 'Amtlicher Geocoder der Stadt; Quellenangabe',
  },
  efa: {
    name: 'EFA-BW (NVBW)',
    url: 'https://www.efa-bw.de/',
    license: 'Datenlizenz Deutschland – Namensnennung 2.0',
    note: 'Abfahrten, Haltestellen, Verbindungssuche; ohne Gewähr, maßgeblich ist der Aushang.',
  },
  gtfsrt: {
    name: 'GTFS-Realtime über gtfs.de (NVBW/MobiData BW)',
    url: 'https://gtfs.de/',
    license: 'CC BY-SA 4.0 (Feed), Datenlizenz Deutschland – Namensnennung 2.0',
    note: 'Verspätungen und Pünktlichkeitswerte.',
  },
  db: {
    name: 'DB Timetables / IRIS, Deutsche Bahn',
    url: 'https://www.deutschebahn.com/',
    license: 'DB-Regeln; IRIS ist ein Übergangsweg',
    note: 'Fernbahn am Hauptbahnhof, Anschlüsse, Aufzüge.',
  },
  vvs: {
    name: 'VVS / Verband Region Stuttgart',
    url: 'https://www.vvs.de/',
    license: 'Quellenangabe VVS',
    note: 'P+R, Bike+Ride, Netzdaten.',
  },
  mobidata: {
    name: 'MobiData BW',
    url: 'https://www.mobidata-bw.de/',
    license: 'Datenlizenz Deutschland – Namensnennung 2.0, je Datensatz',
    note: 'ParkAPI, GBFS, Bike+Ride, Ladesäulen, DATEX II, Eco-Counter.',
  },
  parkapi: {
    name: 'ParkAPI v3 über MobiData BW',
    url: 'https://www.mobidata-bw.de/',
    license: 'dl-de/by-2-0',
    note: 'Parkhäuser mit Live-Belegung, P+R, Bike+Ride.',
  },
  gbfs: {
    name: 'GBFS 2.3 über MobiData BW',
    url: 'https://www.mobidata-bw.de/',
    license: 'dl-de/by-2-0, je Anbieter',
    note: 'Sharing-Angebote (stadtmobil, RegioRad, Call a Bike, Dott, Bolt, Lime …).',
  },
  datex: {
    name: 'Landesmeldestelle BW / Verkehrsleitzentrale Stuttgart (DATEX II)',
    url: 'https://www.mobidata-bw.de/',
    license: 'dl-de/by-2-0',
    note: 'Verkehrsmeldungen und Baustellen.',
  },
  autobahn: {
    name: 'Autobahn GmbH des Bundes',
    url: 'https://www.autobahn.de/',
    license: 'dl-de/by-2-0',
    note: 'Autobahn-Baustellen, Sperrungen und Staus im Umkreis.',
  },
  dwd: {
    name: 'Deutscher Wetterdienst (DWD)',
    url: 'https://www.dwd.de/',
    license: 'GeoNutzV / CC BY 4.0, je Produkt',
    note: 'Wetter, Warnungen, Pollen, UV, Hitze, Radar, Biowetter.',
  },
  brightsky: {
    name: 'Bright Sky (DWD-Daten)',
    url: 'https://brightsky.dev/',
    license: 'GeoNutzV; Daten des DWD',
    note: 'Wetter, Vorhersage, Warnungen und Radar in einer API.',
  },
  uba: {
    name: 'Umweltbundesamt (UBA) mit Daten der LUBW',
    url: 'https://www.umweltbundesamt.de/',
    license: 'dl-de/by-2-0',
    note: 'Luftqualitätsindex und Schadstoffe der Stuttgarter Messstationen.',
  },
  pegel: {
    name: 'Wasserstraßen- und Schifffahrtsverwaltung des Bundes (PEGELONLINE)',
    url: 'https://www.pegelonline.wsv.de/',
    license: 'Datenlizenz Deutschland – Namensnennung 2.0',
    note: 'Neckarpegel Cannstatt.',
  },
  nina: {
    name: 'Bundesamt für Bevölkerungsschutz und Katastrophenhilfe (BBK), NINA/MoWaS',
    url: 'https://warnung.bund.de/',
    license: 'dl-de/by-2-0',
    note: 'Amtliche Gefahrenmeldungen mit Warngebieten.',
  },
  openmeteo: {
    name: 'Open-Meteo (Modelle des DWD)',
    url: 'https://open-meteo.com/',
    license: 'CC BY 4.0',
    note: 'Modellwerte für den Luftaustausch im Talkessel.',
  },
  sensocommunity: {
    name: 'Sensor.Community / openSenseMap',
    url: 'https://sensor.community/',
    license: 'ODbL / offene Sensordaten',
    note: 'Bürgersensoren für das Höhenprofil.',
  },
  stadtklima: {
    name: 'Klimaatlas der Landeshauptstadt Stuttgart',
    url: 'https://www.stuttgart.de/',
    license: 'Quellenangabe Stadt Stuttgart',
    note: 'Kaltluftleitbahnen und Klimatope.',
  },
  wikidata: {
    name: 'Wikidata',
    url: 'https://www.wikidata.org/',
    license: 'CC0 1.0',
    note: 'Sehenswürdigkeiten, Koordinaten, Wikipedia-Artikel.',
  },
  wikipedia: {
    name: 'Wikipedia (deutsch)',
    url: 'https://de.wikipedia.org/',
    license: 'CC BY-SA 4.0',
    note: 'Kurztexte zu Orten und Bauwerken.',
  },
  commons: {
    name: 'Wikimedia Commons',
    url: 'https://commons.wikimedia.org/',
    license: 'CC BY / CC BY-SA / CC0, je Bild',
    note: 'Bilder zu Sehenswürdigkeiten.',
  },
  osm: {
    name: 'OpenStreetMap-Mitwirkende',
    url: 'https://www.openstreetmap.org/',
    license: 'ODbL 1.0',
    note: 'Gastronomie, POIs, Wege, Geocaches, OSM-Hinweise.',
  },
  overpass: {
    name: 'Overpass / OpenStreetMap-Auszug',
    url: 'https://www.openstreetmap.org/',
    license: 'ODbL 1.0',
    note: 'Vorberechnete Auszüge für Gastronomie und Freizeit.',
  },
  opencaching: {
    name: 'Opencaching.de',
    url: 'https://www.opencaching.de/',
    license: 'Je Cache; Listing-Inhalte mit Quellenangabe',
    note: 'Geocaches im Umkreis; Logs und Details nur auf der Plattform.',
  },
  openligadb: {
    name: 'OpenLigaDB',
    url: 'https://www.openligadb.de/',
    license: 'Open Data, Quellenangabe',
    note: 'VfB-Heimspiele im Terminkalender.',
  },
  stadtmarketing: {
    name: 'Stuttgart-Marketing GmbH',
    url: 'https://www.stuttgart-tourist.de/',
    license: 'Quellenangabe; nur Termine und Links',
    note: 'Veranstaltungen und Tourismus.',
  },
  stadtbibliothek: {
    name: 'Stadtbibliothek Stuttgart',
    url: 'https://www.stadtbibliothek-stuttgart.de/',
    license: 'Quellenangabe',
    note: 'Veranstaltungen der Stadtbibliothek.',
  },
  gancio: {
    name: 'Offenes Veranstaltungsregister Stuttgart (Gancio)',
    url: 'https://gancio.org/',
    license: 'CC0 1.0 (Register), je Termin',
    note: 'Szene-Termine; nur mit OS_GANCIO_URL aktiv.',
  },
  szene: {
    name: 'Haus- und Szenequellen (Theaterhaus, Im Wizemann, Bix, Wagenhallen, Hochschulen, stuvus …)',
    url: 'https://open-stuttgart.de/',
    license: 'Keine einheitliche Lizenz; nur Termin, Ort, Preis und Link',
    note: 'Einzelne Quellen mit OS_SCENE_<KEY>=0 abschaltbar.',
  },
  veranstaltungen: {
    name: 'Veranstaltungskalender der Landeshauptstadt Stuttgart',
    url: 'https://www.stuttgart.de/veranstaltungen/',
    license: 'Quellenangabe Stadt Stuttgart',
    note: 'Termine der Stadt und angeschlossener Häuser.',
  },
  openmensa: {
    name: 'OpenMensa',
    url: 'https://openmensa.org/',
    license: 'CC BY-SA 4.0',
    note: 'Tagesgerichte der Stuttgarter Mensen.',
  },
  inaturalist: {
    name: 'iNaturalist-Community',
    url: 'https://www.inaturalist.org/',
    license: 'CC0 / CC BY / CC BY-SA, je Foto',
    note: 'Verifizierte Artenbeobachtungen mit freien Fotos.',
  },
  gbif: {
    name: 'GBIF',
    url: 'https://www.gbif.org/',
    license: 'CC0 / CC BY, je Datensatz',
    note: 'Artenvorkommen im Umkreis.',
  },
  foodsharing: {
    name: 'foodsharing.de',
    url: 'https://foodsharing.de/',
    license: 'ODbL / Quellenangabe',
    note: 'Fairteiler und Lebensmittelrettung.',
  },
  fragdenstaat: {
    name: 'FragDenStaat',
    url: 'https://fragdenstaat.de/',
    license: 'CC BY-SA 4.0, je Anfrage',
    note: 'Transparenzanfragen mit Bezug zu Stuttgart.',
  },
  komunis: {
    name: 'Landeshauptstadt Stuttgart, Statistisches Amt (KOMUNIS)',
    url: 'https://www.stuttgart.de/statistik/',
    license: 'Quellenangabe; XLSX-Anhänge je Tabelle',
    note: 'Amtliche Statistiken; Schnittstelle nicht dokumentiert.',
  },
  govdata: {
    name: 'GovData.de',
    url: 'https://www.govdata.de/',
    license: 'Metadaten CC0; Daten je Datensatz',
    note: 'DCAT-AP-Katalog mit Stuttgart-Bezug.',
  },
  opendataStuttgart: {
    name: 'OpenData@Stuttgart (CKAN)',
    url: 'https://opendata.stuttgart.de/',
    license: 'Je Datensatz, häufig CC BY 4.0',
    note: 'Datensätze und Download-Links der Stadt.',
  },
  k10plus: {
    name: 'K10plus / Stuttgarter Bibliothekskatalog',
    url: 'https://sru.k10plus.de/',
    license: 'Metadaten; Quellenangabe',
    note: 'Bibliotheksbestand.',
  },
  unfallatlas: {
    name: 'Unfallatlas der Statistischen Ämter des Bundes und der Länder',
    url: 'https://unfallatlas.statistikportal.de/',
    license: 'dl-de/by-2-0',
    note: 'Unfälle mit Personenschaden 2025.',
  },
  wsv: {
    name: 'Wasserstraßen- und Schifffahrtsverwaltung des Bundes',
    url: 'https://www.wsv.de/',
    license: 'Datenlizenz Deutschland – Namensnennung 2.0',
  },
  adsb: {
    name: 'adsb.lol',
    url: 'https://adsb.lol/',
    license: 'ODbL',
    note: 'ADS-B-Luftfahrzeuge; Community-Netz, keine amtliche Flugverkehrsdaten.',
  },
  noaa: {
    name: 'NOAA Aviation Weather (METAR)',
    url: 'https://aviationweather.gov/',
    license: 'US Government Open Data',
    note: 'METAR für die Betriebsrichtung des Flughafens.',
  },
  wheretheiss: {
    name: 'wheretheiss.at',
    url: 'https://wheretheiss.at/',
    license: 'Quellenangabe',
    note: 'Position der ISS (berechnet).',
  },
  energycharts: {
    name: 'Fraunhofer ISE, Energy-Charts',
    url: 'https://www.energy-charts.info/',
    license: 'CC BY 4.0',
    note: 'Grünstrom-Anteil im regionalen Netz.',
  },
  stromgedacht: {
    name: 'TransnetBW StromGedacht',
    url: 'https://www.stromgedacht.de/',
    license: 'Quellenangabe TransnetBW',
    note: 'Zustand des Stromnetzes.',
  },
  stadtpalais: {
    name: 'StadtPalais – Museum für Stuttgart',
    url: 'https://www.stadtpalais-stuttgart.de/',
    license: 'Quellenangabe',
    note: 'Programm und Ausstellungen.',
  },
  ocpdb: {
    name: 'OCPDB über MobiData BW (Bundesnetzagentur und Betreiber)',
    url: 'https://www.mobidata-bw.de/',
    license: 'dl-de/by-2-0',
    note: 'Ladepunkte für Elektrofahrzeuge.',
  },
  ecocounter: {
    name: 'Eco-Counter / CKAN über MobiData BW',
    url: 'https://www.mobidata-bw.de/',
    license: 'CC BY 4.0',
    note: 'Fahrradzählstellen.',
  },
  tankerkoenig: {
    name: 'Tankerkönig / Mobilithek',
    url: 'https://www.tankerkoenig.de/',
    license: 'CC BY 4.0 / Quellenangabe',
    note: 'Kraftstoffpreise; ohne Gewähr, maßgeblich ist die Zapfsäule.',
  },
};

export const LICENSE_LIST = Object.entries(SOURCES).map(([id, s]) => ({ id, ...s }));

export function source(id) {
  return SOURCES[id] ?? { name: String(id) };
}

export function sourcesByIds(ids = []) {
  return ids.map((id) => source(id));
}
