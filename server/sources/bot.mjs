// StuttBot: Bürgeranliegen-Assistent auf Basis eines günstigen Gemini-Modells.
//
// Aufgabenteilung bewusst streng:
//   • Das Modell versteht Freitext und formuliert die Antwort.
//   • Der Server entscheidet über Fakten, Werkzeuge, Standort, Wartezeit und Route.
//   • Ohne Key, bei Quota oder Fehler antwortet ein deterministischer Lotse aus
//     denselben Werkzeugdaten. Der Bot ist damit nie „kaputt“, nur weniger flüssig.
//
// Der API-Key bleibt ausschließlich auf dem Server. Kein Chattext wird gespeichert
// oder geloggt; Sessions liegen nur im Arbeitsspeicher und verfallen nach 45 Minuten.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verwaltungLeistung, verwaltungSuche, verwaltungWo } from './verwaltung.mjs';
import { ortSuche, route } from './routing.mjs';
import { adresse } from './nearby.mjs';
import {
  ALL_SLOT_IDS, INTENTS, INTENT_IDS, catalogForPrompt, detectIntent, nextSlot,
  norm, parseSlotValue, slotById,
} from './bot-katalog.mjs';

const MODEL = process.env.OS_BOT_MODEL ?? 'gemini-2.5-flash-lite';
const MODEL_FALLBACK = process.env.OS_BOT_MODEL_FALLBACK ?? '';
const API_BASE = (process.env.OS_BOT_API_BASE ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
const BOT_OFF = process.env.OS_BOT === '0';
const DAILY_USD = Math.max(0, Number(process.env.OS_BOT_DAILY_USD ?? 0.5) || 0.5);
const RATE_PER_HOUR = Math.max(0, Number(process.env.OS_BOT_RATE ?? 40));
const MAX_TURNS = 24;
const SESSION_TTL = 45 * 60_000;
const MAX_SESSIONS = 2_000;
const CACHE_DIR = process.env.OS_BOT_STATE ?? fileURLToPath(new URL('../.cache/', import.meta.url));
const BUDGET_FILE = `${CACHE_DIR}bot-budget.json`;

// Preise pro 1 Mio. Token in USD (Stand 10/2026). Unbekannte Modelle werden konservativ
// mit dem Preis von 3.5 Flash-Lite gerechnet, damit das Budget nie zu großzügig ist.
const PRICES = {
  'gemini-2.5-flash-lite': [0.10, 0.40],
  'gemini-3.1-flash-lite': [0.25, 1.50],
  'gemini-3.5-flash-lite': [0.15, 1.25],
  'gemini-2.5-flash': [0.30, 2.50],
};
const FALLBACK_PRICE = [0.15, 1.25];

const SYSTEM_RULES = `Du bist StuttBot, der Bürgeranliegen-Assistent von Open Stuttgart.

Deine Aufgabe: Menschen in Stuttgart helfen, ein Amt-Anliegen zu erledigen, den richtigen Ort zu finden und dorthin zu kommen.

Regeln:
- Antworte auf Deutsch, per „du“, freundlich und knapp (2 bis 4 Sätze).
- Kein Markdown, keine Aufzählungszeichen, keine Überschriften – reiner Fließtext.
- Nutze ausschließlich die Fakten im JSON. Erfinde keine Gebühren, Fristen, Adressen, Öffnungszeiten oder Wartezeiten.
- Nenne Zahlen nur, wenn sie im JSON stehen. Wenn eine Angabe fehlt, sage das und verweise auf den Link.
- Behaupte nie, du hättest einen Termin gebucht oder eine Anfrage abgeschickt. Du kannst nur informieren und Links anbieten.
- Nenne höchstens einen Terminlink und einen Leistungslink.
- Wenn ein empfohlenes Bürgerbüro dabei ist: nenne Name, Wartezeit und Fahrzeit.
- Bei akuter Gefahr oder Notfall: 112. Bei rechtlicher oder sozialer Beratung: an die zuständige Stelle verweisen.
- Frage nie nach Ausweisnummern, IBAN, Gesundheitsdaten oder anderen sensiblen Angaben.`;

const UNDERSTAND_RULES = `Du bist die Spracherkennung von StuttBot. Ordne die Nachricht genau einem Anliegen aus dem Katalog zu und extrahiere nur Angaben, die die Person ausdrücklich nennt.

Regeln:
- intent: eine ID aus dem Katalog oder "unbekannt".
- slots: nur Werte, die zu den Optionen des Anliegens passen. Keine Vermutungen.
- locationText: nur ein Ort, eine Adresse oder eine PLZ, wenn die Person ihn nennt. Sonst leer.
- confidence: 0 bis 1.
- Antworte ausschließlich als JSON.`;

const HTTP = (status, message) => Object.assign(new Error(message), { status });

// ---------- Budget ----------

function berlinDate() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
}

function freshBudget() {
  return { date: berlinDate(), spentUsd: 0, calls: 0, promptTokens: 0, outputTokens: 0 };
}

function loadBudget() {
  try {
    if (!existsSync(BUDGET_FILE)) return freshBudget();
    const raw = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') return freshBudget();
    if (raw.date !== berlinDate()) return freshBudget();
    return {
      date: raw.date,
      spentUsd: Number(raw.spentUsd) || 0,
      calls: Number(raw.calls) || 0,
      promptTokens: Number(raw.promptTokens) || 0,
      outputTokens: Number(raw.outputTokens) || 0,
    };
  } catch {
    return freshBudget();
  }
}

let budget = loadBudget();

function saveBudget() {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const tmp = `${BUDGET_FILE}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(budget));
    renameSync(tmp, BUDGET_FILE);
  } catch {
    // Ohne Schreibrechte bleibt der Zähler im Speicher; der Schutz wirkt weiter.
  }
}

function priceFor(model) {
  return PRICES[model] ?? FALLBACK_PRICE;
}

function trackUsage(usage) {
  if (!usage) return;
  const [pin, pout] = priceFor(MODEL);
  const inTok = Number(usage.promptTokenCount) || 0;
  const outTok = Number(usage.candidatesTokenCount) || 0;
  budget.spentUsd += (inTok / 1e6) * pin + (outTok / 1e6) * pout;
  budget.calls += 1;
  budget.promptTokens += inTok;
  budget.outputTokens += outTok;
  saveBudget();
}

// ---------- Rate-Limit, Sessions ----------

const rate = new Map();
function allowRequest(ip) {
  if (!RATE_PER_HOUR) return true;
  const key = String(ip ?? 'unbekannt');
  const now = Date.now();
  const hits = (rate.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= RATE_PER_HOUR) return false;
  hits.push(now);
  rate.set(key, hits);
  if (rate.size > 5_000) {
    for (const [k, v] of rate) {
      if (!v.some((t) => now - t < 3_600_000)) rate.delete(k);
    }
  }
  return true;
}

const sessions = new Map();

function newSession(id) {
  return {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    turns: 0,
    intentId: null,
    slots: {},
    location: null,
    pending: null,
    lastUser: '',
    topic: '',
    lastServiceUrl: null,
    lastFacts: null,
    busy: false,
  };
}

function getSession(id) {
  const key = /^[a-zA-Z0-9-]{8,80}$/.test(String(id ?? '')) ? String(id) : crypto.randomUUID();
  let s = sessions.get(key);
  if (!s) {
    s = newSession(key);
    sessions.set(key, s);
    if (sessions.size > MAX_SESSIONS) {
      const oldest = [...sessions.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0];
      if (oldest) sessions.delete(oldest.id);
    }
  }
  s.updatedAt = Date.now();
  return s;
}

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL;
  for (const [id, s] of sessions) {
    if (s.updatedAt < cutoff) sessions.delete(id);
  }
}, 5 * 60_000).unref?.();

// ---------- Gemini ----------

let quotaBlockedUntil = 0;
let keyBrokenUntil = 0;
let lastLlmError = null;

function apiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function llmConfigured() {
  return !!apiKey() && !BOT_OFF;
}

function llmAllowed() {
  return llmConfigured()
    && Date.now() > quotaBlockedUntil
    && Date.now() > keyBrokenUntil
    && budget.spentUsd < DAILY_USD;
}

async function callGemini({ system, user, schema, maxOutputTokens = 400, temperature = 0.2, model = MODEL }) {
  if (!llmAllowed()) return null;
  const key = apiKey();
  if (!key) return null;
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
    },
  };
  let res;
  try {
    res = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (err) {
    lastLlmError = err.message;
    if (process.env.OS_BOT_LOG === '1') console.warn(`StuttBot: Modell nicht erreichbar (${err.message})`);
    return null;
  }

  const data = await res.json().catch(() => null);
  if (data?.usageMetadata) trackUsage(data.usageMetadata);

  if (!res.ok) {
    lastLlmError = data?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 429) {
      quotaBlockedUntil = Date.now() + 5 * 60_000;
    } else if (res.status === 400 || res.status === 401 || res.status === 403) {
      keyBrokenUntil = Date.now() + 10 * 60_000;
      console.warn('StuttBot: Gemini-Key oder Modell abgelehnt; nutze den deterministischen Fallback.');
    }
    if (process.env.OS_BOT_LOG === '1') console.warn(`StuttBot: Gemini HTTP ${res.status}: ${lastLlmError}`);
    if (MODEL_FALLBACK && model !== MODEL_FALLBACK) {
      return callGemini({ system, user, schema, maxOutputTokens, temperature, model: MODEL_FALLBACK });
    }
    return null;
  }

  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  return text || null;
}

function understandSchema() {
  return {
    type: 'object',
    properties: {
      intent: { type: 'string', enum: [...INTENT_IDS, 'unbekannt'] },
      slots: {
        type: 'object',
        properties: Object.fromEntries(ALL_SLOT_IDS.map((id) => [id, { type: 'string' }])),
      },
      locationText: { type: 'string' },
      confidence: { type: 'number' },
    },
    required: ['intent'],
    propertyOrdering: ['intent', 'slots', 'locationText', 'confidence'],
  };
}

async function understand(text, s, intent) {
  const state = {
    anliegen: intent?.id ?? s.intentId ?? null,
    bekannteAngaben: s.slots,
    hatStandort: !!s.location,
  };
  const prompt = `Katalog:\n${catalogForPrompt()}

Aktueller Zustand: ${JSON.stringify(state)}

Nachricht der Person:
"""${text}"""`;
  const raw = await callGemini({
    system: UNDERSTAND_RULES,
    user: prompt,
    schema: understandSchema(),
    maxOutputTokens: 220,
    temperature: 0,
  });
  if (!raw) return null;
  try {
    const json = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
    const id = String(json.intent ?? '');
    return {
      intent: id === 'unbekannt' || !INTENT_IDS.includes(id) ? null : id,
      slots: json.slots && typeof json.slots === 'object' ? json.slots : {},
      locationText: typeof json.locationText === 'string' ? json.locationText.slice(0, 160).trim() : '',
      confidence: Number(json.confidence) || 0,
    };
  } catch {
    return null;
  }
}

function cleanAnswer(text) {
  return String(text ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Harte Erdung: Das Modell darf keine Zahl mit Euro, keinen fremden Bürgerbüro-Namen
 * und keine fremde URL erfinden. Wenn doch, wird die Antwort verworfen.
 */
function guardAnswer(text, facts) {
  const answer = cleanAnswer(text);
  if (!answer || answer.length > 900) return null;
  if (/\b(gebucht|reserviert|bestätigt|beantragt habe)\b/i.test(answer) && !/nicht|kein/i.test(answer)) return null;

  const factText = JSON.stringify(facts);
  const money = [...answer.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:Euro|€)/gi)].map((m) => m[1].replace(',', '.'));
  for (const n of money) {
    if (!factText.includes(n) && !factText.includes(n.replace('.', ','))) return null;
  }

  const offices = [...answer.matchAll(/Bürgerbüro\s+[A-ZÄÖÜ][\wÄÖÜäöüß-]*/g)].map((m) => m[0]);
  for (const name of offices) {
    if (!factText.includes(name)) return null;
  }

  const urls = [...answer.matchAll(/https?:\/\/[^\s)"']+/g)].map((m) => m[0].replace(/[.,;:]$/, ''));
  for (const url of urls) {
    if (!factText.includes(url)) return null;
  }
  return answer;
}

// ---------- Werkzeuge ----------

const r4 = (n) => Math.round(Number(n) * 1e4) / 1e4;

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Zeitüberschreitung')), ms); }),
  ]);
}

function validLocation(loc) {
  if (!loc || typeof loc !== 'object') return null;
  const lat = Number(loc.lat);
  const lon = Number(loc.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < 47.4 || lat > 49.9 || lon < 7.4 || lon > 10.6) return null;
  return { lat: r4(lat), lon: r4(lon), label: String(loc.label ?? 'Mein Standort').slice(0, 80) };
}

async function geocode(text) {
  const q = String(text ?? '').trim();
  if (q.length < 2 || q.length > 160) return null;
  try {
    const r = await withTimeout(ortSuche(q), 5_000);
    const hit = (r.results ?? []).find((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
    if (hit) return { lat: r4(hit.lat), lon: r4(hit.lon), label: hit.label ?? q };
  } catch { /* nächster Versuch */ }
  try {
    const r = await withTimeout(adresse(q), 5_000);
    const hit = (r.items ?? []).find((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
    if (hit) return { lat: r4(hit.lat), lon: r4(hit.lon), label: hit.label ?? q };
  } catch { /* egal */ }
  return null;
}

function looksLikeLocation(text) {
  return /\b\d{5}\b/.test(text)
    || /(?:^|\s)[\p{L}.]+(?:straße|strasse|str\.|weg|platz|allee|gasse|ring|ufer|steig|halden|graben)\b/iu.test(text);
}

async function loadService(intent, slots) {
  const url = intent.serviceUrl?.(slots);
  if (url) {
    try {
      return await verwaltungLeistung(url);
    } catch { /* Fallback über die Suche */ }
  }
  try {
    const r = await verwaltungSuche([intent.label, slots.anlass].filter(Boolean).join(' '));
    const hit = r.leistungen?.[0];
    if (hit) return await verwaltungLeistung(hit.url);
  } catch { /* egal */ }
  return null;
}

async function travelTo(loc, office) {
  const metres = Number(office.dist) || 0;
  const mode = metres > 0 && metres <= 2_000 ? 'fuss' : 'oepnv';
  try {
    const r = await withTimeout(route({
      von: `${loc.lat},${loc.lon}`,
      nach: `${r4(office.lat)},${r4(office.lon)}`,
      modus: mode,
    }), 9_000);
    const best = (r.varianten ?? [])
      .filter((v) => Number.isFinite(v.dauerMin))
      .sort((a, b) => a.dauerMin - b.dauerMin)[0];
    if (best) {
      return {
        min: best.dauerMin,
        label: mode === 'fuss' ? 'zu Fuß' : 'mit Bahn/Bus',
        source: r.quelle ?? null,
        estimated: false,
      };
    }
  } catch { /* Schätzung unten */ }
  const min = Math.max(1, Math.round(metres / (mode === 'fuss' ? 75 : 250)));
  return {
    min,
    label: mode === 'fuss' ? 'zu Fuß (geschätzt)' : 'mit Bahn/Bus (geschätzt)',
    source: 'Schätzung aus Luftlinie',
    estimated: true,
  };
}

function waitFeeling(status) {
  if (status === 0) return 'gerade geschlossen';
  if (status === 11) return 'keine Wartemarken mehr';
  if (status >= 10) return 'sehr viel los';
  if (status >= 6) return 'ziemlich viel los';
  if (status >= 3) return 'überschaubar';
  if (status >= 1) return 'wenig los';
  return null;
}

function officeFact(o, travel) {
  const w = o.wartezeit ?? null;
  return {
    name: o.name,
    address: o.address,
    open: o.jetztGeoeffnet?.open ?? null,
    openText: o.jetztGeoeffnet?.text ?? null,
    onlyAppointment: o.jetztGeoeffnet?.onlyAppointment ?? null,
    waitMin: w?.waitMin ?? null,
    waitText: w?.text ?? null,
    waitStatus: w?.status ?? null,
    waitFeeling: o.jetztGeoeffnet?.onlyAppointment ? null : waitFeeling(w?.status),
    booking: o.booking ?? null,
    lat: r4(o.lat),
    lon: r4(o.lon),
    gebaeudeId: o.gebaeudeId ?? null,
    distM: Number.isFinite(o.dist) ? Math.round(o.dist) : null,
    travelMin: travel?.min ?? null,
    travelLabel: travel?.label ?? null,
    travelSource: travel?.source ?? null,
    totalMin: w?.waitMin != null && travel?.min != null ? w.waitMin + travel.min : null,
  };
}

async function findBestOffice(service, loc) {
  if (!loc) return null;
  let wo;
  try {
    wo = await verwaltungWo(service.url, loc.lat, loc.lon);
  } catch {
    return null;
  }
  const all = (wo.orte ?? []).filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lon));
  if (!all.length) return null;

  // Für Bürgerbüro-Leistungen sind die Bürgerbüros gemeint – nicht das übergeordnete
  // Referat, das die Leistung fachlich verantwortet. Ausgabe- und Ausbildungstheken
  // nehmen keine Anträge an.
  const usable = all.filter((o) => !/Einarbeitungs|Ausbildungsbürgerbüro|\bAusgabe\b/i.test(o.name ?? ''));
  const citizenOffices = usable.filter((o) => /bürgerbüro/i.test(o.name ?? '') || o.wartezeit != null);
  const offers = citizenOffices.length ? citizenOffices : (usable.length ? usable : all);

  const ranked = offers.map((o) => {
    const status = o.wartezeit?.status ?? null;
    const open = o.jetztGeoeffnet?.open === true;
    const appointmentOnly = o.jetztGeoeffnet?.onlyAppointment === true;
    const closed = o.jetztGeoeffnet?.state === 'geschlossen' || (status === 0 && !appointmentOnly);
    const noTickets = status === 11;
    const wait = o.wartezeit?.waitMin ?? 15;
    const approxTravel = Math.max(3, (Number(o.dist) || 0) / 250);
    return {
      ...o,
      _closed: closed,
      _noTickets: noTickets,
      _score: (open ? 0 : appointmentOnly ? 45 : 80) + (closed ? 40 : 0) + (noTickets ? 120 : 0) + wait * 0.6 + approxTravel,
    };
  }).sort((a, b) => a._score - b._score);

  const candidates = ranked.slice(0, 3);
  const winner = candidates[0];
  const travel = await travelTo(loc, winner);
  const estimate = (o) => {
    const metres = Number(o.dist) || 0;
    const mode = metres > 0 && metres <= 2_000 ? 'fuss' : 'oepnv';
    return {
      min: Math.max(1, Math.round(metres / (mode === 'fuss' ? 75 : 250))),
      label: mode === 'fuss' ? 'zu Fuß (geschätzt)' : 'mit Bahn/Bus (geschätzt)',
      source: 'Schätzung aus Luftlinie',
      estimated: true,
    };
  };
  return {
    best: officeFact(winner, travel),
    alternatives: candidates.slice(1).map((o) => officeFact(o, estimate(o))),
  };
}

function compact(text, max = 420) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function feeFor(text, alter) {
  const lines = String(text ?? '').split(/\n/).map((x) => x.trim()).filter(Boolean);
  const pairs = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /Kosten:\s*([0-9]+(?:[.,][0-9]+)?)\s*Euro/i.exec(lines[i]);
    if (!m) continue;
    const context = lines.slice(Math.max(0, i - 5), i + 1).join(' ');
    pairs.push({ fee: `${m[1]} Euro`, context });
  }
  if (!pairs.length) return null;
  if (pairs.length === 1) return pairs[0].fee;
  if (alter === 'unter16' || alter === '16-23') {
    const young = pairs.find((p) => /bis 24|unter 24|minderjaehrig|unter 16/i.test(p.context));
    if (young) return young.fee;
  }
  if (alter === '24+') {
    const old = pairs.find((p) => /ab 24|ueber 24|über 24/i.test(p.context));
    if (old) return old.fee;
  }
  return pairs[0].fee;
}

function firstDocs(text) {
  const lines = String(text ?? '')
    .split(/\n/)
    .map((x) => x.replace(/^[-•*:;\s]+/, '').replace(/[.;:\s]+$/, '').trim())
    .filter((x) => x.length >= 4 && !/^hinweis/i.test(x));
  const picked = [];
  for (const line of lines) {
    if (line.length < 4) continue;
    if (picked.some((p) => p.toLowerCase().includes(line.toLowerCase()))) continue;
    picked.push(line);
    if (picked.length >= 4) break;
  }
  return picked.length ? compact(picked.join('; '), 320) : null;
}

/** Grobe lexikalische Prüfung: Ein Suchtreffer muss Wörter der Frage enthalten. */
function queryMatchesName(text, name) {
  const q = norm(text).split(' ').filter((w) => w.length > 3);
  const n = norm(name);
  if (!q.length) return false;
  // Das längste inhaltstragende Wort muss vorkommen; sonst passt z. B. „Hundesteuer“
  // auf „hochqualifizierte Beschäftigung“.
  const important = q.filter((w) => w.length >= 6);
  if (important.length && !important.some((w) => n.includes(w))) return false;
  const hits = q.filter((w) => n.includes(w)).length;
  return hits >= Math.max(1, Math.ceil(q.length * 0.4));
}

function buildFacts(service, officeData, loc, slots = {}) {
  const online = (service.onlineAngebote ?? []).find((o) => o.art !== 'termin') ?? null;
  const appointmentText = `${service.ablauf ?? ''} ${service.voraussetzungen ?? ''}`;
  return {
    service: {
      name: service.name,
      url: service.url,
      zustaendig: service.zustaendig ?? null,
      gebuehren: compact(service.abschnitte?.Gebühren ?? '', 500),
      fee: feeFor(service.abschnitte?.Gebühren, slots.alter),
      unterlagen: compact(service.abschnitte?.['Benötigte Unterlagen'] ?? '', 700),
      docs: firstDocs(service.abschnitte?.['Benötigte Unterlagen']),
      dauer: compact(service.abschnitte?.['Bearbeitungsdauer'] ?? '', 260),
      ablauf: compact(service.abschnitte?.Ablauf ?? '', 500),
      online: !!online,
      onlineUrl: online?.url ?? null,
      onlineLabel: online?.titel ?? null,
      booking: service.booking ?? null,
    },
    appointmentNeeded: /terminvereinbarung|nur mit termin|terminpflicht/i.test(appointmentText)
      || officeData?.best?.onlyAppointment === true,
    location: loc ? { label: loc.label } : null,
    recommended: officeData?.best ?? null,
    alternatives: officeData?.alternatives ?? [],
    source: service.source ?? 'Landeshauptstadt Stuttgart, stuttgart.de',
    stand: service.stand ?? null,
    generatedAt: new Date().toISOString(),
  };
}

function actionsFor(facts, askLocation) {
  const out = [];
  const push = (a) => {
    if (!a) return;
    if (a.url && out.some((x) => x.url === a.url)) return;
    if (a.type === 'map' && out.some((x) => x.type === 'route' && x.lat === a.lat && x.lon === a.lon)) return;
    out.push(a);
  };
  if (askLocation) push({ type: 'location', label: 'Standort freigeben' });
  const booking = facts?.service?.booking || facts?.recommended?.booking;
  if (booking) push({ type: 'booking', label: 'Termin buchen', url: booking });
  if (facts?.service?.onlineUrl) push({ type: 'online', label: facts.service.onlineLabel || 'Online erledigen', url: facts.service.onlineUrl });
  if (facts?.recommended) {
    push({ type: 'route', label: 'Route öffnen', lat: facts.recommended.lat, lon: facts.recommended.lon, name: facts.recommended.name });
    push({ type: 'map', label: 'Auf Karte', lat: facts.recommended.lat, lon: facts.recommended.lon, name: facts.recommended.name, gebaeudeId: facts.recommended.gebaeudeId });
  }
  if (facts?.service?.url) push({ type: 'link', label: 'Leistung bei stuttgart.de', url: facts.service.url });
  return out.slice(0, 5);
}

function fallbackAnswer(facts, askLocation) {
  if (!facts) return 'Dazu habe ich keine Angaben gefunden. Versuch es bitte über die Suche auf stuttgart.de.';
  const s = facts.service;
  const parts = [];
  parts.push(`Das läuft unter „${s.name}“.`);
  if (facts.appointmentNeeded) {
    parts.push(s.booking ? 'Dafür ist ein Termin nötig.' : 'Dafür ist wahrscheinlich ein Termin nötig; die Leistungsseite nennt die Einzelheiten.');
  }
  if (askLocation) {
    parts.push('Sag mir noch, wo du startest – Adresse, PLZ oder Standort –, dann nenne ich dir das schnellste Bürgerbüro.');
    return parts.join(' ');
  }
  const r = facts.recommended;
  if (r) {
    const closed = r.open === false && !r.onlyAppointment;
    if (closed && r.openText) {
      parts.push(`${r.name} ist gerade ${r.openText}.`);
    } else if (r.openText) {
      parts.push(`${r.name}: ${r.openText}.`);
    } else {
      parts.push(`${r.name} ist die nächste passende Stelle.`);
    }
    if (r.waitMin != null && !closed) {
      parts.push(`Dort ${r.waitFeeling ? `${r.waitFeeling}, ` : ''}ca. ${r.waitMin} Minuten Wartezeit.`);
    } else if (r.waitStatus === 11 && !closed) {
      parts.push(`${r.name} vergibt gerade keine Wartemarken mehr.`);
    }
    if (!closed && r.travelMin != null) {
      parts.push(`Anfahrt: ${r.travelLabel} ca. ${r.travelMin} Minuten${r.totalMin != null ? `, mit Wartezeit rund ${r.totalMin} Minuten` : ''}.`);
    }
    if (r.booking && !s.booking) parts.push(`Termin: ${r.booking}`);
  } else if (facts.location) {
    parts.push('Für diese Leistung ist kein Ort hinterlegt; die Stadtseite nennt die zuständige Stelle.');
  }
  if (s.booking) parts.push(`Termin buchen: ${s.booking}`);
  if (s.onlineUrl) parts.push(`Online erledigen: ${s.onlineUrl}`);
  if (s.fee) parts.push(`Gebühr: ${s.fee}.`);
  if (s.docs) parts.push(`Mitbringen: ${s.docs}.`);
  parts.push('Die Leistungsseite ist unten verlinkt.');
  return parts.join(' ');
}

async function composeAnswer(facts, question, askLocation) {
  if (!llmAllowed()) return null;
  const prompt = `<fakten>\n${JSON.stringify(facts)}\n</fakten>

<frage>${question || 'Bitte fasse die wichtigsten Angaben zusammen.'}</frage>`;
  const raw = await callGemini({
    system: SYSTEM_RULES,
    user: prompt,
    maxOutputTokens: 420,
    temperature: 0.3,
  });
  if (!raw) return null;
  return guardAnswer(raw, facts);
}

// ---------- Gespräch ----------

function resetState(s, keepLocation = true) {
  s.turns = 0;
  s.intentId = null;
  s.slots = {};
  s.pending = null;
  s.lastUser = '';
  s.topic = '';
  s.lastServiceUrl = null;
  s.lastFacts = null;
  if (!keepLocation) s.location = null;
}

function isReset(text) {
  return /^(neu starten|von vorne|abbrechen|reset|nochmal starten)$/i.test(text.trim())
    || /^(neues anliegen|andere frage)$/i.test(text.trim());
}

function smalltalk(text) {
  const t = text.trim().toLowerCase();
  if (/^(hallo|hi|hey|guten (tag|morgen|abend)|moin)\b/.test(t)) {
    return {
      reply: 'Hallo! Ich bin StuttBot. Sag mir, was du bei der Stadt erledigen möchtest – zum Beispiel „Ich brauche einen Personalausweis“.',
      suggestions: ['Personalausweis beantragen', 'Wohnsitz anmelden', 'Termin im Bürgerbüro'],
    };
  }
  if (/^(danke|vielen dank|super|perfekt)\b/.test(t)) {
    return { reply: 'Gern! Wenn du noch etwas brauchst, sag einfach Bescheid.', suggestions: [] };
  }
  if (/(wer bist du|was kannst du|hilfe|wie funktionierst du)/.test(t)) {
    return {
      reply: 'Ich helfe bei Ämtern in Stuttgart: passende Leistung finden, zuständiges Bürgerbüro mit Wartezeit zeigen und den Weg dorthin berechnen. Ich ersetze keine Rechtsberatung und buche keine Termine.',
      suggestions: ['Personalausweis beantragen', 'Wohnsitz anmelden', 'Führerschein beantragen'],
    };
  }
  if (/^(tschüss|tschuess|bye|bis bald)\b/.test(t)) {
    return { reply: 'Bis bald!', suggestions: [] };
  }
  return null;
}

function questionReply(s, intent, slot, meta) {
  s.pending = `slot:${slot.id}`;
  const base = {
    sessionId: s.id,
    reply: slot.question,
    suggestions: slot.options.map((o) => o.label),
    actions: [],
    office: null,
    alternatives: [],
    meta,
  };
  if (intent.id === 'abfall') {
    base.reply = 'Für Abfuhrtermine brauche ich deine Adresse. Nenne mir Straße und Hausnummer, dann kann ich nachsehen.';
    base.suggestions = [];
  }
  return base;
}

function locationReply(s, meta) {
  s.pending = 'location';
  return {
    sessionId: s.id,
    reply: s.lastServiceUrl
      ? 'Wo startest du? Nenne mir eine Adresse oder PLZ – oder gib deinen Standort frei. Dann berechne ich das schnellste Bürgerbüro mit Wartezeit und Fahrzeit.'
      : 'Wo startest du? Nenne mir eine Adresse oder PLZ – oder gib deinen Standort frei.',
    suggestions: [],
    actions: [{ type: 'location', label: 'Standort freigeben' }],
    office: null,
    alternatives: [],
    meta,
  };
}

function metaInfo(extra = {}) {
  return {
    model: llmConfigured() ? MODEL : null,
    llm: llmConfigured(),
    fallback: false,
    budget: { limitUsd: DAILY_USD, spentUsd: Math.round(budget.spentUsd * 1e6) / 1e6 },
    ...extra,
  };
}

function applySlots(intent, target, rawSlots) {
  for (const [id, raw] of Object.entries(rawSlots ?? {})) {
    const slot = slotById(intent, id);
    if (!slot) continue;
    if (target[id]) continue;
    const value = String(raw ?? '').trim();
    if (!value) continue;
    const direct = slot.options.find((o) => o.value === value);
    if (direct) { target[id] = direct.value; continue; }
    const parsed = parseSlotValue(slot, value);
    if (parsed) target[id] = parsed;
  }
}

async function answerWithService(s, intent, service, meta) {
  if (!service) {
    return {
      sessionId: s.id,
      reply: 'Dazu habe ich keine passende Leistung gefunden. Versuch es bitte über die Suche auf stuttgart.de oder formuliere das Anliegen etwas anders.',
      suggestions: ['Personalausweis beantragen', 'Wohnsitz anmelden', 'Führerschein beantragen'],
      actions: [],
      office: null,
      alternatives: [],
      meta: { ...meta, fallback: true },
    };
  }

  const needsLocation = intent.needsLocation !== false;
  if (needsLocation && !s.location) {
    s.lastServiceUrl = service.url;
    return locationReply(s, meta);
  }

  const officeData = needsLocation ? await findBestOffice(service, s.location) : null;
  const facts = buildFacts(service, officeData, s.location, s.slots);
  let reply = await composeAnswer(facts, s.topic || s.lastUser, false);
  const fallback = !reply;
  if (!reply) reply = fallbackAnswer(facts, false);

  s.lastServiceUrl = service.url;
  s.lastFacts = facts;
  s.pending = null;

  return {
    sessionId: s.id,
    reply,
    suggestions: ['Welche Unterlagen brauche ich?', 'Kann ich das online erledigen?'],
    actions: actionsFor(facts, false),
    office: facts.recommended,
    alternatives: facts.alternatives,
    meta: { ...meta, fallback },
  };
}

async function followUp(s, text, meta) {
  if (!s.lastServiceUrl || !s.lastFacts) return null;
  const t = text.toLowerCase();
  if (/unterlagen|mitbringen|dokumente|papiere/.test(t)) {
    const docs = s.lastFacts.service.docs || s.lastFacts.service.unterlagen;
    return {
      sessionId: s.id,
      reply: docs
        ? `Für „${s.lastFacts.service.name}“ brauchst du laut Stadt: ${docs}`
        : 'Dazu stehen auf der Leistungsseite keine Unterlagen. Schau bitte direkt bei der Stadt nach.',
      suggestions: ['Kann ich das online erledigen?'],
      actions: s.lastFacts.service.url ? [{ type: 'link', label: 'Leistungsseite öffnen', url: s.lastFacts.service.url }] : [],
      office: s.lastFacts.recommended,
      alternatives: [],
      meta: { ...meta, fallback: true },
    };
  }
  if (/online|internet|digital/.test(t)) {
    const f = s.lastFacts.service;
    return {
      sessionId: s.id,
      reply: f.onlineUrl
        ? `Ja, das geht online: ${f.onlineUrl}`
        : 'Für diese Leistung ist kein vollständig Online-Dienst hinterlegt. Die Stadtseite nennt Termin und Vor-Ort-Optionen.',
      suggestions: ['Welche Unterlagen brauche ich?'],
      actions: f.onlineUrl
        ? [{ type: 'online', label: f.onlineLabel || 'Online erledigen', url: f.onlineUrl }, { type: 'link', label: 'Leistungsseite', url: f.service.url }]
        : [{ type: 'link', label: 'Leistungsseite', url: f.url }],
      office: s.lastFacts.recommended,
      alternatives: [],
      meta: { ...meta, fallback: true },
    };
  }
  return null;
}

/**
 * Eine Runde StuttBot.
 * @param {{sessionId?:string,message?:string,location?:{lat:number,lon:number,label?:string}|null,ip?:string}} input
 */
export async function botReply({ sessionId, message, location, ip } = {}) {
  if (BOT_OFF) throw HTTP(503, 'StuttBot ist in dieser Installation abgeschaltet.');
  if (!allowRequest(ip)) throw HTTP(429, 'Zu viele Anfragen. Bitte in einer Stunde noch einmal versuchen.');

  const s = getSession(sessionId);
  if (s.busy) throw HTTP(429, 'Einen Moment, ich rechne noch an der letzten Antwort.');
  s.busy = true;
  const started = Date.now();

  try {
    const text = String(message ?? '').replace(/\u0000/g, '').trim().slice(0, 1_200);
    const loc = validLocation(location);
    if (loc) {
      s.location = loc;
      if (s.pending === 'location') s.pending = null;
    }
    if (!text && !loc) throw HTTP(400, 'Bitte eine Nachricht oder einen Standort senden.');
    if (s.turns >= MAX_TURNS) {
      resetState(s, true);
      return {
        sessionId: s.id,
        reply: 'Die Unterhaltung war schon sehr lang – ich starte einmal frisch. Was möchtest du bei der Stadt erledigen?',
        suggestions: ['Personalausweis beantragen', 'Wohnsitz anmelden', 'Termin im Bürgerbüro'],
        actions: [],
        office: null,
        alternatives: [],
        meta: { ...metaInfo(), fallback: true },
      };
    }

    if (text) s.lastUser = text;
    const meta = metaInfo();

    if (text && isReset(text)) {
      resetState(s);
      return {
        sessionId: s.id,
        reply: 'Alles klar, wir starten neu. Was möchtest du bei der Stadt erledigen?',
        suggestions: ['Personalausweis beantragen', 'Wohnsitz anmelden', 'Termin im Bürgerbüro'],
        actions: [],
        office: null,
        alternatives: [],
        meta: { ...meta, fallback: true },
      };
    }

    if (text) {
      const talk = smalltalk(text);
      if (talk) {
        s.turns += 1;
        return { sessionId: s.id, ...talk, actions: [], office: null, alternatives: [], meta: { ...meta, fallback: true } };
      }
    }

    // Direkte Nachfragen zuletzt beantworteter Leistung
    if (text && s.lastFacts) {
      const fu = await followUp(s, text, meta);
      if (fu) { s.turns += 1; return fu; }
    }

    let intent = s.intentId ? INTENTS.find((i) => i.id === s.intentId) ?? null : null;
    let plan = null;

    // Klarer Anliegenwechsel schon ohne Modell (z. B. „eigentlich brauche ich einen Reisepass“).
    if (intent && text && text.length <= 90) {
      const alt = detectIntent(text);
      if (alt && alt.id !== intent.id) {
        intent = alt;
        s.intentId = intent.id;
        s.slots = {};
        s.pending = null;
        s.lastFacts = null;
        s.lastServiceUrl = null;
        s.topic = text;
      }
    }

    // Standort alone (z. B. Klick auf „Standort freigeben“) beantwortet die offene Frage.
    if (!text && loc && intent && !nextSlot(intent, s.slots)) {
      const service = await loadService(intent, s.slots);
      s.turns += 1;
      return answerWithService(s, intent, service, meta);
    }

    // Noch kein Anliegen: deterministisch, dann Modell, dann Volltextsuche.
    if (!intent) {
      intent = detectIntent(text);
      if (!intent && llmAllowed()) {
        plan = await understand(text, s, null);
        if (plan?.intent) intent = INTENTS.find((i) => i.id === plan.intent) ?? null;
      }
      if (!intent && /termin/i.test(text)) {
        s.turns += 1;
        return {
          sessionId: s.id,
          reply: 'Für einen Termin im Bürgerbüro sag mir bitte noch, worum es geht – zum Beispiel Personalausweis, Reisepass oder Wohnsitz anmelden. Dann nenne ich dir den passenden Terminlink.',
          suggestions: ['Personalausweis beantragen', 'Reisepass beantragen', 'Wohnsitz anmelden'],
          actions: [],
          office: null,
          alternatives: [],
          meta: { ...meta, fallback: true },
        };
      }
      if (!intent) {
        // Generischer Treffer aus dem Verwaltungsbestand – nur wenn der Titel
        // erkennbar zur Frage passt. Sonst lieber nachfragen als falsch antworten.
        const r = await verwaltungSuche(text).catch(() => null);
        const hit = r?.leistungen?.find((x) => queryMatchesName(text, x.name));
        if (hit) {
          intent = {
            id: 'generic',
            label: hit.name,
            serviceUrl: () => hit.url,
            slots: [],
            needsLocation: false,
            hint: hit.kurz ?? '',
          };
        }
      }
      if (!intent) {
        s.turns += 1;
        return {
          sessionId: s.id,
          reply: 'Das habe ich nicht sicher zuordnen können. Sag mir bitte, welche Leistung du brauchst – zum Beispiel „Personalausweis“, „Wohnsitz anmelden“ oder „Führerschein“.',
          suggestions: ['Personalausweis beantragen', 'Wohnsitz anmelden', 'Führerschein beantragen'],
          actions: [],
          office: null,
          alternatives: [],
          meta: { ...meta, fallback: true },
        };
      }
      s.intentId = intent.id;
      s.slots = {};
      s.pending = null;
      s.lastFacts = null;
      s.lastServiceUrl = null;
      s.topic = text || s.topic;
    } else if (plan?.intent && plan.intent !== intent.id) {
      // Anliegenwechsel mitten im Gespräch
      const next = INTENTS.find((i) => i.id === plan.intent);
      if (next) {
        intent = next;
        s.intentId = intent.id;
        s.slots = {};
        s.pending = null;
        s.lastFacts = null;
        s.lastServiceUrl = null;
        s.topic = text || s.topic;
      }
    }

    // Zuerst deterministisch lesen: „abgelaufen“, „verloren“, „ich bin 34“.
    // Das spart einen Modellaufruf und ist bei klaren Antworten verlässlicher.
    if (text && !looksLikeLocation(text)) {
      for (const slot of intent.slots) {
        if (slot.when && !slot.when(s.slots)) continue;
        if (s.slots[slot.id]) continue;
        const value = parseSlotValue(slot, text);
        if (value) s.slots[slot.id] = value;
      }
    }

    // Bleibt eine Slot-Frage offen und der Freitext passt auf keine Option,
    // darf das Modell die Angabe einordnen.
    if (!plan && text && llmAllowed() && s.pending?.startsWith('slot:')) {
      const slotId = s.pending.slice(5);
      const slot = slotById(intent, slotId);
      if (slot && !s.slots[slotId] && !parseSlotValue(slot, text)) {
        plan = await understand(text, s, intent);
      }
    }

    // Das Modell kann mitten im Gespräch ein anderes Anliegen erkennen.
    if (plan?.intent && plan.intent !== intent.id) {
      const next = INTENTS.find((i) => i.id === plan.intent);
      if (next) {
        intent = next;
        s.intentId = intent.id;
        s.slots = {};
        s.pending = null;
        s.lastFacts = null;
        s.lastServiceUrl = null;
        s.topic = text || s.topic;
      }
    }

    // Standort aus Freitext oder Modell
    const pendingLocation = s.pending === 'location';
    if (!s.location) {
      const locationText = plan?.locationText || (pendingLocation || looksLikeLocation(text) ? text : '');
      if (locationText) {
        const geo = await geocode(locationText);
        if (geo) s.location = geo;
        else if (pendingLocation) {
          s.turns += 1;
          return {
            sessionId: s.id,
            reply: 'Den Ort konnte ich nicht finden. Nenne mir bitte Straße und Hausnummer oder eine PLZ in Stuttgart.',
            suggestions: [],
            actions: [{ type: 'location', label: 'Standort freigeben' }],
            office: null,
            alternatives: [],
            meta: { ...meta, fallback: true },
          };
        }
      }
    }

    // Offene Slot-Frage beantworten
    if (s.pending?.startsWith('slot:')) {
      const slotId = s.pending.slice(5);
      const slot = slotById(intent, slotId);
      if (slot) {
        const value = parseSlotValue(slot, text) ?? (plan?.slots?.[slotId] ? parseSlotValue(slot, plan.slots[slotId]) : null);
        if (value) s.slots[slotId] = value;
        else if (text) {
          s.turns += 1;
          return questionReply(s, intent, slot, meta);
        }
      }
    }

    // Weitere Angaben aus dem Modell übernehmen
    if (plan?.slots) applySlots(intent, s.slots, plan.slots);

    const missing = nextSlot(intent, s.slots);
    if (missing) {
      s.turns += 1;
      return questionReply(s, intent, missing, meta);
    }

    // Abfall ist ein Sonderfall: Adresse statt Bürgerbüro
    if (intent.id === 'abfall') {
      s.turns += 1;
      return {
        sessionId: s.id,
        reply: 'Abfuhrtermine findest du im Abfallkalender der Stadt. Gib dort deine Straße und Hausnummer ein – oder frag mich nach „Sperrmüll“.',
        suggestions: ['Sperrmüll', 'Wertstoffhof'],
        actions: [{ type: 'link', label: 'Abfuhrtermine öffnen', url: 'https://www.stuttgart.de/organigramm/leistungen/abfuhrtermine' }],
        office: null,
        alternatives: [],
        meta: { ...meta, fallback: true },
      };
    }

    if (intent.needsLocation !== false && !s.location) {
      s.turns += 1;
      return locationReply(s, meta);
    }

    const service = await loadService(intent, s.slots);
    s.turns += 1;
    const result = await answerWithService(s, intent, service, meta);
    if (process.env.OS_BOT_LOG === '1') {
      console.log(`StuttBot intent=${intent.id} fallback=${result.meta?.fallback} ms=${Date.now() - started} turns=${s.turns}`);
    }
    return result;
  } finally {
    s.busy = false;
    s.updatedAt = Date.now();
  }
}

export function botStatus() {
  return {
    enabled: !BOT_OFF,
    llm: llmConfigured(),
    model: llmConfigured() ? MODEL : null,
    fallback: true,
    budget: {
      date: budget.date,
      limitUsd: DAILY_USD,
      spentUsd: Math.round(budget.spentUsd * 1e6) / 1e6,
      calls: budget.calls,
      promptTokens: budget.promptTokens,
      outputTokens: budget.outputTokens,
    },
    sessions: sessions.size,
    rateLimitPerHour: RATE_PER_HOUR,
    lastError: process.env.OS_BOT_LOG === '1' ? lastLlmError : null,
  };
}

if (llmConfigured()) {
  console.log(`StuttBot aktiv: ${MODEL}, Tagesbudget ${DAILY_USD.toFixed(2)} USD`);
} else if (!BOT_OFF) {
  console.log('StuttBot ohne Gemini-Key: deterministischer Fallback aktiv.');
}
