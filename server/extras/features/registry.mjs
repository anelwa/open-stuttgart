// 100 Werkzeuge (Features) des Erweiterungsprogramms. Die Metadaten sind vollständig,
// die Handler werden schrittweise ergänzt. `status` steuert, ob ein Werkzeug in der
// Oberfläche ausführbar ist; `run` ist die Implementierung.
import * as kiez from './kiez.mjs';
import * as daten from './daten.mjs';
import * as wissen from './wissen.mjs';
import * as umwelt from './umwelt.mjs';
import * as alltag from './alltag.mjs';
import * as freizeit from './freizeit.mjs';
import * as mobilitaet from './mobilitaet.mjs';
import * as hilfe from './hilfe.mjs';
import * as teilen from './teilen.mjs';
import * as spiel from './spiel.mjs';

const place = { key: 'ort', label: 'Ort oder Adresse', type: 'place', placeholder: 'z. B. Charlottenplatz, Stuttgart-Mitte', required: false };
const district = { key: 'bezirk', label: 'Stadtbezirk', type: 'text', placeholder: 'z. B. Mitte, Bad Cannstatt', required: true };
const text = (key, label, placeholder = '') => ({ key, label, type: 'text', placeholder, required: true });
const num = (key, label, placeholder = '') => ({ key, label, type: 'number', placeholder, required: false });

const INDICATORS = [
  ['einwohner', 'Einwohner'],
  ['unter18', 'Kinder und Jugendliche unter 18'],
  ['ueber65', 'Menschen ab 65'],
  ['haushalte', 'Haushalte'],
  ['singlehaushalte', 'Single-Haushalte'],
  ['familien', 'Familien mit Kindern'],
  ['arbeitslose', 'Arbeitslos Gemeldete'],
  ['arbeitslosenquote', 'Arbeitslosenquote'],
  ['einkommen', 'Nettoeinkommen je veranlagter Person'],
  ['wohnungen', 'Wohnungen'],
  ['baugenehmigungen', 'Genehmigte Wohnungen'],
];

const FEATURE_SPECS = [
  // ---------- A. Mein Kiez ----------
  {
    id: 'kiez-steckbrief', title: 'Kiez-Steckbrief', category: 'kiez',
    summary: 'Bevölkerung, Haushalte, Familien, Arbeitsmarkt, Einkommen und Bauen für einen Stadtbezirk – aus amtlichen Datensätzen, mit Jahr und Quelle.',
    inputs: [district], run: kiez.kiezSteckbrief,
  },
  {
    id: 'kiez-zeitreise', title: 'Kiez-Zeitreise', category: 'kiez',
    summary: 'Wie hat sich ein Stadtbezirk seit den 1990er-Jahren entwickelt? Ein Indikator als Zeitreihe mit Jahreswerten.',
    inputs: [district, { key: 'indikator', label: 'Indikator', type: 'select', options: INDICATORS, required: true }], run: kiez.kiezZeitreise,
  },
  {
    id: 'kiez-vergleich', title: 'Kiez-Vergleich', category: 'kiez',
    summary: 'Zwei Stadtbezirke direkt nebeneinander: Bevölkerung, Haushalte, Arbeitsmarkt, Einkommen und Bauen.',
    inputs: [district, { ...district, key: 'bezirk2', label: 'Zweiter Stadtbezirk' }], run: kiez.kiezVergleich,
  },
  {
    id: 'kiez-ranking', title: 'Kiez-Ranking', category: 'kiez',
    summary: 'Alle 23 Stadtbezirke nach einem Indikator sortiert – mit Wert, Jahr und Einordnung.',
    inputs: [{ key: 'indikator', label: 'Indikator', type: 'select', options: INDICATORS, required: true }], run: kiez.kiezRanking,
  },
  {
    id: 'adress-zeugnis', title: 'Adress-Zeugnis', category: 'kiez',
    summary: 'Ein Ort, alle amtlichen Antworten: Stadtbezirk, Wahllokal, Starkregen, Lärm, Klima, Bäume, Solar und die nächsten Einrichtungen.',
    inputs: [place], run: kiez.adressZeugnis,
  },
  {
    id: 'wohnlage-check', title: 'Wohnlage & Miete', category: 'kiez',
    summary: 'Mietspiegel-Wohnlage, Wohnungsbestand, Baugenehmigungen und Sozialwohnungen im Stadtbezirk.',
    inputs: [place], run: kiez.wohnlageCheck,
  },
  {
    id: 'familien-check', title: 'Familien-Check', category: 'kiez',
    summary: 'Kitas, Grundschulen, Spielplätze, Familienzentren und Ferienangebote in Gehweite – mit Entfernung und Öffnungszeiten.',
    inputs: [place], run: kiez.familienCheck,
  },
  {
    id: 'senioren-check', title: 'Senioren-Check', category: 'kiez',
    summary: 'Pflege- und Senioreneinrichtungen, Kliniken, barrierearme Toiletten, ruhige Orte und Hitzeschutz in der Nähe.',
    inputs: [place], run: kiez.seniorenCheck,
  },
  {
    id: 'auto-check', title: 'Auto-Check', category: 'kiez',
    summary: 'Parkhäuser, Tankstellen, Ladesäulen, Unfallschwerpunkte und Tempo-30-Zonen rund um einen Ort.',
    inputs: [place], run: kiez.autoCheck,
  },
  {
    id: 'barriere-check', title: 'Barriere-Check', category: 'kiez',
    summary: 'Stufenlose Wege, rollstuhlgerechte Toiletten, Aufzüge und barrierefreie Einrichtungen im Umkreis.',
    inputs: [place], run: kiez.barriereCheck,
  },

  // ---------- B. Unterwegs ----------
  {
    id: 'isochron-15', title: '15-Minuten-Radius', category: 'unterwegs',
    summary: 'Was ist in 15 Minuten zu Fuß, mit dem Rad oder mit Bus und Bahn erreichbar?',
    inputs: [place, { key: 'modus', label: 'Fortbewegung', type: 'select', options: [['fuss', 'zu Fuß'], ['rad', 'Fahrrad']], required: true }], run: mobilitaet.isochron15,
  },
  {
    id: 'letzte-verbindung', title: 'Letzte Verbindung', category: 'unterwegs',
    summary: 'Nach dem Konzert, Kino oder Essen noch heimkommen: letzte Fahrten ab der Haltestelle am Ort.',
    inputs: [place, { key: 'zeit', label: 'Späteste Abfahrt (HH:MM)', type: 'text', placeholder: '23:30', required: false }], run: mobilitaet.letzteVerbindung,
  },
  {
    id: 'anschluss-risiko', title: 'Anschluss-Risiko', category: 'unterwegs',
    summary: 'Ist der Umstieg mit der aktuellen Verspätung noch erreichbar? Mit Alternative und Fußweg.',
    inputs: [{ key: 'ankunft', label: 'Ankunft (HH:MM)', type: 'text', placeholder: '17:42', required: true }, { key: 'linie', label: 'Anschlusslinie', type: 'text', placeholder: 'U6', required: false }, { key: 'ziel', label: 'Ziel', type: 'text', placeholder: 'Flughafen', required: false }], run: mobilitaet.anschlussRisiko,
  },
  {
    id: 'baustellen-route', title: 'Baustellen auf der Route', category: 'unterwegs',
    summary: 'Welche Baustellen und Sperrungen liegen auf der Verbindung – und welche Umleitung ist sinnvoll?',
    inputs: [{ key: 'von', label: 'Von', type: 'text', required: true, placeholder: 'Hauptbahnhof' }, { key: 'nach', label: 'Nach', type: 'text', required: true, placeholder: 'Feuerbach' }], run: mobilitaet.baustellenRoute,
  },
  {
    id: 'unfall-route', title: 'Unfallschwerpunkte auf der Route', category: 'unterwegs',
    summary: 'Unfälle mit Personenschaden im 30-Meter-Korridor einer Verbindung, nach Schwere und Beteiligten.',
    inputs: [{ key: 'von', label: 'Von', type: 'text', required: true, placeholder: 'Hauptbahnhof' }, { key: 'nach', label: 'Nach', type: 'text', required: true, placeholder: 'Vaihingen' }], run: mobilitaet.unfallRoute,
  },
  {
    id: 'steigungs-profil', title: 'Steigungsprofil', category: 'unterwegs',
    summary: 'Höhenprofil und steile Abschnitte für eine Fuß- oder Radverbindung.',
    inputs: [place, { key: 'nach', label: 'Ziel', type: 'text', required: true, placeholder: 'Karlshöhe' }], run: mobilitaet.steigungsProfil,
  },
  {
    id: 'parkdruck', title: 'Parkdruck am Ziel', category: 'unterwegs',
    summary: 'Parkhäuser, P+R, Auslastung und Alternativen rund um das Ziel.',
    inputs: [place], run: mobilitaet.parkdruck,
  },
  {
    id: 'tank-optimierer', title: 'Günstigste Tankstelle', category: 'unterwegs',
    summary: 'E5, E10 und Diesel im Umkreis vergleichen – mit Entfernung und Preisstand.',
    inputs: [place, num('radius', 'Radius in Kilometern', '5')], run: mobilitaet.tankOptimierer,
  },
  {
    id: 'lade-optimierer', title: 'Laden mit Grünstrom', category: 'unterwegs',
    summary: 'Freie Ladepunkte, Grünstromanteil und das günstigste Zeitfenster der nächsten Stunden.',
    inputs: [place], run: mobilitaet.ladeOptimierer,
  },
  {
    id: 'flug-analyse', title: 'Flug über mir', category: 'unterwegs',
    summary: 'Welches Luftfahrzeug fliegt gerade in welcher Höhe über Stuttgart – und welche Piste ist in Betrieb?',
    inputs: [], run: mobilitaet.flugAnalyse,
  },

  // ---------- C. Umwelt & Gesundheit ----------
  {
    id: 'regen-ankunft', title: 'Wann kommt der Regen?', category: 'umwelt',
    summary: 'Radarbild und Modell: Beginn und Ende des Niederschlags am Ort, mit nächster trockener Stunde.',
    inputs: [place], run: freizeit.regenAnkunft,
  },
  {
    id: 'luft-verlauf', title: 'Luftqualität im Verlauf', category: 'umwelt',
    summary: 'Aktuelle Messwerte, EU-Index und Prognose für die nächsten 48 Stunden.',
    inputs: [place], run: umwelt.luftVerlauf,
  },
  {
    id: 'pollen-risiko', title: 'Pollenrisiko heute', category: 'umwelt',
    summary: 'DWD-Pollenwerte, Wind und blühende Bäume in der Nähe zu einer persönlichen Einschätzung verbinden.',
    inputs: [place], run: umwelt.pollenRisiko,
  },
  {
    id: 'gewitter-radar', title: 'Gewitter im Anmarsch', category: 'umwelt',
    summary: 'Regenintensität, Blitznähe und Warnungen für die nächste Stunde.',
    inputs: [place], run: umwelt.gewitterRadar,
  },
  {
    id: 'erdbeben-check', title: 'Erdbeben in der Region', category: 'umwelt',
    summary: 'Spürbare Erdbeben im Umkreis von 300 Kilometern – mit Magnitude, Tiefe und Zeitpunkt.',
    inputs: [], run: umwelt.erdbebenCheck,
  },
  {
    id: 'waldbrand-check', title: 'Waldbrandgefahr', category: 'umwelt',
    summary: 'Waldbrandgefahrenindex, Wetter der letzten Tage und der nächste Wald mit Warnhinweisen.',
    inputs: [place], run: umwelt.waldbrandCheck,
  },
  {
    id: 'neckar-pegel', title: 'Neckarpegel & Trend', category: 'umwelt',
    summary: 'Wasserstand Pegel Cannstatt, Verlauf der letzten Stunden und Hochwasser-Schwellen.',
    inputs: [], run: umwelt.neckarPegel,
  },
  {
    id: 'trinkwasser-check', title: 'Trinkwasser & Brunnen', category: 'umwelt',
    summary: 'Nächste Trinkbrunnen, Wasserhärte und Tipps zum Nachfüllen unterwegs.',
    inputs: [place], run: umwelt.trinkwasserCheck,
  },
  {
    id: 'hitze-check', title: 'Hitze-Check', category: 'umwelt',
    summary: 'Hitzebelastung, kühle Orte, Trinkbrunnen, Schatten und die nächste Abkühlung.',
    inputs: [place], run: umwelt.hitzeCheck,
  },
  {
    id: 'naturschutz-check', title: 'Schutzgebiet am Ort', category: 'umwelt',
    summary: 'Natur-, Landschafts- und Wasserschutzgebiete, FFH und Vogelschutz im Umkreis.',
    inputs: [place], run: umwelt.naturschutzCheck,
  },

  // ---------- D. Freizeit ----------
  {
    id: 'abend-planer', title: 'Abendplaner', category: 'freizeit',
    summary: 'Was geht heute Abend? Wetter, Termine, Sonnenuntergang, Anreise und Heimweg in einem Plan.',
    inputs: [place], run: freizeit.abendPlaner,
  },
  {
    id: 'wochenend-planer', title: 'Wochenendplaner', category: 'freizeit',
    summary: 'Samstag und Sonntag: Wetter, Veranstaltungen, Ausflüge und Bahnverbindungen.',
    inputs: [place], run: spiel.wochenendPlaner,
  },
  {
    id: 'aussicht-finder', title: 'Aussichtsfinder', category: 'freizeit',
    summary: 'Aussichtspunkte mit Sonnenuntergang, Bewölkung, Sichtweite und nächster Haltestelle.',
    inputs: [], run: umwelt.aussichtFinder,
  },
  {
    id: 'wander-rundweg', title: 'Rundwanderung mit Bahn', category: 'freizeit',
    summary: 'Eine ausgeschilderte Runde mit Start/Ziel an einer Haltestelle, Höhenprofil und Einkehrtipp.',
    inputs: [place], run: freizeit.wanderRundweg,
  },
  {
    id: 'radtour-planer', title: 'Radtour mit Rückweg', category: 'freizeit',
    summary: 'Radroute mit Steigung, Oberfläche, Unfallstellen, Reparatursäule und Rückfahrt mit der Bahn.',
    inputs: [place, { key: 'nach', label: 'Ziel', type: 'text', required: true, placeholder: 'z. B. Ludwigsburg' }], run: mobilitaet.radtourPlaner,
  },
  {
    id: 'picknick-finder', title: 'Picknickplatz', category: 'freizeit',
    summary: 'Park, Bank, Schatten, Toilette, Einkauf und Wetter – der nächste gute Picknickplatz.',
    inputs: [place], run: freizeit.picknickFinder,
  },
  {
    id: 'spielplatz-finder', title: 'Spielplatz mit Schatten', category: 'freizeit',
    summary: 'Spielplätze nach Alter, Schatten, Toilette, Wasser und Gastronomie in der Nähe filtern.',
    inputs: [place], run: freizeit.spielplatzFinder,
  },
  {
    id: 'museum-regen', title: 'Museum bei Regen', category: 'freizeit',
    summary: 'Wenn es regnet: Museen und Ausstellungen mit Öffnungszeiten, Anreise und Besuchsdauer.',
    inputs: [place], run: freizeit.museumRegen,
  },
  {
    id: 'sport-im-park', title: 'Sport im Park heute', category: 'freizeit',
    summary: 'Kostenlose Sportangebote im Park mit Uhrzeit, Treffpunkt, Wetter und Anfahrt.',
    inputs: [place], run: freizeit.sportImPark,
  },
  {
    id: 'grillplatz-check', title: 'Grillplatz-Check', category: 'freizeit',
    summary: 'Grillplätze, erlaubte Nutzung, Waldbrandgefahr, Müll und nächste Toilette.',
    inputs: [place], run: freizeit.grillplatzCheck,
  },

  // ---------- E. Wissen & Bildung ----------
  {
    id: 'bibliothek-suche', title: 'Bibliothekssuche', category: 'wissen',
    summary: 'Bücher und Medien zu einem Ort oder Thema – K10plus, Open Library und Stadtbibliothek.',
    inputs: [text('q', 'Suchbegriff', 'z. B. Stuttgarter Kessel, Stadtgeschichte')], run: wissen.bibliothekSuche,
  },
  {
    id: 'wissens-luecken', title: 'Wissenslücken', category: 'wissen',
    summary: 'Orte in Stuttgart mit Wikidata-Koordinate, aber ohne Wikipedia-Artikel – mit Verbesserungsvorschlag.',
    inputs: [place], run: wissen.wissensLuecken,
  },
  {
    id: 'historische-bilder', title: 'Historische Bilder', category: 'wissen',
    summary: 'Fotos, Karten und Dokumente aus Commons, Wikipedia und Internet Archive zu einem Ort.',
    inputs: [place], run: wissen.historischeBilder,
  },
  {
    id: 'stadtarchiv-quellen', title: 'Quellen zur Straße', category: 'wissen',
    summary: 'Bücher, Archivstücke und Digitalisate zu einer Straße oder einem Gebäude.',
    inputs: [text('q', 'Straße oder Gebäude', 'z. B. Königstraße 1')], run: wissen.stadtarchivQuellen,
  },
  {
    id: 'strassen-geschichte', title: 'Straßenname erklärt', category: 'wissen',
    summary: 'Woher kommt der Straßenname? Wikipedia, Wikidata und historische Karten.',
    inputs: [text('q', 'Straßenname', 'z. B. Olgastraße')], run: wissen.strassenGeschichte,
  },
  {
    id: 'denkmal-erklaerer', title: 'Denkmal erklärt', category: 'wissen',
    summary: 'Denkmäler, Gedenkstätten und öffentliche Kunst in der Nähe – mit Bild und Hintergrund.',
    inputs: [place], run: wissen.denkmalErklaerer,
  },
  {
    id: 'baum-arten', title: 'Baumarten vor Ort', category: 'wissen',
    summary: 'Welche Bäume stehen in der Nähe? Baumkataster mit Art, Pflanzjahr und Pollenrisiko.',
    inputs: [place], run: wissen.baumArten,
  },
  {
    id: 'sternenhimmel', title: 'Sternenhimmel heute', category: 'wissen',
    summary: 'Mondphase, Planeten, Dämmerung, Lichtverschmutzung und Wolken – lohnt sich der Blick nach oben?',
    inputs: [place], run: freizeit.sternenhimmel,
  },
  {
    id: 'satelliten-ueberflug', title: 'ISS-Überflug', category: 'wissen',
    summary: 'Wann die ISS über Stuttgart sichtbar ist – berechnet aus aktuellen Bahndaten.',
    inputs: [place], run: freizeit.satellitenUeberflug,
  },
  {
    id: 'stadtteil-erklaert', title: 'Stadtteil in Zahlen erklärt', category: 'wissen',
    summary: 'Ein Stadtteil in einem Absatz: Lage, Geschichte, Bevölkerung, Besonderheiten und Quellen.',
    inputs: [district], run: wissen.stadtteilErklaert,
  },

  // ---------- F. Verwaltung & Alltag ----------
  {
    id: 'amt-finder', title: 'Zuständiges Amt', category: 'alltag',
    summary: 'Welche Stelle ist für ein Anliegen zuständig – mit Adresse, Öffnungszeiten, Telefon und Online-Dienst.',
    inputs: [text('q', 'Anliegen', 'z. B. Personalausweis verlängern')], run: alltag.amtFinder,
  },
  {
    id: 'fristen-rechner', title: 'Fristen-Rechner', category: 'alltag',
    summary: 'Widerspruch, Kündigung, Gewährleistung oder Bauantrag: Fristen mit Feiertagen und Wochenenden.',
    inputs: [{ key: 'start', label: 'Startdatum', type: 'date', required: true }, { key: 'art', label: 'Fristart', type: 'select', options: [['widerspruch', 'Widerspruch (1 Monat)'], ['kuendigung', 'Kündigung (4 Wochen)'], ['gewaehrleistung', 'Gewährleistung (2 Jahre)'], ['bauantrag', 'Bauantrag (3 Monate)']], required: true }], run: hilfe.fristenRechner,
  },
  {
    id: 'gebuehren-rechner', title: 'Gebühren-Rechner', category: 'alltag',
    summary: 'Was kostet ein Personalausweis, eine Meldebescheinigung oder ein Gewerbeschein?',
    inputs: [{ key: 'leistung', label: 'Leistung', type: 'select', options: [['personalausweis', 'Personalausweis'], ['reisepass', 'Reisepass'], ['meldebescheinigung', 'Meldebescheinigung'], ['gewerbe', 'Gewerbeanmeldung'], ['hund', 'Hundesteuer']], required: true }], run: hilfe.gebuehrenRechner,
  },
  {
    id: 'dokumenten-checkliste', title: 'Dokumenten-Checkliste', category: 'alltag',
    summary: 'Welche Unterlagen braucht ein Antrag? Checkliste zum Abhaken und Ausdrucken.',
    inputs: [text('q', 'Leistung', 'z. B. Wohnsitz anmelden')], run: alltag.dokumentenCheckliste,
  },
  {
    id: 'termin-optimierer', title: 'Bester Termin', category: 'alltag',
    summary: 'Bürgerbüro mit der kürzesten Wartezeit plus Anfahrt – und der beste Zeitpunkt in den nächsten Tagen.',
    inputs: [place], run: alltag.terminOptimierer,
  },
  {
    id: 'ummelde-helfer', title: 'Ummelde-Helfer', category: 'alltag',
    summary: 'Von der Wohnungsübergabe bis zum Abfuhrkalender: die Schritte nach dem Umzug.',
    inputs: [place], run: hilfe.ummeldeHilfer,
  },
  {
    id: 'abfall-kalender', title: 'Abfuhrkalender', category: 'alltag',
    summary: 'Nächste Abfuhrtermine für eine Adresse, mit Sonderterminen und Erinnerungsdatei.',
    inputs: [{ key: 'strasse', label: 'Straße', type: 'text', required: true, placeholder: 'z. B. Marienstraße' }, { key: 'nr', label: 'Hausnummer', type: 'text', required: true, placeholder: '1' }], run: alltag.abfallKalender,
  },
  {
    id: 'sperrmuell-check', title: 'Sperrmüll & Sonderabfall', category: 'alltag',
    summary: 'Wie entsorge ich Sperrmüll, Elektrogeräte, Farben und Grüngut? Mit Standorten und Terminen.',
    inputs: [place], run: hilfe.sperrmuellCheck,
  },
  {
    id: 'foerder-finder', title: 'Förderungen', category: 'alltag',
    summary: 'Solar, Gründach, Wärmepumpe, E-Lastrad oder Kultur: passende Förderprogramme und Antragswege.',
    inputs: [place], run: hilfe.foerderFinder,
  },
  {
    id: 'schulweg-check', title: 'Sicherer Schulweg', category: 'alltag',
    summary: 'Grundschulbezirk, Geh- und Radschulweg, Achtungsstellen und Unfallschwerpunkte.',
    inputs: [place], run: hilfe.schulwegCheck,
  },

  // ---------- G. Sicherheit & Notfall ----------
  {
    id: 'notfall-karte', title: 'Notfallkarte', category: 'notfall',
    summary: 'Notruf, nächster Defibrillator, Klinik, Polizei, Feuerwehr und Notfall-Treffpunkt auf einen Blick.',
    inputs: [place], run: umwelt.notfallKarte,
  },
  {
    id: 'apotheken-notdienst', title: 'Apotheken-Notdienst', category: 'notfall',
    summary: 'Welche Apotheke hat jetzt Notdienst? Mit Rufnummer, Anfahrt und Öffnungszeiten.',
    inputs: [place], run: hilfe.apothekenNotdienst,
  },
  {
    id: 'warnlage', title: 'Warnlage', category: 'notfall',
    summary: 'Amtliche Warnungen für den Ort: Gefahr, Gebiet, Zeitraum und konkrete Handlungshinweise.',
    inputs: [place], run: umwelt.warnlage,
  },
  {
    id: 'hochwasser-route', title: 'Hochwasser-Route', category: 'notfall',
    summary: 'Überflutungsflächen und HQ100 im Umkreis – mit sicheren Wegen und Treffpunkten.',
    inputs: [
      { key: 'von', label: 'Von', type: 'text', required: true, placeholder: 'z. B. Hauptbahnhof' },
      { key: 'nach', label: 'Nach', type: 'text', required: true, placeholder: 'z. B. Untertürkheim' },
    ], run: umwelt.hochwasserRoute,
  },
  {
    id: 'stromausfall-check', title: 'Stromausfall', category: 'notfall',
    summary: 'Netzzustand, Notfall-Leuchttürme, Ansprechpartner und Tipps für den Ernstfall.',
    inputs: [place], run: hilfe.stromausfallCheck,
  },
  {
    id: 'gas-notfall', title: 'Gas-Notfall', category: 'notfall',
    summary: 'Was tun bei Gasgeruch? Sofortmaßnahmen, Notrufnummern und nächster Treffpunkt.',
    inputs: [], run: hilfe.gasNotfall,
  },
  {
    id: 'erste-hilfe', title: 'Erste Hilfe', category: 'notfall',
    summary: 'Notruf, Herzdruckmassage, nächster Defibrillator und stabile Seitenlage – ruhig erklärt.',
    inputs: [], run: hilfe.ersteHilfe,
  },
  {
    id: 'defi-check', title: 'Defibrillator in der Nähe', category: 'notfall',
    summary: 'Nächste AED-Standorte mit Entfernung, Zugang und Öffnungszeiten.',
    inputs: [place], run: umwelt.defiCheck,
  },
  {
    id: 'feuerwehr-check', title: 'Feuerwehr & Brandschutz', category: 'notfall',
    summary: 'Nächste Feuerwache, Hydranten, Rauchwarnmelder-Pflicht und Verhalten im Brandfall.',
    inputs: [place], run: hilfe.feuerwehrCheck,
  },
  {
    id: 'polizei-check', title: 'Polizei & Sicherheit', category: 'notfall',
    summary: 'Nächstes Polizeirevier, Kriminalstatistik und Sicherheitshinweise für den Stadtbezirk.',
    inputs: [place], run: hilfe.polizeiCheck,
  },

  // ---------- H. Daten & Transparenz ----------
  {
    id: 'quellen-check', title: 'Quellen-Check', category: 'daten',
    summary: 'Welche Quelle steckt hinter einem Datensatz? Lizenz, Stand, Grenzen und Zitierhinweis.',
    inputs: [{ key: 'quelle', label: 'Quellen-ID oder Stichwort', type: 'text', required: true, placeholder: 'z. B. ckan-einwohner-altersgruppen' }], run: daten.quellenCheck,
  },
  {
    id: 'datensatz-explorer', title: 'Datensatz-Explorer', category: 'daten',
    summary: 'Alle neuen Quellen durchsuchen, als Tabelle ansehen und als CSV/GeoJSON weitergeben.',
    inputs: [{ ...text('q', 'Stichwort', 'z. B. Luft, Wahl, Brunnen'), required: false }, { key: 'quelle', label: 'Quelle (optional)', type: 'text', required: false, placeholder: 'Quellen-ID' }], run: daten.datensatzExplorer,
  },
  {
    id: 'stadt-vergleich', title: 'Stadt im Vergleich', category: 'daten',
    summary: 'Stuttgart im langfristigen Vergleich: Bevölkerung, Wohnen, Verkehr, Umwelt und Kultur.',
    inputs: [], run: daten.stadtVergleich,
  },
  {
    id: 'haushalt-transparenz', title: 'Haushalt & Ausgaben', category: 'daten',
    summary: 'Kulturausgaben, Sozialausgaben und Investitionen im Zeitverlauf.',
    inputs: [], run: daten.haushaltTransparenz,
  },
  {
    id: 'ifg-radar', title: 'IFG-Radar', category: 'daten',
    summary: 'Öffentliche Informationsfreiheitsanfragen an die Stadt: Themen, Status und offene Fragen.',
    inputs: [], run: alltag.ifgRadar,
  },
  {
    id: 'katalog-neu', title: 'Neue Datensätze', category: 'daten',
    summary: 'Was ist im Open-Data-Katalog neu oder zuletzt geändert? Mit Direktlink und Lizenz.',
    inputs: [], run: daten.katalogNeu,
  },
  {
    id: 'lizenz-finder', title: 'Lizenz-Finder', category: 'daten',
    summary: 'Welche Lizenz gilt für welche Quelle – und was muss bei der Weiterverwendung genannt werden?',
    inputs: [text('q', 'Quelle oder Lizenz', 'z. B. CC BY 4.0, ODbL, WFS')], run: daten.lizenzFinder,
  },
  {
    id: 'datenqualitaet', title: 'Datenqualität vor Ort', category: 'daten',
    summary: 'Wie vollständig sind die offenen Daten zu einem Ort? Abgleich von WFS, OSM und Statistik.',
    inputs: [place], run: daten.datenqualitaet,
  },
  {
    id: 'open-data-export', title: 'Open-Data-Export', category: 'daten',
    summary: 'Eine Auswahl von Quellen als CSV, GeoJSON oder Feed bündeln und herunterladen.',
    inputs: [text('q', 'Stichwort oder Quellen-ID', 'z. B. wahlen')], run: daten.openDataExport,
  },
  {
    id: 'aenderungs-feed', title: 'Änderungs-Feed', category: 'daten',
    summary: 'Was hat sich in den letzten Tagen geändert? Quellen mit Zeitstempel als RSS-Idee.',
    inputs: [], run: daten.aenderungsFeed,
  },

  // ---------- I. Teilen, Sprache, Zugang ----------
  {
    id: 'vorlesen', title: 'Vorlesen', category: 'teilen',
    summary: 'Einen Bericht als gesprochenen Text aufbereiten – für unterwegs und für sehbehinderte Menschen.',
    inputs: [text('text', 'Text oder Werkzeug-ID', 'z. B. kiez-steckbrief')], run: teilen.vorlesen,
  },
  {
    id: 'leichte-sprache', title: 'Leichte Sprache', category: 'teilen',
    summary: 'Kurze Sätze, klare Wörter, feste Reihenfolge – derselbe Inhalt in Leichter Sprache.',
    inputs: [text('text', 'Text oder Werkzeug-ID', 'z. B. warnlage')], run: teilen.leichteSprache,
  },
  {
    id: 'qr-schild', title: 'QR-Schild', category: 'teilen',
    summary: 'Ein Schild mit QR-Code für einen Ort oder eine Ansicht erzeugen und drucken.',
    inputs: [place, { key: 'titel', label: 'Titel auf dem Schild', type: 'text', required: false, placeholder: 'z. B. Trinkbrunnen' }], run: teilen.qrSchild,
  },
  {
    id: 'kiosk-builder', title: 'Kiosk-Builder', category: 'teilen',
    summary: 'Eine Kiosk-Ansicht für einen Stadtbezirk oder eine Haltestelle zusammenstellen.',
    inputs: [place], run: teilen.kioskBuilder,
  },
  {
    id: 'embed-widget', title: 'Embed-Widget', category: 'teilen',
    summary: 'Eine Karte oder Liste als iframe-Schnipsel in eine Vereins- oder Schulseite einbetten.',
    inputs: [text('url', 'Feed- oder Ansichts-URL', 'https://openstuttgart.de/…')], run: teilen.embedWidget,
  },
  {
    id: 'rss-builder', title: 'RSS-Builder', category: 'teilen',
    summary: 'Aus einer Filterkombination einen stabilen RSS-Feed bauen.',
    inputs: [text('q', 'Thema oder Quellen-ID', 'z. B. Baustellen')], run: teilen.rssBuilder,
  },
  {
    id: 'ical-builder', title: 'iCal-Builder', category: 'teilen',
    summary: 'Termine, Abfuhrtermine oder Fristen als Kalenderdatei exportieren.',
    inputs: [text('q', 'Thema oder Quellen-ID', 'z. B. Was geht')], run: teilen.icalBuilder,
  },
  {
    id: 'webhook-builder', title: 'Webhook & ntfy', category: 'teilen',
    summary: 'Benachrichtigungen für ein Thema abonnieren – ohne App, mit nachvollziehbarer Einwilligung.',
    inputs: [text('q', 'Thema', 'z. B. Regen an meiner Haltestelle')], run: teilen.webhookBuilder,
  },
  {
    id: 'social-post', title: 'Social-Post', category: 'teilen',
    summary: 'Einen Fund als fertigen Beitrag mit Quellenlink und Lizenzhinweis formulieren.',
    inputs: [text('q', 'Thema oder Quellen-ID', 'z. B. neue Brunnen')], run: teilen.socialPost,
  },
  {
    id: 'barrierefreie-route', title: 'Barrierefreie Route', category: 'teilen',
    summary: 'Stufenlose Verbindung mit Aufzügen, Toiletten und barrierefreien Umstiegen.',
    inputs: [{ key: 'von', label: 'Von', type: 'text', required: true, placeholder: 'Hauptbahnhof' }, { key: 'nach', label: 'Nach', type: 'text', required: true, placeholder: 'Charlottenplatz' }], run: mobilitaet.barrierefreieRoute,
  },

  // ---------- J. Spiel & Community ----------
  {
    id: 'stadt-quiz', title: 'Stadt-Quiz', category: 'spiel',
    summary: 'Fünf Fragen aus amtlichen Daten zu einem Stadtbezirk – mit Auflösung und Quelle.',
    inputs: [district], run: freizeit.stadtQuiz,
  },
  {
    id: 'schnitzeljagd-builder', title: 'Schnitzeljagd', category: 'spiel',
    summary: 'Eine eigene Route aus Sehenswürdigkeiten, Brunnen und Spielplätzen bauen.',
    inputs: [place], run: spiel.schnitzeljagdBuilder,
  },
  {
    id: 'foto-rallye', title: 'Foto-Rallye', category: 'spiel',
    summary: 'Fotospots in der Nähe mit Aufgaben, Sonnenstand und passender Uhrzeit.',
    inputs: [place], run: spiel.fotoRallye,
  },
  {
    id: 'giess-pate', title: 'Gieß-Pate', category: 'spiel',
    summary: 'Junge Bäume in der Nähe, Regenbilanz und der nächste Brunnen – für die Gießpatenschaft.',
    inputs: [place], run: freizeit.giessPate,
  },
  {
    id: 'nachbarschafts-tipp', title: 'Nachbarschaftstipp', category: 'spiel',
    summary: 'Kleine Entdeckungen in der Nähe: Brunnen, Aussichten, Bücherschränke, Engagements.',
    inputs: [place], run: spiel.nachbarschaftsTipp,
  },
  {
    id: 'strassen-ranking', title: 'Unfallschwerpunkte', category: 'daten',
    summary: 'Die dichtesten Unfall-Rasterpunkte im Stadtgebiet – mit Bezirk, Beteiligten und Methodik.',
    inputs: [], run: daten.strassenRanking,
  },
  {
    id: 'kessel-wetter', title: 'Kessel-Wetter', category: 'spiel',
    summary: 'Tal und Höhen vergleichen: Temperatur, Wind und Inversion im Stuttgarter Kessel.',
    inputs: [], run: spiel.kesselWetter,
  },
  {
    id: 'zeitkapsel', title: 'Zeitkapsel', category: 'spiel',
    summary: 'Was war hier früher? Historische Karten, Luftbilder und Bilder im Vergleich.',
    inputs: [place], run: wissen.zeitkapsel,
  },
  {
    id: 'geheimnisorte', title: 'Geheimnisorte', category: 'spiel',
    summary: 'Stäffele, Aussichtspunkte, Brunnen und stille Orte abseits der bekannten Wege.',
    inputs: [place], run: spiel.geheimnisOrte,
  },
  {
    id: 'mein-stuttgart', title: 'Mein Stuttgart', category: 'spiel',
    summary: 'Ein persönlicher Jahresrückblick aus den Daten des eigenen Stadtbezirks.',
    inputs: [district], run: freizeit.meinStuttgart,
  },
];

export const FEATURES = FEATURE_SPECS.map((f, i) => ({
  number: i + 1,
  key: `${String(i + 1).padStart(3, '0')}`,
  status: f.run ? 'live' : 'geplant',
  ...f,
}));

if (FEATURES.length !== 100) throw new Error(`Feature-Register muss 100 Einträge haben, hat aber ${FEATURES.length}`);
const ids = new Set(FEATURES.map((f) => f.id));
if (ids.size !== FEATURES.length) throw new Error('Doppelte Feature-ID im Register');

export const FEATURE_BY_ID = new Map(FEATURES.map((f) => [f.id, f]));

export const FEATURE_CATEGORIES = [
  ['kiez', 'Mein Kiez'],
  ['unterwegs', 'Unterwegs'],
  ['umwelt', 'Umwelt & Gesundheit'],
  ['freizeit', 'Freizeit'],
  ['wissen', 'Wissen & Bildung'],
  ['alltag', 'Verwaltung & Alltag'],
  ['notfall', 'Sicherheit & Notfall'],
  ['daten', 'Daten & Transparenz'],
  ['teilen', 'Teilen & Zugang'],
  ['spiel', 'Spiel & Community'],
];
