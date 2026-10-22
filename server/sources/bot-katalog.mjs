// Kuratierter Anliegen-Katalog für StuttBot.
//
// Die Leistungs-URLs stammen aus dem Verwaltungsdatensatz (stuttgart.de). Der Katalog
// ist absichtlich klein und stabil: Er deckt die häufigen Bürgeranliegen ab und sagt
// dem Modell, welche Angaben für eine gute Antwort fehlen. Alles andere beantwortet
// der Bot über die Volltextsuche im Verwaltungsbestand.

const U = (slug) => `https://www.stuttgart.de/organigramm/leistungen/${slug}`;

export const SERVICE_URLS = {
  personalausweis: U('personalausweis-beantragen-erstmalig-oder-nach-ablauf'),
  personalausweisVerlust: U('personalausweis-ausstellung-wegen-verlust-oder-diebstahl-beantragen'),
  personalausweisUnter16: U('personalausweis-ausstellung-fuer-unter-16-jaehrige-beantragen'),
  personalausweisAdresse: U('personalausweis-adressaenderung'),
  reisepass: U('reisepass-beantragen-erstmalig-oder-nach-ablauf'),
  reisepassExpress: U('reisepass-beantragen-express'),
  reisepassVerlust: U('reisepass-beantragen-wegen-verlust'),
  reisepassUnter16: U('reisepass-beantragen-fuer-minderjaehrige'),
  wohnsitzHaupt: U('wohnsitz-anmelden-als-hauptwohnsitz'),
  wohnsitzNeben: U('wohnsitz-anmelden-als-nebenwohnsitz'),
  wohnsitzUmmelden: U('wohnsitz-ummelden-innerhalb-von-stuttgart'),
  wohnungsgeber: U('wohnsitz-anmelden-durch-den-wohnungsgeber-bescheinigung-vom-wohnungsgeber'),
  fuehrerschein: U('fuehrerschein-beantragen-erstmalig'),
  fuehrerscheinAb17: U('fuehrerschein-beantragen-ab-17-jahre'),
  fuehrerscheinErweiterung: U('fuehrerschein-erweiterung'),
  fuehrerscheinUmtausch: U('fuehrerschein-umtausch-in-eu-fuehrerschein-beantragen'),
  fuehrerscheinVerlust: U('fuehrerschein-ersetzen-wegen-verlust-oder-diebstahl'),
  bewohnerpark: U('bewohnerparkausweis-beantragen'),
  bewohnerparkVerlaengern: U('bewohnerparkausweis-verlaengern'),
  bewohnerparkAendern: U('bewohnerparkausweis-aendern'),
  bewohnerparkErsatz: U('bewohnerparkausweis-ersatz-beantragen'),
  kfzNeuwagen: U('kraftfahrzeug-zulassen-erstmalig-neuwagen-'),
  kfzWieder: U('kraftfahrzeug-wieder-zulassen'),
  kfzAbmelden: U('ikfz-kraftfahrzeug-online-abmelden-ausserbetriebsetzung-'),
  kfzOnline: U('ikfz-kraftfahrzeug-online-zulassen'),
  fuehrungszeugnis: U('einfaches-fuehrungszeugnis-beantragen'),
  eheschliessung: U('eheschliessung-anmelden'),
  kita: U('kindertageseinrichtung-kind-fuer-aufnahme-anmelden'),
  abfall: U('abfuhrtermine'),
  abfallkalender: U('abfallkalender'),
};

/** Normalisiert deutsche Eingaben für den Vergleich: klein, ohne Umlaute, ohne Satzzeichen. */
export function norm(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const opt = (value, label, match) => ({ value, label, match });

const ALTER = {
  id: 'alter',
  question: 'Wie alt bist du? Das entscheidet über die Gebühr.',
  options: [
    opt('unter16', 'unter 16', /unter 16|kind|kindes|sohn|tochter|minderjaehrig|schueler/),
    opt('16-23', '16 bis 23', /\b1[6-9]\b|\b2[0-3]\b|jugendlich|16 bis 23/),
    opt('24+', '24 oder älter', /\b2[4-9]\b|\b[3-9]\d\b|\b\d{3}\b|erwachsen|volljaehrig/),
  ],
};

export const INTENTS = [
  {
    id: 'personalausweis',
    label: 'Personalausweis',
    keywords: [/personalausweis/, /\bperso\b/, /ausweis.*beantrag/, /ausweis.*(verlor|gestohl|geklaut|diebstahl|abgelaufen)/],
    serviceUrl: (s) => {
      if (s.anlass === 'verlust') return SERVICE_URLS.personalausweisVerlust;
      if (s.anlass === 'unter16') return SERVICE_URLS.personalausweisUnter16;
      if (s.anlass === 'adressaenderung') return SERVICE_URLS.personalausweisAdresse;
      return SERVICE_URLS.personalausweis;
    },
    slots: [
      {
        id: 'anlass',
        question: 'Worum geht es beim Personalausweis?',
        options: [
          opt('erstmalig', 'Erstmalig oder abgelaufen', /erst|abgelaufen|neu|verlaeng|alt|normal/),
          opt('verlust', 'Verloren oder gestohlen', /verlor|gestohl|geklaut|diebstahl|weg/),
          opt('unter16', 'Für ein Kind unter 16', /kind|unter 16|minderjaehrig|sohn|tochter/),
          opt('adressaenderung', 'Adresse ändern', /adress|umzug|umgemeldet/),
        ],
      },
      { ...ALTER, when: (s) => !['unter16', 'adressaenderung'].includes(s.anlass) },
    ],
    hint: 'Ausweis im Bürgerbüro beantragen, verlängern oder ersetzen',
  },
  {
    id: 'reisepass',
    label: 'Reisepass',
    keywords: [/reisepass/, /\bpass\b.*(beantrag|abgelaufen|verlor|gestohl)/, /passport/],
    serviceUrl: (s) => {
      if (s.anlass === 'verlust') return SERVICE_URLS.reisepassVerlust;
      if (s.anlass === 'express') return SERVICE_URLS.reisepassExpress;
      if (s.anlass === 'unter16') return SERVICE_URLS.reisepassUnter16;
      return SERVICE_URLS.reisepass;
    },
    slots: [
      {
        id: 'anlass',
        question: 'Was brauchst du beim Reisepass?',
        options: [
          opt('erstmalig', 'Erstmalig oder abgelaufen', /erst|abgelaufen|neu|verlaeng|alt|normal/),
          opt('express', 'Express, möglichst schnell', /express|schnell|eilig|sofort/),
          opt('verlust', 'Verloren oder gestohlen', /verlor|gestohl|geklaut|diebstahl|weg/),
          opt('unter16', 'Für ein Kind unter 16', /kind|unter 16|minderjaehrig|sohn|tochter/),
        ],
      },
      { ...ALTER, when: (s) => !['unter16'].includes(s.anlass) },
    ],
    hint: 'Reisepass beantragen, express oder ersetzen',
  },
  {
    id: 'wohnsitz',
    label: 'Wohnsitz anmelden',
    keywords: [/wohnsitz/, /wohnung.*ummeld/, /wohnsitz.*ummeld/, /wohnung.*anmeld/, /anmeldung.*wohn/, /meldebescheinigung/],
    serviceUrl: (s) => {
      if (s.anlass === 'neben') return SERVICE_URLS.wohnsitzNeben;
      if (s.anlass === 'ummelden') return SERVICE_URLS.wohnsitzUmmelden;
      if (s.anlass === 'wohnungsgeber') return SERVICE_URLS.wohnungsgeber;
      return SERVICE_URLS.wohnsitzHaupt;
    },
    slots: [
      {
        id: 'anlass',
        question: 'Was ist deine Situation?',
        options: [
          opt('haupt', 'Neu in Stuttgart, Hauptwohnsitz', /haupt|neu|zugezogen|von auswaerts|erste/),
          opt('neben', 'Nebenwohnsitz anmelden', /neben/),
          opt('ummelden', 'Innerhalb Stuttgarts umziehen', /innerhalb|umzug|umgezogen|ummelden/),
          opt('wohnungsgeber', 'Wohnungsgeberbescheinigung', /wohnungsgeber|bescheinigung|vermieter/),
        ],
      },
    ],
    hint: 'Haupt- oder Nebenwohnsitz anmelden, ummelden',
  },
  {
    id: 'fuehrerschein',
    label: 'Führerschein',
    keywords: [/fuehrerschein/, /fahrerlaubnis/],
    serviceUrl: (s) => {
      if (s.anlass === 'ab17') return SERVICE_URLS.fuehrerscheinAb17;
      if (s.anlass === 'erweiterung') return SERVICE_URLS.fuehrerscheinErweiterung;
      if (s.anlass === 'umtausch') return SERVICE_URLS.fuehrerscheinUmtausch;
      if (s.anlass === 'verlust') return SERVICE_URLS.fuehrerscheinVerlust;
      return SERVICE_URLS.fuehrerschein;
    },
    slots: [
      {
        id: 'anlass',
        question: 'Worum geht es beim Führerschein?',
        options: [
          opt('erstmalig', 'Erstmalig beantragen', /erst|neu|anfang|beginner/),
          opt('ab17', 'Begleitetes Fahren ab 17', /ab 17|17 jahre|begleitet/),
          opt('erweiterung', 'Klasse erweitern', /erweiter|klasse|zusatz/),
          opt('umtausch', 'Umtausch in EU-Führerschein', /umtausch|eu|auslaendisch/),
          opt('verlust', 'Verloren oder gestohlen', /verlor|gestohl|geklaut|diebstahl/),
        ],
      },
    ],
    hint: 'Führerschein erstmalig, erweitern, umtauschen oder ersetzen',
  },
  {
    id: 'bewohnerparkausweis',
    label: 'Bewohnerparkausweis',
    keywords: [/bewohnerpark/, /parkausweis/],
    serviceUrl: (s) => {
      if (s.anlass === 'verlaengern') return SERVICE_URLS.bewohnerparkVerlaengern;
      if (s.anlass === 'aendern') return SERVICE_URLS.bewohnerparkAendern;
      if (s.anlass === 'ersatz') return SERVICE_URLS.bewohnerparkErsatz;
      return SERVICE_URLS.bewohnerpark;
    },
    slots: [
      {
        id: 'anlass',
        question: 'Was möchtest du beim Bewohnerparkausweis machen?',
        options: [
          opt('erst', 'Erstantrag', /erst|neu|beantrag/),
          opt('verlaengern', 'Verlängern', /verlaenger|weiter/),
          opt('aendern', 'Ändern', /aender|umzug|kennzeichen/),
          opt('ersatz', 'Ersatz beantragen', /ersatz|verlor|gestohl/),
        ],
      },
    ],
    hint: 'Parkausweis für Anwohner beantragen oder verlängern',
  },
  {
    id: 'kfz',
    label: 'Kfz-Zulassung',
    keywords: [/kfz/, /kraftfahrzeug/, /auto.*zulass/, /zulassung.*auto/, /auto.*ummeld/, /fahrzeug.*ummeld/, /neuwagen/],
    serviceUrl: (s) => {
      if (s.anlass === 'wieder') return SERVICE_URLS.kfzWieder;
      if (s.anlass === 'abmelden') return SERVICE_URLS.kfzAbmelden;
      if (s.anlass === 'online') return SERVICE_URLS.kfzOnline;
      return SERVICE_URLS.kfzNeuwagen;
    },
    slots: [
      {
        id: 'anlass',
        question: 'Was ist mit dem Fahrzeug?',
        options: [
          opt('neuwagen', 'Neuwagen zulassen', /neu|neuwagen|erstmalig/),
          opt('gebraucht', 'Gebrauchtwagen ummelden', /gebraucht|ummelden|uebernehmen|kaufen/),
          opt('wieder', 'Wiederzulassung', /wieder|abgemeldet/),
          opt('abmelden', 'Abmelden', /abmeld|ausser betrieb|stilllegen/),
        ],
      },
    ],
    hint: 'Auto an-, um- oder abmelden',
  },
  {
    id: 'fuehrungszeugnis',
    label: 'Führungszeugnis',
    keywords: [/fuehrungszeugnis/],
    serviceUrl: () => SERVICE_URLS.fuehrungszeugnis,
    slots: [],
    needsLocation: false,
    hint: 'Einfaches Führungszeugnis beantragen',
  },
  {
    id: 'eheschliessung',
    label: 'Eheschließung',
    keywords: [/eheschliessung/, /heiraten/, /hochzeit/, /standesamt/],
    serviceUrl: () => SERVICE_URLS.eheschliessung,
    slots: [],
    hint: 'Eheschließung beim Standesamt anmelden',
  },
  {
    id: 'kita',
    label: 'Kita-Platz',
    keywords: [/kita/, /kindertages/, /kitaplatz/, /kindergarten/],
    serviceUrl: () => SERVICE_URLS.kita,
    slots: [],
    needsLocation: false,
    hint: 'Kind für eine Kindertageseinrichtung anmelden',
  },
  {
    id: 'abfall',
    label: 'Abfall & Abfuhrtermine',
    keywords: [/abfall/, /abfuhr/, /muell/, /sperrmuell/],
    serviceUrl: () => SERVICE_URLS.abfall,
    slots: [],
    needsLocation: false,
    hint: 'Abfuhrtermine, Abfallkalender und Sperrmüll',
  },
];

export const INTENT_IDS = INTENTS.map((i) => i.id);

/** Erkennt ein Anliegen ohne Modell. Liefert null, wenn nichts sicher passt. */
export function detectIntent(text) {
  const t = norm(text);
  let best = null;
  for (const intent of INTENTS) {
    let score = 0;
    for (const re of intent.keywords) {
      if (re.test(t)) score += Math.max(4, re.source.length);
    }
    if (score > (best?.score ?? 0)) best = { intent, score };
  }
  return best && best.score >= 4 ? best.intent : null;
}

/** Liest eine Antwort auf eine Slot-Frage, auch wenn sie frei formuliert ist. */
export function parseSlotValue(slot, text) {
  const t = norm(text);
  if (!t) return null;
  for (const o of slot.options) {
    if (o.match?.test(t)) return o.value;
  }
  for (const o of slot.options) {
    if (norm(o.label) === t) return o.value;
  }
  // Altersangaben wie „ich bin 15“ oder „34 Jahre“
  if (slot.id === 'alter') {
    const m = /\b(\d{1,3})\b/.exec(t);
    if (m) {
      const n = Number(m[1]);
      if (n < 16) return 'unter16';
      if (n < 24) return '16-23';
      if (n < 120) return '24+';
    }
  }
  return null;
}

/** Nächste fehlende Angabe; respektiert when() und setzt ableitbare Werte. */
export function nextSlot(intent, slots) {
  if (intent.id === 'personalausweis') {
    if (slots.anlass === 'unter16') slots.alter = 'unter16';
    if (slots.anlass === 'adressaenderung') slots.alter = null;
  }
  if (intent.id === 'reisepass' && slots.anlass === 'unter16') slots.alter = 'unter16';
  for (const slot of intent.slots) {
    if (slot.when && !slot.when(slots)) continue;
    if (!slots[slot.id]) return slot;
  }
  return null;
}

export function slotById(intent, id) {
  return intent.slots.find((s) => s.id === id) ?? null;
}

/** Alle Slot-Namen für das JSON-Schema der Modellabfrage. */
export const ALL_SLOT_IDS = [...new Set(INTENTS.flatMap((i) => i.slots.map((s) => s.id)))];

/** Kurzbeschreibung für den Systemprompt des Modells. */
export function catalogForPrompt() {
  return INTENTS.map((i) => `${i.id}: ${i.label} — ${i.hint}`).join('\n');
}
