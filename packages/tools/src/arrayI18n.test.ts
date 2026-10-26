import { describe, expect, it } from 'vitest';
import { arrayHint } from './arrayTool.ts';
import { clickAt, makeEnv, tool } from './testEnv.ts';

describe('mensagens da Matriz no idioma da interface', () => {
  it('com env.lang = en, dica, centro e rótulo do ângulo saem em inglês; sem idioma, em português', () => {
    const { env, options } = makeEnv();
    const said: string[] = [];
    env.say = (m) => {
      said.push(m);
    };
    env.lang = () => 'en';
    options.arrayKind = 'radial';
    const r = tool('array', env);
    expect(r.hint).toBe(arrayHint(false, 'en'));
    clickAt(r, 2, 0);
    expect(said.at(-1)).toMatch(/^Radial array: center at \(/);
    expect(r.inputPrompt()).toBe('Angle (degrees)');
    // Sem idioma informado (ferramentas fora do app), o texto continua em português.
    expect(arrayHint(true)).toMatch(/^Matriz radial: clique no centro/);
    expect(arrayHint(false)).toMatch(/^Matriz linear: clique no ponto base/);
  });
});
