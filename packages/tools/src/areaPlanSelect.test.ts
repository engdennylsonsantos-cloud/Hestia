import { describe, expect, it } from 'vitest';
import { makeWall } from '@hestia/model';
import { makeEnv, P, tool, walls } from './testEnv.ts';
import type { SelectTool } from './selectTool.ts';

/**
 * Regra das alças da planta de área (A1): a vista bloqueia as FERRAMENTAS de modelo (`AREA_PLAN_TOOLS`), mas o
 * `select` continua movendo o que está selecionado. Como o transform pelo select é permitido, a sobreposição
 * compartilhada mantém as alças e os fantasmas de mover — o feedback acompanha o que o select faz de fato.
 */
describe('planta de área · o que o select permite', () => {
  it('arrastar uma parede selecionada move o modelo (por isso as alças são coerentes)', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    ctx.env.setSelection(['w1']);
    ctx.setAreaPlanId('ap1');
    const s = tool('select', ctx.env) as SelectTool;
    s.down(P(2, 0));
    s.drag(P(3, 0));
    s.up(P(3, 0));
    expect(walls(ctx.store)[0]!.a).toEqual({ x: 1, y: 0 });
    expect(walls(ctx.store)[0]!.b).toEqual({ x: 5, y: 0 });
  });

  it('arrastar no vazio continua sendo janela de seleção (não move nada)', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    ctx.setAreaPlanId('ap1');
    const s = tool('select', ctx.env) as SelectTool;
    s.down(P(-1, -1));
    s.drag(P(5, 1));
    s.up(P(5, 1));
    expect(ctx.sel()).toEqual(['w1']);
    expect(walls(ctx.store)[0]!.a).toEqual({ x: 0, y: 0 });
  });
});
