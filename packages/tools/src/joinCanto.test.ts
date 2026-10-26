import { describe, expect, it } from 'vitest';
import { wallsOnLevel, type Wall } from '@hestia/model';
import { joinStatus, levelFrames } from '@hestia/engine';
import { drawWall, makeEnv, P, tool } from './testEnv.ts';
import { DEFAULT_SNAP } from './types.ts';

/**
 * Canto desenhado pela face (J-01): a ponta cai sobre a tampa da outra parede, meia espessura para fora do eixo.
 * Antes, virava T nas duas pontas; agora é canto (par) com a parede vizinha.
 */
describe('canto pela face (J-01)', () => {
  // wt_alv14: espessura 0,184 m, meia espessura 0,092 m. Parede A ao longo de x, de (0;0) a (4;0).
  function scene(bStart: [number, number]) {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]); // A
    drawWall(ctx.env, bStart, [bStart[0], 3]); // B: começa na face de A
    return ctx.store.project;
  }
  const endsOf = (p: ReturnType<typeof scene>) => {
    const walls = wallsOnLevel(p, 'lv_0') as Wall[];
    const frames = levelFrames(p, 'lv_0');
    return { walls, frames };
  };

  it('ponta sobre a face externa (4; 0,092): é canto com A, não T', () => {
    const p = scene([4, 0.092]);
    const { walls, frames } = endsOf(p);
    const b = walls.find((w) => w.a.y > 0)!;
    expect(joinStatus(frames, b.id, 'a').kind).toBe('pair');
  });

  it('ponta sobre a face interna (4; -0,092): é canto com A, não T', () => {
    const p = scene([4, -0.092]);
    const { walls, frames } = endsOf(p);
    const b = walls.find((w) => w.a.y < 0)!;
    expect(joinStatus(frames, b.id, 'a').kind).toBe('pair');
  });

  it('ponta a meio da parede (2; 0,092) continua T: não é canto', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [2, 0.092], [2, 3]);
    const { walls, frames } = endsOf(ctx.store.project);
    const b = walls.find((w) => w.a.x === 2)!;
    expect(joinStatus(frames, b.id, 'a').kind).toBe('tee');
  });
});

/** J-04: paredes sem sobreposição vertical não se unem, mesmo no mesmo ponto de planta. */
describe('junção exige sobreposição vertical (J-04)', () => {
  it('parede elevada acima da altura da outra: sem junção', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]); // A: 0 a 2,8 m
    drawWall(ctx.env, [4, 0], [4, 3]); // B: no mesmo ponto, mas elevada
    const walls = wallsOnLevel(ctx.store.project, 'lv_0') as Wall[];
    const b = walls.find((w) => w.a.x === 4)!;
    // Eleva B a 3 m: não cruza com A (0 a 2,8 m).
    ctx.env.exec({ type: 'updateElements', ids: [b.id], patch: { baseOffset: 3 } });
    const frames = levelFrames(ctx.store.project, 'lv_0');
    expect(joinStatus(frames, b.id, 'a').kind).toBe('free');
  });

  it('mesma altura: a junção de canto continua valendo', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [4, 0], [4, 3]);
    const walls = wallsOnLevel(ctx.store.project, 'lv_0') as Wall[];
    const b = walls.find((w) => w.a.x === 4)!;
    expect(joinStatus(levelFrames(ctx.store.project, 'lv_0'), b.id, 'a').kind).toBe('pair');
  });
});


/** J-03: a ferramenta Junção mostra o T e liga/desliga "não unir" na ponta, sem editar coordenadas. */
describe('ferramenta Junção em T (J-03)', () => {
  it('clicar na ponta em T desliga a junção dessa ponta; clicar de novo religa', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [2, 0.092], [2, 3]); // T no meio de A
    const b = (wallsOnLevel(ctx.store.project, 'lv_0') as Wall[]).find((w) => w.a.x === 2)!;
    const j = tool('joins', ctx.env);
    j.move!(P(2, 0.092));
    j.click!(P(2, 0.092));
    const off = (wallsOnLevel(ctx.store.project, 'lv_0') as Wall[]).find((w) => w.id === b.id)!;
    expect(off.noJoinStart).toBe(true);
    j.move!(P(2, 0.092));
    j.click!(P(2, 0.092));
    const on = (wallsOnLevel(ctx.store.project, 'lv_0') as Wall[]).find((w) => w.id === b.id)!;
    expect(on.noJoinStart).toBe(false);
  });
});

describe('T em canto pela ferramenta Junção (J-03)', () => {
  it('T perto da extremidade vira canto com Tab', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]); // A
    // B: T quase na extremidade de A. Captura desligada no desenho, para o ponto inicial não virar canto de face.
    ctx.env.options().snap = { ...DEFAULT_SNAP, enabled: false };
    drawWall(ctx.env, [3.95, 0.06], [3.95, 3]);
    ctx.env.options().snap = DEFAULT_SNAP;
    const b = (wallsOnLevel(ctx.store.project, 'lv_0') as Wall[]).find((w) => w.a.x === 3.95)!;
    expect(joinStatus(levelFrames(ctx.store.project, 'lv_0'), b.id, 'a').kind).toBe('tee');
    const j = tool('joins', ctx.env);
    j.move!(P(3.95, 0.06));
    j.tab!();
    const after = (wallsOnLevel(ctx.store.project, 'lv_0') as Wall[]).find((w) => w.id === b.id)!;
    expect(after.a.x).toBeCloseTo(4, 6);
    expect(after.a.y).toBeCloseTo(0, 6);
    expect(joinStatus(levelFrames(ctx.store.project, 'lv_0'), b.id, 'a').kind).toBe('pair');
  });

  it('T no meio do vão não vira canto: a ponta fica onde estava', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [2, 0.09], [2, 3]);
    const b = (wallsOnLevel(ctx.store.project, 'lv_0') as Wall[]).find((w) => w.a.x === 2)!;
    const j = tool('joins', ctx.env);
    j.move!(P(2, 0.09));
    j.tab!();
    const after = (wallsOnLevel(ctx.store.project, 'lv_0') as Wall[]).find((w) => w.id === b.id)!;
    expect(after.a.x).toBeCloseTo(2, 6);
  });
});
