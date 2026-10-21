import { describe, expect, it } from 'vitest';
import { makeFloor, type Project } from '@hestia/model';
import { infer, type InferContext } from './infer.ts';
import { DEFAULT_SNAP } from './types.ts';
import { drawWall, makeEnv, tool, walls } from './testEnv.ts';

/** Escala de teste: 1 px = 0,005 m, então a tolerância de captura (10 px) é 0,05 m. */
const MPP = 0.005;

/** Projeto com uma parede 4 m (wt_alv14) de (0,0) a (4,0), desenhada pela ferramenta Parede. */
function oneWall() {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [4, 0]);
  return ctx;
}

const at = (p: Project, x: number, y: number, extra: Partial<InferContext> = {}) =>
  infer({ x, y }, { project: p, levelId: 'lv_0', mpp: MPP, gridStep: 0.1, ...extra });

const near = (a: { x: number; y: number }, x: number, y: number, eps = 1e-6): boolean => Math.abs(a.x - x) < eps && Math.abs(a.y - y) < eps;

describe('captura de faces de acabamento (motor de inferência)', () => {
  it('canto da face: perto de (0; 0,092) devolve kind face exatamente nesse ponto', () => {
    const { store } = oneWall();
    const r = at(store.project, 0, 0.092);
    expect(r.kind).toBe('face');
    expect(near(r.point, 0, 0.092, 1e-6)).toBe(true);
  });

  it('canto da outra face: perto de (4; -0,092) devolve kind face', () => {
    const { store } = oneWall();
    const r = at(store.project, 4, -0.092);
    expect(r.kind).toBe('face');
    expect(near(r.point, 4, -0.092)).toBe(true);
  });

  it('ponto médio da face: (2; 0,092) devolve kind midpoint', () => {
    const { store } = oneWall();
    const r = at(store.project, 2, 0.092);
    expect(r.kind).toBe('midpoint');
    expect(near(r.point, 2, 0.092)).toBe(true);
  });

  it('sobre a aresta da face: (1,3; 0,092) devolve kind nearest no pé da aresta', () => {
    const { store } = oneWall();
    const r = at(store.project, 1.3, 0.092);
    expect(r.kind).toBe('nearest');
    expect(near(r.point, 1.3, 0.092)).toBe(true);
  });

  it('com faces desligadas não captura a face (cai em outra captura)', () => {
    const { store } = oneWall();
    const r = at(store.project, 0, 0.092, { snap: { ...DEFAULT_SNAP, faces: false } });
    expect(r.kind).not.toBe('face');
    expect(r.kind).not.toBe('core');
  });

  it('com grade desligada e nada perto devolve kind none, no próprio cursor', () => {
    const { store } = oneWall();
    const r = at(store.project, 10, 10, { snap: { ...DEFAULT_SNAP, grid: false } });
    expect(r.kind).toBe('none');
    expect(near(r.point, 10, 10)).toBe(true);
  });

  it('com captura de núcleo ligada, captura o canto do núcleo (0; 0,07) como core', () => {
    const { store } = oneWall();
    // Tolerância menor: o canto da face de acabamento (0; 0,092) está a 0,022 m e venceria a prioridade do núcleo.
    const r = infer({ x: 0, y: 0.07 }, { project: store.project, levelId: 'lv_0', mpp: 0.002, gridStep: 0.1, snap: { ...DEFAULT_SNAP, core: true } });
    expect(r.kind).toBe('core');
    expect(near(r.point, 0, 0.07, 1e-4)).toBe(true);
  });

  it('sem captura de núcleo, o mesmo ponto não vira core', () => {
    const { store } = oneWall();
    const r = infer({ x: 0, y: 0.07 }, { project: store.project, levelId: 'lv_0', mpp: 0.002, gridStep: 0.1 });
    expect(r.kind).not.toBe('core');
  });

  it('parede ignorada (ignore) não captura as faces dela', () => {
    const { store } = oneWall();
    const id = walls(store)[0]!.id;
    const r = at(store.project, 0, 0.092, { ignore: new Set([id]) });
    expect(r.kind).not.toBe('face');
  });

  it('canto de L com esquadria: o vértice externo (4,092; -0,092) é capturável', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [4, 0], [4, 3]);
    const r = infer({ x: 4.092, y: -0.092 }, { project: ctx.store.project, levelId: 'lv_0', mpp: 0.002, gridStep: 0.1 });
    expect(r.kind).toBe('face');
    expect(near(r.point, 4.092, -0.092, 1e-4)).toBe(true);
  });

  it('ortogonal com Shift (orthoLock) continua valendo com alinhamento desligado', () => {
    const ctx = makeEnv();
    const r = infer(
      { x: 3, y: 2.02 },
      { project: ctx.store.project, levelId: 'lv_0', mpp: MPP, gridStep: 0.1, from: { x: 1, y: 2 }, orthoLock: true, snap: { ...DEFAULT_SNAP, alignment: false } },
    );
    expect(r.kind).toBe('ortho');
    expect(near(r.point, 3, 2, 1e-6)).toBe(true);
  });

  it('pontos extras (vértices de piso) viram endpoint, mas não entram no modo só-paredes', () => {
    const ctx = makeEnv();
    const r = infer({ x: 5.02, y: 4.98 }, { project: ctx.store.project, levelId: 'lv_0', mpp: MPP, gridStep: 0.1, extraPoints: [{ x: 5, y: 5 }] });
    expect(r.kind).toBe('endpoint');
    expect(near(r.point, 5, 5)).toBe(true);
    const only = infer({ x: 5.02, y: 4.98 }, { project: ctx.store.project, levelId: 'lv_0', mpp: MPP, gridStep: 0.1, extraPoints: [{ x: 5, y: 5 }], onWallsOnly: true });
    expect(only.kind).not.toBe('endpoint');
  });
});

// O teste de tempo da captura (500 chamadas a infer em 200 paredes) está em snapFaces.perf.test.ts.

describe('pisos do nível como captura (ferramentas que usam ToolBase.ctx)', () => {
  it('a ferramenta Parede captura o vértice de um piso existente do nível', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 5, y: 5 }, { x: 7, y: 5 }, { x: 7, y: 7 }, { x: 5, y: 7 }] }) });
    ctx.env.metersPerPixel = () => MPP;
    const w = tool('wall', ctx.env);
    w.move({ raw: { x: 5.02, y: 4.98 }, shift: false, ctrl: false, alt: false });
    expect(w.inference()?.kind).toBe('endpoint');
    expect(near(w.inference()!.point, 5, 5)).toBe(true);
  });
});

describe('ferramenta Parede com captura de faces', () => {
  it('a parede desenhada pela ferramenta usa as faces ao clicar perto de um canto', () => {
    const ctx = oneWall();
    // Tolerância de 0,05 m (o ambiente de teste usa 0,01 m/px, em que o eixo da ponta venceria a face).
    ctx.env.metersPerPixel = () => MPP;
    ctx.options.snap = { ...DEFAULT_SNAP, grid: false };
    const w = tool('wall', ctx.env);
    w.move({ raw: { x: 0, y: 0.092 }, shift: false, ctrl: false, alt: false });
    expect(w.inference()?.kind).toBe('face');
    w.cancel();
  });
});
