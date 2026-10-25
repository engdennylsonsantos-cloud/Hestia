import { describe, expect, it } from 'vitest';
import { stairsOnLevel } from '@hestia/model';
import { clickAt, makeEnv, tool } from './testEnv.ts';
import { StairTool } from './stairTool.ts';
import { missingText } from './stairSketchState.ts';
import { DEFAULT_SNAP } from './types.ts';

/** Ambiente com mensagens capturadas (o `say` do ambiente), como em `stairTool.test.ts`. */
function setup() {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  ctx.options.stair = {};
  return { ...ctx, last: () => msgs[msgs.length - 1] ?? '' };
}

const stairsOf = (store: { project: Parameters<typeof stairsOnLevel>[0] }) => stairsOnLevel(store.project, 'lv_0');

/** Limites de teste: esquerdo em y = 0,5 e direito em y = −0,5, de x = −0,5 a 5 (padrão de `stairTool.test.ts`). */
function boundaries(t: StairTool): void {
  clickAt(t, -0.5, 0.5);
  clickAt(t, 5, 0.5);
  t.confirm();
  clickAt(t, -0.5, -0.5);
  clickAt(t, 5, -0.5);
  t.confirm();
}

/** Espelhos verticais em `xs`, cada um de (x, y0) a (x, y1). */
function risers(t: StairTool, xs: number[], y0: number, y1: number): void {
  for (const x of xs) {
    clickAt(t, x, y0);
    clickAt(t, x, y1);
  }
}

/** Gerador determinístico (LCG): o ruído dos cliques à mão é sempre o mesmo entre execuções. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('ferramenta Escada: espelhos faltando e tolerância dos limites (frente D)', () => {
  it('D1: 17 espelhos a 0,28 m com cliques à mão (ruído de 0,05 a 0,15 m) e snap LIGADO concluem', () => {
    // Antes da correção: a grade (0,1 m) e a ponta do espelho anterior puxavam os cliques e dois espelhos coincidiam.
    for (const mpp of [0.005, 0.01, 0.02, 0.03]) {
      const ctx = setup();
      ctx.env.metersPerPixel = () => mpp;
      const t = tool('stair', ctx.env) as StairTool;
      boundaries(t);
      const rnd = lcg(7);
      const dev = () => (rnd() < 0.5 ? -1 : 1) * (0.05 + rnd() * 0.1);
      for (let i = 0; i < 17; i++) {
        const x = i * 0.28;
        clickAt(t, x + dev(), 0.5 + dev());
        clickAt(t, x + dev(), -0.5 + dev());
      }
      expect(t.status().firstError, `mpp ${mpp}`).toBeNull();
      expect(t.status().created, `mpp ${mpp}`).toBe(17);
      t.setSubmode('concluir');
      expect(ctx.last()).toMatch(/^Escada criada: 17 espelhos\./);
    }
  });

  it('D4: Esc com traço em curso só cancela o traço; o 2º Esc descarta o croqui e avisa quantos espelhos perdeu', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1], -1, 1);
    clickAt(t, 2, -1);
    t.cancel();
    expect(ctx.done()).toBe(0);
    expect(ctx.last()).toBe('Cadeia cancelada. Esc de novo descarta o croqui.');
    t.cancel();
    expect(ctx.done()).toBe(1);
    expect(ctx.last()).toBe('Croqui descartado (2 espelhos). Ctrl+Z não recupera: use Concluir para guardar.');
  });

  it('2 de 17 espelhos: a conta "Faltam 15" vai ao croqui, e Concluir grava com aviso que diz quantos faltam', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1], -1, 1);
    expect(t.status().remaining).toBe(15);
    expect(missingText(t.status())).toBe('Faltam 15 espelhos para concluir (de 17).');
    t.setSubmode('concluir');
    expect(ctx.last()).toMatch(/^Escada criada com 2 de 17 espelhos: faltam 15 para chegar ao nível de cima\. Edite o croqui para completar\./);
  });

  it('D2: Enter com espelhos faltando conclui como Concluir, com a mesma mensagem coerente', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, Array.from({ length: 11 }, (_, i) => i * 0.2), -0.7, 0.7);
    t.confirm();
    expect(ctx.done()).toBe(1);
    expect(stairsOf(ctx.store)).toHaveLength(1);
    expect(ctx.last()).toMatch(/^Escada criada com 11 de 17 espelhos: faltam 6 para chegar ao nível de cima\. Edite o croqui para completar\. /);
  });

  it('17 espelhos clicados a 0,2 m dos limites ligam os dois (captura de 0,4 m) e concluem', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, Array.from({ length: 17 }, (_, i) => i * 0.2), -0.7, 0.7);
    expect(t.status().firstError).toBeNull();
    expect(t.status().created).toBe(17);
    t.setSubmode('concluir');
    expect(ctx.last()).toMatch(/^Escada criada: 17 espelhos\./);
  });

  it('espelho que fica a mais de 0,4 m do limite: a mensagem diz qual espelho, o limite e quanto falta', () => {
    const ctx = setup();
    // Sem captura: a perpendicular do snap levaria a ponta ao limite e o espelho ligaria os dois.
    ctx.options.snap = { ...DEFAULT_SNAP, enabled: false };
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    clickAt(t, 1, -0.5);
    clickAt(t, 1, 0.05);
    expect(t.status().firstError).toBe('Espelho nº 1: deve ligar o limite esquerdo ao direito, mas não chega ao limite esquerdo (falta 45,0 cm).');
  });
});
