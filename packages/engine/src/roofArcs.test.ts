import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof, type Project, type Roof } from '@hestia/model';
import { expandRoofArcs, quantifyRoofs, resolveRoofs } from './index.ts';

const R: Vec2[] = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 6 },
  { x: 0, y: 6 },
];
const planArea = (r: ReturnType<typeof resolveRoofs>[number]): number => r.planes.reduce((s, p) => s + multiArea(p.polygon), 0);

function build(extra: Partial<Roof>): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: R, shape: 'hip', slopePercent: 30, ...extra }) });
  return s.project;
}

describe('arco real no telhado', () => {
  it('sem edgeSag devolve o mesmo telhado e o resultado não muda', () => {
    const r = { ...makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: R, shape: 'hip', slopePercent: 30 }), order: 0 };
    expect(expandRoofArcs(r)).toBe(r);
    const zero = build({ edgeSag: [0, 0, 0, 0] });
    expect(resolveRoofs(zero, 'lv_0')[0]!.planes).toEqual(resolveRoofs(build({}), 'lv_0')[0]!.planes);
  });

  it('divide a aresta em trechos de até 7,5° copiando inclinação e balanço', () => {
    const r = { ...makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: R, shape: 'edges', edgeSlopes: [30, 30, 30, null], edgeOverhangs: [0.1, 0.2, 0.3, 0.4], edgeSag: [1.5, 0, 0, 0] }), order: 0 };
    const e = expandRoofArcs(r);
    expect(e.boundary.length).toBeGreaterThan(8);
    const k = e.boundary.length - 3;
    expect(e.edgeSlopes.slice(0, k).every((s) => s === 30)).toBe(true);
    expect(e.edgeOverhangs.slice(0, k).every((s) => s === 0.1)).toBe(true);
    expect(e.edgeSlopes.length).toBe(e.boundary.length);
    expect(e.edgeSag).toBeUndefined();
    expect(r.boundary.length).toBe(4);
  });

  it('quadrado com uma aresta em arco tem mais área em planta e águas coerentes', () => {
    const reto = resolveRoofs(build({}), 'lv_0')[0]!;
    const proj = build({ edgeSag: [-1, 0, 0, 0] });
    const arco = resolveRoofs(proj, 'lv_0')[0]!;
    expect(arco.problem).toBeUndefined();
    // Flecha negativa abaula para a direita da aresta 0→1 (y = 0), isto é, para fora (contorno anti-horário).
    expect(planArea(arco)).toBeGreaterThan(planArea(reto) + 4);
    expect(arco.planes.length).toBeGreaterThan(reto.planes.length);
    expect(arco.lines.some((l) => l.kind === 'ridge' || l.kind === 'hip')).toBe(true);
    const q = quantifyRoofs(proj, 'lv_0').roofs[0]!;
    expect(q.planArea).toBeGreaterThan(48 + 4);
    expect(q.perimeter).toBeGreaterThan(28);
    expect(q.slopedEdges).toBe(4);
  });
});
