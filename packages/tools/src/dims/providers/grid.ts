import { add, arcFromSagitta, dist, dot, mul, sub, type Vec2 } from '@hestia/geom';
import { gridOf, projectGrids, type Grid, type Id, type Project } from '@hestia/model';
import { NON_POSITIVE_MSG, gapTranslation, nearestParallelGaps, segFrame, segPoint, PARALLEL_TOL, type LocalPlane, type ParallelGap, type SegFrame } from '../parallel.ts';
import type { DimContext, DimEditResult, DimEnd, DimProvider, TempDim } from '../types.ts';

/** Grade/eixo a cotar: distância às grades paralelas vizinhas. */
export interface GridDimSubject {
  gridId: Id;
}

const PROVIDER_ID = 'grid';
const DIM_OFFSET = 0.25;

/** Quadro do eixo reto de uma grade. Grades em arco ficam sem cota (a corda não é o eixo). */
function axisOf(g: Grid): SegFrame | null {
  if (g.sag !== 0 || g.points.length < 2) return null;
  return segFrame(g.points[0]!, g.points[g.points.length - 1]!);
}

const end = (at: Vec2, slot: string): DimEnd => ({ at, slot, kind: 'wall', current: 'axis', options: ['axis'] });

/**
 * Comprimento do eixo em desenho (prévia da ferramenta): a corda ou o arco, quando há flecha. Usa o mesmo sistema
 * único de cotas das demais ferramentas, em vez de um rótulo solto na prévia.
 */
export function gridPreviewDim(a: Vec2, b: Vec2, sag = 0): TempDim {
  const arc = sag ? arcFromSagitta(a, b, sag) : null;
  return {
    key: `${PROVIDER_ID}:draft:length`,
    a,
    b,
    offset: DIM_OFFSET,
    value: arc ? arc.length : dist(a, b),
    ends: [end(a, 'draftA'), end(b, 'draftB')],
  };
}

/** Grades paralelas vizinhas, a mais próxima de cada lado (retas ilimitadas: não exigem sobreposição). */
function nearestParallel(ctx: DimContext, host: SegFrame, hostId: Id): ParallelGap[] {
  const planes: LocalPlane[] = [];
  for (const other of projectGrids(ctx.project)) {
    if (other.id === hostId) continue;
    const axis = axisOf(other);
    if (!axis || Math.abs(dot(host.u, axis.u)) < PARALLEL_TOL) continue;
    const mid = mul(add(other.points[0]!, other.points[other.points.length - 1]!), 0.5);
    planes.push({ id: other.id, s: dot(sub(mid, host.origin), host.n), t0: -Infinity, t1: Infinity });
  }
  return nearestParallelGaps(() => 0, 0, host.length, planes);
}

function gapDim(grid: Grid, host: SegFrame, gap: ParallelGap): TempDim {
  const a = segPoint(host, gap.t, 0);
  const b = segPoint(host, gap.t, gap.s);
  const slot = gap.side > 0 ? 'right' : 'left';
  const edit = (value: number): DimEditResult => {
    if (!(value > 0)) return { error: NON_POSITIVE_MSG };
    const d = gapTranslation(host.n, gap, value);
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
