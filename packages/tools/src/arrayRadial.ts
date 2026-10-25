import { applyTransform, mul, type Transform, type Vec2 } from '@hestia/geom';
import { isCeiling, newId, type Id, type Project } from '@hestia/model';
import { copyWalls, ghostBands, ghostViews, selectedMovables, selectedViews, transformViews } from './edit.ts';
import type { ArrayAnchor, PreviewItem, ToolEnv } from './types.ts';

/** Elementos da seleção que a Matriz copia: paredes, pisos, lajes, telhados, escadas e ambientes; vistas; e forros. */
export interface ArraySet {
  els: Id[];
  views: Id[];
  ceil: Id[];
}

export function arraySet(p: Project, ids: Id[]): ArraySet {
  return {
    els: selectedMovables(p, ids),
    views: selectedViews(p, ids),
    ceil: ids.filter((id) => isCeiling(p.elements[id])),
  };
}

/** Ângulo (rad) de cada item da matriz radial, contado do original (item 0 em 0). */
export function radialAngles(n: number, angleDeg: number, anchor: ArrayAnchor): number[] {
  const total = (angleDeg * Math.PI) / 180;
  // Último: o total vai do 1º ao último item. Num círculo fechado (360°) o último cairia sobre o primeiro,
  // então o total se divide pelos N itens (como no Revit); num arco aberto, pelos N-1 intervalos.
  const fechado = Math.abs(Math.abs(angleDeg) - 360) < 1e-9;
  const passo = anchor === 'second' ? total : total / (fechado ? n : n - 1);
  return Array.from({ length: n }, (_, i) => i * passo);
}

/** Vetor de um passo da matriz linear: com Segundo é o próprio vetor digitado; com Último, o total dividido por N-1. */
export function linearStep(total: Vec2, n: number, anchor: ArrayAnchor): Vec2 {
  return anchor === 'last' ? mul(total, 1 / (n - 1)) : total;
}

/** Vem da planta em metros: vírgula decimal, como no resto da barra de status. */
export const fmtXY = (p: Vec2): string => `${p.x.toFixed(2).replace('.', ',')}; ${p.y.toFixed(2).replace('.', ',')}`;

/** Transformações de rotação de cada cópia (o original, item 0, não entra). */
const rotations = (center: Vec2, angles: number[]): Transform[] => angles.slice(1).map((angle) => ({ kind: 'rotate', about: center, angle }));

/** Fantasmas de todas as cópias radiais: paredes, vistas e forros (contorno tracejado). */
export function radialGhosts(env: ToolEnv, set: ArraySet, center: Vec2, angles: number[]): PreviewItem[] {
  const p = env.project();
  const out: PreviewItem[] = [];
  for (const t of rotations(center, angles)) {
    out.push(...ghostBands(p, set.els, t), ...ghostViews(p, env.selection(), t));
    for (const id of set.ceil) {
      const c = p.elements[id];
      if (isCeiling(c)) out.push({ kind: 'polygon', ring: c.boundary.map((q) => applyTransform(t, q)), dashed: true });
    }
  }
  return out;
}

/** Copia a seleção em cada ângulo da matriz radial num único passo de desfazer (o item 0 é o original). */
export function commitRadial(env: ToolEnv, set: ArraySet, center: Vec2, angles: number[]): void {
  env.transaction('Matriz radial', () => {
    for (const t of rotations(center, angles)) {
      if (set.els.length) copyWalls(env, set.els, t);
      if (set.views.length) transformViews(env, set.views, t, true);
      if (set.ceil.length) copyCeilings(env, set.ceil, t);
    }
  });
}

/** Copia forros com ids novos; o `transform` com `copy` cuida do resto (o forro que acompanha o ambiente mantém o vínculo). */
function copyCeilings(env: ToolEnv, ids: Id[], t: Transform): void {
  const idMap: Record<Id, Id> = {};
  for (const id of ids) idMap[id] = newId('cl');
  env.exec({ type: 'transform', ids, transform: t, copy: { idMap } });
}
