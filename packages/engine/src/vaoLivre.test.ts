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
  it('recorta as camadas e mantém o retorno da parede, ao contrário da porta com batente', () => {
    const semVao = cutArea(null, 'ot_p90');
    const vaoLivre = cutArea({}, 'ot_vao90');
    const porta = cutArea({}, 'ot_p90');
    expect(vaoLivre).toBeLessThan(semVao);
    expect(porta).toBeLessThan(semVao);
    // O vão livre (leaves = 0) herda o fechamento da parede; a porta com batente encosta o acabamento (sem retorno).
    expect(vaoLivre).toBeGreaterThan(porta);
  });
});
