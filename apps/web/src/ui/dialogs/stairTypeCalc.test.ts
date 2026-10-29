import { describe, expect, it } from 'vitest';
import { DEFAULT_STAIR_TYPES, type StairType } from '@hestia/model';
import { applyPreset, computeStairCalc, matchPreset, STAIR_DIALOG_PRESETS } from './stairTypeCalc.ts';

const base = (over: Partial<StairType> = {}): StairType => ({ ...structuredClone(DEFAULT_STAIR_TYPES[0]!), ...over });
const calcOf = (t: StairType): StairType => t;

describe('cálculo do piso do tipo de escada', () => {
  it('exemplo padrão: H=3,00 m, espelho máx. 18 cm e piso mín. 28 cm', () => {
    const r = computeStairCalc(calcOf(base()), 3);
    expect(r.valid).toBe(true);
    expect(r.risers).toBe(17);
    expect(r.riser).toBeCloseTo(3 / 17, 9);
    expect(r.tread).toBeCloseTo(0.28, 9);
    expect(r.sum).toBeCloseTo(2 * (3 / 17) + 0.28, 9);
    expect(r.status).toBe('ok');
    expect(r.delta).toBeCloseTo(0, 9);
    expect(r.run).toBeCloseTo(16 * 0.28, 9);
    expect(r.angleDeg).toBeCloseTo((Math.atan2(3 / 17, 0.28) * 180) / Math.PI, 6);
    expect(r.angleDeg).toBeCloseTo(32.2, 1);
  });

  it('espelho máximo 25 cm: piso no mínimo e soma fora da faixa por mais de 3 cm', () => {
    const r = computeStairCalc(calcOf(base({ maxRiser: 0.25 })), 3);
    expect(r.valid).toBe(true);
    expect(r.risers).toBe(12);
    expect(r.riser).toBeCloseTo(0.25, 9);
    expect(r.tread).toBeCloseTo(0.28, 9);
    expect(r.sum).toBeCloseTo(0.78, 9);
    expect(r.status).toBe('bad');
    expect(r.delta).toBeCloseTo(0.13, 9);
  });

  it('piso limitado pelo máximo: a soma fica fora da faixa por menos de 3 cm (aviso)', () => {
    const r = computeStairCalc(calcOf(base({ maxRiser: 0.15 })), 3);
    expect(r.risers).toBe(20);
    expect(r.tread).toBeCloseTo(0.32, 9);
    expect(r.sum).toBeCloseTo(0.62, 9);
    expect(r.status).toBe('warn');
    expect(r.delta).toBeCloseTo(0.01, 9);
  });

  it('tolerância de 0,05 cm conta como dentro da faixa', () => {
    const r = computeStairCalc(calcOf(base({ calcMin: 0.62, calcMax: 0.64 })), 3);
    expect(r.sum).toBeCloseTo(0.632941, 6);
    expect(r.status).toBe('ok');
  });

  it('entradas inválidas devolvem valid: false sem lançar', () => {
    expect(computeStairCalc(calcOf(base({ minTread: 0.35, maxTread: 0.32 })), 3)).toMatchObject({ valid: false, status: 'bad' });
    expect(computeStairCalc(calcOf(base()), 0).valid).toBe(false);
    expect(computeStairCalc(calcOf(base()), Number.NaN).valid).toBe(false);
    expect(computeStairCalc(calcOf(base({ maxRiser: 0 })), 3).valid).toBe(false);
    expect(computeStairCalc(calcOf(base({ calcTreadFactor: 0 })), 3).valid).toBe(false);
  });
});

describe('predefinições do diálogo', () => {
  it('aplicar NBR 9050 e reconhecer pela comparação dos campos', () => {
    const t: StairType = { ...base(), ...applyPreset(calcOf(base()), 'nbr9050') };
    expect(matchPreset(calcOf(t))).toBe('nbr9050');
    expect(t.minRunWidth).toBeCloseTo(1.2, 9);
  });

  it('mudar um campo em 1 mm deixa de casar (Personalizado)', () => {
    const t: StairType = { ...base(), ...applyPreset(calcOf(base()), 'nbr9050'), maxRiser: 0.181 };
    expect(matchPreset(calcOf(t))).toBe('custom');
  });

  it('o tipo padrão casa com o Padrão Hestia e cada predefinição tem todos os campos', () => {
    expect(matchPreset(calcOf(base()))).toBe('hestia');
    expect(STAIR_DIALOG_PRESETS.map((p) => p.id)).toEqual(['hestia', 'nbr9050', 'nbr9077', 'ibc']);
    for (const p of STAIR_DIALOG_PRESETS) {
      const patch = applyPreset(calcOf(base()), p.id);
      expect(patch.maxRiser).toBe(p.maxRiser);
      expect(patch.minTread).toBe(p.minTread);
      expect(patch.maxTread).toBe(p.rule.maxTread);
      expect(patch.calcTarget).toBe(p.rule.calcTarget);
      expect(patch.calcMin).toBe(p.rule.calcMin);
      expect(patch.calcMax).toBe(p.rule.calcMax);
    }
  });
});
