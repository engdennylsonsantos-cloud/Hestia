import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Project, type Wall } from '@hestia/model';
import { computeSection } from './section.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Parede de 4 m de (0,0) a (4,0), altura 3 m; piso cobre só x de 0 a 2 (face superior em +0,05). */
function project(): Project {
  const s = new ProjectStore(createEmptyProject());
  const wall: Wall = { ...makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3, attachBottomToFloor: true }), order: 0 };
  s.exec({ type: 'addWall', wall });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(-1, -1, 2, 1), heightOffset: 0.05 }) });
  return s.project;
}

/** Menor cota (z) do corte da parede w1 numa linha de corte (perpendicular ao eixo, no x dado). */
function minZDaParede(x: number): number {
  const r = computeSection(project(), { a: { x, y: -2 }, b: { x, y: 2 }, depth: 3 });
  const zs = r.cut.filter((c) => c.sources.some((s) => s.wallId === 'w1')).flatMap((c) => c.polygons.flat(2).map((q) => q.y));
  return Math.min(...zs);
}

describe('P9 · corte da parede com a base em degrau (decisão 0023 §6)', () => {
  it('no trecho coberto (x = 1) a parede corta a partir de 0,05 m; fora do piso (x = 3), a partir de 0 m', () => {
    expect(minZDaParede(1)).toBeCloseTo(0.05, 6);
    expect(minZDaParede(3)).toBeCloseTo(0, 6);
  });
});
