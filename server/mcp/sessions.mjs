// Sitzungen für die Legacy-Generation des MCP (initialize bis 2025-11-25).
// Moderne Clients (ab 2026-07-28) sind zustandslos und bekommen keine Sitzung.
import { randomBytes } from 'node:crypto';

let counter = 0;

export class SessionStore {
  constructor({ ttlMs = 30 * 60_000, max = 5000 } = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.sessions = new Map();
    this.timer = setInterval(() => this.prune(), 60_000);
    this.timer.unref?.();
  }

  create({ protocolVersion = '2025-06-18', clientInfo = null, capabilities = null } = {}) {
    if (this.sessions.size >= this.max) this.prune(true);
    const id = randomBytes(24).toString('base64url');
    const now = Date.now();
    const session = {
      id,
      protocolVersion,
      clientInfo,
      capabilities,
      createdAt: now,
      lastSeen: now,
      logLevel: null,
      streams: new Set(),
      eventId: 0,
      events: [],
      meta: { seq: ++counter },
    };
    this.sessions.set(id, session);
    return session;
  }

  get(id) {
    if (!id) return null;
    const s = this.sessions.get(String(id));
    if (!s) return null;
    if (Date.now() - s.lastSeen > this.ttlMs) {
      this.delete(s.id);
      return null;
    }
    s.lastSeen = Date.now();
    return s;
  }

  delete(id) {
    const s = this.sessions.get(String(id));
    if (!s) return false;
    for (const res of s.streams) {
      try { res.end(); } catch { /* egal */ }
    }
    s.streams.clear();
    this.sessions.delete(String(id));
    return true;
  }

  prune(force = false) {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      const expired = now - s.lastSeen > this.ttlMs;
      const over = force && this.sessions.size > this.max;
      if (expired || over) this.delete(id);
    }
  }

  /** Sendet eine Nachricht an alle offenen SSE-Ströme einer Sitzung. */
  broadcast(session, message) {
    if (!session) return;
    session.eventId += 1;
    const event = { id: session.eventId, message };
    session.events.push(event);
    if (session.events.length > 100) session.events.shift();
    const data = `id: ${event.id}\nevent: message\ndata: ${JSON.stringify(message)}\n\n`;
    for (const res of session.streams) {
      try { res.write(data); } catch { session.streams.delete(res); }
    }
  }

  replay(session, lastEventId, res) {
    if (!session || !lastEventId || !res) return;
    const after = Number(lastEventId);
    if (!Number.isFinite(after)) return;
    for (const event of session.events) {
      if (event.id <= after) continue;
      try {
        res.write(`id: ${event.id}\nevent: message\ndata: ${JSON.stringify(event.message)}\n\n`);
      } catch { /* Stream weg */ }
    }
  }

  close() {
    clearInterval(this.timer);
    for (const id of [...this.sessions.keys()]) this.delete(id);
  }
}
