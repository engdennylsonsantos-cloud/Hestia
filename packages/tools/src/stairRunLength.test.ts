import { describe, expect, it } from 'vitest';
import { stairsOnLevel, type Stair, type StairRun } from '@hestia/model';
import { clickAt, makeEnv, tool } from './testEnv.ts';
import { regenStraightComponents } from './stairRunEdit.ts';
import { risersForLength } from './stairRunPlan.ts';
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

describe('escada reta: o 2º clique define o comprimento e o nº de espelhos (frente D)', () => {
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

  it('2º clique a 5 m: o comprimento pede 17 espelhos (piso mais perto do ideal), e a altura do espelho acompanha', () => {
    const ctx = setup();
    drawTo(tool('stairrun', ctx.env), [0, 5]);
    expect(runOf(stairsOf(ctx.store)[0]!).risers).toHaveLength(17);
    expect(ctx.last()).toMatch(/^Escada criada: 17 espelhos de 16,5 cm/);
  });

  it('D3: 5,10 m dá 17 espelhos (piso mais perto do ideal) e a mensagem explica o ideal pela altura (16) sem "difere"', () => {
    const ctx = setup();
    drawTo(tool('stairrun', ctx.env), [0, 5.1]);
    expect(runOf(stairsOf(ctx.store)[0]!).risers).toHaveLength(17);
    expect(ctx.last()).toMatch(/^Escada criada: 17 espelhos de 16,5 cm, piso 31,9 cm\. \(o comprimento de 5,10 m permite 17; o ideal pela altura é 16: ajuste o comprimento para 4,20 m ou edite o nº de espelhos\)\. /);
    expect(ctx.last()).toMatch(/ Ctrl\+Z desfaz\.$/);
    expect(ctx.last()).not.toMatch(/difere do nº desejado/);
  });

  it('comprimento curto demais para o nº mínimo de espelhos: erro claro e nada criado', () => {
    const ctx = setup();
    drawTo(tool('stairrun', ctx.env), [0, 0.5]);
    expect(stairsOf(ctx.store)).toHaveLength(0);
    expect(ctx.last()).toMatch(/^O comprimento \(50 cm\) é curto para 16 espelhos/);
  });

  it('risersForLength: o piso não cai abaixo do mínimo e o N escolhido não passa do espelho máximo', () => {
    const r = risersForLength(2.8, 0.175, 0.25, 4.2);
    expect(r).toEqual({ risers: 16, tread: 4.2 / 15 });
    expect('error' in risersForLength(2.8, 0.175, 0.25, 0.5)).toBe(true);
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
    expect(r).toEqual({ error: 'com 30 espelhos o piso ficaria em 14,5 cm, abaixo do mínimo do tipo (20 cm).' });
  });

  it('escada que não é reta gerada não tem o nº de espelhos editável', () => {
    const ctx = setup();
    drawTo(tool('stairrun', ctx.env), [0, 4.2]);
    const s = stairsOf(ctx.store)[0]!;
    const manual = { ...s, components: [{ ...runOf(s), generatedBy: undefined }] } as Stair;
    expect('error' in regenStraightComponents(manual, 14, 0.2)).toBe(true);
  });
});
