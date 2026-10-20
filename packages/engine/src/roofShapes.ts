import { asMulti, dot, intersection, orientedRect, ringArea, sub, type MultiPolygon, type Vec2 } from '@hestia/geom';
import type { Roof, RoofPlaneDef } from '@hestia/model';
import type { ResolvedRoofPlane } from './roofs.ts';
import { ccwRing, clipHalfPlane, isConvexRing, perpOf, simplifyRing, unitOf, WATER_MIN_AREA } from './roofGeom.ts';

/** Semiplano {p : dot(p, n) ≤ c} (below) ou ≥ c (above), como retângulo grande (com a mesma escala do contorno). */
function halfPlane(boundary: Vec2[], u: Vec2, n: Vec2, c: number, below: boolean): MultiPolygon {
  const scale = boundary.reduce((m, p) => Math.max(m, Math.abs(p.x), Math.abs(p.y)), 0);
  const big = 2 * scale + 10;
  const center = below ? c - big : c + big;
  return [[orientedRect(n.x * center, n.y * center, u.x, u.y, big, big)]];
}

/** Uma água: sobe na direção `dir` desde o ponto de menor projeção do contorno (beiral na cota eaveZ). */
export function shedPlanes(boundary: Vec2[], dir: Vec2, percent: number, eaveZ: number): ResolvedRoofPlane[] {
  const u = unitOf(dir);
  if (!u || boundary.length < 3) return [];
  let origin = boundary[0]!;
  let low = Infinity;
  for (const v of boundary) {
    const t = dot(v, u);
    if (t < low) {
      low = t;
      origin = v;
    }
  }
  return [{ polygon: asMulti(boundary), origin, up: u, percent, z0: eaveZ }];
}

/**
 * Duas águas: a cumeeira é paralela a `dir` e passa pelo meio da largura do contorno (meio entre a menor e a maior
 * projeção na normal de `dir`). Cada água sobe do beiral até a cumeeira; a cota da cumeeira é eaveZ + % × meia largura.
 */
export function gablePlanes(boundary: Vec2[], dir: Vec2, percent: number, eaveZ: number): ResolvedRoofPlane[] {
  const u = unitOf(dir);
  if (!u || boundary.length < 3) return [];
  const n = perpOf(u);
  const ts = boundary.map((p) => dot(p, n));
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  const mid = (tMin + tMax) / 2;
  const low = intersection(asMulti(boundary), halfPlane(boundary, u, n, mid, true));
  const high = intersection(asMulti(boundary), halfPlane(boundary, u, n, mid, false));
  const out: ResolvedRoofPlane[] = [];
  // Água baixa: sobe na direção +n a partir da reta t = tMin; água alta: desce na direção +n, subindo para −n.
  if (low.length) out.push({ polygon: low, origin: { x: n.x * tMin, y: n.y * tMin }, up: n, percent, z0: eaveZ });
  if (high.length) out.push({ polygon: high, origin: { x: n.x * tMax, y: n.y * tMax }, up: { x: -n.x, y: -n.y }, percent, z0: eaveZ });
  return out;
}

/**
 * Quatro águas (contorno convexo): a altura é `percent` × distância à reta da aresta mais próxima (straight skeleton
 * de polígono convexo). Cada água é a região onde a aresta i é a mais próxima: recorte do contorno pelos semiplanos
 * d_i ≤ d_j. Contorno não convexo não tem águas (a validação avisa e o usuário usa águas livres).
 */
export function hipPlanes(boundary: Vec2[], percent: number, eaveZ: number): ResolvedRoofPlane[] {
  const ring = simplifyRing(ccwRing(boundary));
  if (ring.length < 3 || !isConvexRing(ring)) return [];
  const edges = ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    const e = unitOf(sub(b, a));
    return { a, normal: e ? perpOf(e) : { x: 0, y: 0 } };
  });
  const out: ResolvedRoofPlane[] = [];
  edges.forEach((ei, i) => {
    let poly = ring;
    edges.forEach((ej, j) => {
      if (j === i) return;
      // d_i(p) ≤ d_j(p), com d_k(p) = dot(p − a_k, n_k): A·x + B·y ≤ C.
      const A = ei.normal.x - ej.normal.x;
      const B = ei.normal.y - ej.normal.y;
      const C = dot(ei.a, ei.normal) - dot(ej.a, ej.normal);
      poly = clipHalfPlane(poly, A, B, C);
    });
    if (poly.length < 3) return;
    if (Math.abs(ringArea(poly)) < WATER_MIN_AREA) return;
    out.push({ polygon: [[poly]], origin: ei.a, up: ei.normal, percent, z0: eaveZ });
  });
  return out;
}

/** Águas livres: cada polígono recortado pelo contorno do beiral; a cota é eaveZ + z0 do plano. */
export function freePlanes(boundary: Vec2[], defs: RoofPlaneDef[], eaveZ: number): ResolvedRoofPlane[] {
  const bm = asMulti(boundary);
  return defs.flatMap((d): ResolvedRoofPlane[] => {
    const up = unitOf(d.up);
    if (d.polygon.length < 3 || !up) return [];
    const polygon = intersection(asMulti(d.polygon), bm);
    return polygon.length ? [{ polygon, origin: d.origin, up, percent: d.percent, z0: eaveZ + d.z0 }] : [];
  });
}

/** Águas de um telhado antes dos furos, pela forma. */
export function waterPlanes(r: Roof, eaveZ: number): ResolvedRoofPlane[] {
  switch (r.shape) {
    case 'shed':
      return shedPlanes(r.boundary, r.dir, r.slopePercent, eaveZ);
    case 'gable':
      return gablePlanes(r.boundary, r.dir, r.slopePercent, eaveZ);
    case 'hip':
      return hipPlanes(r.boundary, r.slopePercent, eaveZ);
    case 'free':
      return freePlanes(r.boundary, r.planes, eaveZ);
    // 'edges' e 'extrusion': resolvidos pelo esqueleto reto e pelo perfil (agentes de motor); até lá, sem águas.
    case 'edges':
    case 'extrusion':
      return [];
  }
}
