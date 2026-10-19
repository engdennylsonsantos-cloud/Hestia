import { describe, expect, it } from 'vitest';
import { wallsOnLevel, type Wall } from '@hestia/model';
import { followingEnds } from './pick.ts';
import { clickAt, drawWall, makeEnv, tool, P } from './testEnv.ts';

const ids = (r: Array<{ wallId: string }>): string[] => r.map((x) => x.wallId).sort();

describe('quem acompanha ao mover uma ponta', () => {
  // Canto simples em (4,0) e, em (0,0), um nó de três paredes.
  function scene() {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]); // w0
    drawWall(ctx.env, [4, 0], [4, 3]); // w1: canto simples com w0 em (4,0)
    drawWall(ctx.env, [0, 0], [0, 3]); // w2: nó em (0,0) com w0 e w3
    drawWall(ctx.env, [0, 0], [-3, 0]); // w3
    return ctx;
  }

  it('canto simples: a vizinha acompanha', () => {
    const { store } = scene();
    const [w0] = wallsOnLevel(store.project, 'lv_0') as [Wall];
    expect(ids(followingEnds(store.project, 'lv_0', { x: 4, y: 0 }, new Set([w0.id])))).toHaveLength(1);
  });

  it('nó de três ou mais paredes: ninguém acompanha, a parede se solta sozinha', () => {
    const { store } = scene();
    const [w0] = wallsOnLevel(store.project, 'lv_0') as [Wall];
    expect(followingEnds(store.project, 'lv_0', { x: 0, y: 0 }, new Set([w0.id]))).toHaveLength(0);
  });

  it('Alt inverte: solta o canto simples e leva todas do nó', () => {
    const { store } = scene();
    const [w0] = wallsOnLevel(store.project, 'lv_0') as [Wall];
    expect(followingEnds(store.project, 'lv_0', { x: 4, y: 0 }, new Set([w0.id]), true)).toHaveLength(0);
    expect(followingEnds(store.project, 'lv_0', { x: 0, y: 0 }, new Set([w0.id]), true)).toHaveLength(2);
  });

  it('arrastar a alça de uma parede num nó move só ela', () => {
    const ctx = scene();
    const [w0, , w2] = wallsOnLevel(ctx.store.project, 'lv_0') as [Wall, Wall, Wall];
    ctx.env.setSelection([w0.id]);
    const s = tool('select', ctx.env);
    s.down!(P(0, 0));
    s.drag!(P(0, -1));
    s.up!(P(0, -1));
    const after = wallsOnLevel(ctx.store.project, 'lv_0');
    expect(after.find((w) => w.id === w0.id)!.a.y).toBeCloseTo(-1);
    expect(after.find((w) => w.id === w2.id)!.a.y).toBeCloseTo(0); // a vizinha do nó ficou
    void clickAt;
  });

  it('arrastar a alça no canto simples leva a vizinha (como no Revit)', () => {
    const ctx = scene();
    const [w0, w1] = wallsOnLevel(ctx.store.project, 'lv_0') as [Wall, Wall];
    ctx.env.setSelection([w0.id]);
    const s = tool('select', ctx.env);
    s.down!(P(4, 0));
    s.drag!(P(4, 1));
    s.up!(P(4, 1));
    const after = wallsOnLevel(ctx.store.project, 'lv_0');
    expect(after.find((w) => w.id === w0.id)!.b.y).toBeCloseTo(1);
    expect(after.find((w) => w.id === w1.id)!.a.y).toBeCloseTo(1);
  });
});
