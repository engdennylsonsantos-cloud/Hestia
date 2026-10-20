import type { ReactElement } from 'react';

const P: Record<string, string> = {
  select: 'M5 3l13 7-6 2-2 6z',
  wall: 'M3 9h18v6H3zM8 9v6M13 9v6M18 9v6',
  door: 'M5 21V3h9v18M14 3l5 2v14l-5 2M11 12h.01',
  window: 'M4 4h16v16H4zM12 4v16M4 12h16',
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  rotate: 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5',
  mirror: 'M12 3v18M8 7L3 12l5 5zM16 7l5 5-5 5z',
  array: 'M3 6h4v4H3zM10 6h4v4h-4zM17 6h4v4h-4zM3 14h4v4H3zM10 14h4v4h-4zM17 14h4v4h-4z',
  parallel: 'M3 7h18M3 17h18M9 3v4M15 3v4M9 15l-2 4M15 15l2 4',
  offset: 'M4 20L20 4M4 14L14 4M10 20L20 10',
  trim: 'M4 4v16h16M4 12h8M12 12l6-6',
  align: 'M4 3v18M8 7h12M8 12h8M8 17h10',
  joins: 'M4 20V9h11M4 9l5-5M15 9v11M15 9l5 5',
  split: 'M4 12h6M14 12h6M12 4v16',
  measure: 'M3 17L17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  save: 'M5 3h12l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7',
  open: 'M3 7h6l2 2h10v10H3zM3 7V5h6l2 2',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  grid: 'M4 4h16v16H4zM9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  plan: 'M4 4h16v16H4zM4 12h8v8M12 4v8',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  levels: 'M3 6h18M3 12h18M3 18h18',
  up: 'M6 14l6-6 6 6',
  down: 'M6 10l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  file: 'M6 3h9l4 4v14H6zM14 3v5h5',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01',
  floor: 'M4 8l8-4 8 4v9l-8 4-8-4zM4 8l8 4 8-4M12 12v9M7 14.5h3M14 14.5h3M8 18h2M14 18h2',
  slab: 'M3 8h18v4H3zM3 12h18v5H3zM7 17v2M12 17v2M17 17v2M7 8V5M12 8V5M17 8V5',
  slope: 'M3 17L21 9M21 9v4M21 9h-4M3 20h18M3 17v3',
  roof: 'M3 14l9-9 9 9M6 12v8h12v-8',
  roofarrow: 'M3 14l9-9 9 9M6 12v8h12v-8M12 17v-4M10.5 14.5L12 13l1.5 1.5',
  stairs: 'M3 20h5v-5h5v-5h5V5h3',
  room: 'M4 4h16v16H4zM9 9h6v6H9z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  chevron: 'M9 6l6 6-6 6',
  section: 'M3 12h3M9 12h1.5M13.5 12h1.5M18 12h3M12 3v4M9 5l3-2 3 2M12 17v4M9 19l3 2 3-2',
  elevation: 'M3 20h18M5 20V6h14v14M9 20v-5h6v5M9 10h2M13 10h2',
  sametype: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  rehost: 'M3 9h18v6H3zM8 9v6M16 9v6M5 19l4-3M19 19l-4-3',
  attachroof: 'M3 8l9-5 9 5M5 8v12h14V8M9 14h6M12 11v6',
  detachroof: 'M3 8l9-5 9 5M5 8v12h14V8M4 4l16 16',
};

export function Icon({ name, size = 20 }: { name: string; size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? ''} />
    </svg>
  );
}
