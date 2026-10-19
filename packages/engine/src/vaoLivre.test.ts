import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type Opening } from '@hestia/model';
import { resolveLevel } from './resolve.ts';

/** Área cortada em todas as camadas de todas as paredes do nível (planta). */
const cutArea = (opening: Partial<Opening> | null, typeId: string): number => {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  if (opening) {
    s.exec({ type: 'addOpening', opening: { id: 'o', kind: 'door', typeId, hostId: 'w', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '', ...opening } });
  }
  const r = resolveLevel(s.project, 'lv_0', new Map());
  return r.walls.w!.layers.reduce((sum, l) => sum + multiArea(l.cut), 0);
};

describe('vão livre no motor', () => {
  it('recorta as camadas como uma porta de mesma medida', () => {
    const semVao = cutArea(null, 'ot_p90');
    const vaoLivre = cutArea({}, 'ot_vao90');
    const porta = cutArea({}, 'ot_p90');
    expect(vaoLivre).toBeLessThan(semVao);
    expect(vaoLivre).toBeCloseTo(porta, 9);
  });
});
