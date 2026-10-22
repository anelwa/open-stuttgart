// StuttBots Maskottchen: ein kleines schwarzes Fernsehtürmli auf Gold.
// Die Silhouette greift den Stuttgarter Fernsehturm auf – Turmkorb, Schaft,
// Antenne – und gibt ihm im Korb ein freundliches Gesicht.

export function StuttBotMark({
  size = 32,
  badge = true,
  className,
  title,
}: {
  size?: number;
  badge?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}

      {badge && (
        <>
          <rect x="1.25" y="1.25" width="45.5" height="45.5" rx="15" fill="#FFB300" />
          <path d="M8 12.5C9.5 7.8 13.4 4.8 18.2 4.2" stroke="#FFF7E6" strokeWidth="2.2" strokeLinecap="round" opacity=".4" />
        </>
      )}

      <g fill="#161616">
        {/* Antenne */}
        <rect x="23.1" y="4.2" width="1.8" height="7" rx=".9" />
        <circle cx="24" cy="3.4" r="1.7" />

        {/* Turmkorb */}
        <rect x="11.5" y="10.2" width="25" height="10.6" rx="5.3" />

        {/* Schaft */}
        <path d="M16.3 20.4h15.4l3.2 19.1H13.1z" />

        {/* Sockel und zwei kleine Füße */}
        <rect x="10.8" y="38.8" width="26.4" height="3.4" rx="1.7" />
        <rect x="14.2" y="41.6" width="6.1" height="2.3" rx="1.15" />
        <rect x="27.7" y="41.6" width="6.1" height="2.3" rx="1.15" />
      </g>

      {/* Gesicht im Turmkorb */}
      <circle cx="19.2" cy="14.7" r="1.55" fill="#FFB300" />
      <circle cx="28.8" cy="14.7" r="1.55" fill="#FFB300" />
      <path d="M20.7 17.4c1.7 1.5 5 1.5 6.7 0" stroke="#FFB300" strokeWidth="1.55" strokeLinecap="round" />

      {/* Aussichtsplattform als feine goldene Linie */}
      <path d="M13.2 18.6h21.6" stroke="#FFB300" strokeWidth="1.2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}
