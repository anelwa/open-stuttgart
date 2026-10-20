// Kleine Verlaufslinie ohne Achsen, mit letztem Punkt hervorgehoben.
export function Sparkline({ values, width = 120, height = 32, color = 'currentColor', label }: {
  values: number[]; width?: number; height?: number; color?: string; label: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (width - 2 * pad),
    pad + (1 - (v - min) / span) * (height - 2 * pad),
  ]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const area = `${d}L${pts.at(-1)![0]},${height}L${pts[0][0]},${height}Z`;
  const last = pts.at(-1)!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="spark">
      <path d={area} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </svg>
  );
}
