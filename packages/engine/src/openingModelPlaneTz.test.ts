import { describe, expect, it } from 'vitest';
import { projectParts, slicePartsAtZ } from './openingModelTransforms.ts';
import { CLOSED, type OpeningModel, type OpeningPart, type PartProfile } from './openingModelTypes.ts';

/** Octógono (t, z) de raio 0,5 centrado em (t = 1, z = 2); extrudado em s entre 3 e 3,2. */
const OITO: Array<[number, number]> = Array.from({ length: 8 }, (_, k) => [
  1 + 0.5 * Math.cos((2 * Math.PI * k) / 8),
  2 + 0.5 * Math.sin((2 * Math.PI * k) / 8),
]);
const perfil: PartProfile = { plane: 'tz', pts: OITO };
const caixa = { t0: 0.5, t1: 1.5, s0: 3, s1: 3.2, z0: 1.5, z1: 2.5 };

const modelo = (parts: OpeningPart[]): OpeningModel => ({ parts }) as unknown as OpeningModel;

describe('plano tz: corte horizontal (planta)', () => {
  it('na cota do centro, o anel é o intervalo em t do octógono ao longo de s', () => {
    const peca: OpeningPart = { id: 'disco', role: 'handle', material: 'metal', box: caixa, profile: perfil };
    const [corte] = slicePartsAtZ(modelo([peca]), 2, CLOSED);
    expect(corte).toBeDefined();
    const ts = corte!.ring.map((p) => p.t);
    const ss = corte!.ring.map((p) => p.s);
    expect(Math.min(...ts)).toBeCloseTo(0.5, 9);
    expect(Math.max(...ts)).toBeCloseTo(1.5, 9);
    expect(Math.min(...ss)).toBeCloseTo(3, 9);
    expect(Math.max(...ss)).toBeCloseTo(3.2, 9);
  });

  it('fora da altura da peça não há corte', () => {
    const peca: OpeningPart = { id: 'disco', role: 'handle', material: 'metal', box: caixa, profile: perfil };
    expect(slicePartsAtZ(modelo([peca]), 3, CLOSED)).toEqual([]);
  });
});

describe('plano tz: elevação (projeção ao longo de s)', () => {
  it('sem movimento, a elevação é a seção (t, z) real, não a caixa', () => {
    const peca: OpeningPart = { id: 'disco', role: 'handle', material: 'metal', box: caixa, profile: perfil };
    const [item] = projectParts(modelo([peca]), 's', CLOSED);
    expect(item!.ring).toHaveLength(8);
    expect(item!.ring.map((p) => p.u)).toEqual(OITO.map(([t]) => t));
    expect(item!.ring.map((p) => p.z)).toEqual(OITO.map(([, z]) => z));
  });

  it('com giro de 90° em torno de z (eixo na peça), o disco vira linha de perfil na elevação', () => {
    const giro = { kind: 'rotate' as const, axis: 'z' as const, t: 1, s: 3.1, sign: 1 as const };
    const peca: OpeningPart = { id: 'disco', role: 'handle', material: 'metal', box: caixa, profile: perfil, motion: giro };
    const [item] = projectParts(modelo([peca]), 's', { angle: Math.PI / 2, slide: 0 });
    // O disco fica perpendicular à folha: visto de frente, todos os vértices caem em t = 1.
    for (const p of item!.ring) expect(p.u).toBeCloseTo(1, 9);
    expect(item!.ring.map((p) => p.z)).toEqual(OITO.map(([, z]) => z));
  });
});
