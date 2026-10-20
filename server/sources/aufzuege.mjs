// Aufzüge an Stuttgarter Bahnhöfen: Stammdaten aus der BFRK „Barrierefreiheit an Bahnhöfen (SPNV)“
// der NVBW (MobiData BW, dl-de/by-2-0), Live-Status aus DB InfraGO OpenStation SIRI-FM (Mobilithek, ohne Schlüssel).
//
// Verknüpfung: BFRK nennt je Aufzug die `DB-FaSta-ID`. SIRI-FM kennt nur die `diid:`-Kennungen der DB.
// Die Zuordnung FaSta-Nummer → diid steht im OpenStation-NeTEx (LiftEquipment/PrivateCode). Der NeTEx-Datensatz
// ist groß (rund 19 MB komprimiert, 300 MB XML); er wird deshalb höchstens einmal pro Woche als Datenstrom gelesen,
// nur die Zuordnung der Aufzüge wird behalten und auf der Platte gespeichert.
//
// Abrufe: BFRK und NeTEx wöchentlich, SIRI-FM höchstens alle 5 Minuten (1 MB, komprimiert rund 30 kB).
// SSB-Stadtbahnaufzüge sind in keiner der Quellen enthalten.
import { cached, diskStore, fetchText, USER_AGENT } from '../cache.mjs';

const BFRK_AUFZUG = 'https://www.nvbw.de/fileadmin/user_upload/service/open_data/haltestellen/SPNV/BFRK_Aufzug.csv';
const NETEX = 'https://www.bahnhof.de/daten/netex'; // leitet auf die jeweils aktuelle Mobilithek-Veröffentlichung weiter
const SIRI_FM = 'https://mobilithek.info/mdp-api/mdp-conn-server/v1/publication/930558234532405248/file/noauth';
const SIRI_FM_REDIRECT = 'https://bahnhof.de/daten/siri-lite/fm.xml';

const WOCHE = 7 * 24 * 3600_000;
const disk = diskStore('aufzuege');

const SOURCE = 'Stammdaten: BFRK Bahnhöfe, NVBW über MobiData BW (dl-de/by-2-0); Live-Status: DB InfraGO OpenStation (SIRI-FM, Mobilithek)';

// ---------- BFRK ----------

/** Einfacher CSV-Leser für Semikolon-Dateien (Felder ohne Zeilenumbrüche, optional in Anführungszeichen). */
function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const split = (l) => {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') {
        if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q;
      } else if (c === ';' && !q) { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const head = split(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const v = split(l);
    return Object.fromEntries(head.map((h, i) => [h, (v[i] ?? '').trim()]));
  });
}

const num = (s) => {
  const n = parseFloat(String(s ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Stationsnamen sind in der BFRK auf 19 Zeichen gekürzt („Stadtmitte (Stuttga“): offene Klammer am Ende entfernen.
const stationName = (s) => String(s ?? '').replace(/\s*\([^)]*$/, '').trim();

async function bfrkStuttgart() {
  const disked = disk.get('bfrk', WOCHE);
  if (disked) return disked;
  const { value } = await cached('bfrk-aufzuege', WOCHE, async () => {
    const aText = await fetchText(BFRK_AUFZUG, { timeout: 60000 });
    const items = parseCsv(aText)
      .filter((r) => r.HST_DHID?.startsWith('de:08111:'))
      .map((r) => ({
        id: r.ID,
        stationId: r.HST_DHID,
        station: stationName(r.HST_Name),
        beschreibung: r.Verbindungsfunktion || 'Aufzug',
        lat: num(r.Latitude),
        lon: num(r.Longitude),
        fastaId: r['DB-FaSta-ID'] || null,
        tuerweiteCm: num(r.Tuerweite_cm),
        kabineCm: num(r.Kabinenbreite_cm) && num(r.Kabinenlaenge_cm) ? `${num(r.Kabinenbreite_cm)} × ${num(r.Kabinenlaenge_cm)}` : null,
        foto: r.Aufzug_Foto || null,
        erfasst: r.Erfassungsdatum || null,
        datenstatus: r.Datenstatus || null,
      }))
      .filter((a) => a.lat != null && a.lon != null);
    if (!items.length) throw new Error('BFRK: keine Aufzüge für Stuttgart gefunden');
    return items;
  });
  disk.set('bfrk', value);
  return value;
}

// ---------- NeTEx: FaSta-Nummer → diid ----------

/** Liest den NeTEx-Datenstrom und sammelt für jeden Aufzug (LiftEquipment) die FaSta-Nummer und die diid. */
async function ladeNetexZuordnung() {
  const res = await fetch(NETEX, {
    headers: { 'User-Agent': USER_AGENT, Accept: '*/*', 'Accept-Encoding': 'gzip' },
    redirect: 'follow',
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok || !res.body) throw new Error(`NeTEx antwortet mit ${res.status}`);
  const map = {};
  const dec = new TextDecoder();
  const RE = /<LiftEquipment\b[^>]*\bid="(diid:[^"]+)"[\s\S]*?<\/LiftEquipment>/g;
  let buf = '';
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let last = 0;
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(buf))) {
      const codes = [...m[0].matchAll(/<PrivateCode[^>]*>(\d+)<\/PrivateCode>/g)].map((x) => x[1]);
      for (const c of new Set(codes)) map[c] = m[1];
      last = RE.lastIndex;
    }
    // Rest behalten: ab einem noch offenen LiftEquipment, sonst nur ein kurzes Ende für Tags über Blockgrenzen
    const open = buf.lastIndexOf('<LiftEquipment');
    buf = open >= last ? buf.slice(open) : buf.slice(Math.max(last, buf.length - 64));
  }
  if (Object.keys(map).length < 100) throw new Error('NeTEx: zu wenige Aufzüge erkannt');
  return map;
}

async function netexZuordnung() {
  const disked = disk.get('netex', WOCHE);
  if (disked) return disked;
  const { value } = await cached('netex-aufzuege', WOCHE, ladeNetexZuordnung);
  disk.set('netex', value);
  return value;
}

// ---------- SIRI-FM ----------

const STATUS = { available: 'in Betrieb', notAvailable: 'außer Betrieb', unknown: 'unbekannt' };

async function siriFm() {
  const { value, at, fresh } = await cached('siri-fm', 5 * 60_000, async () => {
    let xml;
    try {
      xml = await fetchText(SIRI_FM, { timeout: 30000, headers: { Accept: '*/*' } });
    } catch {
      xml = await fetchText(SIRI_FM_REDIRECT, { timeout: 30000, headers: { Accept: '*/*' } });
    }
    const stand = /<ResponseTimestamp>([^<]+)<\/ResponseTimestamp>/.exec(xml)?.[1] ?? null;
    const status = {};
    const RE = /<FacilityRef>([^<]+)<\/FacilityRef>\s*<FacilityStatus>\s*<Status>([^<]+)<\/Status>(?:\s*<Description[^>]*>([^<]*)<\/Description>)?/g;
    let m;
    while ((m = RE.exec(xml))) status[m[1].trim()] = { s: m[2].trim(), d: m[3]?.trim() ?? null };
    if (!Object.keys(status).length) throw new Error('SIRI-FM: keine Anlagen in der Antwort');
    return { stand, status };
  });
  return { ...value, abgerufen: new Date(at).toISOString(), fresh };
}

// ---------- Zusammenführen ----------

/**
 * Aufzüge an Stuttgarter Bahnhöfen mit Live-Status.
 * status: 'in Betrieb' | 'außer Betrieb' | 'unbekannt'
 */
export async function aufzuege() {
  const stamm = await bfrkStuttgart();
  const hinweise = [];
  let zuordnung = null;
  let live = null;
  try {
    zuordnung = await netexZuordnung();
  } catch (err) {
    hinweise.push(`Zuordnung der DB-Anlagen (OpenStation NeTEx) derzeit nicht verfügbar: ${err.message}`);
  }
  if (zuordnung) {
    try {
      live = await siriFm();
      if (!live.fresh) hinweise.push('Live-Status der DB derzeit nicht abrufbar; angezeigt wird der zuletzt abgerufene Stand.');
    } catch {
      hinweise.push('Live-Status der DB derzeit nicht abrufbar; angezeigt werden nur die Stammdaten.');
    }
  }
  const items = stamm.map((a) => {
    const diid = a.fastaId && zuordnung ? zuordnung[a.fastaId] ?? null : null;
    const st = diid && live ? live.status[diid] : null;
    let status = 'unbekannt';
    let statusHinweis = null;
    if (st) {
      status = STATUS[st.s] ?? 'unbekannt';
      if (status === 'unbekannt') statusHinweis = /monitor/i.test(st.d ?? '') ? 'von der DB nicht überwacht' : 'Status von der DB nicht gemeldet';
    } else if (!a.fastaId) statusHinweis = 'keine DB-Anlagennummer hinterlegt, kein Live-Status';
    else if (zuordnung && !diid) statusHinweis = 'Anlage im DB-Datensatz nicht gefunden, kein Live-Status';
    else if (!live) statusHinweis = 'Live-Status nicht abrufbar';
    return {
      ...a,
      diid,
      status,
      statusHinweis,
      statusQuelle: st ? 'DB SIRI-FM' : null,
      stand: st ? live.stand : null,
    };
  });
  const mitLive = items.filter((i) => i.statusQuelle).length;
  return {
    items,
    anzahl: items.length,
    mitLiveStatus: mitLive,
    stand: live?.stand ?? null,
    abgerufen: live?.abgerufen ?? new Date().toISOString(),
    hinweise: [
      ...hinweise,
      'Enthalten sind nur Aufzüge an Bahnhöfen der DB (S-Bahn, Regional- und Fernverkehr). Für Aufzüge der SSB-Stadtbahn ist keine offene Live-Quelle bekannt.',
    ],
    source: SOURCE,
  };
}

// ---------- Hilfen für die Routensuche ----------

const R = 6371000;
export function distanzM(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Aufzüge im Umkreis einer Koordinate, nach Entfernung sortiert.
 * Optional `stationIds`: nur Aufzüge dieser Stationen (DHID ohne Steigteil, z. B. de:08111:6118).
 * `wartenMs` begrenzt die Wartezeit auf die Quellen (z. B. beim ersten Abruf nach dem Start).
 */
export async function aufzuegeNahe(lat, lon, { radiusM = 120, stationIds = null, wartenMs = 0 } = {}) {
  let data;
  try {
    const p = aufzuege();
    data = wartenMs > 0
      ? await Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung')), wartenMs))])
      : await p;
  } catch {
    return [];
  }
  const ids = stationIds ? new Set(stationIds.map((s) => String(s).split(':').slice(0, 3).join(':'))) : null;
  return data.items
    .filter((a) => !ids || ids.has(a.stationId))
    .map((a) => ({ ...a, distanzM: Math.round(distanzM(lat, lon, a.lat, a.lon)) }))
    .filter((a) => a.distanzM <= radiusM)
    .sort((a, b) => a.distanzM - b.distanzM);
}
