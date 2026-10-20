// „Schaffe ich den Anschluss?“ am Stuttgarter Hauptbahnhof.
//
// Ankünfte und Abfahrten an Stuttgart Hbf (de:08111:6115, mit den Teilhaltestellen oben, tief und Arnulf-Klett-Platz)
// aus EFA-BW (NVBW, XML_DM_REQUEST, dl-de/by-2-0), je Richtung höchstens alle 60 s. Liefert EFA keine Ist-Zeit,
// wird für Züge der DB die Ist-Zeit aus sources/db.mjs (DB Timetables bzw. übergangsweise IRIS) über die Zugnummer
// übernommen; sonst wird mit der Sollzeit gerechnet und das gekennzeichnet.
//
// Rechnung (Recherche „Verspätungen, Laufwege und historische Daten“, Abschnitt 3):
//   Puffer = Abfahrt_ist(Anschluss) − Ankunft_ist(Zubringer) − Fußweg − Zuschlag
//   Fußweg  = Tabelle server/data/fusswege-hbf.json je Paar von Teilhaltestellen
//   Zuschlag = 1 min Aussteigen, dazu 2 min, wenn ein Aufzug an einer der beiden Teilhaltestellen gestört ist
//   Ampel   = grün ≥ 2 min · gelb 0–2 min · rot < 0
// Als gewünschter Anschluss gilt die erste Abfahrt der gewählten Linie (und Richtung), die nach Fahrplan erreichbar ist.
import { readFileSync } from 'node:fs';
import { cached, fetchJson } from '../cache.mjs';
import { aufzuege } from './aufzuege.mjs';
import { bahnZugstatus } from './db.mjs';

const EFA = 'https://www.efa-bw.de/nvbw';
const HBF = 'de:08111:6115';
const QUELLE = 'Fahrplan- und Echtzeitdaten: EFA-BW (NVBW), DL-DE-BY-2.0; Ist-Zeiten der Eisenbahn: Deutsche Bahn (CC BY 4.0); ' +
  'Aufzugsstatus: DB InfraGO OpenStation (SIRI-FM) und FaSta-Meldungen in EFA-BW; Fußwege: eigene Tabelle aus EFA-Trip und VVS-GTFS';

const FUSSWEGE = JSON.parse(readFileSync(new URL('../data/fusswege-hbf.json', import.meta.url), 'utf8'));

const fehler = (msg, status = 400) => Object.assign(new Error(msg), { status });

// ---------- Hilfen ----------

function teilVon(name) {
  const n = String(name ?? '');
  if (/\(tief\)/i.test(n)) return 'tief';
  if (/Klett/i.test(n)) return 'klett';
  if (/^Stuttgart Hauptbahnhof$/i.test(n.trim())) return 'oben';
  return null;
}

function fussweg(a, b) {
  const w = FUSSWEGE.wege.find((x) => (x.von === a && x.nach === b) || (x.von === b && x.nach === a));
  return w ?? null;
}

function art(p) {
  // EFA-Produktklassen wie in efa.mjs
  switch (p?.class) {
    case 0: case 13: case 14: case 15: case 16: return 'zug';
    case 1: return 'sbahn';
    case 2: case 3: case 4: return 'stadtbahn';
    case 8: return 'zahnrad';
    default: return 'bus';
  }
}

const hhmm = (d) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(d);
const kompakt = (d) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(d).replace(/\D/g, '');

const minuten = (ms) => Math.round(ms / 60000);
const steigText = (s) => (s == null ? null : /^\d+$/.test(s) ? `Gleis ${s}` : s);

// ---------- EFA ----------

async function efaHbf(richtung) {
  const url = `${EFA}/XML_DM_REQUEST?outputFormat=rapidJSON&type_dm=stop&name_dm=${encodeURIComponent(HBF)}` +
    `&mode=direct&useRealtime=1&limit=150&useProxFootSearch=0${richtung === 'arr' ? '&itdDateTimeDepArr=arr' : ''}`;
  const { value, at, fresh } = await cached(`anschluss:${richtung}`, 60_000, async () => {
    const d = await fetchJson(url, { timeout: 20000 });
    const p = richtung === 'arr' ? 'arrival' : 'departure';
    const stoerungen = [];
    const events = [];
    for (const e of d.stopEvents ?? []) {
      for (const i of e.infos ?? []) {
        if (!String(i.id ?? '').startsWith('FaSta-')) continue;
        const text = i.infoLinks?.[0]?.urlText ?? i.infoLinks?.[0]?.subtitle ?? '';
        const m = /Bahnhof (Stuttgart Hauptbahnhof(?: \(tief\))?):\s*(Aufzug|Rolltreppe)\b(.*?)\s*außer Betrieb/i.exec(text);
        if (m && !stoerungen.some((s) => s.id === i.id)) {
          stoerungen.push({ id: i.id, teil: /\(tief\)/.test(m[1]) ? 'tief' : 'oben', anlage: m[2], text: text.trim() });
        }
      }
      const loc = e.location ?? {};
      const teil = teilVon(loc.parent?.name ?? loc.name);
      if (!teil) continue;
      const t = e.transportation ?? {};
      const soll = e[`${p}TimePlanned`];
      if (!soll) continue;
      const linie = t.disassembledName ?? t.number ?? t.name ?? '?';
      const tripCode = t.properties?.tripCode ?? '';
      events.push({
        key: `${kompakt(new Date(soll))}~${String(linie).replace(/[^\w]/g, '')}~${tripCode}`,
        linie,
        art: art(t.product),
        produkt: t.product?.name ?? null,
        zugnummer: t.properties?.trainNumber ?? null,
        ort: richtung === 'arr' ? t.origin?.name ?? null : t.destination?.name ?? null,
        teil,
        teilName: FUSSWEGE.teile[teil]?.name ?? loc.parent?.name,
        steig: loc.properties?.platformName ?? loc.disassembledName ?? null,
        steigSoll: loc.properties?.plannedPlatformName ?? null,
        soll,
        istEfa: e[`${p}TimeEstimated`] ?? null,
        ausfall: (e.realtimeStatus ?? []).includes('TRIP_CANCELLED') || e.isCancelled === true,
      });
    }
    return { events, stoerungen };
  });
  return { ...value, at, fresh };
}

/** Ergänzt fehlende Ist-Zeiten bei DB-Zügen aus der DB-Quelle (über die Zugnummer). */
function mitIst(e, db, richtung) {
  const soll = new Date(e.soll);
  let ist = e.istEfa ? new Date(e.istEfa) : null;
  let echtzeit = ist ? 'EFA-BW' : null;
  let ausfall = e.ausfall;
  let steig = e.steig;
  if (!ist && e.zugnummer && db.has(String(e.zugnummer))) {
    const z = db.get(String(e.zugnummer));
    const ev = richtung === 'arr' ? z.an : z.ab;
    // nur übernehmen, wenn die Sollzeiten zusammenpassen (gleiche Fahrt)
    if (ev && Math.abs(ev.soll - soll) < 2 * 60_000) {
      if (ev.istBekannt) { ist = ev.ist; echtzeit = 'DB'; }
      if (ev.ausfall) ausfall = true;
      if (ev.gleis && /^\d+$/.test(String(steig ?? '').replace(/^Gleis /, ''))) steig = ev.gleis;
    }
  }
  return {
    key: e.key,
    linie: e.linie,
    art: e.art,
    produkt: e.produkt,
    [richtung === 'arr' ? 'herkunft' : 'ziel']: e.ort,
    teil: e.teil,
    teilName: e.teilName,
    steig,
    steigSoll: e.steigSoll,
    soll: soll.toISOString(),
    ist: (ist ?? soll).toISOString(),
    verspaetung: ist && !ausfall ? minuten(ist - soll) : null,
    echtzeit,
    ausfall,
  };
}

async function laden() {
  const [arr, dep, db] = await Promise.all([efaHbf('arr'), efaHbf('dep'), bahnZugstatus()]);
  const ankuenfte = arr.events.map((e) => mitIst(e, db, 'arr'));
  const abfahrten = dep.events.map((e) => mitIst(e, db, 'dep'));
  const stoerungen = [...arr.stoerungen, ...dep.stoerungen.filter((s) => !arr.stoerungen.some((x) => x.id === s.id))];
  return { ankuenfte, abfahrten, stoerungen, at: Math.min(arr.at, dep.at), fresh: arr.fresh && dep.fresh };
}

function echtzeitHinweis(liste) {
  const efa = liste.filter((x) => x.echtzeit === 'EFA-BW').length;
  const db = liste.filter((x) => x.echtzeit === 'DB').length;
  if (efa === 0 && liste.length > 10) {
    return db > 0
      ? 'EFA-BW liefert derzeit keine Ist-Zeiten. Für Züge der DB werden Ist-Zeiten der DB verwendet, für Stadtbahn und Bus gilt der Fahrplan.'
      : 'EFA-BW liefert derzeit keine Ist-Zeiten. Gerechnet wird mit dem Fahrplan.';
  }
  return null;
}

const ART_FOLGE = { zug: 0, sbahn: 1, stadtbahn: 2, zahnrad: 3, bus: 4 };
const linienSort = (a, b) => (ART_FOLGE[a.art] ?? 9) - (ART_FOLGE[b.art] ?? 9) ||
  String(a.linie).localeCompare(String(b.linie), 'de', { numeric: true });

/**
 * Ankommende Fahrten am Hbf (etwa die nächste Stunde, dazu die letzten 5 Minuten) und die abfahrenden Linien
 * mit Richtungen als Auswahl für den Anschluss.
 */
export async function ankuenfteHbf() {
  const d = await laden();
  const jetzt = Date.now();
  const ankuenfte = d.ankuenfte
    .filter((a) => Date.parse(a.ist) >= jetzt - 5 * 60_000)
    .sort((a, b) => a.ist.localeCompare(b.ist));
  const gruppen = new Map();
  for (const ab of d.abfahrten) {
    const k = `${ab.linie}|${ab.ziel}`;
    if (!gruppen.has(k)) gruppen.set(k, { linie: ab.linie, art: ab.art, ziel: ab.ziel, teil: ab.teil, steige: new Set() });
    if (ab.steig) gruppen.get(k).steige.add(ab.steig);
  }
  const linien = [...gruppen.values()].map((g) => ({ ...g, steige: [...g.steige] })).sort(linienSort);
  return {
    ankuenfte,
    linien,
    echtzeitHinweis: echtzeitHinweis([...d.ankuenfte, ...d.abfahrten]),
    stand: new Date(d.at).toISOString(),
    fresh: d.fresh,
    quelle: QUELLE,
  };
}

async function aufzugsStoerungen(efaStoerungen) {
  const out = efaStoerungen.map((s) => ({ teil: s.teil, anlage: s.anlage, text: s.text, quelle: 'FaSta-Meldung in EFA-BW' }));
  try {
    const p = aufzuege();
    const data = await Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung')), 4000))]);
    const teile = { 'de:08111:6115': 'oben', 'de:08111:6118': 'tief' };
    for (const a of data.items) {
      if (!teile[a.stationId] || a.status !== 'außer Betrieb') continue;
      out.push({ teil: teile[a.stationId], anlage: 'Aufzug', text: `Aufzug ${a.beschreibung} außer Betrieb`, quelle: 'DB SIRI-FM' });
    }
  } catch { /* Aufzugsstatus nicht verfügbar: nur EFA-Meldungen */ }
  return out;
}

function bezeichnung(x, gross = false) {
  const g = (s) => (gross ? s[0].toUpperCase() + s.slice(1) : s);
  if (x.art === 'bus') return `${g('der')} Bus ${x.linie}`;
  if (x.art === 'zug') return `${g('der')} ${x.linie}`;
  return `${g('die')} ${x.linie}`;
}
const naechsteText = (x) => (x.art === 'bus' || x.art === 'zug' ? 'Der nächste' : 'Die nächste');

/**
 * Anschluss von einer ankommenden Fahrt (Schlüssel aus ankuenfteHbf) auf eine Linie, optional mit Richtung (Ziel).
 */
export async function anschluss(ankunftKey, linie, ziel) {
  if (!ankunftKey || typeof ankunftKey !== 'string' || ankunftKey.length > 80) throw fehler('Ankunft fehlt oder ist ungültig');
  if (!linie || String(linie).length > 20) throw fehler('Linie fehlt oder ist ungültig');
  const d = await laden();
  const a = d.ankuenfte.find((x) => x.key === ankunftKey);
  if (!a) throw fehler('Die gewählte Ankunft ist nicht mehr in der Ankunftsliste enthalten.', 404);
  const zielNorm = ziel ? String(ziel).trim() : null;
  const kandidaten = d.abfahrten
    .filter((x) => x.linie === linie && (!zielNorm || x.ziel === zielNorm))
    .filter((x) => !(x.linie === a.linie && x.key.split('~')[2] === a.key.split('~')[2])) // dieselbe Fahrt (durchgehend)
    .sort((x, y) => x.soll.localeCompare(y.soll));
  if (!kandidaten.length) {
    throw fehler(`Für die Linie ${linie}${zielNorm ? ` Richtung ${zielNorm}` : ''} ist in der nächsten Stunde keine Abfahrt am Hauptbahnhof bekannt.`, 404);
  }

  const stoerungen = await aufzugsStoerungen(d.stoerungen);
  const hinweise = [];

  const weg = (ab) => {
    const w = fussweg(a.teil, ab.teil);
    const basis = w?.minuten ?? 9;
    const aufzug = stoerungen.some((s) => s.anlage === 'Aufzug' && (s.teil === a.teil || s.teil === ab.teil));
    const zuschlag = FUSSWEGE.aussteigenMin + (aufzug ? FUSSWEGE.aufzugGestoertZuschlagMin : 0);
    return { minuten: basis + zuschlag, basis, zuschlag, aufzug, geschaetzt: w?.geschaetzt ?? true, quelle: w?.quelle ?? 'keine Angabe, Annahme 9 min' };
  };

  const ankSoll = Date.parse(a.soll);
  const ankIst = a.ausfall ? null : Date.parse(a.ist);
  // geplanter Anschluss: erste Abfahrt, die nach Fahrplan mit Fußweg erreichbar ist
  const geplant = kandidaten.find((x) => Date.parse(x.soll) - ankSoll >= weg(x).minuten * 60_000) ?? kandidaten[0];
  const w = weg(geplant);
  const puffer = ankIst == null ? null : minuten(Date.parse(geplant.ist) - ankIst) - w.minuten;
  const erreichbar = (x) => !x.ausfall && ankIst != null && Date.parse(x.ist) - ankIst >= weg(x).minuten * 60_000;
  // nächste erreichbare Fahrt derselben Linie in derselben Richtung
  const naechste = kandidaten
    .filter((x) => x !== geplant && x.ziel === geplant.ziel && Date.parse(x.soll) > Date.parse(geplant.soll))
    .find(erreichbar) ?? null;

  let ampel;
  if (a.ausfall || geplant.ausfall || puffer == null) ampel = 'rot';
  else ampel = puffer >= 2 ? 'gruen' : puffer >= 0 ? 'gelb' : 'rot';

  // Satz
  const v = a.verspaetung;
  const ort = steigText(a.steig) ? ` an ${steigText(a.steig)}` : '';
  let auftakt;
  if (a.echtzeit == null) auftakt = `Nach Fahrplan (Ankunft ${hhmm(new Date(ankSoll))}${ort}, ohne Echtzeitdaten)`;
  else if (v > 0) auftakt = `Mit ${v} ${v === 1 ? 'Minute' : 'Minuten'} Verspätung${ort}`;
  else if (v < 0) auftakt = `Bei Ankunft ${-v} ${v === -1 ? 'Minute' : 'Minuten'} vor Plan${ort}`;
  else auftakt = `Bei pünktlicher Ankunft${ort}`;
  const abZeit = (x) => {
    const ist = Date.parse(x.ist);
    const s = Date.parse(x.soll);
    return x.verspaetung && x.verspaetung !== 0 ? `${hhmm(new Date(ist))} (planmäßig ${hhmm(new Date(s))})` : hhmm(new Date(s));
  };
  let satz;
  if (a.ausfall) {
    satz = `Die Fahrt ${a.linie} aus ${a.herkunft ?? 'unbekannt'} (planmäßig ${hhmm(new Date(ankSoll))}) fällt aus.`;
  } else if (geplant.ausfall) {
    satz = `${bezeichnung(geplant, true)} um ${hhmm(new Date(Date.parse(geplant.soll)))} fällt aus.`;
  } else if (ampel === 'rot') {
    satz = `${auftakt} ist ${bezeichnung(geplant)} um ${abZeit(geplant)} nicht zu erreichen.`;
  } else if (ampel === 'gelb') {
    satz = `${auftakt} ist ${bezeichnung(geplant)} um ${abZeit(geplant)} knapp zu erreichen (Puffer ${puffer} ${puffer === 1 ? 'Minute' : 'Minuten'}).`;
  } else {
    satz = `${auftakt} ist ${bezeichnung(geplant)} um ${abZeit(geplant)} voraussichtlich zu erreichen (Puffer ${puffer} Minuten).`;
  }
  if (ampel === 'rot' && !a.ausfall) {
    satz += naechste
      ? ` ${naechsteText(naechste)} ${naechste.linie} fährt um ${abZeit(naechste)}.`
      : ' Eine spätere Abfahrt dieser Linie ist in der Abfahrtsliste der nächsten Stunde nicht enthalten.';
  }

  if (a.echtzeit == null || geplant.echtzeit == null) {
    hinweise.push(`Ohne Echtzeitdaten für ${[a.echtzeit == null ? 'die Ankunft' : null, geplant.echtzeit == null ? 'die Abfahrt' : null].filter(Boolean).join(' und ')}; gerechnet wird mit der Sollzeit.`);
  }
  if (w.aufzug) hinweise.push(`Gestörter Aufzug auf dem Weg: ${FUSSWEGE.aufzugGestoertZuschlagMin} Minuten Zuschlag eingerechnet.`);
  for (const s of stoerungen.filter((s) => s.teil === a.teil || s.teil === geplant.teil)) hinweise.push(s.text);
  if (w.geschaetzt) hinweise.push('Der Fußweg zwischen diesen Bahnhofsteilen ist geschätzt.');

  return {
    zubringer: a,
    anschluss: geplant,
    fussweg_min: w.minuten,
    fussweg: {
      von: FUSSWEGE.teile[a.teil]?.name,
      nach: FUSSWEGE.teile[geplant.teil]?.name,
      wegMin: w.basis,
      zuschlagMin: w.zuschlag,
      aufzugGestoert: w.aufzug,
      geschaetzt: w.geschaetzt,
      quelle: w.quelle,
    },
    puffer_min: puffer,
    ampel,
    satz,
    naechste: naechste
      ? { ...naechste, puffer_min: minuten(Date.parse(naechste.ist) - ankIst) - weg(naechste).minuten }
      : null,
    hinweise,
    grenzen: FUSSWEGE.grenzen,
    stand: new Date(d.at).toISOString(),
    quelle: QUELLE,
  };
}
