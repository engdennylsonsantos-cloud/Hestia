import { v2, type Vec2 } from './vec.ts';

/** Anel simples (sem repetir o primeiro ponto no fim). */
export type Ring = Vec2[];
/** Polígono: anel externo seguido de furos. */
export type Polygon = Ring[];
export type MultiPolygon = Polygon[];

export function ringArea(r: Ring): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i]!;
    const b = r[(i + 1) % r.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** Área líquida (externo menos furos). */
export function polygonArea(p: Polygon): number {
  let total = 0;
  p.forEach((r, i) => {
    const a = Math.abs(ringArea(r));
    total += i === 0 ? a : -a;
  });
  return total;
}

export const multiArea = (m: MultiPolygon): number => m.reduce((s, p) => s + polygonArea(p), 0);

export function pointInRing(pt: Vec2, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i]!;
    const b = r[j]!;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(pt: Vec2, p: Polygon): boolean {
  if (!p[0] || !pointInRing(pt, p[0])) return false;
  for (let i = 1; i < p.length; i++) if (pointInRing(pt, p[i]!)) return false;
  return true;
}

export const pointInMulti = (pt: Vec2, m: MultiPolygon): boolean => m.some((p) => pointInPolygon(pt, p));

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boxOf(points: Vec2[]): Box {
  const b: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of points) {
    if (p.x < b.minX) b.minX = p.x;
    if (p.y < b.minY) b.minY = p.y;
    if (p.x > b.maxX) b.maxX = p.x;
    if (p.y > b.maxY) b.maxY = p.y;
  }
  return b;
}

export const boxesOverlap = (a: Box, b: Box, pad = 0): boolean =>
  a.minX <= b.maxX + pad && a.maxX >= b.minX - pad && a.minY <= b.maxY + pad && a.maxY >= b.minY - pad;

export const expandBox = (b: Box, k: number): Box => ({
  minX: b.minX - k,
  minY: b.minY - k,
  maxX: b.maxX + k,
  maxY: b.maxY + k,
});

export function multiPoints(m: MultiPolygon): Vec2[] {
  const out: Vec2[] = [];
  for (const p of m) for (const r of p) out.push(...r);
  return out;
}

/** Retângulo orientado: centro, direção unitária u, meia-extensão along (u) e across (perp u). */
export function orientedRect(cx: number, cy: number, ux: number, uy: number, halfAlong: number, halfAcross: number): Ring {
  const vx = -uy;
  const vy = ux;
  return [
    { x: cx - ux * halfAlong - vx * halfAcross, y: cy - uy * halfAlong - vy * halfAcross },
    { x: cx + ux * halfAlong - vx * halfAcross, y: cy + uy * halfAlong - vy * halfAcross },
    { x: cx + ux * halfAlong + vx * halfAcross, y: cy + uy * halfAlong + vy * halfAcross },
    { x: cx - ux * halfAlong + vx * halfAcross, y: cy - uy * halfAlong + vy * halfAcross },
  ];
}

/** Fecho convexo (cadeia monótona de Andrew), anti-horário, sem pontos colineares nas arestas. */
export function convexHull(points: Vec2[]): Ring {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const uniq = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1]!.x || p.y !== pts[i - 1]!.y);
  if (uniq.length < 3) return uniq;
  const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Vec2[]): Ring => {
    const h: Ring = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(uniq), ...half([...uniq].reverse())];
}

/**
 * Retângulo orientado de menor área que envolve os pontos (rotating calipers por arestas do fecho: o mínimo de área
 * ocorre com um lado alinhado a uma aresta do fecho). Anel de 4 vértices. Sem área (pontos colineares ou um só),
 * devolve a caixa alinhada aos eixos.
 */
export function minAreaRect(points: Vec2[]): Ring {
  const hull = convexHull(points);
  if (hull.length < 3) {
    const b = boxOf(points);
    return [v2(b.minX, b.minY), v2(b.maxX, b.minY), v2(b.maxX, b.maxY), v2(b.minX, b.maxY)];
  }
  let best: { area: number; ring: Ring } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const c = hull[(i + 1) % hull.length]!;
    const len = Math.hypot(c.x - a.x, c.y - a.y);
    if (len === 0) continue;
    const ux = (c.x - a.x) / len;
    const uy = (c.y - a.y) / len;
    const vx = -uy;
    const vy = ux;
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of hull) {
      const pu = p.x * ux + p.y * uy;
      const pv = p.x * vx + p.y * vy;
      if (pu < minU) minU = pu;
      if (pu > maxU) maxU = pu;
      if (pv < minV) minV = pv;
      if (pv > maxV) maxV = pv;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (best && area >= best.area) continue;
    const at = (pu: number, pv: number): Vec2 => v2(pu * ux + pv * vx, pu * uy + pv * vy);
    best = { area, ring: [at(minU, minV), at(maxU, minV), at(maxU, maxV), at(minU, maxV)] };
  }
  if (best) return best.ring;
  const b = boxOf(hull);
  return [v2(b.minX, b.minY), v2(b.maxX, b.minY), v2(b.maxX, b.maxY), v2(b.minX, b.maxY)];
}

