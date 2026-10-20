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

export function lineColors(line: string, kind?: string): { bg: string; fg: string; shape: 'pill' | 'round' | 'square' } {
  const hit = LINE[line];
  if (hit) return { bg: hit[0], fg: hit[1], shape: line.startsWith('S') ? 'round' : 'square' };
  if (kind === 'zug' || /^(RE|RB|MEX|IRE|IC|ICE|EC|TGV|FLX)/.test(line)) return { bg: '#6E6E73', fg: '#fff', shape: 'pill' };
  if (/^N/.test(line)) return { bg: '#26262C', fg: '#FFB300', shape: 'pill' };
  if (/^X/.test(line)) return { bg: '#9B1B30', fg: '#fff', shape: 'pill' };
  return { bg: '#C8102E', fg: '#fff', shape: 'pill' };
}
