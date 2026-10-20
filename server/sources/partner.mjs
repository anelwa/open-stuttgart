// Vorbereitete Schnittstellen für Daten, die nur über die Stadt oder Partner zugänglich sind
// (Abschnitt 7.2 Rang 11 und 13, Abschnitt 7.3 Rang 14 bis 19 der Positionierung).
// Jeder Eintrag nennt, welcher Zugang von wem nötig ist, und die Umgebungsvariable, über die der
// Betrieb einen Endpunkt bzw. Schlüssel einträgt. Ohne Eintrag bleibt der Status „vorbereitet“ und es
// findet kein Abruf statt. Mit Eintrag wird die Antwort als JSON unverändert durchgereicht (5 Minuten Cache).
//
// Allgemeine Variablen je Eintrag (ENV = Wert von `env`):
//   ENV          Endpunkt (https-URL), der JSON liefert
//   ENV_KEY      optionaler Schlüssel; gesendet als `Authorization: Bearer …` oder im Kopf aus ENV_HEADER
//   ENV_HEADER   optionaler Name des Kopffelds für den Schlüssel (z. B. X-Api-Key)
import { cached, fetchJson } from '../cache.mjs';

const GELBE_KARTE = 'https://service.stuttgart.de/lhs-services/stoerung/stoerung';
// Störungsarten des Formulars (Auswahlfeld form[incidenttype]), Stand 20.10.2026
const GELBE_KARTE_ARTEN = {
  1: 'Ampel', 2: 'Brunnen / Gewässer', 3: 'Straße - Schäden', 5: 'Gehweg - Schäden', 7: 'Kanaldeckel', 8: 'Parkscheinautomat',
  9: 'Poller', 10: 'Radweg - Schäden', 11: 'Radweg - Scherben', 12: 'Radweg - Verschmutzung', 13: 'Rolltreppe', 14: 'Schlagloch',
  15: 'SSB Haltestelle', 16: 'Straßenbeleuchtung', 17: 'Treppe', 18: 'Verkehrszeichen', 19: 'Straßeneinlauf - verstopft',
  20: 'Wilder Müll', 21: 'Sonstiges', 24: 'Gehweg - Verschmutzung', 25: 'Straße - Verschmutzung', 26: 'Bäder', 28: 'Gefahrenstelle', 30: 'Begrünung',
};

export const PARTNER = [
  {
    id: 'maengelmelder', rang: 11, titel: 'Mangel melden (Gelbe Karte)',
    beschreibung: 'Übergabe eines Orts an die Gelbe Karte, das Ideen- und Beschwerdemanagement der Stadt. Heute nur als Verweis auf das Formular mit Koordinaten und Adresse zum Übernehmen; das Formular übernimmt keine Werte aus der Adresszeile. Eine Statusanzeige gemeldeter Mängel setzt eine Veröffentlichung durch die Stadt voraus.',
    benoetigt: 'Stadt (betreuende Stelle der Gelben Karte): Vorbelegung von Ort und Störungsart per Link oder eine Schnittstelle (z. B. Open311), Freigabe zur Anzeige des Bearbeitungsstands.',
    env: 'OS_MAENGEL_URL', quelle: GELBE_KARTE,
  },
  {
    id: 'pvog', rang: 13, titel: 'Verwaltungsleistungen (PVOG-Suchdienst)',
    beschreibung: 'Leistungsbeschreibungen, erforderliche Unterlagen und Zuständigkeiten für Stuttgart aus dem Portalverbund (PVOG) als Grundlage eines Verwaltungsassistenten mit Quellenangabe. Der Suchdienst antwortet ohne Client-ID mit 401.',
    benoetigt: 'FITKO: Client-ID für den PVOG-Suchdienst (pvog.fitko.net), Antrag naheliegend über die Stadt; Klärung von Modellbetrieb und Datenschutz für den Assistenten.',
    env: 'OS_PVOG_CLIENT_ID', quelle: 'https://pvog.fitko.net/suchdienst/api/v5',
  },
  {
    id: 'sperrungen', rang: 14, titel: 'Sperrungen vor dem Ereignis',
    beschreibung: 'Genehmigte Straßensperrungen für Feste, Märkte, Versammlungen und Großveranstaltungen mit Zeitraum und Umleitung, verknüpfbar mit Linien und Parkhäusern.',
    benoetigt: 'Stadt: Amt für öffentliche Ordnung und Tiefbauamt, Vereinbarung zur Datenweitergabe (z. B. als GeoJSON oder DATEX II).',
    env: 'OS_SPERRUNGEN_URL',
  },
  {
    id: 'ssb-fahrzeuge', rang: 15, titel: 'Stadtbahn-Fahrzeugpositionen und Auslastung',
    beschreibung: 'Positionen der Stadtbahnen und Busse der SSB und, falls erhoben, die Auslastung je Fahrt.',
    benoetigt: 'Partner: Stuttgarter Straßenbahnen AG (SSB), Freigabe eines Echtzeit-Feeds (z. B. GTFS-Realtime VehiclePositions oder VDV 454).',
    env: 'OS_SSB_FAHRZEUGE_URL',
  },
  {
    id: 'verkehrszaehlung', rang: 16, titel: 'Verkehrslage aus städtischen Zählstellen',
    beschreibung: 'Werte der Kfz-Zählstellen und des Verkehrsrechners der Stadt. Im Geoserver bestehen Ebenen im Arbeitsbereich DVFO_Aufbau_ERZ; ob sie live betrieben werden, ist nicht geklärt.',
    benoetigt: 'Stadt: Amt für öffentliche Ordnung bzw. Tiefbauamt, Klärung von Betrieb, Aktualität und Nutzungsbedingungen der DVFO-Daten.',
    env: 'OS_VERKEHR_URL',
  },
  {
    id: 'apotheken-notdienst', rang: 17, titel: 'Apotheken-Notdienst',
    beschreibung: 'Dienstbereite Apotheken in Stuttgart mit Zeitraum. Die Schnittstelle der Landesapothekerkammer ist nur für Kammermitglieder freigeschaltet; bis dahin Verweis auf das Notdienstportal.',
    benoetigt: 'Partner: Landesapothekerkammer Baden-Württemberg, Zugang zur Notdienst-Schnittstelle, Anfrage über den Auftrag der Stadt.',
    env: 'OS_APOTHEKEN_URL', quelle: 'https://www.lak-bw.de/notdienstportal/',
  },
  {
    id: 'starkregen-fruehwarnung', rang: 18, titel: 'Starkregen-Frühwarnung',
    beschreibung: 'Messwerte von Pegeln und Regenmessern der Stadtentwässerung, verknüpft mit der Starkregengefahrenkarte.',
    benoetigt: 'Stadt: Eigenbetrieb Stadtentwässerung Stuttgart (SES), Verfügbarkeit der Messwerte nicht geprüft.',
    env: 'OS_SES_URL',
  },
  {
    id: 'wartezeiten-aemter', rang: 19, titel: 'Wartezeiten weiterer Ämter',
    beschreibung: 'Live-Wartezeiten weiterer Dienststellen, etwa Kfz-Zulassungsstelle und Ausländerbehörde. Heute veröffentlicht die Stadt nur die Bürgerbüros (wartezeiten.stuttgart.de/bb/status); die Bedeutung der Statuswerte ist nicht amtlich erläutert.',
    benoetigt: 'Stadt: Erläuterung der Statuswerte und Bereitstellung weiterer Ämter im selben Format.',
    env: 'OS_WARTEZEITEN_URL',
  },
];

const env = (name) => (process.env[name] ?? '').trim();
const configured = (p) => env(p.env) !== '';

/** Welche Partner-Schnittstellen per Umgebungsvariable eingerichtet sind. Werte werden nicht ausgegeben. */
export function partnerStatus() {
  return {
    eintraege: PARTNER.map((p) => ({
      id: p.id, rang: p.rang, titel: p.titel, beschreibung: p.beschreibung, benoetigt: p.benoetigt, env: p.env,
      quelle: p.quelle ?? null, status: configured(p) ? 'aktiv' : 'vorbereitet',
    })),
    hinweis: 'Status „vorbereitet“ bedeutet: Schnittstelle im Programm angelegt, Daten liegen nicht vor. „aktiv“ bedeutet: Zugang ist im Betrieb eingetragen.',
  };
}

/** Leitet eine Anfrage an den eingetragenen Endpunkt weiter und reicht das JSON durch. */
export async function partnerDaten(id, params = {}) {
  const p = PARTNER.find((x) => x.id === id);
  if (!p) throw new Error('Unbekannte Partner-Schnittstelle');
  if (!configured(p)) return { id, status: 'vorbereitet', available: false, benoetigt: p.benoetigt, quelle: p.quelle ?? null };
  if (id === 'pvog') return pvog(params.q, params.ars);
  const url = env(p.env);
  if (!/^https:\/\//.test(url)) throw new Error(`${p.env} muss eine https-Adresse sein`);
  const { value, at, fresh } = await cached(`partner-${id}`, 5 * 60_000, () => fetchJson(url, { headers: authHeader(p.env) }));
  return { id, status: 'aktiv', available: true, stand: new Date(at).toISOString(), fresh, daten: value };
}

function authHeader(name) {
  const key = env(`${name}_KEY`);
  if (!key) return {};
  const h = env(`${name}_HEADER`);
  return h ? { [h]: key } : { Authorization: `Bearer ${key}` };
}

// PVOG-Suchdienst: Leistungen für einen Amtlichen Regionalschlüssel (Stuttgart 081110000000).
// Wie die Client-ID übergeben wird, legt die FITKO bei der Freischaltung fest; Kopffeld über
// OS_PVOG_HEADER (Standard X-Client-Id), Basisadresse über OS_PVOG_URL. Nicht mit gültiger ID geprüft.
async function pvog(q, ars = '081110000000') {
  if (!q || String(q).trim().length < 2) throw new Error('Suchbegriff fehlt');
  if (!/^\d{12}$/.test(ars)) throw new Error('Regionalschlüssel muss 12 Ziffern haben');
  const base = env('OS_PVOG_URL') || 'https://pvog.fitko.net/suchdienst/api/v5';
  const header = env('OS_PVOG_HEADER') || 'X-Client-Id';
  const url = `${base}/servicedescriptions/${ars}?q=${encodeURIComponent(String(q).trim().slice(0, 100))}`;
  const { value, at } = await cached(`pvog-${ars}-${String(q).toLowerCase()}`, 24 * 3600_000,
    () => fetchJson(url, { headers: { [header]: env('OS_PVOG_CLIENT_ID') } }));
  return { id: 'pvog', status: 'aktiv', available: true, stand: new Date(at).toISOString(), ars, daten: value, source: 'Portalverbund Online-Gateway (PVOG), FITKO' };
}

/**
 * Übergabe an die Gelbe Karte. Das Formular (Symfony, POST) übernimmt keine Werte aus der Adresse;
 * daher ein Verweis plus die Angaben, die die Nutzerin oder der Nutzer dort einträgt bzw. auf der Karte setzt.
 * Ist OS_MAENGEL_URL gesetzt (vereinbarte Übergabe-Adresse mit Platzhaltern {lat} {lon} {art}), wird diese verwendet.
 */
export function maengelUebergabe(lat, lon, art, adresse) {
  lat = +lat; lon = +lon;
  const ok = Number.isFinite(lat) && Number.isFinite(lon) && lat > 48.6 && lat < 48.9 && lon > 9.0 && lon < 9.35;
  const artId = GELBE_KARTE_ARTEN[art] ? +art : null;
  const vorlage = env('OS_MAENGEL_URL');
  const url = vorlage && ok
    ? vorlage.replace('{lat}', lat.toFixed(6)).replace('{lon}', lon.toFixed(6)).replace('{art}', artId ?? '')
    : GELBE_KARTE;
  return {
    url,
    vorbelegt: Boolean(vorlage && ok),
    angaben: ok ? {
      lat: +lat.toFixed(6), lon: +lon.toFixed(6), adresse: adresse ?? null,
      art: artId ? { id: artId, name: GELBE_KARTE_ARTEN[artId] } : null,
      text: [adresse, `Koordinaten ${lat.toFixed(6)}, ${lon.toFixed(6)} (WGS 84)`].filter(Boolean).join(' – '),
    } : null,
    arten: Object.entries(GELBE_KARTE_ARTEN).map(([id, name]) => ({ id: +id, name })).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    hinweis: vorlage
      ? 'Übergabe über die mit der Stadt vereinbarte Adresse.'
      : 'Das Formular der Gelben Karte übernimmt Ort und Störungsart nicht automatisch. Bitte Ort im Formular auf der Karte setzen oder die Adresse eintragen und die Störungsart wählen.',
    source: 'Landeshauptstadt Stuttgart, Gelbe Karte (Ideen- und Beschwerdemanagement)',
  };
}
