import { describe, expect, it } from 'vitest';
import { computeSection } from './index.ts';
import { cenaEsquadria, EX2, EX3, EX4, EX5 } from './openingCompositionCases.ts';
import type { OpeningPart } from './openingModelTypes.ts';

/** Corte e elevação de composição: o modelo do vão leva membros internos e vidro de bandeira/laterais. */
const ELEVACAO = { a: { x: 0, y: -2 }, b: { x: 4, y: -2 }, depth: 4 };
const TRANSVERSAL = { a: { x: 2, y: -1 }, b: { x: 2, y: 1 }, depth: 3 };
const peca = (parts: OpeningPart[], id: string): OpeningPart => {
  const x = parts.find((q) => q.id === id);
  expect(x, `peça '${id}' ausente na seção`).toBeDefined();
  return x!;
};

describe('seção · Ex. 2 (porta + bandeira)', () => {
  const c = cenaEsquadria('ot_p90', EX2);

  it('elevação: vão de 2,60 com a bandeira de vidro e a travessa interna no modelo', () => {
    const r = computeSection(c.p, ELEVACAO);
    expect(r.openings).toHaveLength(1);
    const o = r.openings[0]!;
    expect(o.z1 - o.z0).toBeCloseTo(2.6, 6);
    expect(peca(o.model.parts, 'glass-band').box.z0).toBeCloseTo(2.15, 6);
    expect(peca(o.model.parts, 'transom-0').box.z1).toBeCloseTo(2.15, 6);
  });

  it('corte transversal: travessa interna e a superior com a profundidade do quadro (s ±0,045)', () => {
    const r = computeSection(c.p, TRANSVERSAL);
    const o = r.openings[0]!;
    expect(o.cut).toBe(true);
    for (const id of ['transom-0', 'head']) {
      const b = peca(o.model.parts, id).box;
      expect(b.s0).toBeCloseTo(-0.045, 6);
      expect(b.s1).toBeCloseTo(0.045, 6);
    }
  });
});

describe('seção · Ex. 3 (laterais)', () => {
  const c = cenaEsquadria('ot_p90', EX3);

  it('elevação: montantes e vidros laterais presentes, com o vão de 1,88 de largura', () => {
    const o = computeSection(c.p, ELEVACAO).openings[0]!;
    expect(o.t1 - o.t0).toBeCloseTo(1.88, 6);
    expect(peca(o.model.parts, 'mullion-0').box.z1).toBeCloseTo(2.1, 6);
    expect(peca(o.model.parts, 'glass-lat-e').material).toBe('glass');
    expect(peca(o.model.parts, 'glass-lat-d').material).toBe('glass');
  });
});

describe('seção · Ex. 4 (laterais + bandeira)', () => {
  const c = cenaEsquadria('ot_p90', EX4);

  it('elevação: vão 1,88 × 2,60; travessa interna contínua e vidro da bandeira no modelo', () => {
    const o = computeSection(c.p, ELEVACAO).openings[0]!;
    expect(o.t1 - o.t0).toBeCloseTo(1.88, 6);
    expect(o.z1 - o.z0).toBeCloseTo(2.6, 6);
    expect(peca(o.model.parts, 'transom-0').box.t0).toBeCloseTo(-0.89, 6);
    expect(peca(o.model.parts, 'glass-band').material).toBe('glass');
  });
});

describe('seção · Ex. 5 (janela combinada)', () => {
  const c = cenaEsquadria('ot_j120', EX5);

  it('corte transversal: montante e vidro fixo com a profundidade do quadro', () => {
    const o = computeSection(c.p, TRANSVERSAL).openings[0]!;
    const m = peca(o.model.parts, 'mullion-0').box;
    expect(m.s0).toBeCloseTo(-0.045, 6);
    expect(m.s1).toBeCloseTo(0.045, 6);
    expect(peca(o.model.parts, 'glass-fixa').material).toBe('glass');
  });
});
