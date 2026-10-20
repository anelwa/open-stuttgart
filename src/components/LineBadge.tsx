import { lineColors } from '../lib/lines';

export function LineBadge({ line, kind, size = 'md' }: { line: string; kind?: string; size?: 'sm' | 'md' }) {
  const c = lineColors(line, kind);
  return (
    <span className={`line-badge ${c.shape} ${size}`} style={{ background: c.bg, color: c.fg }}>
      {line}
    </span>
  );
}
