// Quellenregister des Erweiterungsprogramms. 100 öffentliche Schnittstellen, APIs und
// Datensätze, die vorher nicht in der Anwendung waren. Die Liste ist die einzige
// Wahrheit für Oberfläche, API, Prüfskript und Dokumentation.
//
// Status:
//   live     – Adapter und Route laufen, Quelle wird getestet
//   geplant  – recherchiert, aber noch nicht angebunden
//   key      – benötigt einen frei beantragbaren Schlüssel (OS_*)
//
// Grundsatz: keine Quelle ohne Lizenz, keine Quelle ohne Quellenangabe. Wo eine Quelle
// keine ausdrückliche offene Lizenz nennt, steht das in `license` und `note`.

const CKAN_LICENSE = 'CC BY 4.0';
const CKAN_ATTRIBUTION = 'Landeshauptstadt Stuttgart, OpenData@Stuttgart';

const ckan = (id, title, dataset, group, summary, config = {}) => ({
  id,
  title,
  category: 'stadt',
  group,
  kind: 'CKAN-Datensatz',
  adapter: 'ckanCsv',
  config: { dataset, resourceFormat: 'CSV', ...config },
  license: CKAN_LICENSE,
  attribution: CKAN_ATTRIBUTION,
  url: `https://opendata.stuttgart.de/dataset/${dataset}`,
  summary,
  status: 'live',
  ttl: '12 Stunden',
  note: 'Amtliche Statistik; Werte sind Momentaufnahmen und können nachträglich korrigiert werden.',
});

const wfs = (id, title, layer, summary, extra = {}) => ({
  id,
  title,
  category: 'stadt',
  group: extra.group ?? 'stadt',
  kind: 'WFS-Layer',
  adapter: 'wfsLayer',
  config: {
    baseUrl: 'https://geoserver.stuttgart.de/geoserver/ows',
    version: '2.0.0',
    layer,
    title,
  },
  license: 'CC BY 4.0',
  attribution: 'Landeshauptstadt Stuttgart, Stadtmessungsamt',
  url: 'https://geoserver.stuttgart.de/',
  summary,
  status: 'live',
  ttl: '6 Stunden',
  note: 'GeoJSON-Ausschnitt; die Stadt veröffentlicht nicht jeden WFS-Layer als Open Data.',
  ...extra,
});

const lubw = (id, title, service, summary, extra = {}) => ({
  id,
  title,
  category: 'region',
  group: extra.group ?? 'natur',
  kind: 'LUBW-WFS',
  adapter: 'arcgisGeoJson',
  config: { service, title, radiusKm: 20, include: extra.include ?? [] },
  license: 'Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0)',
  attribution: 'Landesanstalt für Umwelt Baden-Württemberg (LUBW)',
  url: `https://rips-gdi.lubw.baden-wuerttemberg.de/arcgis/rest/services/wfs/${service}/MapServer`,
  summary,
  status: 'live',
  ttl: '12 Stunden',
  note: 'Landesweite Schutzgebiets- und Umweltdaten; der Ausschnitt folgt der Kartenmitte.',
  ...extra,
});

const lgl = (id, title, layer, summary) => ({
  id,
  title,
  category: 'region',
  group: 'natur',
  kind: 'LGL-BW-WFS',
  adapter: 'lglWfs',
  config: { layer, title },
  license: 'Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0)',
  attribution: 'LGL Baden-Württemberg (2026)',
  url: 'https://www.lgl-bw.de/Produkte/Open-Data/',
  summary,
  status: 'live',
  ttl: '12 Stunden',
  note: 'ATKIS Basis-DLM; landesweite Geobasisdaten, kein amtlicher Bebauungsplan.',
});

const api = (id, title, group, summary, config, extra = {}) => ({
  id,
  title,
  category: extra.category ?? 'welt',
  group,
  kind: extra.kind ?? 'REST-API',
  adapter: extra.adapter ?? 'jsonApi',
  config,
  license: extra.license ?? 'Quellenangabe; siehe Anbieter',
  attribution: extra.attribution ?? title,
  url: extra.url ?? config.url ?? '',
  summary,
  status: extra.status ?? 'live',
  ttl: extra.ttl ?? '15 Minuten',
  note: extra.note ?? null,
  ...extra,
});

// ---------- 1–40: Amtliche Datensätze der Stadt (CKAN) ----------
const ckanSources = [
  ckan('ckan-einwohner-altersgruppen', 'Einwohner nach Altersgruppen und Stadtbezirken', 'einwohner-altersgruppen-stadtbezirke', 'bevoelkerung',
    'Einwohnerzahlen seit 1986 nach Stadtbezirk und Altersgruppe. Grundlage für Altersstruktur, Familien- und Seniorenbedarf.'),
  ckan('ckan-privathaushalte', 'Privathaushalte nach Personenzahl', 'privathaushalte-nach-der-zahl-der-personen', 'bevoelkerung',
    'Haushaltsgrößen seit 1992 – ein Indikator für Wohnraumbedarf und Singularisierung.'),
  ckan('ckan-familien', 'Familien mit Kindern nach Stadtbezirken', 'privathaushalte-familien-stadtbezirke', 'bevoelkerung',
    'Zahl der Familien und Kinder je Stadtbezirk; Grundlage für Familienangebote.'),
  ckan('ckan-beschaeftigte', 'Sozialversicherungspflichtig Beschäftigte am Wohnort', 'sozialversicherungspflichtig-beschaeftigte-am-wohnort', 'arbeit',
    'Beschäftigte nach Stadtbezirken seit 2001 – zeigt Erwerbsstruktur und Pendelverflechtung.'),
  ckan('ckan-arbeitslos', 'Arbeitslos Gemeldete nach Stadtbezirken', 'arbeitslos-gemeldete', 'arbeit',
    'Arbeitslosenzahlen seit 2005 je Stadtbezirk; für Kiezvergleiche und Sozialplanung.'),
  ckan('ckan-sgb2', 'Sozialgeldempfänger SGB II', 'sozialgeldempfaenger-sgb-ii', 'soziales',
    'Empfänger von Sozialgeld nach Stadtbezirken seit 2005.'),
  ckan('ckan-einkommen', 'Steuerpflichtiges Einkommen', 'steuerpflichtiges-einkommen', 'soziales',
    'Einkommen je Stadtbezirk – eine wichtige Kennzahl für die soziale Lage.'),
  ckan('ckan-einkommensverteilung', 'Einkommensverteilung', 'einkommensverteilung', 'soziales',
    'Verteilung der Einkommen in Stuttgart, unter anderem nach Dezilen.'),
  ckan('ckan-armut', 'Armut in Stuttgart', 'armut', 'soziales',
    'Armutsindikatoren und Empfängerzahlen; für Sozialberichte und Kiezvergleiche.'),
  ckan('ckan-kinderbetreuung', 'Betreuungsquote von Kindern', 'kinderbetreuung', 'familie',
    'Betreuungs- und Versorgungsquote für unter 3- und 3- bis 6-jährige Kinder.'),
  ckan('ckan-wohnungen-groesse', 'Wohnungen nach Wohnungsgröße', 'wohnungen-nach-wohnungsgroesse', 'wohnen',
    'Wohnungsbestand nach Größe in den Stadtbezirken seit 1995.'),
  ckan('ckan-wohngebaeude', 'Wohngebäude, Wohnungen und Wohnfläche', 'wohngebaeude-wohnungen-und-wohnflaeche', 'wohnen',
    'Wohngebäude und Wohnfläche je Stadtbezirk seit 1995.'),
  ckan('ckan-baugenehmigungen', 'Baugenehmigungen in den Stadtbezirken', 'baugenehmigungen', 'wohnen',
    'Baugenehmigungen seit 1995 – Frühindikator für die Wohnungsentwicklung.'),
  ckan('ckan-energieverbrauch', 'Energieverbrauch in Stuttgart', 'energieverbrauch', 'energie',
    'Energieverbrauch nach Energieträgern und Jahren; Grundlage für die Wärmewende.'),
  ckan('ckan-treibhausgas', 'Treibhausgasausstoß', 'treibhausgasausstoss', 'energie',
    'Treibhausgasemissionen Stuttgarts im Zeitverlauf.'),
  ckan('ckan-co2', 'Kohlendioxid-Emissionen', 'kohlendioxid-co2-emissionen', 'energie',
    'CO2-Emissionen nach Verursachergruppen und Jahren.'),
  ckan('ckan-klima-wetter', 'Klima- und Wetterdaten', 'klima-und-wetterdaten', 'umwelt',
    'Langjährige Wetterreihe Stuttgarts seit 1980 – Temperatur, Niederschlag, Sonne.'),
  ckan('ckan-luftqualitaet', 'Luftqualität in Stuttgart', 'luftqualitaet-und-laermbelastung', 'umwelt',
    'Amtliche Luftqualitätswerte, unter anderem Feinstaub und Stickstoffdioxid.',
    { resourceName: 'Luftqualität' }),
  ckan('ckan-laermbelastung', 'Lärmbelastung in Stuttgart', 'luftqualitaet-und-laermbelastung', 'umwelt',
    'Lärmbelastung der Bevölkerung nach Pegelklassen und Jahren.',
    { resourceName: 'Lärmbelastung' }),
  ckan('ckan-naturschutzflaechen', 'Naturschutzflächen', 'naturschutzflaechen', 'natur',
    'Naturschutzflächen in Stuttgart mit Schutzstatus und Flächengröße.'),
  ckan('ckan-flaechennutzung', 'Flächennutzung in Stuttgart', 'flaechennutzung', 'umwelt',
    'Flächennutzung nach Siedlung, Verkehr, Vegetation und Gewässer.'),
  ckan('ckan-strassennetz', 'Straßennetz in Stuttgart', 'strassennetz-in-stuttgart', 'verkehr',
    'Länge des Straßennetzes seit 1980 nach Straßenkategorie.'),
  ckan('ckan-verkehrszaehlungen', 'Ergebnisse der Verkehrszählungen', 'ergebnisse-der-verkehrszaehlungen', 'verkehr',
    'Zählstellen und Verkehrsmengen im Stadtgebiet.'),
  ckan('ckan-unfaelle-schadensart', 'Unfälle nach Schadensart', 'unfaelle-schadensart', 'verkehr',
    'Verkehrsunfälle nach Schadensart und Beteiligten im Zeitverlauf.'),
  ckan('ckan-strassenverkehrsunfaelle', 'Straßenverkehrsunfälle', 'strassenverkehrsunfaelle', 'verkehr',
    'Amtliche Unfallzahlen für Stuttgart nach Jahren und Kategorien.'),
  ckan('ckan-flugziele', 'Flugziele am Flughafen Stuttgart', 'flugziele-am-flughafen-stuttgart', 'verkehr',
    'Angeflogene Ziele und ihre Entwicklung – für Reise- und Lärmfragen.'),
  ckan('ckan-luftverkehr', 'Luftverkehr am Flughafen Stuttgart', 'luftverkehr-am-flughafen-stuttgart', 'verkehr',
    'Passagiere, Flugbewegungen und Fracht im Zeitverlauf.'),
  ckan('ckan-wilhelma', 'Wilhelma-Besucherzahlen', 'wilhelmabesucher', 'kultur',
    'Besucherzahlen der Wilhelma – für Ausflugsplanung und Andrang.'),
  ckan('ckan-staatstheater', 'Staatstheater: Aufführungen und Besucher', 'auffuehrungen-und-besucher-staatstheater-stuttgart', 'kultur',
    'Spielplan- und Besucherstatistik des Staatstheaters.'),
  ckan('ckan-museen', 'Museen und Besucherzahlen', 'museen', 'kultur',
    'Stuttgarter Museen mit Besucherzahlen seit 1980.'),
  ckan('ckan-sportanlagen', 'Sportanlagen in Stuttgart', 'sportanlagen', 'freizeit',
    'Öffentliche und vereinsgetragene Sportanlagen mit Standorten und Angeboten.'),
  ckan('ckan-schwimmbaeder', 'Besucher der Schwimmbäder', 'schwimmbaeder', 'freizeit',
    'Besucherzahlen der Stuttgarter Schwimmbäder seit 1980.'),
  ckan('ckan-aerzte', 'Ärztliche Versorgung', 'aerztliche-versorgung', 'gesundheit',
    'Arztpraxen und Fachrichtungen in Stuttgart – für die Suche nach medizinischer Nähe.'),
  ckan('ckan-krankenhaeuser', 'Krankenhäuser und Betten', 'krankenhaeuser-und-betten', 'gesundheit',
    'Krankenhäuser, Fachabteilungen und Bettenzahlen.'),
  ckan('ckan-pflegebeduerftige', 'Pflegebedürftige Leistungsempfänger', 'pflegebeduerftige-leistungsempfaenger', 'gesundheit',
    'Pflegebedürftige nach Stadtbezirk und Versorgungsart.'),
  ckan('ckan-straftaten', 'Erfasste Straftaten', 'straftaten', 'sicherheit',
    'Amtliche Kriminalstatistik für Stuttgart im Zeitverlauf.'),
  ckan('ckan-schulen', 'Öffentliche Schulen, Klassen und Schüler', 'oeffentliche-allgemeinbildende-schulen-klassen-und-schueler', 'bildung',
    'Schulen, Klassen und Schülerzahlen nach Schulart.'),
  ckan('ckan-schueler', 'Schüler an öffentlichen Schulen', 'schueler-an-oeffentlichen-schulen', 'bildung',
    'Schülerzahlen nach Schulart und Jahren.'),
  ckan('ckan-studierende', 'Studierende an Universitäten und Hochschulen', 'studierende-an-universitaeten-und-hochschulen', 'bildung',
    'Studierendenzahlen der Stuttgarter Hochschulen.'),
  ckan('ckan-wahlergebnisse', 'Wahlergebnisse und Sitzverteilungen', 'wahlergebnisse-und-sitzverteilungen-in-stuttgart', 'wahlen',
    'Ergebnisse kommunaler und überregionaler Wahlen in Stuttgart.'),
  ckan('ckan-kulturausgaben', 'Kulturausgaben und Kulturerträge', 'kulturausgaben', 'kultur',
    'Aufwand und Erträge der Stuttgarter Kulturverwaltung seit 2010 – Haushaltsdaten für die Transparenz.'),
];

// ---------- 41–45: Fünf Stuttgarter WFS-Layer, die vorher nicht ausgespielt wurden ----------
const stadtWfsSources = [
  wfs('wfs-aussichtspunkte', 'Aussichtspunkte in Stuttgart',
    'GEOLINE_FLEX:A62_POI_AUSSICHTSPUNKTE_PUNKTE_EPSG25832',
    'Aussichtspunkte mit Blick über den Kessel – Grundlage für Sonnenuntergangs- und Fotospots.',
    { group: 'freizeit' }),
  wfs('wfs-innenstadtrundweg', 'Innenstadtrundweg: Stationen',
    'GEOLINE_FLEX:A62_POI_INNENSTADTRUNDWEG_PUNKTE_EPSG25832',
    'Stationen des offiziellen Innenstadtrundwegs mit Kurzbeschreibungen.',
    { group: 'freizeit' }),
  wfs('wfs-trauungsorte', 'Heirats-Wunschorte',
    'GEOLINE_FLEX:A62_POI_34_TRAUUNG_WUNSCH_EPSG25832',
    'Besonders schöne Orte für Trauungen und Eheschließungen im Stadtgebiet.',
    { group: 'freizeit' }),
  wfs('wfs-engagement-orte', 'Engagement-Orte',
    'GEOLINE_FLEX:A10_EP_TOUR_ENGAGEMENT_ORTE_EPSG25832',
    'Orte der „Tour der guten Engagement-Orte“ – Ehrenamt, Nachbarschaft und Begegnung.',
    { group: 'gesellschaft' }),
  wfs('wfs-mobilfunk', 'Mobilfunkstandorte',
    'GEOLINE_FLEX:A62_MOFU_STANDORTE_EPSG25832',
    'Gemeldete Mobilfunkantennen – grobe Orientierung für Netzinfrastruktur, keine Ausbauprognose.',
    { group: 'infrastruktur' }),
];

// ---------- 46–60: LUBW-Schutzgebiets- und Umweltdaten ----------
const lubwSources = [
  lubw('lubw-naturpark', 'Naturpark Stuttgart', 'Naturpark',
    'Naturpark-Gebiete in und um Stuttgart; wichtig für Ausflüge und Naturschutz.'),
  lubw('lubw-naturschutzgebiet', 'Naturschutzgebiete', 'Naturschutzgebiet',
    'Amtliche Naturschutzgebiete mit Flächen und Namen.'),
  lubw('lubw-landschaftsschutzgebiet', 'Landschaftsschutzgebiete', 'Landschaftsschutzgebiet',
    'Landschaftsschutzgebiete in der Region – sie prägen die freie Landschaft.'),
  lubw('lubw-ffh', 'Natura-2000-FFH-Gebiete', 'FFH_Gebiet',
    'FFH-Gebiete nach der Fauna-Flora-Habitat-Richtlinie.'),
  lubw('lubw-vogelschutz', 'Natura-2000-Vogelschutzgebiete', 'Vogelschutzgebiet_SPA',
    'Europäische Vogelschutzgebiete (SPA) in der Region.'),
  lubw('lubw-wasserschutzgebiet', 'Wasserschutzgebiete', 'Wasserschutzgebiet',
    'Wasserschutzgebiete um Trinkwasserfassungen.'),
  lubw('lubw-ueberschwemmungsgebiet', 'Überschwemmungsgebiete', 'Ueberschwemmungsgebiet',
    'Amtliche Überschwemmungsgebiete – Grundlage für Hochwasservorsorge.',
    { group: 'wasser' }),
  lubw('lubw-umweltzone', 'Umweltzone Baden-Württemberg', 'Umweltzone',
    'Umwelt- und Diesel-Fahrverbotszonen im Land.',
    { group: 'verkehr' }),
  lubw('lubw-naturdenkmal', 'Naturdenkmäler (flächenhaft)', 'Naturdenkmal_Flaechenhaft',
    'Amtlich geschützte Naturdenkmäler mit flächigem Charakter.'),
  lubw('lubw-biotopkartierung', 'Biotopkartierung', 'Biotopkartierung',
    'Kartierte Biotope nach Naturschutzrecht – Grundlage für Eingriffsprüfungen.'),
  lubw('lubw-streuobst', 'Streuobst-Bestand', 'Streuobsterhebung_Fernerkundung',
    'Streuobstwiesen, per Fernerkundung erhoben – prägend für die Region.'),
  lubw('lubw-globalstrahlung', 'Globalstrahlung', 'Globalstrahlung',
    'Jährliche Globalstrahlung als Planungsgrundlage für Solaranlagen.',
    { group: 'energie' }),
  lubw('lubw-windkraft', 'Windkraft-Bestand', 'Windkraft_Bestand',
    'Bestehende Windenergieanlagen in der Region.',
    { group: 'energie' }),
  lubw('lubw-wasserkraft', 'Wasserkraft-Bestand', 'Wasserkraft_Bestand',
    'Bestehende Wasserkraftanlagen an Neckar und Zuläufen.',
    { group: 'energie' }),
  lubw('lubw-artenfunde', 'Artenfunde Baden-Württemberg', 'WFS_Artenfunde',
    'Amtliche Artenfunde aus der LUBW-Fachdatenbank – ergänzt GBIF und iNaturalist.'),
];

// ---------- 61–65: LGL-BW ATKIS Basis-DLM ----------
const lglSources = [
  lgl('lgl-landnutzung', 'ATKIS Landnutzung', 'nora:v_landnutzung',
    'Landnutzung in der Region nach ATKIS – Wald, Landwirtschaft, Siedlung, Wasser.'),
  lgl('lgl-vegetation', 'ATKIS Vegetationsflächen', 'nora:v_vegetationsflaeche',
    'Vegetationsflächen mit Nutzungsart – Forst, Grünland, Streuobst.'),
  lgl('lgl-siedlung', 'ATKIS Siedlungsflächen', 'nora:v_siedlungsflaeche',
    'Siedlungs- und Bauflächen nach ATKIS.'),
  lgl('lgl-verkehr', 'ATKIS Verkehrsflächen', 'nora:v_verkehrsflaeche',
    'Verkehrsflächen und Straßen nach ATKIS.'),
  lgl('lgl-besondere-flaeche', 'ATKIS Besondere Flächen', 'nora:v_besondere_flaeche',
    'Besondere Flächen wie Schutzgebiete, Übungsplätze und Friedhöfe.'),
];

// ---------- 66–100: Bundesweite und internationale APIs ----------
const apiSources = [
  api('api-emsc-erdbeben', 'EMSC-Erdbeben (FDSN)', 'natur',
    'Erdbeben der letzten 90 Tage im Umkreis von 300 km – der Oberrheingraben ist seismisch aktiv.',
    {
      url: 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmagnitude=1.5&limit=50&minlatitude=46.5&maxlatitude=50.5&minlongitude=6.5&maxlongitude=11.5&orderby=time',
      normalizer: 'emsc',
      ttlMs: 10 * 60_000,
    },
    { license: 'CC BY 4.0', attribution: 'EMSC-CSEM (seismicportal.eu)', category: 'welt', kind: 'Erdbebendienst' }),

  api('api-usgs-erdbeben', 'USGS-Erdbeben', 'natur',
    'Unabhängige Zweitquelle für Erdbeben weltweit und in Europa.',
    {
      url: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2&limit=50&minlatitude=45&maxlatitude=52&minlongitude=5&maxlongitude=13&orderby=time',
      normalizer: 'usgs',
      ttlMs: 10 * 60_000,
    },
    { license: 'USGS Open Data (public domain)', attribution: 'U.S. Geological Survey', category: 'welt', kind: 'Erdbebendienst' }),

  api('api-open-meteo-archiv', 'Open-Meteo Archiv', 'wetter',
    'Historische Wetterdaten für Stuttgart seit 1940 – für Klimavergleiche und Zeitreihen.',
    {
      url: 'https://archive-api.open-meteo.com/v1/archive?latitude=48.7758&longitude=9.1829&start_date={date}&end_date={date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe%2FBerlin',
      normalizer: 'openMeteoDaily',
      ttlMs: 24 * 3600_000,
    },
    { license: 'CC BY 4.0', attribution: 'Open-Meteo (Modelle des DWD)', kind: 'Klimaarchiv' }),

  api('api-open-meteo-hochwasser', 'Open-Meteo Hochwasser', 'wasser',
    'Modellierte Abflussmengen für die nächsten Tage – Ergänzung zum amtlichen Pegel.',
    {
      url: 'https://flood-api.open-meteo.com/v1/flood?latitude=48.7758&longitude=9.1829&daily=river_discharge,river_discharge_mean&forecast_days=7&timezone=Europe%2FBerlin',
      normalizer: 'openMeteoFlood',
      ttlMs: 3 * 3600_000,
    },
    { license: 'CC BY 4.0', attribution: 'Open-Meteo / GloFAS', kind: 'Hochwassermodell' }),

  api('api-open-meteo-luft', 'Open-Meteo Luftqualität', 'luft',
    'Stündliche Luftqualitätsprognose (PM10, PM2,5, European AQI) für Stuttgart.',
    {
      url: 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=48.7758&longitude=9.1829&hourly=pm10,pm2_5,european_aqi&forecast_days=3&timezone=Europe%2FBerlin',
      normalizer: 'openMeteoAir',
      ttlMs: 30 * 60_000,
    },
    { license: 'CC BY 4.0', attribution: 'Open-Meteo / CAMS', kind: 'Luftqualitätsprognose' }),

  api('api-open-meteo-klima', 'Open-Meteo Klimaprojektion', 'wetter',
    'Klimamodell-Reihen für Stuttgart bis 2050 – für langfristige Vergleiche.',
    {
      url: 'https://climate-api.open-meteo.com/v1/climate?latitude=48.7758&longitude=9.1829&start_date=2020-01-01&end_date=2050-12-31&models=MRI_AGCM3_2_S&daily=temperature_2m_max,temperature_2m_min,precipitation_sum',
      normalizer: 'openMeteoClimate',
      ttlMs: 24 * 3600_000,
      timeoutMs: 60_000,
    },
    { license: 'CC BY 4.0', attribution: 'Open-Meteo / CMIP6', kind: 'Klimaprojektion' }),

  api('api-met-no', 'MET Norway Locationforecast', 'wetter',
    'Norwegische Wettervorhersage als unabhängige Zweitmeinung zum DWD.',
    {
      url: 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=48.7758&lon=9.1829',
      normalizer: 'metNo',
      ttlMs: 30 * 60_000,
      headers: { 'User-Agent': 'open-stuttgart/0.2 (nicht kommerzielles Open-Source-Projekt)' },
    },
    { license: 'CC BY 4.0 / NLOD', attribution: 'MET Norway', kind: 'Wettervorhersage' }),

  api('api-rainviewer', 'RainViewer-Radar', 'wetter',
    'Globales Niederschlagsradar mit Zeitstempeln – Ergänzung zum DWD-Radar.',
    {
      url: 'https://api.rainviewer.com/public/weather-maps.json',
      normalizer: 'rainviewer',
      ttlMs: 5 * 60_000,
    },
    { license: 'RainViewer-Nutzungsbedingungen', attribution: 'RainViewer', kind: 'Radar' }),

  api('api-transitous', 'Transitous/MOTIS-Routing', 'mobilitaet',
    'Open-Source-Routing für ÖPNV, Rad und Fuß – unabhängiger Zweitansatz zu EFA-BW.',
    {
      url: 'https://api.transitous.org/api/v6/plan?fromPlace={lat},{lon}&toPlace=48.7830,9.1815&time={date}T08:00:00Z',
      normalizer: 'transitous',
      ttlMs: 60_000,
      timeoutMs: 45_000,
    },
    { license: 'MIT / OpenStreetMap ODbL, GTFS-Quellen', attribution: 'Transitous (MOTIS)', kind: 'Multimodales Routing' }),

  api('api-celestrak', 'CelesTrak TLE', 'himmel',
    'Bahndaten für ISS und ausgewählte Satelliten – Grundlage für Überflugberechnungen.',
    {
      url: 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle',
      normalizer: 'tle',
      ttlMs: 6 * 3600_000,
    },
    { license: 'CelesTrak-Nutzungsbedingungen (frei)', attribution: 'CelesTrak', kind: 'Satellitenbahnen', adapter: 'textApi' }),

  api('api-nasa-gibs', 'NASA GIBS Satellitenbilder', 'himmel',
    'Tagesaktuelle Satelliten- und Thermalbilder als Kartenebene.',
    {
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml',
      normalizer: 'gibs',
      ttlMs: 24 * 3600_000,
      timeoutMs: 60_000,
    },
    { license: 'NASA Open Data', attribution: 'NASA EOSDIS GIBS', kind: 'Satellitenbilder', adapter: 'textApi' }),

  api('api-nasa-eonet', 'NASA EONET Naturereignisse', 'natur',
    'Weltweite Naturereignisse (Brände, Stürme, Vulkane) im Europa-Ausschnitt.',
    {
      url: 'https://eonet.gsfc.nasa.gov/api/v3/events?bbox=5,45,14,53&status=open&limit=30',
      normalizer: 'eonet',
      ttlMs: 30 * 60_000,
    },
    { license: 'NASA Open Data', attribution: 'NASA EONET', kind: 'Naturereignisse' }),

  api('api-gdacs', 'GDACS Warnungen', 'natur',
    'Globale Katastrophenwarnungen (Erdbeben, Hochwasser, Stürme) als RSS.',
    {
      url: 'https://www.gdacs.org/xml/rss.xml',
      normalizer: 'gdacs',
      ttlMs: 30 * 60_000,
    },
    { license: 'GDACS-Nutzungsbedingungen', attribution: 'GDACS / Europäische Kommission', kind: 'Katastrophenwarnungen', adapter: 'textApi' }),

  api('api-smard-strom', 'SMARD Strommarktdaten', 'energie',
    'Stromerzeugung und -verbrauch in Deutschland im 15-Minuten-Takt.',
    {
      url: 'https://www.smard.de/app/chart_data/1223/DE/index_hour.json',
      normalizer: 'smard',
      ttlMs: 60 * 60_000,
    },
    { license: 'CC BY 4.0', attribution: 'Bundesnetzagentur / SMARD', kind: 'Strommarktdaten' }),

  api('api-opensky', 'OpenSky Network Flugdaten', 'verkehr',
    'Live-Flugpositionen im Großraum Stuttgart – unabhängige Zweitquelle zu adsb.lol.',
    {
      url: 'https://opensky-network.org/api/states/all?lamin=47.5&lomin=8.5&lamax=49.5&lomax=10.5',
      normalizer: 'opensky',
      ttlMs: 60_000,
    },
    { license: 'OpenSky-Nutzungsbedingungen (Open Data)', attribution: 'OpenSky Network', kind: 'Flugverkehr' }),

  api('api-commons-geosuche', 'Wikimedia Commons Geosuche', 'wissen',
    'Fotos und Karten in der Nähe eines Ortes – frei lizenziert, mit Dateiseite.',
    {
      url: 'https://commons.wikimedia.org/w/api.php?action=query&list=geosearch&gscoord={lat}%7C{lon}&gsradius=10000&gslimit=20&format=json&origin=*',
      normalizer: 'commons',
      ttlMs: 12 * 3600_000,
    },
    { license: 'CC-BY/CC0 je Datei, ODbL für Geodaten', attribution: 'Wikimedia Commons', kind: 'Bildarchiv' }),

  api('api-wikipedia-geosuche', 'Wikipedia Geosuche', 'wissen',
    'Wikipedia-Artikel in der Nähe eines Ortes – als Kurzlexikon zur Umgebung.',
    {
      url: 'https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord={lat}%7C{lon}&gsradius=10000&gslimit=20&format=json&origin=*',
      normalizer: 'wikipediaGeo',
      ttlMs: 12 * 3600_000,
    },
    { license: 'CC BY-SA 4.0', attribution: 'Wikipedia-Mitwirkende', kind: 'Lexikon' }),

  api('api-wikipedia-pageviews', 'Wikipedia Seitenaufrufe', 'wissen',
    'Aufrufzahlen eines Artikels – zeigt, was die Stadt gerade beschäftigt.',
    {
      url: 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/de.wikipedia/all-access/user/Stuttgart/daily/{yearStart}/{yearEnd}',
      normalizer: 'pageviews',
      ttlMs: 24 * 3600_000,
    },
    { license: 'CC0 1.0', attribution: 'Wikimedia Foundation', kind: 'Aufmerksamkeitsdaten' }),

  api('api-wikidata-kunst', 'Wikidata: Kunst im öffentlichen Raum', 'wissen',
    'Öffentliche Kunstwerke, Denkmäler und Gedenktafeln in Stuttgart aus Wikidata.',
    {
      url: 'https://query.wikidata.org/sparql?format=json&query=SELECT%20%3Fitem%20%3FitemLabel%20%3Fcoord%20%3FtypeLabel%20WHERE%20%7B%20%3Fitem%20wdt%3AP131%20wd%3AQ1022%3B%20wdt%3AP625%20%3Fcoord%3B%20wdt%3AP31%20%3Ftype.%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22de%2Cen%22.%20%7D%20%7D%20LIMIT%20100',
      normalizer: 'wikidataArt',
      ttlMs: 24 * 3600_000,
      timeoutMs: 60_000,
      headers: { Accept: 'application/sparql-results+json' },
    },
    { license: 'CC0 1.0', attribution: 'Wikidata Query Service', kind: 'Wissensgraph' }),

  api('api-openlibrary', 'Open Library', 'wissen',
    'Bücher und Ausgaben zu Stuttgart – Ergänzung zum K10plus-Katalog.',
    {
      url: 'https://openlibrary.org/search.json?q={q}&limit=20',
      normalizer: 'openlibrary',
      ttlMs: 12 * 3600_000,
    },
    { license: 'Open Library Data (CC0)', attribution: 'Internet Archive / Open Library', kind: 'Bibliothekskatalog' }),

  api('api-internet-archive', 'Internet Archive', 'wissen',
    'Digitalisierte Bücher, Karten und Tondokumente zu Stuttgart.',
    {
      url: 'https://archive.org/advancedsearch.php?q=Stuttgart&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=creator&rows=20&output=json',
      normalizer: 'archive',
      ttlMs: 12 * 3600_000,
    },
    { license: 'Je Objekt; Metadaten offen', attribution: 'Internet Archive', kind: 'Digitalarchiv' }),

  api('api-tagesschau', 'Tagesschau-Nachrichten', 'gesellschaft',
    'Aktuelle Nachrichten der ARD als JSON – für den Nachrichtenüberblick.',
    {
      url: 'https://www.tagesschau.de/api2u/homepage',
      normalizer: 'tagesschau',
      ttlMs: 10 * 60_000,
    },
    { license: 'Quellenangabe tagesschau.de', attribution: 'ARD-aktuell / tagesschau.de', kind: 'Nachrichten' }),

  api('api-abgeordnetenwatch', 'Abgeordnetenwatch', 'gesellschaft',
    'Parlamente, Abgeordnete und Abstimmungen – Transparenz für politische Fragen.',
    {
      url: 'https://www.abgeordnetenwatch.de/api/v2/parliaments?range_end=20',
      normalizer: 'abgeordnetenwatch',
      ttlMs: 24 * 3600_000,
      timeoutMs: 45_000,
    },
    { license: 'CC BY-SA 4.0', attribution: 'Abgeordnetenwatch.de', kind: 'Parlamentsdaten' }),

  api('api-data-europa', 'data.europa.eu', 'wissen',
    'Europäischer Datenkatalog – Suche nach Stuttgart-Datensätzen.',
    {
      url: 'https://data.europa.eu/api/hub/search/search?q=Stuttgart&limit=20',
      normalizer: 'dataEuropa',
      ttlMs: 12 * 3600_000,
    },
    { license: 'CC BY 4.0 (Metadaten)', attribution: 'data.europa.eu', kind: 'Datenkatalog' }),

  api('api-feiertage', 'Feiertage Baden-Württemberg', 'alltag',
    'Gesetzliche Feiertage in Baden-Württemberg – für Fristen und Öffnungszeiten.',
    {
      url: 'https://feiertage-api.de/api/?jahr={year}&nur_land=BW',
      normalizer: 'feiertage',
      ttlMs: 24 * 3600_000,
    },
    { license: 'Freie Nutzung, Quellenangabe', attribution: 'feiertage-api.de', kind: 'Kalender' }),

  api('api-photon', 'Photon Geocoder', 'stadt',
    'Komoot-Photon als unabhängiger Geocoder – Fallback und Zweitmeinung zu gis6.',
    {
      url: 'https://photon.komoot.io/api/?q={q}&limit=10&lang=de',
      normalizer: 'photon',
      ttlMs: 24 * 3600_000,
    },
    { license: 'ODbL (OpenStreetMap)', attribution: 'Komoot Photon / OpenStreetMap-Mitwirkende', kind: 'Geocoder' }),

  api('api-overpass', 'OpenStreetMap Overpass', 'stadt',
    'Freie OSM-Abfragen für Detaildaten, die nicht im Stadt-WFS liegen.',
    {
      query: '[out:json][timeout:25];(node[amenity=drinking_water](around:{r},{lat},{lon});node[emergency=defibrillator](around:{r},{lat},{lon}););out center tags;',
      ttlMs: 30 * 60_000,
    },
    { adapter: 'overpass', license: 'ODbL', attribution: 'OpenStreetMap-Mitwirkende', kind: 'OpenStreetMap' }),

  api('api-dipul', 'DIPUL Drohnen-Geozonen', 'verkehr',
    'Kontrollzonen, Flugbeschränkungen und sensible Anlagen für Drohnenflüge.',
    {
      url: 'https://uas-betrieb.de/geoservices/dipul/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=dipul:kontrollzonen&count=20&outputFormat=application/json&srsName=EPSG:4326&bbox=9.0,48.6,9.4,48.9,EPSG:4326',
      normalizer: 'geojsonGeneric',
      ttlMs: 24 * 3600_000,
      timeoutMs: 45_000,
    },
    { license: 'CC BY-ND 4.0', attribution: 'BMI / DIPUL', kind: 'Drohnen-Geodaten' }),

  api('api-pvgis', 'PVGIS Solarertrag', 'energie',
    'Solarertrag pro kWp für einen Standort – Monatsverlauf und Jahreswert.',
    {
      url: 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat={lat}&lon={lon}&peakpower=1&loss=14&outputformat=json',
      normalizer: 'pvgis',
      ttlMs: 24 * 3600_000,
      timeoutMs: 45_000,
    },
    { license: 'EUPL / JRC Open Data', attribution: 'Europäische Kommission, JRC PVGIS', kind: 'Solarrechner' }),

  api('api-catalogue-of-life', 'Catalogue of Life', 'natur',
    'Taxonomische Referenz für Artennamen – ordnet Funde eindeutig zu.',
    {
      url: 'https://api.catalogueoflife.org/dataset?limit=20',
      normalizer: 'col',
      ttlMs: 24 * 3600_000,
    },
    { license: 'CC BY 4.0', attribution: 'Catalogue of Life', kind: 'Taxonomie' }),

  api('api-sunrise-sunset', 'Sunrise-Sunset', 'himmel',
    'Sonnenauf- und -untergang, Dämmerung und Tageslänge für einen Punkt.',
    {
      url: 'https://api.sunrise-sunset.org/json?lat={lat}&lng={lon}&formatted=0',
      normalizer: 'sunrise',
      ttlMs: 24 * 3600_000,
    },
    { license: 'CC BY 4.0', attribution: 'sunrise-sunset.org', kind: 'Astronomie' }),

  api('api-jpl-horizons', 'JPL Horizons', 'himmel',
    'Ephemeriden von Mond, Planeten und Asteroiden – präzise für Sternbeobachtung.',
    {
      url: 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND=301&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=OBSERVER&CENTER=500@399&START_TIME={date}&STOP_TIME={dateTomorrow}&STEP_SIZE=1d',
      normalizer: 'horizons',
      ttlMs: 24 * 3600_000,
      timeoutMs: 45_000,
    },
    { license: 'NASA Open Data', attribution: 'NASA JPL Horizons', kind: 'Ephemeriden' }),

  api('api-crossref', 'Crossref', 'wissen',
    'DOI-Metadaten wissenschaftlicher Arbeiten zu Stuttgart.',
    {
      url: 'https://api.crossref.org/works?query=Stuttgart&rows=20',
      normalizer: 'crossref',
      ttlMs: 12 * 3600_000,
    },
    { license: 'CC0 (Metadaten)', attribution: 'Crossref', kind: 'Forschungsdaten' }),

  api('api-openalex', 'OpenAlex', 'wissen',
    'Open-Alex-Index wissenschaftlicher Arbeiten, Institutionen und Themen zu Stuttgart.',
    {
      url: 'https://api.openalex.org/works?search=Stuttgart&per-page=20',
      normalizer: 'openalex',
      ttlMs: 12 * 3600_000,
    },
    { license: 'CC0 1.0', attribution: 'OpenAlex', kind: 'Forschungsdaten' }),

  api('api-wikivoyage', 'Wikivoyage Ortsartikel', 'wissen',
    'Reiseführer-Artikel in der Nähe – praktische Hinweise zu Orten und Ausflügen.',
    {
      url: 'https://de.wikivoyage.org/w/api.php?action=query&list=geosearch&gscoord={lat}%7C{lon}&gsradius=10000&gslimit=20&format=json&origin=*',
      normalizer: 'wikipediaGeo',
      ttlMs: 12 * 3600_000,
    },
    { license: 'CC BY-SA 4.0', attribution: 'Wikivoyage-Mitwirkende', kind: 'Reiseführer' }),
];

export const SOURCES = [...ckanSources, ...stadtWfsSources, ...lubwSources, ...lglSources, ...apiSources];

if (SOURCES.length < 100) {
  throw new Error(`Quellenregister muss mindestens 100 Einträge haben, hat aber ${SOURCES.length}`);
}
const ids = new Set(SOURCES.map((s) => s.id));
if (ids.size !== SOURCES.length) throw new Error('Doppelte Quellen-ID im Register');

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export const SOURCE_GROUPS = [
  ['bevoelkerung', 'Bevölkerung'],
  ['wohnen', 'Wohnen & Bauen'],
  ['arbeit', 'Arbeit & Soziales'],
  ['familie', 'Familie'],
  ['umwelt', 'Umwelt & Klima'],
  ['natur', 'Natur & Schutzgebiete'],
  ['energie', 'Energie'],
  ['verkehr', 'Verkehr & Mobilität'],
  ['mobilitaet', 'Mobilität'],
  ['gesundheit', 'Gesundheit & Pflege'],
  ['sicherheit', 'Sicherheit'],
  ['bildung', 'Bildung'],
  ['kultur', 'Kultur & Freizeit'],
  ['wahlen', 'Wahlen'],
  ['wetter', 'Wetter & Himmel'],
  ['wasser', 'Wasser'],
  ['luft', 'Luft'],
  ['himmel', 'Himmel & Satelliten'],
  ['wissen', 'Wissen & Kultur'],
  ['gesellschaft', 'Gesellschaft & Politik'],
  ['alltag', 'Alltag'],
  ['infrastruktur', 'Infrastruktur'],
  ['stadt', 'Stadt & Orientierung'],
];
