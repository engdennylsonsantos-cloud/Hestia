import { closestOnSegment, dist, v2, type Vec2 } from '@hestia/geom';
import type { Id } from '@hestia/model';
import type { InferContext } from './infer.ts';
import type { Guide, SnapKind, SnapOptions } from './types.ts';

/** Assinatura do registrador de candidatos do motor de captura. */
export type AddCandidate = (point: Vec2, kind: SnapKind, guides?: Guide[], hostId?: Id, weight?: number) => void;

/**
 * Pontos extras (vértices de pisos, contorno em construção, aberturas) fora do modo só-paredes. O tipo vem do ponto
 * (`kind`): canto é extremidade, centro é centro e face segue as capturas de face.
 */
export function addExtraPoints(ctx: InferContext, sn: SnapOptions, cursor: Vec2, tol: number, add: AddCandidate): void {
  if (ctx.onWallsOnly) return;
  for (const q of ctx.extraPoints ?? []) {
    if (q.hostId !== undefined && ctx.ignore?.has(q.hostId)) continue;
    const kind = q.kind ?? 'endpoint';
    if ((kind === 'endpoint' && sn.endpoint === false) || (kind === 'center' && sn.midpoint === false) || (kind === 'face' && !sn.faces)) continue;
    if (dist(cursor, q) <= tol) add(v2(q.x, q.y), kind, [], q.hostId);
  }
}

/**
 * Arestas extras (contornos de pisos e lajes, ombreiras de aberturas): o pé da perpendicular e o ponto mais próximo.
 * As ombreiras (`kind: 'face'`) também dão o pé da perpendicular a partir do ponto anterior.
 */
export function addExtraSegments(ctx: InferContext, sn: SnapOptions, cursor: Vec2, tol: number, add: AddCandidate): void {
  if (!sn.faces) return;
  for (const e of ctx.extraSegments ?? []) {
    if (e.hostId !== undefined && ctx.ignore?.has(e.hostId)) continue;
    if (dist(e.a, e.b) < 1e-9) continue;
    const kind = e.kind ?? 'nearest';
    const foot = closestOnSegment(cursor, e.a, e.b);
    if (dist(cursor, foot) <= tol) add(foot, kind, [], e.hostId);
    if (kind === 'face' && sn.perpendicular && ctx.from) {
      const pf = closestOnSegment(ctx.from, e.a, e.b);
      if (dist(cursor, pf) <= tol && dist(pf, ctx.from) > 1e-6) add(pf, 'perpendicular', [{ from: ctx.from, to: pf, kind: 'perpendicular' }], e.hostId);
    }
  }
}

/** Ombreiras viram trechos de alinhamento (a linha atravessa a espessura da parede), somando as pontas às referências. */
export function addExtraTracks(ctx: InferContext, tracks: Array<{ a: Vec2; b: Vec2 }>, refs: Vec2[]): void {
  for (const e of ctx.extraSegments ?? []) {
    if (e.kind !== 'face') continue;
    if (e.hostId !== undefined && ctx.ignore?.has(e.hostId)) continue;
    if (dist(e.a, e.b) < 1e-9) continue;
    tracks.push({ a: e.a, b: e.b });
    refs.push(e.a, e.b);
  }
}
