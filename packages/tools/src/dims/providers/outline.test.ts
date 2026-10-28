import { describe, expect, it } from 'vitest';
import { createEmptyProject, dimensionSettingsOf, makeFloor, makeWall, ProjectStore } from '@hestia/model';
import { outlineDimProvider } from './outline.ts';
import type { DimContext } from '../types.ts';

function cena() {
  const s = new ProjectStore(createEmptyProject());
  const boundary = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_ceram', levelId: 'lv_0', boundary }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  const p = s.project;
  return { ctx: { project: p, levelId: 'lv_0', settings: dimensionSettingsOf(p), overrides: {} } as DimContext };
}

describe('provedor de cotas do contorno (piso/laje/forro/telhado)', () => {
  it('cota cada lado do contorno, só leitura, e seleciona só os elementos com contorno', () => {
    const { ctx } = cena();
    const dims = outlineDimProvider.compute(ctx, { elementId: 'f' });
    expect(dims.map((d) => d.value)).toEqual([4, 3, 4, 3]);
    expect(dims.every((d) => d.edit === undefined)).toBe(true);
    expect(outlineDimProvider.selectionSubject!(ctx.project, 'f')).toEqual({ elementId: 'f' });
    expect(outlineDimProvider.selectionSubject!(ctx.project, 'w')).toBeNull();
  });
});
