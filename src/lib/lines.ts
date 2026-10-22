// Linienfarben: Stadtbahn aus dem VVS-GTFS, S-Bahn angelehnt an den VVS-Netzplan.
const LINE: Record<string, [string, string]> = {
  S1: ['#6CB23F', '#fff'], S2: ['#E2001A', '#fff'], S3: ['#F39100', '#26262C'], S4: ['#0069B4', '#fff'],
  S5: ['#00A5DB', '#fff'], S6: ['#83542D', '#fff'], S60: ['#8D8C1D', '#fff'], S62: ['#C26B1E', '#fff'],
  U1: ['#CC9966', '#000'], U2: ['#FF6600', '#fff'], U3: ['#804D19', '#fff'], U4: ['#8368AE', '#fff'],
  U5: ['#33FFFF', '#000'], U6: ['#FF00FF', '#fff'], U7: ['#66B18C', '#fff'], U8: ['#B3B15F', '#000'],
  U9: ['#FFD900', '#000'], U11: ['#A4A5A5', '#fff'], U12: ['#AFC5E9', '#000'], U13: ['#E1ACC0', '#000'],
  U14: ['#8EBF4D', '#000'], U15: ['#004DFF', '#fff'], U16: ['#BAD900', '#000'], U19: ['#FFB300', '#000'],
  '10': ['#FFB300', '#004299'], '20': ['#FFB300', '#004299'],
};

function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Linienfarben sind Identität, nicht Dekoration. Wo der historische weiße Text auf
 * einer hellen Linienfarbe zu wenig Kontrast hat, wird die Schrift dunkel — die
 * Linienfarbe selbst bleibt unverändert. 4,5:1 ist der Maßstab für die kleine Schrift.
 */
function readableInk(bg: string, preferred: string): string {
  if (contrast(bg, preferred) >= 4.5) return preferred;
  return contrast(bg, '#26262C') >= contrast(bg, '#FFFFFF') ? '#26262C' : '#FFFFFF';
}

export function lineColors(line: string, kind?: string): { bg: string; fg: string; shape: 'pill' | 'round' | 'square' } {
  const hit = LINE[line];
  if (hit) return { bg: hit[0], fg: readableInk(hit[0], hit[1]), shape: line.startsWith('S') ? 'round' : 'square' };
  if (kind === 'zug' || /^(RE|RB|MEX|IRE|IC|ICE|EC|TGV|FLX)/.test(line)) return { bg: '#5A5A60', fg: '#FFFFFF', shape: 'pill' };
  if (/^N/.test(line)) return { bg: '#26262C', fg: '#FFB300', shape: 'pill' };
  if (/^X/.test(line)) return { bg: '#9B1B30', fg: '#FFFFFF', shape: 'pill' };
  return { bg: '#C8102E', fg: '#FFFFFF', shape: 'pill' };
}
