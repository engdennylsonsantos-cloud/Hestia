import { describe, expect, it } from 'vitest';
import { DEFAULT_RAMP_TYPES, type RampType } from '@hestia/model';
import { optimizeRamp } from './rampLive.ts';

const type = DEFAULT_RAMP_TYPES.find((t) => t.id === 'rmt_nbr9050')!;
const S = 1 / 12;

describe('optimizeRamp — exemplos da especificação', () => {
  it('Ex.1: 1,50 m em 12 m, barra 1/12 → 8,33 %, 2 lances de 9 m, +7,2 m', () => {
    for (const mode of ['slope', 'length', 'auto'] as const) {
      const r = optimizeRamp({ H: 1.5, type, segments: [12], mode, slope: S });
      expect(r.slope).toBeCloseTo(S, 9);
      expect(r.flights).toBe(2);
      expect(r.flightLength).toBeCloseTo(9, 9);
      expect(r.pathLength).toBeCloseTo(19.2, 9);
      expect(r.delta).toBeCloseTo(7.2, 9);
      expect(r.violation).toBe(0);
      expect(r.segments[0]).toBeCloseTo(19.2, 9);
      expect(r.note).toBe('Ajustado: 8,33 %, 2 lances, +7,2 m no último trecho.');
    }
  });

  it('Ex.2: 0,80 m em 11 m, modo length → 7,27 %, sem ajuste; slope fixo trunca para 9,60 m', () => {
    const a = optimizeRamp({ H: 0.8, type, segments: [11], mode: 'length', slope: S });
    expect(a.slope).toBeCloseTo(0.8 / 11, 9);
    expect(a.flights).toBe(1);
    expect(a.delta).toBeCloseTo(0, 9);
    expect(a.segments).toEqual([11]);
    const b = optimizeRamp({ H: 0.8, type, segments: [11], mode: 'slope', slope: S });
    expect(b.slope).toBeCloseTo(S, 9);
    expect(b.delta).toBeCloseTo(-1.4, 9);
    expect(b.segments[0]).toBeCloseTo(9.6, 9);
  });

  it('Ex.3: 1,20 m em 21 m → auto 6,25 % (−0,6 m); length 6,06 %', () => {
    const a = optimizeRamp({ H: 1.2, type, segments: [21], mode: 'auto', slope: S });
    expect(a.slope).toBeCloseTo(0.0625, 9);
    expect(a.flights).toBe(2);
    expect(a.delta).toBeCloseTo(-0.6, 9);
    expect(a.segments[0]).toBeCloseTo(20.4, 9);
    const b = optimizeRamp({ H: 1.2, type, segments: [21], mode: 'length', slope: S });
    expect(b.slope).toBeCloseTo(1.2 / 19.8, 9);
    expect(b.slope).toBeLessThanOrEqual(0.0625);
    expect(b.flights).toBe(2);
    expect(b.delta).toBeCloseTo(0, 9);
  });

  it('lê a tabela editável do tipo, sem valores fixos', () => {
    const t: RampType = { ...type, normTable: [{ maxSlope: 0.1, maxRise: 2, maxFlights: null }], landingMinLength: 2 };
    const r = optimizeRamp({ H: 1.5, type: t, segments: [20], mode: 'length', slope: 0.1 });
    expect(r.violation).toBe(0);
    expect(r.flights).toBe(1);
    expect(r.slope).toBeCloseTo(0.075, 9);
  });

  it('trunca a partir do fim, passando por trechos inteiros, sem eliminar o 1º', () => {
    const r = optimizeRamp({ H: 0.8, type, segments: [6, 3, 4], mode: 'slope', slope: S, turnLanding: 1.5 });
    // 1 lance por trecho exigiria 2 giros: n >= 3, mas o desnível cabe em 1 lance; giros contam como patamares.
    expect(r.segments.length).toBeGreaterThanOrEqual(1);
    expect(r.segments[0]).toBeGreaterThan(0);
    expect(r.segments.reduce((a, b) => a + b, 0)).toBeCloseTo(r.pathLength, 9);
  });

  it('sem candidato válido devolve o de menor violação, com aviso', () => {
    const t: RampType = { ...type, normTable: [{ maxSlope: 0.05, maxRise: 0.1, maxFlights: 2 }] };
    const r = optimizeRamp({ H: 1, type: t, segments: [10], mode: 'auto', slope: 0.08 });
    expect(r.violation).toBeGreaterThan(0);
    expect(r.messages.length).toBeGreaterThan(0);
    // O de 8 % só passa do máximo de inclinação (0,03); o de 5 % estoura os 2 lances (violação maior).
    expect(r.slope).toBeCloseTo(0.08, 9);
    expect(r.violation).toBeCloseTo(0.03, 9);
    expect(r.note).toContain('Sem opção dentro da norma');
  });

  it('tabela vazia: sem verificação de norma', () => {
    const t: RampType = { ...type, normTable: [] };
    const r = optimizeRamp({ H: 1, type: t, segments: [10], mode: 'length' });
    expect(r.violation).toBe(0);
    expect(r.flights).toBe(1);
  });
});
