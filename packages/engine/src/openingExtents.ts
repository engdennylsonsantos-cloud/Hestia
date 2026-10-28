import type { Opening, OpeningDimRef, Project } from '@hestia/model';
import type { WallFrame } from './frame.ts';
import { buildOpeningModel } from './openingModel.ts';
import { openingGeometry } from './resolve.ts';

/** Meias-larguras da esquadria a partir do centro do vão (m), uma por referência de cota. */
export interface OpeningExtents {
  center: 0;
  /** Vão livre (luz): entre as faces internas do batente. */
  clear: number;
  /** Vão externo do conjunto (batente, bandeiras e laterais incluídas). */
  frame: number;
  /** Borda externa do alizar da face pedida; sem alizar, igual a `frame`. */
  casing: number;
}

const EPS = 1e-6;
const cache = new WeakMap<Project, Map<string, OpeningExtents>>();

/** Meia-largura (|t|) máxima das peças `casing` que ficam do lado `face` da parede. */
function casingHalf(parts: ReadonlyArray<{ role: string; box: { t0: number; t1: number; s0: number; s1: number } }>, face: 1 | -1): number {
  let half = 0;
  for (const q of parts) {
    if (q.role !== 'casing') continue;
    if ((q.box.s0 + q.box.s1) / 2 * face <= 0) continue;
    half = Math.max(half, Math.abs(q.box.t0), Math.abs(q.box.t1));
  }
  return half;
}

/** Face interna do batente: menor |t| das bordas internas das ombreiras externas do conjunto. */
function clearHalf(parts: ReadonlyArray<{ role: string; box: { t0: number; t1: number } }>, frame: number): number {
  let inner = Infinity;
  for (const q of parts) {
    if (q.role !== 'jamb') continue;
    const outer = Math.max(Math.abs(q.box.t0), Math.abs(q.box.t1));
    if (Math.abs(outer - frame) > EPS) continue;
    inner = Math.min(inner, Math.min(Math.abs(q.box.t0), Math.abs(q.box.t1)));
  }
  return Number.isFinite(inner) ? inner : frame;
}

/**
 * Meias-larguras da esquadria calculadas a partir do MODELO REAL (as mesmas peças que a planta e o 3D desenham).
 * `face` é o lado da parede (+1 = lado de `n`) onde a cota é desenhada e decide qual alizar conta.
 * Garantias: `0 < clear ≤ frame ≤ casing`.
 */
export function openingExtents(p: Project, opening: Opening, frame: WallFrame, face: 1 | -1): OpeningExtents {
  const key = `${opening.typeId}|${opening.flipFacing ? 1 : 0}|${opening.flipHand ? 1 : 0}|${frame.wall.id}|${frame.thickness}|${frame.sMid}|${face}`;
  let byKey = cache.get(p);
  if (!byKey) cache.set(p, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit) return hit;
  const model = buildOpeningModel(p, opening, openingGeometry(p, opening, frame), frame);
  const outer = model.width / 2;
  const clear = Math.max(Math.min(clearHalf(model.parts, outer), outer), Math.min(outer, 1e-3));
  const casing = Math.max(outer, casingHalf(model.parts, face));
  const out: OpeningExtents = { center: 0, clear, frame: outer, casing };
  byKey.set(key, out);
  return out;
}

/** Meia-largura (distância do centro à borda) da referência escolhida. */
export function openingEdge(ext: OpeningExtents, ref: OpeningDimRef): number {
  return ext[ref];
}
