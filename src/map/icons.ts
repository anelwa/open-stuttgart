// Kartensymbole, zur Laufzeit gezeichnet (keine externen Sprites nötig).
import type { Map as MlMap } from 'maplibre-gl';
import { ICON_PATHS } from '../components/Icon';
import { PLACE_KINDS } from '../modules/culture/kinds';

const PR = 2; // Pixeldichte der Symbole

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w * PR;
  c.height = h * PR;
  const ctx = c.getContext('2d')!;
  ctx.scale(PR, PR);
  return { c, ctx };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function add(map: MlMap, id: string, draw: (ctx: CanvasRenderingContext2D) => void, w: number, h: number) {
  const { c, ctx } = canvas(w, h);
  draw(ctx);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  if (map.hasImage(id)) map.removeImage(id);
  map.addImage(id, { width: c.width, height: c.height, data: new Uint8Array(data.data.buffer) }, { pixelRatio: PR });
}

const OCC: Record<string, string> = { ok: '#1B7F3B', mid: '#C98500', full: '#C62828', none: '#77767C' };

export function registerIcons(map: MlMap, dark: boolean) {
  const ink = dark ? '#ECEAE4' : '#26262C';
  const card = dark ? '#211F1F' : '#FFFFFF';

  // Parkhaus: weißes Schild mit P und farbigem Balken für die Belegung
  for (const [k, col] of Object.entries(OCC)) {
    add(map, `park-${k}`, (ctx) => {
      ctx.shadowColor = 'rgba(0,0,0,.25)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      roundRect(ctx, 3, 3, 26, 26, 8);
      ctx.fillStyle = card;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.font = '800 16px "Merriweather Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', 16, 17);
    }, 32, 32);
  }

  // Baustelle: Raute in Amber mit dunklem Rand (aktiv) bzw. nur Kontur (geplant)
  for (const active of [true, false]) {
    add(map, active ? 'roadwork' : 'roadwork-planned', (ctx) => {
      ctx.translate(14, 14);
      ctx.rotate(Math.PI / 4);
      roundRect(ctx, -8, -8, 16, 16, 3);
      ctx.fillStyle = active ? '#FFB300' : card;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = active ? '#26262C' : '#8A5A00';
      ctx.stroke();
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = active ? '#26262C' : '#8A5A00';
      ctx.fillRect(-1.2, -5, 2.4, 6);
      ctx.beginPath();
      ctx.arc(0, 4, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }, 28, 28);
  }

  // Sharing: kleine Glyphen in Kreisen
  const kinds: Record<string, string> = { car: '#2B59C3', bike: '#0F8A6B', scooter: '#7A3FB0' };
  for (const [k, col] of Object.entries(kinds)) {
    add(map, `share-${k}`, (ctx) => {
      ctx.beginPath();
      ctx.arc(11, 11, 9, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = card;
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#fff';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      if (k === 'car') {
        roundRect(ctx, 6, 9, 10, 5, 1.5);
        ctx.fill();
        ctx.fillRect(7.5, 7, 7, 3);
      } else if (k === 'bike') {
        ctx.beginPath(); ctx.arc(7.5, 13, 2.6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(14.5, 13, 2.6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(7.5, 13); ctx.lineTo(10, 8.5); ctx.lineTo(13, 8.5); ctx.lineTo(14.5, 13); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(8, 14.5); ctx.lineTo(14.5, 14.5); ctx.moveTo(13, 14.5); ctx.lineTo(12, 7); ctx.lineTo(14, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(8, 14.5, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(14.5, 14.5, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }, 22, 22);
  }

  // Pegel
  add(map, 'gauge', (ctx) => {
    ctx.shadowColor = 'rgba(0,0,0,.25)';
    ctx.shadowBlur = 4;
    roundRect(ctx, 3, 3, 26, 26, 13);
    ctx.fillStyle = '#2F6E8E';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (const y of [12.5, 17, 21.5]) {
      ctx.beginPath();
      ctx.moveTo(9, y);
      ctx.bezierCurveTo(12, y - 2.5, 14, y + 2.5, 16, y);
      ctx.bezierCurveTo(18, y - 2.5, 20, y + 2.5, 23, y);
      ctx.stroke();
    }
  }, 32, 32);

  // Glyph aus den Liniensymbolen der Oberfläche (24er Raster) in ein Kartensymbol zeichnen
  const glyph = (ctx: CanvasRenderingContext2D, name: string, cx: number, cy: number, size: number, color: string, width = 2) => {
    ctx.save();
    const k = size / 24;
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(k, k);
    ctx.strokeStyle = color;
    ctx.lineWidth = width / k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(ICON_PATHS[name]));
    ctx.restore();
  };

  // Sehenswürdigkeiten: farbige Kreise mit Glyph
  for (const [k, def] of Object.entries(PLACE_KINDS)) {
    add(map, `place-${k}`, (ctx) => {
      ctx.shadowColor = 'rgba(0,0,0,.28)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.beginPath();
      ctx.arc(15, 15, 11.5, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 2;
      ctx.strokeStyle = card;
      ctx.stroke();
      glyph(ctx, def.icon, 15, 15, 14, '#fff', 1.7);
    }, 30, 30);
  }

  // Veranstaltungen: Amber-Marke mit Ticket (mit Uhrzeit) bzw. helle Marke mit Amberrand (ganztägig)
  for (const allDay of [false, true]) {
    add(map, allDay ? 'event-allday' : 'event-pin', (ctx) => {
      ctx.shadowColor = 'rgba(0,0,0,.3)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 1.5;
      ctx.beginPath();
      ctx.moveTo(16, 33);
      ctx.lineTo(11, 26);
      ctx.lineTo(21, 26);
      ctx.closePath();
      ctx.fillStyle = allDay ? card : '#FFB300';
      ctx.fill();
      roundRect(ctx, 3, 3, 26, 24, 9);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 2;
      ctx.strokeStyle = allDay ? '#FFB300' : '#26262C';
      ctx.stroke();
      glyph(ctx, 'ticket', 16, 15, 16, allDay ? ink : '#26262C', 1.9);
    }, 32, 35);
  }
}
