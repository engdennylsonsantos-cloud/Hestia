import { describe, expect, it } from 'vitest';
import { createEmptyProject, dimensionSettingsOf, makeWall, ProjectStore, type Opening } from '@hestia/model';
import { wallDimProvider } from './wall.ts';
import type { DimContext } from '../types.ts';

/** Projeto com a parede hospedeira (0,0)-(4,0), uma paralela em y=2 e uma porta na hospedeira. */
function cena(): { ctx: DimContext; hostId: string } {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'host', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'viz', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 2 }, b: { x: 4, y: 2 } }) });
  const door: Opening = { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'host', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: 'P1' };
  s.exec({ type: 'addOpening', opening: door });
  const p = s.project;
  return { ctx: { project: p, levelId: 'lv_0', settings: dimensionSettingsOf(p), overrides: {} }, hostId: 'host' };
}

describe('provedor de cotas da parede', () => {
  it('mede o comprimento e a distância até a paralela, entre faces acabadas', () => {
    const { ctx, hostId } = cena();
    const dims = wallDimProvider.compute(ctx, { wallId: hostId });
    expect(dims).toHaveLength(2);
    const comp = dims.find((d) => d.key.endsWith(':length'))!;
    expect(comp.value).toBeCloseTo(4, 9);
    const gap = dims.find((d) => d.key.endsWith(':right'))!;
    // Faces acabadas: 2 m entre eixos − 0,092 (face da hospedeira) − 0,092 (face da vizinha) = 1,816 m.
    expect(gap.value).toBeCloseTo(1.816, 9);
    expect(gap.ends.every((e) => e.kind === 'wall')).toBe(true);
  });

  it('editar o comprimento move a extremidade b e recusa quando a porta sairia da parede', () => {
    const { ctx, hostId } = cena();
    const comp = wallDimProvider.compute(ctx, { wallId: hostId }).find((d) => d.key.endsWith(':length'))!;
    const ok = comp.edit!(3);
    expect('commands' in ok && ok.commands[0]).toMatchObject({ type: 'setWallEnds', id: 'host' });
    expect('commands' in ok && ok.commands[0]).toMatchObject({ b: { x: 3, y: 0 } });
    const erro = comp.edit!(0.8);
    expect(erro).toEqual({ error: expect.stringContaining('sairia da parede') });
  });

  it('editar a distância translada a parede na normal (hospedados acompanham)', () => {
    const { ctx, hostId } = cena();
    const gap = wallDimProvider.compute(ctx, { wallId: hostId }).find((d) => d.key.endsWith(':right'))!;
    const r = gap.edit!(1.5);
    expect('commands' in r).toBe(true);
    if (!('commands' in r)) return;
    const t = r.commands[0]!;
    expect(t.type).toBe('transform');
    if (t.type !== 'transform' || t.transform.kind !== 'translate') throw new Error('esperava translação');
    expect(t.transform.d.x).toBeCloseTo(0, 9);
    expect(t.transform.d.y).toBeCloseTo(-0.316, 9);
  });

  it('seleciona só parede e aceita a referência da sessão', () => {
    const { ctx, hostId } = cena();
    expect(wallDimProvider.selectionSubject!(ctx.project, hostId)).toEqual({ wallId: hostId });
    expect(wallDimProvider.selectionSubject!(ctx.project, 'd')).toBeNull();
    const eixo = wallDimProvider.compute({ ...ctx, overrides: { 'wall:wall': 'axis' } }, { wallId: hostId });
    expect(eixo.find((d) => d.key.endsWith(':right'))!.value).toBeCloseTo(2, 9);
  });
});
