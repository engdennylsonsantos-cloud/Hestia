import { describe, expect, it } from 'vitest';
import { dist } from '@hestia/geom';
import { createEmptyProject } from '@hestia/model';
import { infer, type InferContext } from './infer.ts';
import { DEFAULT_SNAP } from './types.ts';
import { clickAt, drawWall, makeEnv, tool } from './testEnv.ts';

const MPP = 0.005;
const ON = { ...DEFAULT_SNAP, grid: true };
const empty = createEmptyProject();
const at = (x: number, y: number, extra: Partial<InferContext> = {}) =>
  infer({ x, y }, { project: empty, levelId: 'lv_0', mpp: MPP, gridStep: 0.5, snap: ON, ...extra });

describe('grade de pontos como snap (a)', () => {
  it('ligada, o cursor vai ao ponto mais próximo do quadriculado', () => {
    const r = at(1.23, 2.47);
    expect(r.kind).toBe('grid');
    expect(r.point).toEqual({ x: 1, y: 2.5 });
  });

  it('desligada (padrão), o cursor fica livre', () => {
    const r = at(1.23, 2.47, { snap: DEFAULT_SNAP });
    expect(r.kind).toBe('none');
    expect(r.point).toEqual({ x: 1.23, y: 2.47 });
  });

  it('noGrid e chave mestre desligada dispensam a grade', () => {
    expect(at(1.23, 2.47, { noGrid: true }).kind).toBe('none');
    expect(at(1.23, 2.47, { snap: { ...ON, enabled: false } }).kind).toBe('none');
  });

  it('um ponto real ao alcance vence a grade', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0.13, 0], [3.13, 0]);
    const r = infer({ x: 0.14, y: 0.01 }, { project: ctx.store.project, levelId: 'lv_0', mpp: MPP, gridStep: 0.5, snap: ON });
    expect(r.kind).toBe('endpoint');
  });

  it('alinhamento e ortogonal quantizam o outro eixo pela grade', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0.13, 5], [0.13, 8]);
    const al = infer({ x: 0.14, y: 1.62 }, { project: ctx.store.project, levelId: 'lv_0', mpp: MPP, gridStep: 0.5, snap: ON });
    expect(al.kind).toBe('alignment');
    expect(al.point).toEqual({ x: 0.13, y: 1.5 });
    const o = at(1.23, 0.01, { from: { x: 0, y: 0 }, snap: { ...ON, alignment: false }, orthoLock: true });
    expect(o.point).toEqual({ x: 1, y: 0 });
  });

  it('o espaçamento do contexto é o do snap (0,05 e 2)', () => {
    expect(at(1.23, 2.47, { gridStep: 0.05 }).point.x).toBeCloseTo(1.25, 9);
    expect(at(1.23, 2.47, { gridStep: 2 }).point).toEqual({ x: 2, y: 2 });
  });

  it('pontos negativos e passo fracionário caem em múltiplos do passo', () => {
    const r = at(-0.37, -1.11, { gridStep: 0.25 });
    expect(r.point.x).toBeCloseTo(-0.25, 9);
    expect(r.point.y).toBeCloseTo(-1.0, 9);
  });
});

describe('grade de pontos nas ferramentas de desenho (a)', () => {
  const setup = () => {
    const ctx = makeEnv();
    ctx.options.snap = ON;
    ctx.env.gridStep = () => 0.5;
    return ctx;
  };

  it('parede: as duas pontas caem na grade', () => {
    const ctx = setup();
    const w = tool('wall', ctx.env);
    clickAt(w, 0.12, 0.2);
    clickAt(w, 3.18, 0.1);
    w.cancel();
    const wl = Object.values(ctx.store.project.elements).find((e) => e.kind === 'wall') as { a: { x: number; y: number }; b: { x: number; y: number } };
    expect(dist(wl.a, { x: 0, y: 0 })).toBeLessThan(1e-9);
    expect(dist(wl.b, { x: 3, y: 0 })).toBeLessThan(1e-9);
  });

  it('linha de detalhe: o ponto cai na grade', () => {
    const ctx = setup();
    const d = tool('detailLine', ctx.env);
    d.move({ raw: { x: 1.23, y: 2.47 }, shift: false, ctrl: false, alt: false });
    expect(d.inference()?.point).toEqual({ x: 1, y: 2.5 });
  });

  it('cota, grade e demais: o cursor passa por this.snap com o passo do ambiente', () => {
    const ctx = setup();
    for (const id of ['dimension', 'grid', 'roomsep', 'text', 'section'] as const) {
      const t = tool(id, ctx.env);
      t.move({ raw: { x: 1.23, y: 2.47 }, shift: false, ctrl: false, alt: false });
      const inf = t.inference();
      expect(inf?.kind, id).toBe('grid');
      expect(inf?.point, id).toEqual({ x: 1, y: 2.5 });
    }
  });
});
