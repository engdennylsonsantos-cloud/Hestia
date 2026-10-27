import { describe, expect, it } from 'vitest';
import { makeEnv, clickAt, tool } from './testEnv.ts';

describe('ferramenta Texto: cancelamento', () => {
  it('cancelar depois do clique libera o ponto; o segundo cancelar sai para a seleção', () => {
    const ctx = makeEnv();
    const t = tool('text', ctx.env);
    clickAt(t, 1, 1);
    t.cancel();
    expect(ctx.done()).toBe(0);
    expect(t.type('abc')).toBe(false);
    t.cancel();
    expect(ctx.done()).toBe(1);
  });

  it('com o texto confirmado, o Enter cria a anotação e a ferramenta volta ao estado livre', () => {
    const ctx = makeEnv();
    const t = tool('text', ctx.env);
    clickAt(t, 1, 1);
    expect(t.type('Sala')).toBe(true);
    expect(t.inputPrompt()).toBeNull();
  });
});
