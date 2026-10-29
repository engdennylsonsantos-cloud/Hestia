import { describe, expect, it } from 'vitest';
import { clickAt, makeEnv, tool } from './testEnv.ts';

/** Projeto em centímetros, com as mensagens da ferramenta capturadas. */
function comCm() {
  const ctx = makeEnv();
  ctx.store.exec({ type: 'setSettings', patch: { units: { length: { unit: 'cm', decimals: 1 } } } });
  const msgs: string[] = [];
  return { ctx, msgs, env: { ...ctx.env, say: (m: string) => msgs.push(m) } };
}

describe('mensagens de comprimento usam a unidade do projeto', () => {
  it('parede: valor inválido cita centímetros', () => {
    const { env, msgs } = comCm();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    expect(t.type('abc')).toBe(false);
    expect(msgs.at(-1)).toBe('Valor inválido. Digite um número em centímetros.');
  });

  it('parede: comprimento não positivo cita centímetros', () => {
    const { env, msgs } = comCm();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    expect(t.type('0')).toBe(false);
    expect(msgs.at(-1)).toBe('Valor inválido. Digite o comprimento em centímetros.');
  });

  it('cota: deslocamento inválido cita centímetros', () => {
    const { env, msgs } = comCm();
    const t = tool('dimension', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    expect(t.type('abc')).toBe(false);
    expect(msgs.at(-1)).toContain('Digite o deslocamento em centímetros');
  });
});
