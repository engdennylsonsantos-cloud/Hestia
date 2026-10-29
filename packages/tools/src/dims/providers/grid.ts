import { add, dot, len, mul, norm, perp, sub, type Vec2 } from '@hestia/geom';
import { gridOf, projectGrids, type Grid, type Id, type Project } from '@hestia/model';
import type { DimContext, DimEditResult, DimEnd, DimProvider, TempDim } from '../types.ts';

/** Grade/eixo a cotar: distância às grades paralelas vizinhas. */
export interface GridDimSubject {
  gridId: Id;
}

const PROVIDER_ID = 'grid';
const DIM_OFFSET = 0.25;
const EPS = 1e-6;
const PARALLEL_TOL = 0.999;

/** Eixo reto de uma grade: início, direção e normal. Grades em arco ficam sem cota (a corda não é o eixo). */
interface Axis {
  start: Vec2;
  u: Vec2;
  n: Vec2;
  length: number;
}

function axisOf(g: Grid): Axis | null {
  if (g.sag !== 0 || g.points.length < 2) return null;
  const a = g.points[0]!;
  const b = g.points[g.points.length - 1]!;
  const d = sub(b, a);
  const length = len(d);
  if (length < EPS) return null;
  const u = norm(d);
  return { start: a, u, n: perp(u), length };
}

const end = (at: Vec2, slot: string): DimEnd => ({ at, slot, kind: 'wall', current: 'axis', options: ['axis'] });

interface GridGap {
  side: 1 | -1;
  /** Distância assinada ao longo da normal da grade selecionada. */
  signed: number;
  distance: number;
  /** Ponto da grade selecionada onde a cota é desenhada. */
  at: Vec2;
}

/** Grades paralelas vizinhas, a mais próxima de cada lado. */
function nearestParallel(ctx: DimContext, host: Axis, hostId: Id): GridGap[] {
  let left: GridGap | null = null;
  let right: GridGap | null = null;
  for (const other of projectGrids(ctx.project)) {
    if (other.id === hostId) continue;
    const axis = axisOf(other);
    if (!axis || Math.abs(dot(host.u, axis.u)) < PARALLEL_TOL) continue;
    const mid = mul(add(other.points[0]!, other.points[other.points.length - 1]!), 0.5);
    const rel = sub(mid, host.start);
    const signed = dot(rel, host.n);
    const distance = Math.abs(signed);
    if (distance < EPS) continue;
    const t = Math.max(0, Math.min(host.length, dot(rel, host.u)));
    const at = add(host.start, mul(host.u, t));
    const gap: GridGap = { side: signed > 0 ? 1 : -1, signed, distance, at };
    if (gap.side > 0) {
      if (!right || distance < right.distance) right = gap;
    } else if (!left || distance < left.distance) left = gap;
  }
  return [left, right].filter((g): g is GridGap => g !== null);
}

function gapDim(grid: Grid, host: Axis, gap: GridGap): TempDim {
  const a = gap.at;
  const b = add(a, mul(host.n, gap.signed));
  const slot = gap.side > 0 ? 'right' : 'left';
  const edit = (value: number): DimEditResult => {
    if (!(value > 0)) return { error: 'Digite uma distância maior que zero.' };
    const delta = gap.side * value - gap.signed;
    const d = mul(host.n, delta);
    const points = grid.points.map((q) => add(q, d));
    return { commands: [{ type: 'updateGrid', id: grid.id, patch: { points } }] };
  };
  return {
    key: `${PROVIDER_ID}:${grid.id}:${slot}`,
    a,
    b,
    offset: DIM_OFFSET * gap.side,
    value: gap.distance,
    ends: [end(a, `${slot}A`), end(b, `${slot}B`)],
    edit,
  };
}

/** Distância da grade selecionada até a paralela vizinha de cada lado; editar translada a grade na normal. */
export const gridDimProvider: DimProvider<GridDimSubject> = {
  id: PROVIDER_ID,
  compute(ctx, subject) {
    const grid = gridOf(ctx.project, subject.gridId);
    const host = grid ? axisOf(grid) : null;
    if (!grid || !host) return [];
    return nearestParallel(ctx, host, grid.id).map((gap) => gapDim(grid, host, gap));
  },
  selectionSubject(project: Project, id) {
    return project.grids?.some((g) => g.id === id) ? { gridId: id } : null;
  },
};
