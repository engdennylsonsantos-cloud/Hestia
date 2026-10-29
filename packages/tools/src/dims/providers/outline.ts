import { dist, type Vec2 } from '@hestia/geom';
import { isCeiling, isFloor, isRoof, isSlab, type Id, type Project } from '@hestia/model';
import { segFrame, segPoint, segmentGaps } from '../parallel.ts';
import type { DimProvider, TempDim } from '../types.ts';

/** Piso, laje, telhado ou forro a cotar: distância entre cada lado do contorno e o lado paralelo mais próximo. */
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

/** Cotas entre lados paralelos do contorno: cada lado até o lado paralelo mais próximo (cada par aparece uma vez). */
function parallelSideDims(elementId: Id, ring: readonly Vec2[]): TempDim[] {
  const dims: TempDim[] = [];
  const seen = new Set<string>();
  const edges = ring.map((a, i) => ({ id: String(i), a, b: ring[(i + 1) % ring.length]! }));
  for (const e of edges) {
    const f = segFrame(e.a, e.b);
    if (!f) continue;
    const others = edges.filter((o) => o.id !== e.id);
    for (const gap of segmentGaps(f, others)) {
      const pair = [Number(e.id), Number(gap.id)].sort((x, y) => x - y).join('-');
      if (seen.has(pair)) continue;
      seen.add(pair);
      const a = segPoint(f, gap.t, 0);
      const b = segPoint(f, gap.t, gap.s);
      dims.push({
        key: `${PROVIDER_ID}:${elementId}:sides${pair}`,
        a,
        b,
        offset: DIM_OFFSET,
        value: gap.distance,
        ends: [end(a, `sides${pair}A`), end(b, `sides${pair}B`)],
      });
    }
  }
  return dims;
}

/** Comprimento de cada lado: usado só quando o contorno não tem nenhum par de lados paralelos. */
function sideLengthDims(elementId: Id, ring: readonly Vec2[]): TempDim[] {
  const dims: TempDim[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const value = dist(a, b);
    if (value < EPS) continue;
    dims.push({ key: `${PROVIDER_ID}:${elementId}:edge${i}`, a, b, offset: DIM_OFFSET, value, ends: [end(a, `edge${i}A`), end(b, `edge${i}B`)] });
  }
  return dims;
}

/**
 * Cotas de leitura do contorno: a distância perpendicular de cada lado até o lado paralelo mais próximo (um retângulo
 * mostra largura e profundidade). Sem nenhum par paralelo (triângulo), mostra o comprimento dos lados. A edição de um
 * lado só entra quando `outlineEdit.ts` oferecer uma operação pura (contorno travado, forro vinculado).
 */
export const outlineDimProvider: DimProvider<OutlineDimSubject> = {
  id: PROVIDER_ID,
  compute(ctx, subject) {
    const out = outlineOf(ctx.project, subject.elementId);
    if (!out) return [];
    const sides = parallelSideDims(subject.elementId, out.boundary);
    return sides.length > 0 ? sides : sideLengthDims(subject.elementId, out.boundary);
  },
  selectionSubject(project, id) {
    return outlineOf(project, id) ? { elementId: id } : null;
  },
};
