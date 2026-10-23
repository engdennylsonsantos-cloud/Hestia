import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Project } from '@hestia/model';
import { junctionLevel } from './junctionLevel.ts';

/**
 * F5 · cache da junção por nível (decisão 0023 §9.2). Editar uma parede do pavimento de cima que não alcança o térreo não
 * recalcula a junção do térreo: `junctionLevel` devolve o mesmo objeto (acerto de cache, zero recálculo).
 */

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Térreo com parede e piso que se cruzam; pavimento 2 com uma parede no alto (cota 3,00 m, não alcança o térreo). */
function project(upperWallX: number): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3, baseOffset: -0.2 }) });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3) }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_1', a: { x: upperWallX, y: 0 }, b: { x: upperWallX + 3, y: 0 }, height: 3 }) });
  return s.project;
}

describe('F5 · cache da junção por nível (0023 §9.2)', () => {
  it('editar parede do pavimento de cima que não alcança o térreo não recalcula o térreo', () => {
    const before = junctionLevel(project(10), 'lv_0');
    const after = junctionLevel(project(20), 'lv_0');
    expect(after).toBe(before);
  });

  it('editar parede do próprio térreo recalcula a junção dele', () => {
    const before = junctionLevel(project(10), 'lv_0');
    const s = new ProjectStore(project(10));
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w3', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 3 }, b: { x: 4, y: 3 }, height: 3, baseOffset: -0.2 }) });
    const after = junctionLevel(s.project, 'lv_0');
    expect(after).not.toBe(before);
  });
});
