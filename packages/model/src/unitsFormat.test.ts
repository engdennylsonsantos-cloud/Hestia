import { describe, expect, it } from 'vitest';
import { formatQuantity } from './unitsFormat.ts';
import { defaultUnits, resolveUnits, type ResolvedUnits, type UnitsSettings } from './units.ts';

const com = (patch: UnitsSettings): ResolvedUnits => resolveUnits(patch);

describe('formatQuantity — padrões', () => {
  const u = defaultUnits();

  it('comprimentos', () => {
    expect(formatQuantity(u, 'length', 1.2)).toBe('1,20 m');
    expect(formatQuantity(u, 'smallLength', 0.015)).toBe('1,5 cm');
  });

  it('área, volume e ângulo', () => {
    expect(formatQuantity(u, 'area', 12.5)).toBe('12,50 m²');
    expect(formatQuantity(u, 'volume', 1.5)).toBe('1,500 m³');
    expect(formatQuantity(u, 'angle', Math.PI / 4)).toBe('45,0°');
    expect(formatQuantity(u, 'angle', Math.PI / 2)).toBe('90,0°');
  });

  it('inclinação percentual e em graus', () => {
    expect(formatQuantity(u, 'slope', 0.025)).toBe('2,5%');
    expect(formatQuantity(u, 'slope', 1)).toBe('100,0%');
    expect(formatQuantity(com({ slope: { unit: 'deg', decimals: 1 } }), 'slope', 1)).toBe('45,0°');
  });

  it('moeda', () => {
    expect(formatQuantity(u, 'currency', 1250)).toBe('R$ 1250,00');
    expect(formatQuantity(com({ currency: 'USD' }), 'currency', -3.5)).toBe('USD -3,50');
  });
});

describe('formatQuantity — opções', () => {
  it('sem unidade', () => {
    expect(formatQuantity(defaultUnits(), 'length', 1.2, { withUnit: false })).toBe('1,20');
    expect(formatQuantity(defaultUnits(), 'currency', 12, { withUnit: false })).toBe('12,00');
  });

  it('casas decimais substituídas', () => {
    expect(formatQuantity(defaultUnits(), 'length', 1.6, { decimals: 0 })).toBe('2 m');
    expect(formatQuantity(defaultUnits(), 'length', 1.2, { decimals: 4 })).toBe('1,2000 m');
    expect(formatQuantity(defaultUnits(), 'length', 1.2, { decimals: 9 })).toBe('1,20000 m');
  });

  it('trim e suppressZeros removem zeros à direita', () => {
    expect(formatQuantity(defaultUnits(), 'length', 1.2, { trim: true })).toBe('1,2 m');
    const u = com({ length: { unit: 'm', decimals: 2, suppressZeros: true } });
    expect(formatQuantity(u, 'length', 1.2)).toBe('1,2 m');
    expect(formatQuantity(u, 'length', 2)).toBe('2 m');
  });

  it('símbolo decimal do projeto', () => {
    expect(formatQuantity(com({ decimalSymbol: '.' }), 'length', 1.2)).toBe('1.20 m');
  });

  it('unidade explícita só vale para a grandeza', () => {
    expect(formatQuantity(defaultUnits(), 'length', 1.2, { unit: 'cm' })).toBe('120,00 cm');
    expect(formatQuantity(defaultUnits(), 'length', 1.2, { unit: 'm2' })).toBe('1,20 m');
    expect(formatQuantity(defaultUnits(), 'area', 0.5, { unit: 'cm2' })).toBe('5000,00 cm²');
  });
});

describe('formatQuantity — arredondamento', () => {
  it('arredonda depois de converter', () => {
    expect(formatQuantity(defaultUnits(), 'length', 0.005)).toBe('0,01 m');
    expect(formatQuantity(defaultUnits(), 'length', 0.994)).toBe('0,99 m');
    expect(formatQuantity(defaultUnits(), 'length', 0.995)).toBe('1,00 m');
    expect(formatQuantity(com({ smallLength: { unit: 'cm', decimals: 2 } }), 'smallLength', 0.00995)).toBe('1,00 cm');
  });

  it('negativos, zero e -0', () => {
    expect(formatQuantity(defaultUnits(), 'length', -1.234)).toBe('-1,23 m');
    expect(formatQuantity(defaultUnits(), 'length', -1.235)).toBe('-1,24 m');
    expect(formatQuantity(defaultUnits(), 'length', 0)).toBe('0,00 m');
    expect(formatQuantity(defaultUnits(), 'length', -0)).toBe('0,00 m');
    expect(formatQuantity(defaultUnits(), 'length', -0.001)).toBe('0,00 m');
  });
});

describe('formatQuantity — pés e polegadas', () => {
  const u = com({ length: { unit: 'ft-in', decimals: 2 } });

  it('formata pés e polegadas', () => {
    expect(formatQuantity(u, 'length', 1.6764)).toBe(`5' 6"`);
    expect(formatQuantity(u, 'length', 0.0127)).toBe(`1/2"`);
    expect(formatQuantity(u, 'length', 1.6891)).toBe(`5' 6 1/2"`);
    expect(formatQuantity(u, 'length', 0.1524)).toBe(`6"`);
    expect(formatQuantity(u, 'length', 0)).toBe(`0"`);
    expect(formatQuantity(u, 'length', -1.6764)).toBe(`-5' 6"`);
  });

  it('reduz a fração e respeita o denominador', () => {
    const oito = com({ length: { unit: 'ft-in', decimals: 2, denominator: 8 } });
    expect(formatQuantity(oito, 'length', 0.0127)).toBe(`1/2"`);
    expect(formatQuantity(oito, 'length', 0.003175)).toBe(`1/8"`);
  });

  it('ignora withUnit (o texto já traz pés e polegadas)', () => {
    expect(formatQuantity(u, 'length', 1.6764, { withUnit: false })).toBe(`5' 6"`);
  });
});

describe('formatQuantity — ângulo em radianos', () => {
  it('separa o símbolo com espaço', () => {
    expect(formatQuantity(com({ angle: { unit: 'rad', decimals: 2 } }), 'angle', Math.PI / 2)).toBe('1,57 rad');
  });
});
