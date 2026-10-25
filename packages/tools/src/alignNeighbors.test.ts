import { describe, expect, it } from 'vitest';
import { makeWall, type Wall } from '@hestia/model';
import { clickAt, drawWall, makeEnv, tool, walls } from './testEnv.ts';

/** Retângulo 4 × 3 com as quatro paredes pela ferramenta Parede (eixo). */
function box() {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  drawWall(ctx.env, [0, 0], [4, 0]);
  drawWall(ctx.env, [4, 0], [4, 3]);
  drawWall(ctx.env, [4, 3], [0, 3]);
  drawWall(ctx.env, [0, 3], [0, 0]);
  return { ...ctx, msgs };
}

const copia = (ws: Wall[]) => ws.map((w) => ({ id: w.id, a: { ...w.a }, b: { ...w.b } }));

describe('alinhar: paredes vizinhas não ficam com comprimento zero', () => {
  it('recusa alinhar a parede de cima à face da de baixo quando as laterais zerariam; nada muda', () => {
    const ctx = box();
    const antes = copia(walls(ctx.store));
    const t = tool('align', ctx.env);
    clickAt(t, 2, 0.1); // referência: face interna da parede de baixo
    clickAt(t, 2, 3.1); // parede de cima pela face externa: o eixo vai a y = 0 e as laterais zeram
    expect(ctx.msgs.at(-1)).toMatch(/^Alinhar deixaria a parede .+ com comprimento zero: nada foi alterado\.$/);
    expect(copia(walls(ctx.store))).toEqual(antes);
  });

  it('alinha quando nenhuma vizinha fica curta demais', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'h', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 2 }, b: { x: 6, y: 2 } }) });
    ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'm', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 5 }, b: { x: 6, y: 5 } }) });
    const t = tool('align', ctx.env);
    clickAt(t, 3, 2);
    clickAt(t, 3, 5);
    expect(walls(ctx.store)[1]!.a.y).toBeCloseTo(2);
  });
});
