// Schlichte Liniensymbole (24er Raster, 1,75er Strich), eigene Zeichnungen.
export const ICON_PATHS: Record<string, string> = {
  train: 'M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM4 10h16M8 21l2-4M16 21l-2-4M8.5 13.5h.01M15.5 13.5h.01',
  stop: 'M12 2v6M8 8h8v8H8zM10 16v6M14 16v6',
  parking: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM10 17V7h3.5a3 3 0 0 1 0 6H10',
  bike: 'M5.5 17.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M18.5 17.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M5.5 17.5L9 9h6l3.5 8.5M9 9l3 8.5h1M14 5h2.5',
  car: 'M5 17h14M5 17v2M19 17v2M4 13l2-6h12l2 6v4H4zM7.5 14.5h.01M16.5 14.5h.01',
  scooter: 'M6 18a2 2 0 1 0 0 .01M18 18a2 2 0 1 0 0 .01M6 18h10l2-12h3M16 18l-4-6',
  share: 'M7 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 5v4M10 7h4M7 14l5-5 5 5',
  cone: 'M12 3l6 16H6zM9 11h6M7.5 15h9M4 21h16',
  route: 'M6 19a2 2 0 1 0 0 .01M18 5a2 2 0 1 0 0 .01M6 17V9a4 4 0 0 1 4-4h2M18 7v8a4 4 0 0 1-4 4h-2',
  air: 'M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7',
  water: 'M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0',
  sun: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  cloud: 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z',
  rain: 'M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 6.5 4.25 4.25 0 0 0 7 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3',
  search: 'M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  compass: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M15.5 8.5l-2 5-5 2 2-5z',
  locate: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 2v3M12 19v3M2 12h3M19 12h3M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0',
  culture: 'M4 21h16M5 21V10M19 21V10M9 21v-7M15 21v-7M3 10l9-6 9 6z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  clock: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 2',
  info: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 11v5M12 8h.01',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  chevron: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  wind: 'M3 8h9a3 3 0 1 0-3-3M3 16h13a3 3 0 1 1-3 3M3 12h17',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  mobility: 'M8 3h8a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM5 11h14M8 21l2-3M16 21l-2-3',
  leaf: 'M5 19c0-8 5-14 15-15-1 10-7 15-15 15zM5 19l7-7',
  tree: 'M12 22v-5M12 3a5 5 0 0 0-5 5 4 4 0 0 0-1.5 7.7c.5.2 1 .3 1.5.3h10a4 4 0 0 0 1.5-7.7A5 5 0 0 0 12 3z',
  view: 'M2 20l6.5-10 4.5 6.5 3-4 6 7.5zM17 6.5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  church: 'M12 2v4M10 4h4M6 21V11l6-5 6 5v10M4 21h16M10 21v-4a2 2 0 0 1 4 0v4',
  monument: 'M10.5 4L12 2l1.5 2v12h-3zM7 17h10v4H7z',
  mask: 'M4 5c5 2 11 2 16 0v6a8 8 0 0 1-16 0zM9 10h.01M15 10h.01M9 15c2 1.5 4 1.5 6 0',
  ticket: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM15 7v10',
  walk: 'M13 4.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M9 21l2.5-6 2.5 2.5V21M8 12l2.5-4 3.5 1 2 3M11.5 15l1-5',
  home: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5',
  sunset: 'M3 18h18M7 18a5 5 0 0 1 10 0M12 4v4M10 6l2 2 2-2M4.9 11.9l1.4 1.4M19.1 11.9l-1.4 1.4M8 21h8',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  umbrella: 'M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v7a2 2 0 0 0 4 0',
  image: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M15.5 9.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0',
  pin: 'M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 9m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
  swap: 'M8 3v18M8 21l-3-3M8 21l3-3M16 21V3M16 3l-3 3M16 3l3 3',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
};
const P = ICON_PATHS;

export function Icon({ name, size = 20, className, title }: { name: keyof typeof P | string; size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={P[name] ?? P.info} />
    </svg>
  );
}

export function weatherIconName(icon: string) {
  if (icon?.includes('clear')) return 'sun';
  if (icon?.includes('rain') || icon === 'sleet' || icon === 'hail' || icon === 'thunderstorm') return 'rain';
  if (icon === 'wind') return 'wind';
  return 'cloud';
}
