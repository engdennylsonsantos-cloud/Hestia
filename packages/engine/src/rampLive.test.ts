import { describe, expect, it } from 'vitest';
import { DEFAULT_RAMP_TYPES } from '@hestia/model';
import { layoutSegment, layoutUntilRise, liveRemaining, optimizeRamp } from './rampLive.ts';

const type = DEFAULT_RAMP_TYPES.find((t) => t.id === 'rmt_nbr9050')!;
const S = 1 / 12;

describe('layoutSegment', () => {
  it('patamar em linha a cada desnível máximo', () => {
    const l = layoutSegment(12, 0, S, 0.8, 1.2);
    expect(l.pieces.map((p) => p.kind)).toEqual(['flight', 'landing', 'flight']);
    expect(l.pieces[0]!.length).toBeCloseTo(9.6, 9);
    expect(l.pieces[1]!.length).toBeCloseTo(1.2, 9);
    expect(l.pieces[2]!.length).toBeCloseTo(1.2, 9);
    expect(l.rise).toBeCloseTo(0.9, 9);
    expect(l.carry).toBeCloseTo(0.1, 9);
  });

  it('não emite patamar sem distância sobrando', () => {
    const l = layoutSegment(9.6, 0, S, 0.8, 1.2);
    expect(l.pieces.map((p) => p.kind)).toEqual(['flight']);
  });

  it('respeita o desnível já acumulado no lance corrente', () => {
    const l = layoutSegment(5, 0.7, S, 0.8, 1.2);
    expect(l.pieces[0]!.length).toBeCloseTo(1.2, 9);
    expect(l.pieces[1]!.kind).toBe('landing');
  });

  it('é O(nº de lances): trecho enorme não trava', () => {
    const l = layoutSegment(5000, 0, S, 0.8, 1.2);
    expect(l.pieces.length).toBeLessThan(2000);
  });

  it('layoutUntilRise pára exatamente no desnível', () => {
    const l = layoutUntilRise(1.5, 0, S, 0.8, 1.2);
    expect(l.rise).toBeCloseTo(1.5, 9);
    expect(l.length).toBeCloseTo(18 + 1.2, 9);
    expect(l.pieces[l.pieces.length - 1]!.kind).toBe('flight');
  });
});

describe('liveRemaining', () => {
  it('exemplo A: faltam 0,60 m (≈ 7,2 m)', () => {
    const r = liveRemaining({ H: 1.5, mode: 'slope', type, slope: S, pathLength: 12 });
    if (r.mode !== 'slope') throw new Error('modo');
    expect(r.status).toBe('falta');
    expect(r.rise).toBeCloseTo(0.9, 6);
    expect(r.falta).toBeCloseTo(0.6, 6);
    expect(r.faltaLength).toBeCloseTo(7.2, 6);
  });

  it('exemplo B: passou 0,12 m (≈ 1,4 m), termina a 9,60 m', () => {
    const r = liveRemaining({ H: 0.8, mode: 'slope', type, slope: S, pathLength: 11 });
    if (r.mode !== 'slope') throw new Error('modo');
    expect(r.status).toBe('passou');
    expect(r.excess).toBeCloseTo(0.1167, 3);
    expect(r.excessLength).toBeCloseTo(1.4, 6);
    expect(r.closeAt).toBeCloseTo(9.6, 6);
  });

  it('nível alcançado dentro da tolerância de 0,005 m', () => {
    const r = liveRemaining({ H: 0.8, mode: 'slope', type, slope: S, pathLength: 9.6 + 0.4 });
    expect(r.mode === 'slope' && r.status).toBe('alcancado');
    const r2 = liveRemaining({ H: 0.8, mode: 'slope', type, slope: S, pathLength: 9.6 - 0.05 });
    expect(r2.mode === 'slope' && r2.status).toBe('alcancado');
    const r3 = liveRemaining({ H: 0.8, mode: 'slope', type, slope: S, pathLength: 9.6 - 0.1 });
    expect(r3.mode === 'slope' && r3.status).toBe('falta');
  });

  it('exemplo C: modo length resulta 12 %, faltam ≈ 2,2 m', () => {
    const r = liveRemaining({ H: 0.6, mode: 'length', type, pathLength: 5 });
    if (r.mode !== 'length') throw new Error('modo');
    expect(r.slope).toBeCloseTo(0.12, 6);
    expect(r.target).toBeCloseTo(S, 9);
    expect(r.withinNorm).toBe(false);
    expect(r.faltaLength).toBeCloseTo(2.2, 6);
  });

  it('modo length dentro da norma', () => {
    const r = liveRemaining({ H: 0.6, mode: 'length', type, pathLength: 8 });
    expect(r.mode === 'length' && r.withinNorm).toBe(true);
    expect(r.mode === 'length' && r.faltaLength).toBe(0);
  });
});

describe('inclinação zero (barra de opções)', () => {
  const finito = (o: unknown): boolean => JSON.stringify(o, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '__NF__' : v)).indexOf('__NF__') < 0;
  it('liveRemaining e optimizeRamp com slope = 0 não devolvem Infinity/NaN', () => {
    expect(finito(liveRemaining({ H: 1, type, mode: 'slope', slope: 0, pathLength: 5 }))).toBe(true);
    expect(finito(liveRemaining({ H: 1, type, mode: 'length', slope: 0, pathLength: 5 }))).toBe(true);
    for (const mode of ['slope', 'length', 'auto'] as const) {
      expect(finito(optimizeRamp({ H: 1, type, segments: [8, 4], mode, slope: 0 }))).toBe(true);
    }
  });
});
