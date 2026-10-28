import { describe, expect, it } from 'vitest';
import { openingPlanPaths, type OpeningPlanOptions, type OpeningPlanPath } from './openingPlan.ts';
import { cenaEsquadria, EX2, EX3, EX4, EX5 } from './openingCompositionCases.ts';

/** Planta de composição: divisores cortados como batente, folha só na célula leaf aberta, alizar por face. */
const plano = (cutZ: number, detail: OpeningPlanOptions['detail'] = 'high'): OpeningPlanOptions => ({
  detail,
  angle: Math.PI / 2,
  planDisplay: 'symbolic',
  showSwing: true,
  swingStyle: 'arc',
  cutZ,
});

const cortes = (paths: OpeningPlanPath[], role: string): OpeningPlanPath[] => paths.filter((q) => q.role === role && q.closed && q.tone === 'cut');
const faixa = (q: OpeningPlanPath) => ({
  t0: Math.min(...q.pts.map((p) => p.t)),
  t1: Math.max(...q.pts.map((p) => p.t)),
  s0: Math.min(...q.pts.map((p) => p.s)),
  s1: Math.max(...q.pts.map((p) => p.s)),
});

describe('planta · Ex. 2 (porta + bandeira superior)', () => {
  const c = cenaEsquadria('ot_p90', EX2);

  it('travessa interna cortada como batente no plano da bandeira (z 2,12)', () => {
    const trs = cortes(openingPlanPaths(c.m, plano(2.12)), 'transom');
    expect(trs).toHaveLength(1);
    const f = faixa(trs[0]!);
    expect(f.t0).toBeCloseTo(-0.44, 6);
    expect(f.t1).toBeCloseTo(0.44, 6);
    expect(f.s0).toBeCloseTo(-0.045, 6);
    expect(f.s1).toBeCloseTo(0.045, 6);
  });

  it('abaixo do plano da travessa não há corte de divisor; a folha é uma só', () => {
    const paths = openingPlanPaths(c.m, plano(1));
    expect(cortes(paths, 'transom')).toHaveLength(0);
    expect(paths.filter((q) => q.role === 'leaf' && q.closed)).toHaveLength(1);
  });

  it('vidro da bandeira nunca vira folha em planta', () => {
    const paths = openingPlanPaths(c.m, plano(2.12));
    expect(paths.filter((q) => q.role === 'glass' && q.closed)).toHaveLength(0);
    expect(paths.filter((q) => q.role === 'leaf' && q.closed)).toHaveLength(1);
  });
});

describe('planta · Ex. 3 (porta + laterais)', () => {
  const c = cenaEsquadria('ot_p90', EX3);

  it('dois montantes cortados em z 1,0, em ±[0,44; 0,49], s ±0,045', () => {
    const ms = cortes(openingPlanPaths(c.m, plano(1)), 'mullion').map(faixa).sort((a, b) => a.t0 - b.t0);
    expect(ms).toHaveLength(2);
    expect(ms[0]!.t0).toBeCloseTo(-0.49, 6);
    expect(ms[0]!.t1).toBeCloseTo(-0.44, 6);
    expect(ms[1]!.t0).toBeCloseTo(0.44, 6);
    expect(ms[1]!.t1).toBeCloseTo(0.49, 6);
    for (const m of ms) {
      expect(m.s0).toBeCloseTo(-0.045, 6);
      expect(m.s1).toBeCloseTo(0.045, 6);
    }
  });

  it('a folha (uma só) e nenhuma face de vidro lateral fechada', () => {
    const paths = openingPlanPaths(c.m, plano(1));
    expect(paths.filter((q) => q.role === 'leaf' && q.closed)).toHaveLength(1);
    expect(paths.filter((q) => q.role === 'glass' && q.closed)).toHaveLength(0);
  });

  it('alizar só nas faces externas do conjunto: nada com |t| < 0,89', () => {
    const casings = openingPlanPaths(c.m, plano(1)).filter((q) => q.role === 'casing' && q.closed).map(faixa);
    expect(casings.length).toBeGreaterThan(0);
    for (const a of casings) expect(Math.min(Math.abs(a.t0), Math.abs(a.t1))).toBeGreaterThanOrEqual(0.89 - 1e-9);
  });
});

describe('planta · Ex. 4 (laterais + bandeira)', () => {
  const c = cenaEsquadria('ot_p90', EX4);

  it('montantes cortados em z 1,0 e travessa interna cortada no plano da bandeira', () => {
    const paths = openingPlanPaths(c.m, plano(1));
    expect(cortes(paths, 'mullion')).toHaveLength(2);
    expect(cortes(paths, 'transom')).toHaveLength(0);
    const alto = cortes(openingPlanPaths(c.m, plano(2.12)), 'transom').map(faixa);
    expect(alto).toHaveLength(1);
    expect(alto[0]!.t0).toBeCloseTo(-0.89, 6);
    expect(alto[0]!.t1).toBeCloseTo(0.89, 6);
  });

  it('uma folha fechada só (a da célula leaf)', () => {
    expect(openingPlanPaths(c.m, plano(1)).filter((q) => q.role === 'leaf' && q.closed)).toHaveLength(1);
  });
});

describe('planta · Ex. 5 (janela combinada)', () => {
  const c = cenaEsquadria('ot_j120', EX5);

  it('montante cortado em z 0,6, em [-0,15; -0,10] com a profundidade do quadro', () => {
    const ms = cortes(openingPlanPaths(c.m, plano(0.6)), 'mullion').map(faixa);
    expect(ms).toHaveLength(1);
    expect(ms[0]!.t0).toBeCloseTo(-0.15, 6);
    expect(ms[0]!.t1).toBeCloseTo(-0.1, 6);
    expect(ms[0]!.s0).toBeCloseTo(-0.045, 6);
    expect(ms[0]!.s1).toBeCloseTo(0.045, 6);
  });

  it('uma folha de abrir (a célula leaf), aberta; vidro fixo sem folha', () => {
    const paths = openingPlanPaths(c.m, plano(0.6));
    expect(paths.filter((q) => q.role === 'leaf' && q.closed)).toHaveLength(1);
    expect(paths.filter((q) => q.role === 'glass' && q.closed)).toHaveLength(0);
  });
});
