import { boxOf, dist, pointInPolygon, type Polygon, type Ring, type Vec2 } from '@hestia/geom';
import { lineIntervals } from './sectionGeom.ts';

const EPS = 1e-9;

/** Área assinada e centroide de um anel (fórmula de Green). */
function ringCentroid(ring: Ring): { x: number; y: number; area: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  a /= 2;
  if (Math.abs(a) < EPS) return { x: 0, y: 0, area: 0 };
  return { x: cx / (6 * a), y: cy / (6 * a), area: a };
}

/**
 * Centroide (centro de gravidade) de um polígono com furos. Os furos entram com sinal contrário ao anel
 * externo; se vierem com a mesma orientação, são invertidos aqui. Devolve null para polígono degenerado.
 */
export function polygonCentroid(poly: Polygon): Vec2 | null {
  const outer = poly[0];
  if (!outer || outer.length < 3) return null;
  const sign = Math.sign(ringCentroid(outer).area) || 1;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const c = ringCentroid(poly[i]!);
    const a = i === 0 ? c.area : Math.sign(c.area) === sign ? -Math.abs(c.area) : c.area;
    area += a;
    cx += c.x * a;
    cy += c.y * a;
  }
  if (Math.abs(area) < EPS) return null;
  return { x: cx / area, y: cy / area };
}

/** Distância de um ponto a um segmento. */
function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < EPS) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Menor distância de um ponto às bordas do polígono (furos incluídos). */
export function distanceToPolygon(p: Vec2, poly: Polygon): number {
  let best = Infinity;
  for (const ring of poly) {
    for (let i = 0; i < ring.length; i++) {
      const d = distToSegment(p, ring[i]!, ring[(i + 1) % ring.length]!);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Polo de inacessibilidade (o ponto mais distante das bordas): usado quando o centroide cai fora do
 * polígono, num furo ou numa reentrância. Busca em grade grosseira e três refinamentos.
 */
export function poleOfInaccessibility(poly: Polygon): Vec2 | null {
  const outer = poly[0];
  if (!outer || outer.length < 3) return null;
  const b = boxOf(poly.flat());
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  if (!(w > EPS && h > EPS)) return null;
  let step = Math.max(w, h) / 32;
  let best: Vec2 | null = null;
  let bestD = -1;
  for (let pass = 0; pass < 4; pass++) {
    const x0: number = best ? best.x - step * 1.5 : b.minX;
    const x1: number = best ? best.x + step * 1.5 : b.maxX;
    const y0: number = best ? best.y - step * 1.5 : b.minY;
    const y1: number = best ? best.y + step * 1.5 : b.maxY;
    const n = 12;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const q: Vec2 = { x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * j) / n };
        if (q.x < b.minX || q.x > b.maxX || q.y < b.minY || q.y > b.maxY) continue;
        if (!pointInPolygon(q, poly)) continue;
        const d = distanceToPolygon(q, poly);
        if (d > bestD) {
          bestD = d;
          best = q;
        }
      }
    }
    step /= 2;
  }
  return best;
}

/** Ponto de referência do ambiente: centroide; se ele não estiver na área útil, o polo de inacessibilidade. */
export function roomReferencePoint(poly: Polygon): Vec2 | null {
  const c = polygonCentroid(poly);
  if (c && pointInPolygon(c, poly)) return c;
  return poleOfInaccessibility(poly);
}

/** Trecho de uma linha de referência (já recortado pelo polígono). */
export interface ReferenceSegment {
  a: Vec2;
  b: Vec2;
}

/**
 * Diagonais de referência (Revit: Reference) que atravessam o ambiente de um lado ao outro e se cruzam
 * no ponto de referência. A inclinação vem da caixa do polígono (num retângulo, são as diagonais da
 * caixa); cada diagonal é recortada pelo interior, então num ambiente em L ela pode virar dois trechos.
 */
export function referenceDiagonals(poly: Polygon, at: Vec2): ReferenceSegment[] {
  const b = boxOf(poly.flat());
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  if (!(w > EPS && h > EPS)) return [];
  const angle = Math.atan2(h, w);
  const dirs: Vec2[] = [
    { x: Math.cos(angle), y: Math.sin(angle) },
    { x: Math.cos(angle), y: -Math.sin(angle) },
  ];
  const out: ReferenceSegment[] = [];
  for (const d of dirs) {
    const n = { x: -d.y, y: d.x };
    for (const [t0, t1] of lineIntervals(poly, at, d, n)) {
      if (t1 - t0 <= 1e-6) continue;
      out.push({ a: { x: at.x + d.x * t0, y: at.y + d.y * t0 }, b: { x: at.x + d.x * t1, y: at.y + d.y * t1 } });
    }
  }
  return out;
}

/** Referência e diagonais de um polígono numa chamada só (o que a planta de área desenha). */
export function roomReferenceGeometry(poly: Polygon): { at: Vec2; segments: ReferenceSegment[] } | null {
  const at = roomReferencePoint(poly);
  if (!at) return null;
  return { at, segments: referenceDiagonals(poly, at) };
}
