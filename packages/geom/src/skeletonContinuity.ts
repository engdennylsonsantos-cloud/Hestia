import { sub, type Vec2 } from './vec.ts';
import { pointInRing } from './polygon.ts';

/** Água (face) do esqueleto, na forma usada pela checagem: aresta de origem no anel e região em planta. */
export interface ContinuityFace {
  ring: number;
  edge: number;
  polygon: Vec2[];
}

/** Motivo devolvido quando a superfície não fecha (ok:false); o engine o mostra como aviso do telhado. */
export const DISCONTINUOUS_REASON =
  'superfície do telhado descontínua: contorno côncavo com aresta de empena encostando em beiral no canto reentrante; não há superfície contínua nesse canto';

/** Tolerância de cota entre águas que se encontram num mesmo ponto de planta (metros). */
const HEIGHT_TOL = 1e-6;
/** Distância máxima para considerar que um ponto está sobre uma fronteira (metros). */
const EDGE_TOL = 1e-7;

/**
 * Cota da água da aresta `edge` do anel `ring` em p: peso × distância à reta da aresta (p fica no lado do material).
 * É o mesmo plano que o engine desenha (`planeZ` de roofs.ts), não a interpolação dos `z` da água.
 */
export function waterHeightAt(rings: Vec2[][], weights: number[][], ring: number, edge: number, p: Vec2): number {
  const R = rings[ring]!;
  const a = R[edge]!;
  const b = R[(edge + 1) % R.length]!;
  const d = sub(b, a);
  const l = Math.hypot(d.x, d.y);
  return weights[ring]![edge]! * Math.abs(((p.x - a.x) * -d.y + (p.y - a.y) * d.x) / l);
}

/** p sobre a fronteira de R (dentro da tolerância de EDGE_TOL). */
function onBoundary(p: Vec2, R: Vec2[]): boolean {
  for (let i = 0; i < R.length; i++) {
    const a = R[i]!;
    const b = R[(i + 1) % R.length]!;
    const d = sub(b, a);
    const len2 = d.x * d.x + d.y * d.y;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / len2)) : 0;
    if (Math.hypot(p.x - (a.x + d.x * t), p.y - (a.y + d.y * t)) <= EDGE_TOL) return true;
  }
  return false;
}

/**
 * Verdadeiro se a superfície tem salto em algum vértice de água: todas as águas que contêm ou tocam (fronteira,
 * inclusive T-junção) um vértice de água precisam dar a mesma cota ali. Um salto em aresta comum entre duas águas
 * aparece nas cotas de seus vértices extremos; um salto que começa numa T-junção aparece na própria T-junção.
 */
export function hasHeightJump(rings: Vec2[][], weights: number[][], faces: ContinuityFace[]): boolean {
  for (const f of faces) {
    for (const v of f.polygon) {
      let ref: number | null = null;
      for (const g of faces) {
        if (!pointInRing(v, g.polygon) && !onBoundary(v, g.polygon)) continue;
        const z = waterHeightAt(rings, weights, g.ring, g.edge, v);
        if (ref === null) ref = z;
        else if (Math.abs(z - ref) > HEIGHT_TOL) return true;
      }
    }
  }
  return false;
}
