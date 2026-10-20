import { add, dist, dot, mid, norm, pointInMulti, sub, type Vec2 } from '@hestia/geom';
import type { Roof } from '@hestia/model';
import { collinearOverlaps, perpOf, unitOf } from './roofGeom.ts';
import type { ResolvedRoofPlane, RoofLine } from './roofs.ts';

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
function sharedKind(A: ResolvedRoofPlane, B: ResolvedRoofPlane, p: Vec2, q: Vec2): RoofLine['kind'] | null {
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
  const horizontal = Math.abs(dot(gA, l)) < FLAT && Math.abs(dot(gB, l)) < FLAT;
  if (dA <= FLAT && dB <= FLAT) return horizontal ? 'ridge' : 'hip';
  if (dA >= -FLAT && dB >= -FLAT) return 'valley';
  return horizontal ? 'ridge' : 'hip';
}

/**
 * Linhas notáveis do telhado em planta. O contorno do beiral vira 'eave' (no telhado de uma água, a aresta mais alta
 * vira 'ridge'); cada divisa entre duas águas vira 'ridge', 'hip' ou 'valley' conforme `sharedKind`. Furos não geram linha.
 */
export function roofLines(r: Roof, planes: ResolvedRoofPlane[]): RoofLine[] {
  const out: RoofLine[] = [];
  const b = r.boundary;
  const dirU = unitOf(r.dir);
  const top = r.shape === 'shed' && dirU ? Math.max(...b.map((v) => dot(v, dirU))) : null;
  b.forEach((a, i) => {
    const c = b[(i + 1) % b.length]!;
    const high = top !== null && dirU !== null && Math.abs(dot(a, dirU) - top) < 1e-9 && Math.abs(dot(c, dirU) - top) < 1e-9;
    out.push({ kind: high ? 'ridge' : 'eave', a, b: c });
  });
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
