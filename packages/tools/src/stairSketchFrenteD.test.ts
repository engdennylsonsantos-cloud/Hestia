import { describe, expect, it } from 'vitest';
import { clickAt, makeEnv, tool } from './testEnv.ts';
import { StairTool } from './stairTool.ts';
import { missingText } from './stairSketchState.ts';

/** Ambiente com mensagens capturadas (o `say` do ambiente), como em `stairTool.test.ts`. */
function setup() {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  ctx.options.stair = {};
  return { ...ctx, last: () => msgs[msgs.length - 1] ?? '' };
}

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

describe('ferramenta Escada: espelhos faltando e tolerância dos limites (frente D)', () => {
  it('2 de 17 espelhos: a conta "Faltam 15" vai ao croqui, e Concluir grava com aviso que diz quantos faltam', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1], -1, 1);
    expect(t.status().remaining).toBe(15);
    expect(missingText(t.status())).toBe('Faltam 15 espelhos para concluir (de 17).');
    t.setSubmode('concluir');
    expect(ctx.last()).toMatch(/^Escada criada: 2 espelhos\. Faltam 15 espelhos para concluir \(de 17\)\./);
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
    ctx.options.snap = { enabled: false };
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    clickAt(t, 1, -0.5);
    clickAt(t, 1, 0.05);
    expect(t.status().firstError).toBe('Espelho nº 1: deve ligar o limite esquerdo ao direito, mas não chega ao limite esquerdo (falta 45,0 cm).');
  });
});
