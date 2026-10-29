import { add, dot, intersection, mul, perp, ringArea, sub, type Ring, type Vec2 } from '@hestia/geom';
import type { StairComponentSketch } from './stairGenerators.ts';
import { stairLandingPolygon, type StairCurve, type StairLandingSketch } from './stairSketch.ts';

/** Ângulo (rad) abaixo do qual um vértice é colinear (só patamar em linha da norma). */
export const FREE_COLLINEAR_ANGLE = (3 * Math.PI) / 180;
/** Ângulo (rad) acima do qual o giro é agudo demais para um único patamar (use dois giros menores). */
export const FREE_MAX_TURN_ANGLE = (150 * Math.PI) / 180;
/** Área (m²) de interseção acima da qual dois componentes não adjacentes contam como sobrepostos. */
export const FREE_OVERLAP_AREA = 1e-3;

const line = (a: Vec2, b: Vec2): StairCurve => ({ a, b, sag: 0 });

/** Menor recuo (m) do patamar de giro que evita polígono autointerceptante: (w/2)·tan(θ/2). */
export function turnTMin(theta: number, width: number): number {
  return (width / 2) * Math.tan(theta / 2);
}

/**
 * Anel do patamar de giro com mitra no vértice `v` (6 pontos `[aIn, inner, bIn, bOut, outer, aOut]`): recuado `tIn`
 * sobre o trecho A (antes do vértice) e `tOut` sobre o trecho B (depois), ligado pelos cantos interno e externo.
 */
export function turnLandingRing(v: Vec2, dA: Vec2, dB: Vec2, width: number, tIn: number, tOut: number = tIn): Vec2[] {
  const cr = dA.x * dB.y - dA.y * dB.x;
  const sgn = cr >= 0 ? 1 : -1;
  const nA = perp(dA);
  const nB = perp(dB);
  const h = (sgn * width) / 2;
  const miter = mul(add(nA, nB), h / (1 + dot(nA, nB)));
  const aIn = add(sub(v, mul(dA, tIn)), mul(nA, h));
  const aOut = sub(sub(v, mul(dA, tIn)), mul(nA, h));
  const bIn = add(add(v, mul(dB, tOut)), mul(nB, h));
  const bOut = sub(add(v, mul(dB, tOut)), mul(nB, h));
  const inner = add(v, miter);
  const outer = sub(v, miter);
  return [aIn, inner, bIn, bOut, outer, aOut];
}

/** Croqui do patamar de giro (anel cru de 6 pontos, arestas retas). */
export function turnLandingSketch(v: Vec2, dA: Vec2, dB: Vec2, width: number, tIn: number, tOut: number = tIn): StairComponentSketch {
  const ring = turnLandingRing(v, dA, dB, width, tIn, tOut);
  const landing: StairLandingSketch = { boundary: ring.map((p, i) => line(p, ring[(i + 1) % ring.length]!)) };
  return { kind: 'landing', landing };
}

/** Tira pontos consecutivos repetidos (distância < eps), inclusive o último quando igual ao primeiro. */
export function compactRing(ring: Vec2[], eps = 1e-9): Vec2[] {
  const out: Vec2[] = [];
  for (const p of ring) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p.x - q.x, p.y - q.y) >= eps) out.push(p);
  }
  while (out.length > 1 && Math.hypot(out[0]!.x - out[out.length - 1]!.x, out[0]!.y - out[out.length - 1]!.y) < eps) out.pop();
  return out;
}

/** Polígono de um componente (lance = retângulo dos dois espelhos; patamar = contorno). */
export function partRing(p: StairComponentSketch): Ring | null {
  if (p.kind === 'landing') return stairLandingPolygon(p.landing).polygon;
  const r = p.run.risers;
  if (r.length < 2) return null;
  const r0 = r[0]!;
  const r1 = r[r.length - 1]!;
  return [r0.a, r0.b, r1.b, r1.a];
}

/**
 * Primeiro par de componentes NÃO adjacentes (de trechos diferentes) que se sobrepõe, ou null. Barato: a caixa
 * envolvente descarta quase todos os pares antes da interseção; o contato de borda (área ~0) é tolerado.
 */
export function findSelfOverlap(parts: StairComponentSketch[], segOf: number[]): { a: number; b: number } | null {
  const rings = parts.map(partRing);
  const boxes = rings.map((r) => {
    if (!r) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of r) {
      x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
    }
    return { x0, y0, x1, y1 };
  });
  for (let j = 2; j < parts.length; j++) {
    const bj = boxes[j];
    if (!bj) continue;
    for (let i = 0; i + 1 < j; i++) {
      const bi = boxes[i];
      if (!bi || segOf[i] === segOf[j]) continue;
      if (bi.x1 <= bj.x0 || bj.x1 <= bi.x0 || bi.y1 <= bj.y0 || bj.y1 <= bi.y0) continue;
      const inter = intersection([[rings[i]!]], [[rings[j]!]]);
      const area = inter.reduce((s, poly) => s + poly.reduce((t, ring, k) => t + (k === 0 ? 1 : -1) * Math.abs(ringArea(ring)), 0), 0);
      if (area > FREE_OVERLAP_AREA) return { a: i, b: j };
    }
  }
  return null;
}
