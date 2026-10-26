import {
  applyTransform,
  dot,
  add,
  mul,
  sub,
  type SketchDraft,
  type SketchSeg,
  type Transform,
  type Vec2,
} from '@hestia/geom';
import { addSegs, removeSegs, type NewSeg } from './perimeterSession.ts';
import { MOD_TOL, curveOf, gap, stripId, withGeom, type Geom } from './perimeterModifyCurve.ts';
import { findSeg, replaceById } from './perimeterModifyDraft.ts';

/**
 * Geometria transformada. Espelho inverte o sentido do arco, então a flecha troca de sinal; translação e rotação
 * preservam o lado do arco.
 */
function transformGeom(s: SketchSeg, t: Transform): Geom {
  const flip = t.kind === 'mirror' ? -1 : 1;
  return { a: applyTransform(t, s.a), b: applyTransform(t, s.b), sag: s.sag ? flip * s.sag : undefined };
}

/** Aplica a transformação às linhas indicadas: move no lugar (mesmo id) ou cria cópias com ids novos. */
function transformSegs(d: SketchDraft, ids: string[], t: Transform, copy: boolean): SketchDraft | null {
  const want = new Set(ids);
  const sel = d.segs.filter((s) => want.has(s.id));
  if (sel.length === 0) return null;
  const moved = sel.map((s) => withGeom(s, transformGeom(s, t)));
  if (copy) return addSegs(d, moved.map(stripId));
  return replaceById(d, new Map<string, SketchSeg>(sel.map((s, i): [string, SketchSeg] => [s.id, moved[i]!])));
}

/**
 * Espelhar (Revit: Mirror). `axisA`→`axisB` é o eixo. Sem cópia, as linhas são refletidas no lugar (mesmo id);
 * com cópia, as originais ficam e as cópias ganham ids novos. Null se o eixo tem tamanho zero ou não há linhas.
 */
export function mirrorSegs(d: SketchDraft, ids: string[], axisA: Vec2, axisB: Vec2, copy: boolean): SketchDraft | null {
  if (gap(axisA, axisB) <= MOD_TOL) return null;
  return transformSegs(d, ids, { kind: 'mirror', a: axisA, b: axisB }, copy);
}

/**
 * Girar (Revit: Rotate) em torno de `center`, `angle` em radianos. Com `copy`, as originais ficam.
 * Null se o ângulo é zero ou não há linhas.
 */
export function rotateSegs(d: SketchDraft, ids: string[], center: Vec2, angle: number, copy: boolean): SketchDraft | null {
  if (Math.abs(angle) <= 1e-12) return null;
  return transformSegs(d, ids, { kind: 'rotate', about: center, angle }, copy);
}

/** Copiar (Revit: Copy): cópias deslocadas por `delta`; as originais ficam. Null se o deslocamento é zero. */
export function copySegs(d: SketchDraft, ids: string[], delta: Vec2): SketchDraft | null {
  if (gap(delta, { x: 0, y: 0 }) <= MOD_TOL) return null;
  return transformSegs(d, ids, { kind: 'translate', d: delta }, true);
}

/**
 * Matriz linear (Revit: Linear Array). `count` conta o original: `count` = 3 cria 2 cópias, em `delta` e `2·delta`.
 * Null se `count` < 2 ou o passo é zero.
 */
export function arraySegs(d: SketchDraft, ids: string[], delta: Vec2, count: number): SketchDraft | null {
  if (!Number.isInteger(count) || count < 2) return null;
  if (gap(delta, { x: 0, y: 0 }) <= MOD_TOL) return null;
  const want = new Set(ids);
  const sel = d.segs.filter((s) => want.has(s.id));
  if (sel.length === 0) return null;
  const copies: NewSeg[] = [];
  for (let k = 1; k < count; k++) {
    const step = mul(delta, k);
    for (const s of sel) {
      copies.push(stripId(withGeom(s, { a: add(s.a, step), b: add(s.b, step), sag: s.sag })));
    }
  }
  return addSegs(d, copies);
}

/**
 * Alinhar (Revit: Align) uma reta à linha de referência `refA`→`refB`: as duas pontas são projetadas sobre ela.
 * Só retas: arco não vira reta sem perder a forma. Null se o arco, a referência for nula ou a reta colapsar.
 */
export function alignSegToLine(d: SketchDraft, segId: string, refA: Vec2, refB: Vec2): SketchDraft | null {
  const S = findSeg(d, segId);
  if (!S || curveOf(S).arc || gap(refA, refB) <= MOD_TOL) return null;
  const u = sub(refB, refA);
  const uu = dot(u, u);
  const project = (p: Vec2): Vec2 => add(refA, mul(u, dot(sub(p, refA), u) / uu));
  const a = project(S.a);
  const b = project(S.b);
  if (gap(a, b) <= MOD_TOL) return null;
  return replaceById(d, new Map([[S.id, withGeom(S, { a, b })]]));
}

/** Excluir (Revit: Delete). Null se nenhum dos ids existe. A seleção perde os ids removidos. */
export function deleteSegs(d: SketchDraft, ids: string[]): SketchDraft | null {
  const known = ids.some((id) => findSeg(d, id) !== undefined);
  return known ? removeSegs(d, ids) : null;
}
