import { describe, expect, it } from 'vitest';
import { stairsOnLevel, type Stair, type StairRun } from '@hestia/model';
import { clickAt, makeEnv, tool } from './testEnv.ts';
import { regenStraightComponents } from './stairRunEdit.ts';
import { fitRunToLength } from './stairRunPlan.ts';
import type { Tool } from './types.ts';

/** Reta de 1,20 m com H = 2,80 m (padrão de `stairRunTool.test.ts`), mensagens capturadas. */
function setup() {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  ctx.options.stairRun = { shape: 'straight', width: 1.2, turn: 'left' };
  ctx.options.stair = { topLevelId: 'lv_1', topOffset: -0.2 };
  return { ...ctx, last: () => msgs[msgs.length - 1] ?? '' };
}

/** Dois cliques: o centro do 1º espelho e o do último (o 2º clique define o comprimento e a direção). */
function drawTo(t: Tool, to: [number, number]): void {
  clickAt(t, 0, 0);
  clickAt(t, to[0], to[1]);
}

const stairsOf = (store: { project: Parameters<typeof stairsOnLevel>[0] }): Stair[] => stairsOnLevel(store.project, 'lv_0');
const runOf = (s: Stair): StairRun => s.components[0] as StairRun;
const centerOf = (r: StairRun, i: number) => ({ x: (r.risers[i]!.a.x + r.risers[i]!.b.x) / 2, y: (r.risers[i]!.a.y + r.risers[i]!.b.y) / 2 });

describe('escada reta: a altura define o nº de espelhos e o 2º clique limita o comprimento', () => {
  it('2º clique a 4,20 m: 16 espelhos de 17,5 cm e piso de 28 cm (o ideal 63 − 2h), e o último espelho cai no clique', () => {
    const ctx = setup();
    drawTo(tool('stairrun', ctx.env), [0, 4.2]);
    const [s] = stairsOf(ctx.store);
    expect(s).toBeDefined();
    const r = runOf(s!);
    expect(r.risers).toHaveLength(16);
    const last = centerOf(r, 15);
    expect(last.x).toBeCloseTo(0, 6);
    expect(last.y).toBeCloseTo(4.2, 6);
    expect(ctx.last()).toMatch(/^Escada criada: 16 espelhos de 17,5 cm, piso 28,0 cm/);
  });

  it('2º clique além do que a altura pede (5 m e 5,10 m): continua 16 espelhos de 17,5 cm, termina antes do clique e avisa', () => {
    for (const len of [5, 5.1]) {
      const ctx = setup();
      drawTo(tool('stairrun', ctx.env), [0, len]);
      const r = runOf(stairsOf(ctx.store)[0]!);
      expect(r.risers).toHaveLength(16);
      expect(centerOf(r, 15).y).toBeCloseTo(4.2, 6);
      expect(ctx.last()).toMatch(/^Escada criada: 16 espelhos de 17,5 cm, piso 28,0 cm\. \(a altura pede 16 espelhos: a escada termina a 4,20 m, antes do clique de /);
    }
  });

  it('comprimento curto demais para o nº mínimo de espelhos: erro claro e nada criado', () => {
    const ctx = setup();
    drawTo(tool('stairrun', ctx.env), [0, 0.5]);
    expect(stairsOf(ctx.store)).toHaveLength(0);
    expect(ctx.last()).toMatch(/^O comprimento \(50 cm\) é curto para 16 espelhos/);
  });

  it('fitRunToLength: N só pela altura; o piso é o ideal, encolhe com o comprimento e erra abaixo do mínimo', () => {
    expect(fitRunToLength(2.8, 0.175, 0.25, 4.2)).toEqual({ risers: 16, tread: 0.28 });
    expect(fitRunToLength(2.8, 0.175, 0.25, 40)).toEqual({ risers: 16, tread: 0.28 });
    expect(fitRunToLength(2.8, 0.175, 0.25, 3.9)).toEqual({ risers: 16, tread: 3.9 / 15 });
    expect('error' in fitRunToLength(2.8, 0.175, 0.25, 3.6)).toBe(true);
  });

  it('fitRunToLength usa a regra do tipo: alvo e piso máximo personalizados', () => {
    const rule = { minTread: 0.25, maxTread: 0.32, a: 2, b: 1, target: 0.64 };
    const a = fitRunToLength(2.8, 0.175, 0.25, 40, rule);
    expect('error' in a ? 0 : a.tread).toBeCloseTo(0.29, 12);
    const b = fitRunToLength(2.8, 0.175, 0.25, 40, { ...rule, maxTread: 0.285 });
    expect('error' in b ? 0 : b.tread).toBeCloseTo(0.285, 12);
  });
});

describe('escada reta: "Nº de espelhos" editado nas Propriedades', () => {
  it('regenera com outro N: o início e o comprimento ficam, o piso é comprimento ÷ (N − 1)', () => {
    const ctx = setup();
    drawTo(tool('stairrun', ctx.env), [0, 4.2]);
    const s = stairsOf(ctx.store)[0]!;
    const r = regenStraightComponents(s, 14, 0.2);
    expect('error' in r).toBe(false);
    const run = (r as { components: StairRun[] }).components[0]!;
    expect(run.risers).toHaveLength(14);
    expect(run.generatedBy).toBe('straight');
    expect(centerOf(run, 0).y).toBeCloseTo(0, 6);
    expect(centerOf(run, 13).y).toBeCloseTo(4.2, 6);
    expect(centerOf(run, 1).y - centerOf(run, 0).y).toBeCloseTo(4.2 / 13, 6);
  });

  it('piso abaixo do mínimo recusa a edição com a conta', () => {
    const ctx = setup();
    drawTo(tool('stairrun', ctx.env), [0, 4.2]);
    const r = regenStraightComponents(stairsOf(ctx.store)[0]!, 30, 0.2);
    expect(r).toEqual({ error: 'com 30 espelhos o piso ficaria em 14,5 cm, abaixo do mínimo do tipo (20,0 cm).' });
  });

  it('escada que não é reta gerada não tem o nº de espelhos editável', () => {
    const ctx = setup();
    drawTo(tool('stairrun', ctx.env), [0, 4.2]);
    const s = stairsOf(ctx.store)[0]!;
    const manual = { ...s, components: [{ ...runOf(s), generatedBy: undefined }] } as Stair;
    expect('error' in regenStraightComponents(manual, 14, 0.2)).toBe(true);
  });
});
