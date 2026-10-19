import type { Vec2 } from '@hestia/geom';

/** Vista 2D: centro no mundo (m), zoom em pixels por metro, tamanho do canvas em pixels CSS. */
export interface Viewport {
  cx: number;
  cy: number;
  zoom: number;
  width: number;
  height: number;
}

export const worldToScreen = (v: Viewport, p: Vec2): Vec2 => ({
  x: (p.x - v.cx) * v.zoom + v.width / 2,
  y: v.height / 2 - (p.y - v.cy) * v.zoom,
});

export const screenToWorld = (v: Viewport, s: Vec2): Vec2 => ({
  x: (s.x - v.width / 2) / v.zoom + v.cx,
  y: (v.height / 2 - s.y) / v.zoom + v.cy,
});

export const metersPerPixel = (v: Viewport): number => 1 / v.zoom;

export function visibleBounds(v: Viewport): { minX: number; minY: number; maxX: number; maxY: number } {
  const a = screenToWorld(v, { x: 0, y: v.height });
  const b = screenToWorld(v, { x: v.width, y: 0 });
  return { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y };
}

/** Zoom em torno de um ponto de tela (a roda do mouse mantém o ponto sob o cursor). */
export function zoomAt(v: Viewport, screen: Vec2, factor: number): Viewport {
  const before = screenToWorld(v, screen);
  const zoom = Math.max(2, Math.min(4000, v.zoom * factor));
  const next = { ...v, zoom };
  const after = screenToWorld(next, screen);
  return { ...next, cx: v.cx + (before.x - after.x), cy: v.cy + (before.y - after.y) };
}

export function panBy(v: Viewport, dxPx: number, dyPx: number): Viewport {
  return { ...v, cx: v.cx - dxPx / v.zoom, cy: v.cy + dyPx / v.zoom };
}

/** Enquadra uma caixa com margem. */
export function fitBox(v: Viewport, box: { minX: number; minY: number; maxX: number; maxY: number }, marginPx = 60): Viewport {
  const w = Math.max(1e-3, box.maxX - box.minX);
  const h = Math.max(1e-3, box.maxY - box.minY);
  const zoom = Math.max(2, Math.min(600, Math.min((v.width - marginPx * 2) / w, (v.height - marginPx * 2) / h)));
  return { ...v, zoom, cx: (box.minX + box.maxX) / 2, cy: (box.minY + box.maxY) / 2 };
}
