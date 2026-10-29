import { add, dist, dot, mid, norm, pointInMulti, sub, type Vec2 } from '@hestia/geom';
import type { Roof } from '@hestia/model';
import { collinearOverlaps, perpOf, segmentOverlaps } from './roofGeom.ts';
import type { ResolvedRoofPlane, RoofLine } from './roofs.ts';
import { extrusionLines } from './roofExtrusion.ts';

/** Afastamento (1e-5 m) do ponto médio de uma divisa para testar de que lado está cada água. */
const SIDE_OFFSET = 1e-5;
/** Declive (m/m) abaixo disso conta como nulo (ex.: cumeeira horizontal). */
const FLAT = 1e-9;

/** Gradiente da água em plano: subida por metro de planta, na direção `up`. */
const gradientOf = (pl: ResolvedRoofPlane): Vec2 => ({ x: (pl.percent / 100) * pl.up.x, y: (pl.percent / 100) * pl.up.y });

/**
 * Tipo da divisa entre duas águas (segmento p–q). n_i aponta para dentro da água i. Se as duas descem para longe da
 * divisa é um pico: cumeeira quando a divisa é horizontal, espigão quando não é. Se as duas sobem, é um rincão.
 * Quando uma sobe e a outra desce não há pico nem vale: cumeeira se horizontal, senão espigão.
 */
export function sharedKind(A: ResolvedRoofPlane, B: ResolvedRoofPlane, p: Vec2, q: Vec2): RoofLine['kind'] | null {
  const l = norm(sub(q, p));
  const n = perpOf(l);
  const m = mid(p, q);
  const nA = pointInMulti(add(m, { x: n.x * SIDE_OFFSET, y: n.y * SIDE_OFFSET }), A.polygon) ? n : { x: -n.x, y: -n.y };
  // A água B tem que estar do outro lado: senão é borda compartilhada da mesma face (ex.: sobreposição), não divisa.
  if (!pointInMulti(sub(m, { x: nA.x * SIDE_OFFSET, y: nA.y * SIDE_OFFSET }), B.polygon)) return null;
  const gA = gradientOf(A);
  const gB = gradientOf(B);
  const dA = dot(gA, nA);
  const dB = dot(gB, { x: -nA.x, y: -nA.y });
  // Mesma direção de subida e inclinações diferentes: não é pico nem vale, é um desnível (mansarda).
  if (Math.hypot(A.up.x - B.up.x, A.up.y - B.up.y) < 1e-9 && Math.abs(A.percent - B.percent) > 1e-9 && ((dA < -FLAT && dB > FLAT) || (dA > FLAT && dB < -FLAT))) return 'break';
  const horizontal = Math.abs(dot(gA, l)) < FLAT && Math.abs(dot(gB, l)) < FLAT;
  if (dA <= FLAT && dB <= FLAT) return horizontal ? 'ridge' : 'hip';
  if (dA >= -FLAT && dB >= -FLAT) return 'valley';
  return horizontal ? 'ridge' : 'hip';
}

/**
 * Linhas do contorno: cada aresta vira `kinds[i]` ('eave' com água, 'gable' empena) nos trechos em que uma água a
 * toca. Trecho sem água não gera linha (a aresta foi cortada pela junção de outro telhado).
 */
function boundaryLines(boundary: Vec2[], kinds: RoofLine['kind'][], planes: ResolvedRoofPlane[]): RoofLine[] {
  return boundary.flatMap((a, i) => {
    const c = boundary[(i + 1) % boundary.length]!;
    return planes.flatMap((pl) => segmentOverlaps(a, c, pl.polygon)).map(([p, q]): RoofLine => ({ kind: kinds[i] ?? 'eave', a: p, b: q }));
  });
}

/** Divisas entre águas do mesmo telhado: cumeeira, espigão ou rincão conforme `sharedKind`. */
export function interiorLines(planes: ResolvedRoofPlane[]): RoofLine[] {
  const out: RoofLine[] = [];
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      const A = planes[i]!;
      const B = planes[j]!;
      for (const [p, q] of collinearOverlaps(A.polygon, B.polygon)) {
        if (dist(p, q) < 1e-7) continue;
        const kind = sharedKind(A, B, p, q);
        if (kind) out.push({ kind, a: p, b: q });
      }
    }
  }
  return out;
}

/**
 * Linhas notáveis do telhado em planta: contorno ('eave' ou 'gable' por aresta, conforme `kinds`) e divisas entre águas
 * ('ridge', 'hip' ou 'valley'). Os furos geram as empenas (testeiras) à parte, em `holeGableLines` (roofSkeleton.ts).
 * Extrusão tem as suas (agente de extrusão).
 */
export function roofLines(r: Roof, planes: ResolvedRoofPlane[], kinds: RoofLine['kind'][]): RoofLine[] {
  if (r.shape === 'extrusion') return extrusionLines(r);
  return [...boundaryLines(r.boundary, kinds, planes), ...interiorLines(planes)];
}
