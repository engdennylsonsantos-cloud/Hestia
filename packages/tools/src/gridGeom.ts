import { add, arcFromSagitta, arcPointAt, arcSample, dist, len, sagFromThreePoints, sub, type Vec2 } from '@hestia/geom';
import { gridOf, nextGridName, projectGrids, newId, type Grid, type Id, type Project } from '@hestia/model';
import type { PreviewItem, ToolEnv } from './types.ts';

/** Linha poligonal que desenha o eixo da grade: os pontos, ou o arco amostrado quando `sag` ≠ 0. */
export function gridPath(g: Pick<Grid, 'points' | 'sag'>): Vec2[] {
  if (g.points.length === 2 && g.sag !== 0) {
    const arc = arcFromSagitta(g.points[0]!, g.points[1]!, g.sag);
    if (arc) return arcSample(arc, 0, arc.length);
  }
  return g.points;
}

/** Ponto do meio do arco (alça da flecha); para grade reta, o meio da corda. */
export function gridMid(g: Pick<Grid, 'points' | 'sag'>): Vec2 {
  const a = g.points[0]!;
  const b = g.points[g.points.length - 1]!;
  const arc = g.points.length === 2 ? arcFromSagitta(a, b, g.sag) : null;
  return arc ? arcPointAt(arc, arc.length / 2) : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distToSegment(q: Vec2, a: Vec2, b: Vec2): number {
  const d = sub(b, a);
  const l2 = d.x * d.x + d.y * d.y;
  const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * d.x + (q.y - a.y) * d.y) / l2));
  return dist(q, { x: a.x + d.x * t, y: a.y + d.y * t });
}

/** Distância do ponto ao eixo da grade. */
export function distToGrid(g: Pick<Grid, 'points' | 'sag'>, q: Vec2): number {
  const path = gridPath(g);
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, distToSegment(q, path[i - 1]!, path[i]!));
  return best;
}

/** Grade sob o cursor (a mais próxima dentro de 5 px), ou null. Grades valem em todos os níveis. */
export function pickGridAt(p: Project, at: Vec2, mpp: number): Id | null {
  const tol = 5 * mpp;
  let best: { id: Id; d: number } | null = null;
  for (const g of projectGrids(p)) {
    const d = distToGrid(g, at);
    if (d <= tol && (!best || d < best.d)) best = { id: g.id, d };
  }
  return best ? best.id : null;
}

/** Ids das grades dentro da seleção. */
export function selectedGrids(p: Project, ids: Id[]): Id[] {
  return projectGrids(p).filter((g) => ids.includes(g.id)).map((g) => g.id);
}

/** Grades com algum ponto dentro da janela. */
export function gridIdsInBox(p: Project, a: Vec2, b: Vec2): Id[] {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  return projectGrids(p).filter((g) => g.points.some((q) => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1)).map((g) => g.id);
}

/** Flecha limitada à metade da corda (arco de até 180°), mantendo o sinal. */
export const clampSag = (a: Vec2, b: Vec2, sag: number): number => Math.sign(sag) * Math.min(Math.abs(sag), len(sub(b, a)) / 2);

/** Flecha do arco a–b que passa por `m`, já limitada. */
export const sagThrough = (a: Vec2, m: Vec2, b: Vec2): number => clampSag(a, b, sagFromThreePoints(a, m, b));

/** Alça de grade: um vértice (`index`) ou o meio do arco (`mid`, muda a flecha). */
export interface GridGrip {
  id: Id;
  kind: 'vertex' | 'mid';
  index: number;
  at: Vec2;
}

/** Alças de uma grade: pontas e vértices; em arco, também o meio. */
export function gridGrips(g: Grid): GridGrip[] {
  const out: GridGrip[] = g.points.map((at, index) => ({ id: g.id, kind: 'vertex', index, at }));
  if (g.points.length === 2 && g.sag !== 0) out.push({ id: g.id, kind: 'mid', index: -1, at: gridMid(g) });
  return out;
}

/** Alça sob o cursor entre as grades selecionadas (a mais próxima, tolerância 9 px). */
export function gridGripAt(p: Project, ids: Id[], at: Vec2, mpp: number): GridGrip | null {
  const tol = 9 * mpp;
  let best: { g: GridGrip; d: number } | null = null;
  for (const gr of projectGrids(p)) {
    if (!ids.includes(gr.id)) continue;
    for (const grip of gridGrips(gr)) {
      const d = dist(grip.at, at);
      if (d <= tol && (!best || d < best.d)) best = { g: grip, d };
    }
  }
  return best ? best.g : null;
}

/** Grade com a alça levada a `to`. Arco: a ponta que se move leva a flecha junto (limitada à nova corda). */
export function gridWithGrip(g: Grid, grip: GridGrip, to: Vec2): Pick<Grid, 'points' | 'sag'> {
  if (grip.kind === 'mid') return { points: g.points, sag: sagThrough(g.points[0]!, to, g.points[1]!) };
  const points = g.points.map((q, i) => (i === grip.index ? to : q));
  const sag = points.length === 2 && g.sag !== 0 ? clampSag(points[0]!, points[1]!, g.sag) : g.sag;
  return { points, sag };
}

/** Prévia (tracejada) do eixo de uma grade. */
export function gridPreviewItems(g: Pick<Grid, 'points' | 'sag'>, dashed = true): PreviewItem[] {
  const path = gridPath(g);
  const out: PreviewItem[] = [];
  for (let i = 1; i < path.length; i++) out.push({ kind: 'line', a: path[i - 1]!, b: path[i]!, dashed });
  return out;
}

/** Alças das grades selecionadas, para desenhar. */
export function gridHandlePreview(p: Project, sel: Id[]): PreviewItem[] {
  return projectGrids(p).filter((g) => sel.includes(g.id)).flatMap((g) => gridGrips(g).map((x): PreviewItem => ({ kind: 'point', at: x.at })));
}

/** Move (ou copia, com nome automático novo) as grades `ids` por `d`. Chamar dentro de uma transação. */
export function moveGrids(env: Pick<ToolEnv, 'project' | 'exec'>, ids: Id[], d: Vec2, copy: boolean): void {
  for (const id of ids) {
    const g = gridOf(env.project(), id);
    if (!g) continue;
    const points = g.points.map((q) => add(q, d));
    if (copy) {
      const { order: _order, ...rest } = g;
      env.exec({ type: 'addGrid', grid: { ...rest, id: newId('grid'), name: nextGridName(env.project()), points } });
    } else env.exec({ type: 'updateGrid', id, patch: { points } });
  }
}
