// StuggiAI: stilisierte Büste im Anzug, schwarze Silhouette auf Gelb.
// Kein fotorealistisches Abbild, sondern ein Logo: kopfförmige Silhouette,
// Schultern, Hemd und Krawatte, zwei leuchtende Augen. Funktioniert von 18 bis 92 px.

export function StuggiMark({
  size = 32,
  badge = true,
  tone = 'accent',
  className,
  title,
}: {
  size?: number;
  badge?: boolean;
  /** accent = gelbe Kachel mit schwarzer Büste; ink = dunkle Kachel mit gelber Büste */
  tone?: 'accent' | 'ink';
  className?: string;
  title?: string;
}) {
  const accent = tone !== 'ink';
  const tile = accent ? '#FFC400' : '#161616';
  const ink = accent ? '#0B0B0B' : '#FFC400';
  const eye = accent ? '#FFC400' : '#161616';
  const pupil = accent ? '#0B0B0B' : '#FFC400';

  // Kopf, Ohren, Hals und Schultern in einer ruhigen Silhouette.
  const bust = 'M32 6.5c-6.7 0-12 4.2-13.2 11.1-.6 3.5 0 7 1.5 9.8-3.5 1.8-5.9 4.9-6.7 8.8L9.5 56h45l-4.1-19.8c-.8-3.9-3.2-7-6.7-8.8 1.5-2.8 2.1-6.3 1.5-9.8C44 10.7 38.7 6.5 32 6.5Z';

  if (!badge) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
        {title && <title>{title}</title>}
        <path d={bust} fill="currentColor" />
        <path d="M21.8 24.2c1.5-1.7 4.6-1.7 6.1 0-1.5 1.7-4.6 1.7-6.1 0Z" fill={eye} />
        <path d="M36.1 24.2c1.5-1.7 4.6-1.7 6.1 0-1.5 1.7-4.6 1.7-6.1 0Z" fill={eye} />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}

      {/* Gelbe Kachel, wie ein Stempel */}
      <rect x="1" y="1" width="62" height="62" rx="18" fill={tile} />
      <rect x="2.1" y="2.1" width="59.8" height="59.8" rx="16.9" stroke={ink} strokeOpacity={accent ? '.14' : '.35'} strokeWidth="1.2" />

      {/* Schultern / Anzug */}
      <path d={bust} fill={ink} />

      {/* Hemd als V-Ausschnitt */}
      <path d="M24.6 37.2 32 45.5l7.4-8.3 4 2.1L38.6 56H25.4l-4.8-16.7 4-2.1Z" fill={tile} />

      {/* Krawatte */}
      <path d="M30.2 44.1h3.6l-.7 2.8-1.1 1.2-1.1-1.2-.7-2.8Z" fill={ink} />
      <path d="M32 47.1 34.8 50l-1.4 6h-2.8L29.2 50 32 47.1Z" fill={ink} />

      {/* Augen: mandelförmig, mit kleinem Pupil */}
      <path d="M20.9 24.2c1.6-1.9 5-1.9 6.6 0-1.6 1.9-5 1.9-6.6 0Z" fill={eye} />
      <path d="M36.5 24.2c1.6-1.9 5-1.9 6.6 0-1.6 1.9-5 1.9-6.6 0Z" fill={eye} />
      <circle cx="24.2" cy="24.2" r=".95" fill={pupil} />
      <circle cx="39.8" cy="24.2" r=".95" fill={pupil} />

      {/* Andeutung von Haaren, kein Gesicht */}
      <path d="M20.5 17.2c1.4-4.3 5.2-7 9.4-7.2M34.2 10c4.3.3 8 3 9.3 7.2" stroke={tile} strokeWidth="1.25" strokeLinecap="round" opacity=".22" />
    </svg>
  );
}
