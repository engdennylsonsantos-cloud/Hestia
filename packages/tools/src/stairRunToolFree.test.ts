import { describe, expect, it } from 'vitest';
import { DEFAULT_STAIR_TYPES, stairsOnLevel, type Stair, type StairRun } from '@hestia/model';
import { resolveStairs } from '@hestia/engine';
import { clickAt, makeEnv, tool } from './testEnv.ts';
import { StairRunTool } from './stairRunTool.ts';
import { planStairRun, planStairRunFree, type StairRunToolOptions } from './stairRunPlan.ts';
import type { StairLiveSession } from './stairLiveSession.ts';

/** Ambiente com mensagens capturadas; H = 2,80 m (nível 1 com topo 0,20 m abaixo). */
function setup(opts: Partial<StairRunToolOptions> = {}, stair: Record<string, unknown> = { topLevelId: 'lv_1', topOffset: -0.2 }) {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  ctx.options.stairRun = { shape: 'free', width: 1.0, turn: 'left', ...opts };
  ctx.options.stair = stair;
  return { ...ctx, msgs, last: () => msgs[msgs.length - 1] ?? '' };
}

const stairsOf = (ctx: { store: { project: Parameters<typeof stairsOnLevel>[0] } }, levelId = 'lv_0'): Stair[] => stairsOnLevel(ctx.store.project, levelId);
const near = (a: { x: number; y: number }, b: { x: number; y: number }, tol = 1e-6): void => {
  expect(Math.abs(a.x - b.x)).toBeLessThan(tol);
  expect(Math.abs(a.y - b.y)).toBeLessThan(tol);
};

const mono = DEFAULT_STAIR_TYPES.find((t) => t.id === 'stt_monolitica')!;

describe('planStairRunFree', () => {
  it('Exemplo 2: L de 3 + 2 m, w = 1,00: run(9), patamar, run(7); trajeto até (3; 2,18)', () => {
    const r = planStairRunFree({
      path: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }],
      H: 2.8,
      type: mono,
      options: { shape: 'free', width: 1.0, turn: 'left' },
    });
    if ('error' in r) throw new Error(r.error);
    expect(r.parts.map((p) => p.kind)).toEqual(['run', 'landing', 'run']);
    expect(r.risers).toBe(16);
    expect(r.runs).toBe(2);
    expect(r.landings).toBe(1);
    expect(r.parts.filter((p): p is { kind: 'run'; run: StairRun } => p.kind === 'run').every((p) => p.run.generatedBy === 'free')).toBe(true);
    expect(r.parts.flatMap((p) => (p.kind === 'run' ? [p.run.risers.length] : []))).toEqual([9, 7]);
    near(r.path![2]!, { x: 3, y: 2.18 });
  });

  it('erro do motor sobe como { error }', () => {
    const r = planStairRunFree({ path: [{ x: 0, y: 0 }], H: 2.8, type: mono, options: { shape: 'free', width: 1.0, turn: 'left' } });
    expect('error' in r && r.error).toBe('O trajeto precisa de ao menos dois pontos distintos.');
  });

  it('planStairRun com a forma free devolve o erro de delegação', () => {
    const r = planStairRun({
      start: { x: 0, y: 0 },
      dir: { x: 1, y: 0 },
      H: 2.8,
      maxRiser: 0.18,
      minTread: 0.28,
      options: { shape: 'free', width: 1.0, turn: 'left' },
    });
    expect(r).toEqual({ error: 'A escada livre é planejada por planStairRunFree.' });
  });
});

describe('ferramenta Escada livre: criação por trajeto', () => {
  it('L de 3 + 2 m cria UMA escada (Exemplo 2) em uma transação, com freePath e generatedBy free', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    expect(t).toBeInstanceOf(StairRunTool);
    clickAt(t, 0, 0);
    clickAt(t, 3, 0);
    clickAt(t, 3, 2);
    t.confirm();
    expect(ctx.last()).toMatch(/^Falta 1 espelho:/);
    t.confirm();
    const [s] = stairsOf(ctx);
    expect(s!.components.map((c) => c.kind)).toEqual(['run', 'landing', 'run']);
    const runs = s!.components.filter((c): c is StairRun => c.kind === 'run');
    expect(runs.map((c) => c.risers.length)).toEqual([9, 7]);
    expect(runs.every((c) => c.generatedBy === 'free')).toBe(true);
    expect(s!.freePath).toHaveLength(3);
    near(s!.freePath![0]!, { x: 0, y: 0 });
    near(s!.freePath![1]!, { x: 3, y: 0 });
    near(s!.freePath![2]!, { x: 3, y: 2.18 });
    const r = resolveStairs(ctx.store.project)[0]!;
    expect(r.riserCount).toBe(16);
    expect(r.riserHeight).toBeCloseTo(2.8 / 16, 9);
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(ctx.last()).toMatch(/^Escada criada: 16 espelhos de 17,5 cm, piso 28,0 cm, 2 lances, 1 patamar\./);
    ctx.store.undo();
    expect(stairsOf(ctx)).toHaveLength(0);
  });

  it('plano recusado mantém o rascunho e diz para voltar um ponto', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    const pts = [
      [0, 0],
      [2, 0],
      [2, 1],
      [0.5, 1],
      [0.5, -1.5],
    ] as const;
    for (const [x, y] of pts) clickAt(t, x, y);
    const sessao = (t as unknown as { session: StairLiveSession }).session;
    const antes = sessao.points;
    expect(antes).toHaveLength(5);
    t.confirm();
    expect(stairsOf(ctx)).toHaveLength(0);
    expect(ctx.last()).toMatch(/^Não é possível criar a escada: O trajeto se sobrepõe ao trecho \d+.* Backspace volta um ponto\.$/);
    expect(sessao.points).toEqual(antes);
  });

  it('a tecla A (adjust) troca N/T pelo Ajustar e mantém o trajeto', () => {
    const ctx = setup({ width: 1.2 });
    const t = tool('stairrun', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 5, 0);
    expect(t.adjust?.()).toBe(true);
    expect(ctx.last()).toBe('Ajustado: 17 espelhos de 16,5 cm, piso 31,3 cm, trajeto mantido.');
    // Ajustar não cria: ainda é rascunho (o desenho só nasce no Enter).
    expect(stairsOf(ctx)).toHaveLength(0);
    const sessao = (t as unknown as { session: StairLiveSession }).session;
    expect(sessao.points).toHaveLength(2);
    near(sessao.points[1]!, { x: 5, y: 0 });
  });

  it('a forma reta continua criando como antes', () => {
    const ctx = setup({ shape: 'straight', width: 1.2 });
    const t = tool('stairrun', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 0, 4.2);
    const [s] = stairsOf(ctx);
    expect(s!.components).toHaveLength(1);
    expect(ctx.last()).toMatch(/^Escada criada: 16 espelhos de 17,5 cm, piso 28,0 cm\./);
  });
});
