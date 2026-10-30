import { describe, expect, it } from 'vitest';
import { P, makeEnv, tool } from './testEnv.ts';

describe('cota dinâmica do trecho reto da parede', () => {
  it('com o modo ortogonal, a cota segue o ponto travado e é só comprimento', () => {
    const ctx = makeEnv();
    ctx.options.orthoLock = true;
    const t = tool('wall', ctx.env);
    t.click(P(0, 0));
    t.move(P(3, 1));

    const dims = t.tempDims?.() ?? [];
    expect(dims).toHaveLength(1);
    expect(dims[0]!.key).toBe('wall:draft:length');
    expect(dims[0]!.b).toEqual({ x: 3, y: 0 });
    expect(dims[0]!.value).toBeCloseTo(3);

    // O trecho reto não tem rótulo de comprimento/ângulo: a cota dinâmica é a única medida.
    const labels = t.preview().filter((i) => i.kind === 'label');
    expect(labels.some((l) => l.text.includes('°'))).toBe(false);
    expect(labels).toEqual([]);
  });
});
