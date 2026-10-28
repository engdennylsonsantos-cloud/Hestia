import { dist, type Vec2 } from '@hestia/geom';
import { isCeiling, isFloor, isRoof, isSlab, type Id, type Project } from '@hestia/model';
import type { DimProvider, TempDim } from '../types.ts';

/** Piso, laje, telhado ou forro a cotar: comprimento de cada lado do contorno. */
export interface OutlineDimSubject {
  elementId: Id;
}

const PROVIDER_ID = 'outline';
const DIM_OFFSET = 0.2;
const EPS = 1e-9;

type Outlined = { kind: 'floor' | 'slab' | 'ceiling' | 'roof'; boundary: Vec2[] };

function outlineOf(project: Project, id: Id): Outlined | null {
  const e = project.elements[id];
  if (!e) return null;
  if (isFloor(e)) return { kind: 'floor', boundary: e.boundary };
  if (isSlab(e)) return { kind: 'slab', boundary: e.boundary };
  if (isCeiling(e)) return { kind: 'ceiling', boundary: e.boundary };
  if (isRoof(e)) return { kind: 'roof', boundary: e.boundary };
  return null;
}

const end = (at: Vec2, slot: string) => ({ at, slot, kind: 'wall' as const, current: 'axis' as const, options: ['axis'] as const });

/**
 * Cotas de leitura dos lados do contorno. A edição de um lado só entra quando `outlineEdit.ts` oferecer uma operação
 * pura de comprimento; até lá as cotas mostram a medida para orientar o desenho.
 */
export const outlineDimProvider: DimProvider<OutlineDimSubject> = {
  id: PROVIDER_ID,
  compute(ctx, subject) {
    const out = outlineOf(ctx.project, subject.elementId);
    if (!out) return [];
    const ring = out.boundary;
    const dims: TempDim[] = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const value = dist(a, b);
      if (value < EPS) continue;
      dims.push({
        key: `${PROVIDER_ID}:${subject.elementId}:edge${i}`,
        a,
        b,
        offset: DIM_OFFSET,
        value,
        ends: [end(a, `edge${i}A`), end(b, `edge${i}B`)],
      });
    }
    return dims;
  },
  selectionSubject(project, id) {
    return outlineOf(project, id) ? { elementId: id } : null;
  },
};
