import { describe, expect, it } from 'vitest';
import { stairsOnLevel, type Stair, type StairRun } from '@hestia/model';
import { resolveStairs, type ResolvedStair } from '@hestia/engine';
import { clickAt, makeEnv, P, tool } from './testEnv.ts';
import { StairRunTool } from './stairRunTool.ts';
import { planStairRun, STAIR_RUN_SHAPES, STAIR_RUN_SHAPE_LABEL, type StairRunToolOptions } from './stairRunPlan.ts';
import type { Tool } from './types.ts';

/** Ambiente com mensagens capturadas. Padrão: reta, 1,20 m, giro à esquerda; H = 2,80 m (nível 1 com topo 0,20 m abaixo). */
function setup(opts: Partial<StairRunToolOptions> = {}, stair: Record<string, unknown> = { topLevelId: 'lv_1', topOffset: -0.2 }) {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  ctx.options.stairRun = { shape: 'straight', width: 1.2, turn: 'left', ...opts };
  ctx.options.stair = stair;
  return { ...ctx, msgs, last: () => msgs[msgs.length - 1] ?? '' };
}

/** Clique no ponto inicial e no ponto que fixa a direção (cria a escada). */
function draw(t: Tool, from: [number, number], to: [number, number]): void {
  clickAt(t, from[0], from[1]);
  clickAt(t, to[0], to[1]);
}

const stairsOf = (ctx: { store: { project: Parameters<typeof stairsOnLevel>[0] } }, levelId = 'lv_0'): Stair[] => stairsOnLevel(ctx.store.project, levelId);
const resolved = (ctx: { store: { project: Parameters<typeof resolveStairs>[0] } }): ResolvedStair => resolveStairs(ctx.store.project)[0]!;
const errors = (r: ResolvedStair) => r.issues.filter((i) => i.severity === 'error');
const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
/** Centro do espelho k (1..N) da escada resolvida, na ordem de subida do componente. */
const riserMid = (r: ResolvedStair, componentIndex: number, index: number) => {
  const rr = r.risers.find((x) => x.componentIndex === componentIndex && x.index === index)!;
  return mid(rr.a, rr.b);
};

describe('ferramenta Escada reta/L/U: criação por cliques', () => {
  it('registra a ferramenta com o id, o rótulo e as quatro formas', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    expect(t).toBeInstanceOf(StairRunTool);
    expect(t.id).toBe('stairrun');
    expect(t.label).toBe('Escada (reta, L, U, leque, caracol)');
    expect(STAIR_RUN_SHAPES).toEqual(['straight', 'lshape', 'ushape', 'winder', 'spiral']);
    expect(Object.values(STAIR_RUN_SHAPE_LABEL)).toEqual(['Reta', 'Em L', 'Em U', 'Com leque', 'Caracol']);
  });

  it('reta com H = 2,80 m: 16 espelhos de 0,175 m e 15 degraus, sem erros; o 1º clique é o centro do 1º espelho', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    draw(t, [0, 0], [0, 5]);
    const [s] = stairsOf(ctx);
    expect(s!.components).toHaveLength(1);
    const r = resolved(ctx);
    expect(r.riserCount).toBe(16);
    expect(r.riserHeight).toBeCloseTo(0.175, 6);
    expect(errors(r)).toEqual([]);
    expect(r.steps.filter((x) => x.kind === 'tread')).toHaveLength(15);
    expect(riserMid(r, 0, 1).x).toBeCloseTo(0, 6);
    expect(riserMid(r, 0, 1).y).toBeCloseTo(0, 6);
    // Sobe no sentido do 2º clique (+y): o último espelho fica no topo, a 2,80 m.
    expect(r.risers[r.risers.length - 1]!.z1).toBeCloseTo(2.8, 6);
    expect(riserMid(r, 0, 16).y).toBeGreaterThan(riserMid(r, 0, 1).y);
    expect(ctx.last()).toMatch(/^Escada criada: 16 espelhos de 17,5 cm, piso 28,0 cm\./);
    expect(ctx.last()).toMatch(/Ctrl\+Z desfaz\.$/);
  });

  it('em L: patamar à cota do último espelho do 1º lance (8 × 0,175 = 1,40 m) e dois lances de 8', () => {
    const ctx = setup({ shape: 'lshape' });
    draw(tool('stairrun', ctx.env), [0, 0], [0, 5]);
    const [s] = stairsOf(ctx);
    expect(s!.components.map((c) => c.kind)).toEqual(['run', 'landing', 'run']);
    const runs = s!.components.filter((c): c is StairRun => c.kind === 'run');
    expect(runs.map((c) => c.risers.length)).toEqual([8, 8]);
    expect(runs.every((c) => c.generatedBy === 'lshape')).toBe(true);
    const r = resolved(ctx);
    expect(r.riserCount).toBe(16);
    expect(errors(r)).toEqual([]);
    const landing = r.steps.find((x) => x.kind === 'landing');
    expect(landing!.z).toBeCloseTo(1.4, 6);
    expect(r.risers.find((x) => x.componentIndex === 2 && x.index === 1)!.z0).toBeCloseTo(1.4, 6);
  });

  it('em U: patamar à cota certa e o 2º lance volta no sentido oposto (espelhos com y decrescente)', () => {
    const ctx = setup({ shape: 'ushape' });
    draw(tool('stairrun', ctx.env), [0, 0], [0, 5]);
    const r = resolved(ctx);
    expect(r.riserCount).toBe(16);
    expect(errors(r)).toEqual([]);
    expect(r.steps.find((x) => x.kind === 'landing')!.z).toBeCloseTo(1.4, 6);
    expect(riserMid(r, 2, 1).y).toBeGreaterThan(riserMid(r, 2, 8).y);
    expect(riserMid(r, 2, 1).y).toBeCloseTo(7 * 0.28, 4);
  });

  it('com leque (winder): 16 espelhos num lance só, sem espelho duplicado nem erro de croqui, e 15 pisos', () => {
    const ctx = setup({ shape: 'winder' });
    draw(tool('stairrun', ctx.env), [0, 0], [0, 5]);
    const [s] = stairsOf(ctx);
    expect(s!.components).toHaveLength(1);
    const run = s!.components[0] as StairRun;
    expect(run.generatedBy).toBe('winder');
    expect(run.risers).toHaveLength(16);
    const r = resolved(ctx);
    expect(r.riserCount).toBe(16);
    expect(r.riserHeight).toBeCloseTo(0.175, 6);
    expect(errors(r)).toEqual([]);
    expect(r.steps.filter((x) => x.kind === 'tread')).toHaveLength(15);
    expect(r.risers[r.risers.length - 1]!.z1).toBeCloseTo(2.8, 6);
  });

  it('a prévia mostra degraus e espelhos durante o movimento; antes do 1º clique, só o cursor', () => {
    const ctx = setup({ shape: 'lshape' });
    const t = tool('stairrun', ctx.env);
    t.move(P(1, 1));
    expect(t.preview()).toEqual([{ kind: 'point', at: { x: 1, y: 1 } }]);
    clickAt(t, 0, 0);
    t.move(P(0, 5));
    const items = t.preview();
    expect(items.some((i) => i.kind === 'polygon' && i.tone === 'tread')).toBe(true);
    expect(items.some((i) => i.kind === 'line' && i.tone === 'riser')).toBe(true);
    expect(items.some((i) => i.kind === 'polygon' && i.tone === 'landing')).toBe(true);
    expect(items.some((i) => i.kind === 'label' && /16 espelhos/.test(i.text))).toBe(true);
    expect(stairsOf(ctx)).toHaveLength(0);
  });

  it('largura e giro vêm das opções: a largura é a distância entre os limites; o giro para a direita põe o 2º lance do outro lado', () => {
    const wide = setup({ width: 1.0 });
    draw(tool('stairrun', wide.env), [0, 0], [0, 5]);
    const run = stairsOf(wide)[0]!.components[0] as StairRun;
    const l = run.boundaryLeft[0]!.a;
    const rgt = run.boundaryRight[0]!.a;
    expect(Math.hypot(l.x - rgt.x, l.y - rgt.y)).toBeCloseTo(1.0, 6);

    const left = setup({ shape: 'lshape', turn: 'left' });
    draw(tool('stairrun', left.env), [0, 0], [0, 5]);
    const right = setup({ shape: 'lshape', turn: 'right' });
    draw(tool('stairrun', right.env), [0, 0], [0, 5]);
    const xLeft = riserMid(resolved(left), 2, 1).x;
    const xRight = riserMid(resolved(right), 2, 1).x;
    expect(Math.sign(xLeft)).toBe(-Math.sign(xRight));
    expect(Math.abs(xLeft)).toBeGreaterThan(0.5);
  });

  it('Esc em dois passos: o 1º cancela o ponto inicial; o 2º sai da ferramenta', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    clickAt(t, 0, 0);
    t.cancel();
    expect(ctx.done()).toBe(0);
    expect(stairsOf(ctx)).toHaveLength(0);
    t.cancel();
    expect(ctx.done()).toBe(1);
  });

  it('desfazer leva a escada inteira em um só passo', () => {
    const ctx = setup({ shape: 'winder' });
    draw(tool('stairrun', ctx.env), [0, 0], [0, 5]);
    expect(stairsOf(ctx)).toHaveLength(1);
    ctx.store.undo();
    expect(stairsOf(ctx)).toHaveLength(0);
  });

  it('entrada numérica: o ângulo digitado fixa a direção e cria a escada (90° = subida em +y)', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    expect(t.type('90')).toBe(false);
    expect(t.inputPrompt()).toBeNull();
    clickAt(t, 0, 0);
    expect(t.inputPrompt()).toBe('Ângulo (°)');
    expect(t.type('90')).toBe(true);
    const r = resolved(ctx);
    expect(r.riserCount).toBe(16);
    expect(riserMid(r, 0, 16).y).toBeGreaterThan(riserMid(r, 0, 1).y);
    expect(riserMid(r, 0, 16).x).toBeCloseTo(0, 6);
  });

  it('H menor que um espelho: nada a gerar, sem escada', () => {
    const ctx = setup({}, { topLevelId: 'lv_1', topOffset: -2.9 });
    draw(tool('stairrun', ctx.env), [0, 0], [0, 5]);
    expect(stairsOf(ctx)).toHaveLength(0);
    expect(ctx.last()).toBe('A altura é menor que um espelho: nada a gerar.');
  });

  it('N insuficiente para a forma: L com 3 espelhos e leque com 4 recusam, sem escada', () => {
    const l = setup({ shape: 'lshape' }, { topLevelId: 'lv_1', topOffset: -2.5 });
    draw(tool('stairrun', l.env), [0, 0], [0, 5]);
    expect(stairsOf(l)).toHaveLength(0);
    expect(l.last()).toBe('Esta forma precisa de ao menos 4 espelhos; a altura dá 3.');

    const w = setup({ shape: 'winder' }, { topLevelId: 'lv_1', topOffset: -2.3 });
    draw(tool('stairrun', w.env), [0, 0], [0, 5]);
    expect(stairsOf(w)).toHaveLength(0);
    expect(w.last()).toBe('Esta forma precisa de ao menos 5 espelhos; a altura dá 4.');
  });

  it('sem nível acima, a altura vem de height (2,80 m a partir do nível 3 m)', () => {
    const ctx = setup({}, { height: 2.8 });
    ctx.env.levelId = () => 'lv_1';
    draw(tool('stairrun', ctx.env), [0, 0], [0, 5]);
    expect(stairsOf(ctx, 'lv_1')).toHaveLength(1);
    const r = resolved(ctx);
    expect(r.levelId).toBe('lv_1');
    expect(r.baseZ).toBeCloseTo(3, 6);
    expect(r.topZ - r.baseZ).toBeCloseTo(2.8, 6);
    expect(r.riserCount).toBe(16);
  });

  it('o cálculo de planStairRun: N, h e piso com H, espelho máximo e piso mínimo do tipo', () => {
    const base = { start: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, maxRiser: 0.18, minTread: 0.28, options: { shape: 'straight' as const, width: 1.2, turn: 'left' as const } };
    const a = planStairRun({ ...base, H: 2.8 });
    expect(a).toMatchObject({ risers: 16 });
    if (!('error' in a)) {
      expect(a.riserHeight).toBeCloseTo(0.175, 9);
      expect(a.tread).toBeCloseTo(0.28, 9);
    }
    const b = planStairRun({ ...base, H: 2.4 });
    if (!('error' in b)) {
      expect(b.risers).toBe(14);
      expect(b.tread).toBeCloseTo(0.63 - 2 * (2.4 / 14), 9);
    }
    expect(planStairRun({ ...base, H: 0.1 })).toEqual({ error: 'A altura é menor que um espelho: nada a gerar.' });
    expect(planStairRun({ ...base, options: { ...base.options, width: 0 }, H: 2.8 })).toEqual({ error: 'A largura do lance deve ser positiva.' });
  });
});
