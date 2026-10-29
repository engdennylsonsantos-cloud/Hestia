import { asMulti, dot, pointInMulti, type Vec2 } from '@hestia/geom';
import { expandRoofArcs } from '@hestia/engine';
import { waterPlanesOf } from '@hestia/engine/src/roofShapes.ts';
import type { Roof, RoofPlaneDef } from '@hestia/model';
import { roofShapePatch } from './roofEdges.ts';

/**
 * Patch que converte um telhado qualquer em águas livres PRESERVANDO as águas atuais: cada água calculada pela forma
 * (esqueleto, uma água, extrusão...) vira um plano de `planes`, com a mesma origem, subida, inclinação e cota (relativa
 * ao beiral). Arcos do contorno entram como trechos retos (o contorno passa a ser o expandido e as flechas saem);
 * a mansarda vira duas águas por face. Sem águas calculáveis, cai na conversão simples (uma água sobre o contorno).
 * Telhado que já é livre devolve {}.
 */
export function roofToFreePatch(r: Roof, slopePercent: number = r.slopePercent): Partial<Roof> {
  if (r.shape === 'free') return {};
  const ex = expandRoofArcs(r);
  let water: ReturnType<typeof waterPlanesOf>;
  try {
    water = waterPlanesOf(ex, 0);
  } catch {
    return roofShapePatch(r, 'free', slopePercent);
  }
  const planes = water.planes.flatMap((pl): RoofPlaneDef[] =>
    pl.polygon.flatMap((poly) => (poly[0] && poly[0].length >= 3 ? [{ polygon: poly[0], origin: pl.origin, up: pl.up, percent: pl.percent, z0: pl.z0 }] : [])),
  );
  if (water.problem || planes.length === 0) return roofShapePatch(r, 'free', slopePercent);
  const arcs = ex !== r;
  return {
    shape: 'free',
    slopePercent,
    planes,
    mansard: undefined,
    ...(arcs ? { boundary: ex.boundary, edgeSlopes: ex.edgeSlopes, edgeOverhangs: ex.edgeOverhangs, edgeSag: undefined, footprint: undefined } : {}),
  };
}

/** Índice da água (de `planes`) sob o ponto `at`; na borda, tenta um passo de 1 mm para dentro do contorno. -1 se nenhuma. */
export function planeIndexAt(planes: RoofPlaneDef[], at: Vec2, centroid: Vec2): number {
  const find = (q: Vec2): number => planes.findIndex((pl) => pl.polygon.length >= 3 && pointInMulti(q, asMulti(pl.polygon)));
  const k = find(at);
  if (k >= 0) return k;
  const d = { x: centroid.x - at.x, y: centroid.y - at.y };
  const l = Math.hypot(d.x, d.y);
  return l < 1e-9 ? -1 : find({ x: at.x + (d.x / l) * 1e-3, y: at.y + (d.y / l) * 1e-3 });
}

/** Menor valor de `dot(q, up)` entre os pontos da água: a linha de beiral dela para essa subida. */
export const lowAlong = (ring: Vec2[], up: Vec2): number => Math.min(...ring.map((q) => dot(q, up)));
