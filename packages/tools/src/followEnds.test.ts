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

  it('nó de três ou mais paredes: todas as ligadas acompanham (o nó se move junto)', () => {
    const { store } = scene();
    const [w0] = wallsOnLevel(store.project, 'lv_0') as [Wall];
    expect(followingEnds(store.project, 'lv_0', { x: 0, y: 0 }, new Set([w0.id]))).toHaveLength(2);
  });

  it('Alt solta a parede pegada: nem o canto simples nem o nó levam ninguém', () => {
    const { store } = scene();
    const [w0] = wallsOnLevel(store.project, 'lv_0') as [Wall];
    expect(followingEnds(store.project, 'lv_0', { x: 4, y: 0 }, new Set([w0.id]), true)).toHaveLength(0);
    expect(followingEnds(store.project, 'lv_0', { x: 0, y: 0 }, new Set([w0.id]), true)).toHaveLength(0);
  });

  it('arrastar a alça num nó move o nó: as paredes ligadas acompanham', () => {
    const ctx = scene();
    const [w0, , w2] = wallsOnLevel(ctx.store.project, 'lv_0') as [Wall, Wall, Wall];
    ctx.env.setSelection([w0.id]);
    const s = tool('select', ctx.env);
    s.down!(P(0, 0));
    s.drag!(P(0, -1));
    s.up!(P(0, -1));
    const after = wallsOnLevel(ctx.store.project, 'lv_0');
    expect(after.find((w) => w.id === w0.id)!.a.y).toBeCloseTo(-1);
    expect(after.find((w) => w.id === w2.id)!.a.y).toBeCloseTo(-1);
    void clickAt;
  });

  it('Alt na alça do nó move só a parede pegada', () => {
    const ctx = scene();
    const [w0, , w2] = wallsOnLevel(ctx.store.project, 'lv_0') as [Wall, Wall, Wall];
    ctx.env.setSelection([w0.id]);
    const s = tool('select', ctx.env);
    s.down!(P(0, 0));
    s.drag!(P(0, -1, { alt: true }));
    s.up!(P(0, -1, { alt: true }));
    const after = wallsOnLevel(ctx.store.project, 'lv_0');
    expect(after.find((w) => w.id === w0.id)!.a.y).toBeCloseTo(-1);
    expect(after.find((w) => w.id === w2.id)!.a.y).toBeCloseTo(0);
  });

  it('pegar o canto visível da ponta move o eixo com o mesmo deslocamento (sem salto)', () => {
    const ctx = scene();
    const [w0] = wallsOnLevel(ctx.store.project, 'lv_0') as [Wall];
    ctx.env.setSelection([w0.id]);
    const s = tool('select', ctx.env);
    // Canto visível da ponta (0; 0,092) da parede de 0,184 m: pegar ali e levar a (0; -1).
    s.down!(P(0, 0.092));
    s.drag!(P(0, -1));
    s.up!(P(0, -1));
    const after = wallsOnLevel(ctx.store.project, 'lv_0');
    expect(after.find((w) => w.id === w0.id)!.a.y).toBeCloseTo(-1 - 0.092, 2);
  });

  it('ponta levada até a outra ponta é recusada: a parede não fica com comprimento zero', () => {
    const ctx = scene();
    const [w0] = wallsOnLevel(ctx.store.project, 'lv_0') as [Wall];
    ctx.env.setSelection([w0.id]);
    const s = tool('select', ctx.env);
    s.down!(P(0, 0));
    s.drag!(P(4, 0));
    s.up!(P(4, 0));
    const after = wallsOnLevel(ctx.store.project, 'lv_0');
    expect(after.find((w) => w.id === w0.id)!.a.x).toBeCloseTo(0);
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
