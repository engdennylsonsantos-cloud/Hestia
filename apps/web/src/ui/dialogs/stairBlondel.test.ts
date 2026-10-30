import { describe, expect, it } from 'vitest';
import { DEFAULT_STAIR_TYPES, type StairType } from '@hestia/model';
import { blondelLive, formulaText, round01cm, type BlondelInput } from './stairBlondel.ts';

const base = (over: Partial<StairType> = {}): StairType => ({ ...structuredClone(DEFAULT_STAIR_TYPES[0]!), ...over });
const input = (t: StairType): BlondelInput => t;

describe('conta do cartão de Blondel', () => {
  it('tipo padrão com H=3,00 m: N=17, R=17,6 cm, piso no mínimo e soma 63,2 cm dentro da faixa', () => {
    const r = blondelLive(input(base()), 3);
    expect(r.valid).toBe(true);
    expect(r.height).toBe(3);
    expect(r.risers).toBe(17);
    expect(r.quotient).toBeCloseTo(16.6667, 4);
    expect(r.riserShown).toBe(0.176);
    expect(r.treadRaw).toBeCloseTo(0.278, 4);
    expect(r.tread).toBeCloseTo(0.28, 9);
    expect(r.clamp).toBe('min');
    expect(r.sum).toBeCloseTo(0.632, 9);
    expect(r.status).toBe('ok');
    expect(r.side).toBe('in');
  });

  it('H=3,50 m: R exato 17,5 cm, piso igual ao mínimo (não abaixo) e sem limitação', () => {
    const r = blondelLive(input(base()), 3.5);
    expect(r.risers).toBe(20);
    expect(r.riser).toBeCloseTo(0.175, 9);
    expect(r.riserShown).toBe(0.175);
    expect(r.treadRaw).toBeCloseTo(0.28, 9);
    expect(r.clamp).toBeNull();
    expect(r.tread).toBeCloseTo(0.28, 9);
    expect(r.sum).toBeCloseTo(0.63, 9);
  });

  it('altura zero não é válida e zera a conta', () => {
    const r = blondelLive(input(base()), 0);
    expect(r.valid).toBe(false);
    expect(r.status).toBe('bad');
    expect(r.risers).toBe(0);
    expect(r.sum).toBe(0);
  });

  it('faixa 60 a 63 cm: soma exata 63,294 cm fica acima, avisa e informa a diferença', () => {
    const t = base({ calcMin: 0.6, calcMax: 0.63, calcTarget: 0.62 });
    const r = blondelLive(input(t), 3);
    expect(r.valid).toBe(true);
    expect(r.treadRaw).toBeCloseTo(0.268, 4);
    expect(r.tread).toBeCloseTo(0.28, 9);
    expect(r.side).toBe('above');
    expect(r.delta).toBeCloseTo(0.00294, 5);
    expect(r.status).toBe('warn');
  });
});

describe('texto da fórmula', () => {
  it('simplifica o fator 1 e mantém o separador do idioma', () => {
    expect(formulaText(2, 1, 'pt')).toBe('2·R + T');
    expect(formulaText(1, 1, 'pt')).toBe('R + T');
    expect(formulaText(2.5, 1.5, 'pt')).toBe('2,5·R + 1,5·T');
    expect(formulaText(2.5, 1.5, 'en')).toBe('2.5·R + 1.5·T');
  });
});

describe('arredondamento a 0,1 cm', () => {
  it('arredonda em metros internos', () => {
    expect(round01cm(0.176470588)).toBe(0.176);
    expect(round01cm(0.2784)).toBe(0.278);
    expect(round01cm(0.2786)).toBe(0.279);
  });
});
