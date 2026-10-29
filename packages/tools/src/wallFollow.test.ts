import { describe, expect, it } from 'vitest';
import { dist } from '@hestia/geom';
import { translateWallsJoined } from './wallFollow.ts';
import { clickAt, drawWall, makeEnv, tool, walls } from './testEnv.ts';

describe('translateWallsJoined', () => {
  it('translada a parede e estica as duas vizinhas ligadas', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [4, 0], [4, 3]);
    drawWall(ctx.env, [0, 3], [0, 0]);
    const [w0] = walls(ctx.store);
    const r = translateWallsJoined(ctx.store.project, 'lv_0', [w0!.id], { x: 0, y: -2 });
    ctx.store.transaction('t', () => r.commands.forEach((c) => ctx.store.exec(c)));
    const [a, b, c] = walls(ctx.store);
    expect(dist(a!.b, b!.a)).toBeLessThan(1e-9);
    expect(dist(a!.a, c!.b)).toBeLessThan(1e-9);
    expect(dist(b!.a, b!.b)).toBeCloseTo(5, 9);
    expect(r.note).toBeUndefined();
  });
});

describe('Mover e Copiar mantêm a junção das paredes ligadas', () => {
  it('Mover: a vizinha ligada pela ponta estica e a junção fica fechada', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [4, 0], [4, 3]);
    const [w0] = walls(ctx.store);
    ctx.env.setSelection([w0!.id]);
    const m = tool('move', ctx.env);
    clickAt(m, 0, 0);
    clickAt(m, 0, -2);
    const [a, b] = walls(ctx.store);
    expect(a!.b).toEqual({ x: 4, y: -2 });
    expect(dist(a!.b, b!.a)).toBeLessThan(1e-9);
    expect(dist(b!.a, b!.b)).toBeCloseTo(5, 9);
  });

  it('Copiar: a original e a vizinha não são tocadas', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [4, 0], [4, 3]);
    const [w0, w1] = walls(ctx.store);
    ctx.env.setSelection([w0!.id]);
    const c = tool('copy', ctx.env);
    clickAt(c, 0, 0);
    clickAt(c, 0, -2);
    const after = walls(ctx.store);
    const vizinha = after.find((w) => w.id === w1!.id)!;
    expect(vizinha.a).toEqual({ x: 4, y: 0 });
    expect(vizinha.b).toEqual({ x: 4, y: 3 });
  });
});
