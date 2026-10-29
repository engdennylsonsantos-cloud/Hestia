import { describe, expect, it } from 'vitest';
import { createEmptyProject, DEFAULT_GRID_TYPE_ID, dimensionSettingsOf, ProjectStore } from '@hestia/model';
import { gridDimProvider } from './grid.ts';
import type { DimContext } from '../types.ts';

function projectWithGrids(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const add = (id: string, a: { x: number; y: number }, b: { x: number; y: number }) =>
    s.exec({ type: 'addGrid', grid: { id, name: id, typeId: DEFAULT_GRID_TYPE_ID, points: [a, b], sag: 0, bubbleStart: false, bubbleEnd: true } });
  add('g1', { x: 0, y: 0 }, { x: 6, y: 0 });
  add('g2', { x: 0, y: 2 }, { x: 6, y: 2 });
  add('g3', { x: 0, y: -1.5 }, { x: 6, y: -1.5 });
  add('g4', { x: 0, y: 0 }, { x: 4, y: 4 });
  return s;
}

const ctxOf = (s: ProjectStore): DimContext => ({
  project: s.project,
  levelId: 'lv_0',
  settings: dimensionSettingsOf(s.project),
  overrides: {},
});

describe('provedor de cotas da grade', () => {
  it('mede a distância à paralela mais próxima de cada lado e ignora a não paralela', () => {
    const s = projectWithGrids();
    const dims = gridDimProvider.compute(ctxOf(s), { gridId: 'g1' });
    expect(dims).toHaveLength(2);
    expect(dims.find((d) => d.key.endsWith(':right'))!.value).toBeCloseTo(2, 9);
    expect(dims.find((d) => d.key.endsWith(':left'))!.value).toBeCloseTo(1.5, 9);
  });

  it('editar translada a grade inteira na normal', () => {
    const s = projectWithGrids();
    const dim = gridDimProvider.compute(ctxOf(s), { gridId: 'g1' }).find((d) => d.key.endsWith(':right'))!;
    const r = dim.edit!(3);
    expect('commands' in r && r.commands[0]).toMatchObject({ type: 'updateGrid', id: 'g1' });
    if (!('commands' in r)) return;
    const c = r.commands[0]!;
    if (c.type !== 'updateGrid') throw new Error('esperava updateGrid');
    expect(c.patch.points).toEqual([{ x: 0, y: 1 }, { x: 6, y: 1 }]);
    expect(dim.edit!(-1)).toEqual({ error: expect.stringContaining('maior que zero') });
  });

  it('seleciona a grade pelo id e ignora arco e id desconhecido', () => {
    const s = projectWithGrids();
    expect(gridDimProvider.selectionSubject!(s.project, 'g1')).toEqual({ gridId: 'g1' });
    expect(gridDimProvider.selectionSubject!(s.project, 'nada')).toBeNull();
    s.exec({ type: 'addGrid', grid: { id: 'ga', name: 'A', typeId: DEFAULT_GRID_TYPE_ID, points: [{ x: 0, y: 5 }, { x: 6, y: 5 }], sag: 1, bubbleStart: false, bubbleEnd: true } });
    expect(gridDimProvider.compute(ctxOf(s), { gridId: 'ga' })).toEqual([]);
  });
});
