import { describe, expect, it } from 'vitest';
import { makeFloor, type Wall } from '@hestia/model';
import { clickAt, drawWall, makeEnv, tool, walls } from './testEnv.ts';

/**
 * Espelhar pegando uma parede como eixo, com um piso encostado na mesma linha do eixo (y = 2): o clique tem de
 * escolher a parede, não o piso.
 */
describe('espelhar: eixo na borda de um piso', () => {
  it('Tab + clique na parede escolhe a parede mesmo com piso na mesma linha', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]); // selecionada
    drawWall(ctx.env, [-1, 2], [5, 2]); // eixo
    ctx.store.exec({
      type: 'addFloor',
      floor: makeFloor({ id: 'f_borda', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 0, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 0, y: 3 }] }),
    });
    ctx.env.setSelection([walls(ctx.store)[0]!.id]);
    const m = tool('mirror', ctx.env);
    m.tab();
    clickAt(m, 1, 2);
    const a = walls(ctx.store)[0] as Wall;
    expect(a.a.y).toBeCloseTo(4);
    expect(a.b.y).toBeCloseTo(4);
  });
});
