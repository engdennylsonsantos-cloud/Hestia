import { describe, expect, it } from 'vitest';
import { makeFloor, type Project } from '@hestia/model';
import { wallFaces } from '@hestia/engine';
import { infer, type InferContext } from './infer.ts';
import { DEFAULT_SNAP } from './types.ts';
import { clickAt, drawWall, makeEnv, tool, walls } from './testEnv.ts';

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

describe('capturas inteligentes e rastreamento dinâmico (Smart Snaps)', () => {
  it('com snap.enabled = false (F3), ignora todas as capturas e devolve o ponto cru', () => {
    const { store } = oneWall();
    const r = at(store.project, 0, 0, { snap: { ...DEFAULT_SNAP, enabled: false } });
    expect(r.kind).toBe('none');
    expect(near(r.point, 0, 0)).toBe(true);
  });

  it('com snap.midpoint = false, desativa captura de pontos médios', () => {
    const { store } = oneWall();
    // Ponto médio da parede é (2, 0). Com midpoint desligado, cai em 'nearest' ou grade
    const r = at(store.project, 2, 0.005, { snap: { ...DEFAULT_SNAP, midpoint: false, grid: false } });
    expect(r.kind).not.toBe('midpoint');
  });

  it('com snap.endpoint = false, desativa captura de extremidades', () => {
    const { store } = oneWall();
    const r = at(store.project, 0, 0.005, { snap: { ...DEFAULT_SNAP, endpoint: false, grid: false } });
    expect(r.kind).not.toBe('endpoint');
    expect(r.kind).not.toBe('face');
  });

  it('rastreamento dinâmico de alinhamento com o ponto médio de uma parede existente', () => {
    const { store } = oneWall();
    // Parede de (0,0) a (4,0), ponto médio em (2,0).
    // Cursor em (2.01, 3) deve alinhar em X com o ponto médio (x=2)
    const r = at(store.project, 2.01, 3, { snap: { ...DEFAULT_SNAP, grid: false } });
    expect(r.kind).toBe('alignment');
    expect(near(r.point, 2, 3)).toBe(true);
    expect(r.guides.length).toBeGreaterThan(0);
    expect(r.guides.some((g) => g.kind === 'alignment' && near(g.from, 2, 0))).toBe(true);
  });

  it('estende a guia colinear da face lateral de uma parede oblíqua', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 4]);
    const wf = wallFaces(ctx.store.project, 'lv_0')[0]!;
    const side = wf.faces.slice(0, 2).sort((a, b) => Math.hypot(b[1].x - b[0].x, b[1].y - b[0].y) - Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y))[0]!;
    const dx = side[1].x - side[0].x;
    const dy = side[1].y - side[0].y;
    const sideLen = Math.hypot(dx, dy);
    const cursor = { x: side[1].x + dx * 0.5 - (dy / sideLen) * 0.01, y: side[1].y + dy * 0.5 + (dx / sideLen) * 0.01 };
    const r = infer(cursor, { project: ctx.store.project, levelId: 'lv_0', mpp: MPP, gridStep: 0.1, snap: { ...DEFAULT_SNAP, grid: false } });
    expect(r.kind).toBe('alignment');
    expect(r.guides.some((g) => g.kind === 'alignment' && near(g.from, side[1].x, side[1].y, 1e-5))).toBe(true);
  });

  it('Tab cicla do eixo para a face lateral como referência de alinhamento', () => {
    const { store } = oneWall();
    const base = { project: store.project, levelId: 'lv_0' as const, mpp: MPP, gridStep: 0.1, snap: { ...DEFAULT_SNAP, grid: false } };
    const axis = infer({ x: 5, y: 0.045 }, base);
    const face = infer({ x: 5, y: 0.045 }, { ...base, alignmentCycle: 1 });
    expect(axis.kind).toBe('alignment');
    expect(face.kind).toBe('alignment');
    expect(axis.point.y).toBeCloseTo(0, 6);
    expect(face.point.y).toBeCloseTo(0.092, 3);
    expect(face.guides[0]?.from.y).toBeCloseTo(0.092, 3);

    const ctx = oneWall();
    ctx.env.metersPerPixel = () => MPP;
    ctx.options.snap = { ...DEFAULT_SNAP, grid: false };
    const w = tool('wall', ctx.env);
    w.move({ raw: { x: 5, y: 0.045 }, shift: false, ctrl: false, alt: false });
    expect(w.inference()?.point.y).toBeCloseTo(0, 6);
    w.tab();
    expect(w.inference()?.kind).toBe('alignment');
    expect(w.inference()?.point.y).toBeCloseTo(0.092, 3);
  });
});

describe('Parede: Linha de Localização e Espaço', () => {
  it('finishExterior mantém a face da parede nova coplanar à referência de outra espessura', () => {
    const ctx = oneWall();
    ctx.env.metersPerPixel = () => MPP;
    ctx.options.snap = { ...DEFAULT_SNAP, grid: false };
    ctx.options.locationLine = 'finishExterior';
    ctx.options.wallTypeId = 'wt_alv9';
    const ref = wallFaces(ctx.store.project, 'lv_0')[0]!;
    const refSide = ref.faces.slice(0, 2).find((s) => Math.abs(s[0].y - s[1].y) < 1e-8 && Math.abs(s[0].y) > 0.05)!;
    const y = refSide[0].y;
    const w = tool('wall', ctx.env);
    clickAt(w, 0.5, y);
    clickAt(w, 3.5, y);
    const created = walls(ctx.store).find((wall) => wall.id !== ref.wallId)!;
    expect(created.locationLine).toBe('finishExterior');
    const newFaces = wallFaces(ctx.store.project, 'lv_0').find((wf) => wf.wallId === created.id)!.faces.slice(0, 2);
    const newSide = newFaces.find((s) => Math.abs(s[0].y - s[1].y) < 1e-8 && Math.abs(s[0].y - y) < 1e-8);
    expect(newSide).toBeDefined();
    expect(newSide![0].y).toBeCloseTo(refSide[0].y, 8);
    expect(newSide![1].y).toBeCloseTo(refSide[1].y, 8);
  });

  it('Espaço inverte o lado da parede durante o traçado', () => {
    const ctx = makeEnv();
    const w = tool('wall', ctx.env);
    clickAt(w, 0, 0);
    w.space?.();
    clickAt(w, 3, 0);
    expect(walls(ctx.store)[0]?.flipped).toBe(true);
  });
});

