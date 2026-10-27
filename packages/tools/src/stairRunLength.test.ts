import { describe, expect, it } from 'vitest';
import { stairsOnLevel, type Stair, type StairRun } from '@hestia/model';
import { clickAt, makeEnv, tool } from './testEnv.ts';
import { planStairRun, regenStraightComponents, straightRiserCount } from './stairRunPlan.ts';
import { analyzeDraft, partsFromComponents, type StairLimits } from './stairSketchState.ts';
import type { Tool } from './types.ts';

/** Ambiente com mensagens capturadas: reta 1,20 m; H = 2,80 m (nível 1 com topo 0,20 m abaixo), como em stairRunTool.test. */
function setup() {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  ctx.options.stairRun = { shape: 'straight', width: 1.2, turn: 'left' };
  ctx.options.stair = { topLevelId: 'lv_1', topOffset: -0.2 };
  return { ...ctx, msgs, last: () => msgs[msgs.length - 1] ?? '' };
}

const stairsOf = (ctx: { store: { project: Parameters<typeof stairsOnLevel>[0] } }): Stair[] => stairsOnLevel(ctx.store.project, 'lv_0');
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const runOf = (s: Stair): StairRun => s.components[0] as StairRun;
/** Centro do espelho k do lance (ponto médio do espelho). */
const centerOf = (r: StairRun, k: number) => ({ x: (r.risers[k]!.a.x + r.risers[k]!.b.x) / 2, y: (r.risers[k]!.a.y + r.risers[k]!.b.y) / 2 });

describe('lance reto por comprimento: nº de espelhos casa com a distância clicada', () => {
  it('straightRiserCount: 4,20 m com H 2,80 m e espelho 0,175 m dá 16 espelhos (piso 0,28 m)', () => {
    expect(straightRiserCount(2.8, 0.175, 0.28, 4.2)).toBe(16);
  });

  it('straightRiserCount: comprimento maior pede mais espelhos, com piso mais perto do calculado', () => {
    const N = straightRiserCount(2.8, 0.175, 0.28, 5);
    expect(N).toBeGreaterThan(16);
    expect(5 / (N - 1)).toBeGreaterThanOrEqual(0.28 - 1e-9);
  });

  it('planStairRun com comprimento: piso = L ÷ (N−1) e espelho = H ÷ N', () => {
    const plan = planStairRun({
      start: { x: 0, y: 0 },
      dir: { x: 1, y: 0 },
      H: 2.8,
      maxRiser: 0.175,
      minTread: 0.28,
      options: { shape: 'straight', width: 1.2, turn: 'left' },
      length: 5,
    });
    if ('error' in plan) throw new Error(plan.error);
    expect(plan.risers).toBeGreaterThan(16);
    expect(plan.tread).toBeCloseTo(5 / (plan.risers - 1), 9);
    expect(plan.riserHeight).toBeCloseTo(2.8 / plan.risers, 9);
  });

  it('planStairRun recusa lance curto demais (piso abaixo do mínimo do tipo)', () => {
    const plan = planStairRun({
      start: { x: 0, y: 0 },
      dir: { x: 1, y: 0 },
      H: 2.8,
      maxRiser: 0.175,
      minTread: 0.28,
      options: { shape: 'straight', width: 1.2, turn: 'left' },
      length: 1,
    });
    expect('error' in plan && plan.error).toContain('Lance curto demais');
  });

  it('a ferramenta: o 2º clique define o fim do lance, e a escada criada tem o comprimento clicado', () => {
    const ctx = setup();
    const t: Tool = tool('stairrun', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4.2, 0);
    const st = stairsOf(ctx);
    expect(st).toHaveLength(1);
    const r = runOf(st[0]!);
    const N = r.risers.length;
    expect(N).toBe(16);
    expect(dist(centerOf(r, N - 1), centerOf(r, 0))).toBeCloseTo(4.2, 6);
  });
});

describe('Nº de espelhos editável: regenStraightComponents', () => {
  it('regenera com o mesmo nº de espelhos o mesmo lance (mesmos centros)', () => {
    const ctx = setup();
    const t: Tool = tool('stairrun', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4.2, 0);
    const st = stairsOf(ctx)[0]!;
    const same = regenStraightComponents(ctx.store.project, st, 16);
    if ('error' in same) throw new Error(same.error);
    const r0 = runOf(st);
    const r1 = same.components[0] as StairRun;
    for (let k = 0; k < r0.risers.length; k++) expect(dist(centerOf(r1, k), centerOf(r0, k))).toBeLessThan(1e-9);
  });

  it('mais espelhos alonga o lance com o mesmo piso, e a altura do espelho cai (H ÷ N)', () => {
    const ctx = setup();
    const t: Tool = tool('stairrun', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4.2, 0);
    const st = stairsOf(ctx)[0]!;
    const r0 = runOf(st);
    const tread = dist(centerOf(r0, 1), centerOf(r0, 0));
    const r = regenStraightComponents(ctx.store.project, st, 20);
    if ('error' in r) throw new Error(r.error);
    const r1 = r.components[0] as StairRun;
    expect(r1.risers).toHaveLength(20);
    expect(dist(centerOf(r1, 1), centerOf(r1, 0))).toBeCloseTo(tread, 9);
  });

  it('recusa escada que não é lance reto gerado', () => {
    const ctx = setup();
    const t: Tool = tool('stairrun', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4.2, 0);
    const st = stairsOf(ctx)[0]!;
    const fake: Stair = { ...st, components: [{ ...runOf(st), generatedBy: undefined }] };
    expect('error' in regenStraightComponents(ctx.store.project, fake, 20)).toBe(true);
  });
});

describe('mensagens de espelho: número, limite e folga', () => {
  const limits: StairLimits = { H: 2.8, maxRiser: 0.18, minRunWidth: 0.8 };
  const line = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, sag: 0 });

  it('espelho que não liga o limite direito diz o nº e por quanto falta', () => {
    const parts = partsFromComponents([
      {
        id: 'r1',
        kind: 'run',
        boundaryLeft: [line(-0.5, 0.6, 5, 0.6)],
        boundaryRight: [line(-0.5, -0.6, 5, -0.6)],
        risers: [line(1, 0.6, 1, -0.6), line(2, 0.6, 2, -0.3)],
        path: [],
      },
    ]);
    const rep = analyzeDraft(parts, limits);
    expect(rep.firstError).toBe('Espelho nº 2 não liga o limite direito: a extremidade mais próxima está a 0,300 m dele.');
  });

  it('dois espelhos na mesma posição dizem os dois números e a distância', () => {
    const parts = partsFromComponents([
      {
        id: 'r1',
        kind: 'run',
        boundaryLeft: [line(-0.5, 0.6, 5, 0.6)],
        boundaryRight: [line(-0.5, -0.6, 5, -0.6)],
        risers: [line(1, 0.6, 1, -0.6), line(2, 0.6, 2, -0.6), line(1, 0.6, 1, -0.6)],
        path: [],
      },
    ]);
    const rep = analyzeDraft(parts, limits);
    expect(rep.firstError).toBe('Espelhos nº 1 e nº 3 ocupam a mesma posição: as extremidades distam 0,0 cm.');
  });

  it('o texto de "faltam" diz quantos espelhos faltam para o nº desejado', () => {
    const parts = partsFromComponents([
      {
        id: 'r1',
        kind: 'run',
        boundaryLeft: [line(-0.5, 0.6, 5, 0.6)],
        boundaryRight: [line(-0.5, -0.6, 5, -0.6)],
        risers: [line(1, 0.6, 1, -0.6), line(2, 0.6, 2, -0.6)],
        path: [],
      },
    ]);
    const rep = analyzeDraft(parts, limits);
    expect(rep.desired).toBe(16);
    expect(rep.remaining).toBe(14);
  });
});
