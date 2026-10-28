import { describe, expect, it } from 'vitest';
import {
  defaultUnits,
  fromDisplay,
  displayIn,
  quantityUnits,
  resolveUnits,
  siFrom,
  toDisplay,
  unitSymbol,
  unitsOf,
  type AreaUnit,
  type LengthUnit,
  type Quantity,
  type QuantityUnit,
  type ResolvedUnits,
  type SlopeUnit,
  type UnitsSettings,
  type VolumeUnit,
} from './units.ts';

const resolvido = (patch: UnitsSettings): ResolvedUnits => resolveUnits(patch);

describe('padrões e resolução', () => {
  it('reproduz os padrões do programa', () => {
    const u = defaultUnits();
    expect(u.length).toEqual({ unit: 'm', decimals: 2, suppressZeros: false, denominator: 16 });
    expect(u.smallLength).toEqual({ unit: 'cm', decimals: 1, suppressZeros: false, denominator: 16 });
    expect(u.area).toEqual({ unit: 'm2', decimals: 2, suppressZeros: false, denominator: 16 });
    expect(u.volume).toEqual({ unit: 'm3', decimals: 3, suppressZeros: false, denominator: 16 });
    expect(u.angle).toEqual({ unit: 'deg', decimals: 1, suppressZeros: false, denominator: 16 });
    expect(u.slope).toEqual({ unit: 'percent', decimals: 1, suppressZeros: false, denominator: 16 });
    expect(u.decimalSymbol).toBe(',');
    expect(u.currency).toBe('R$');
  });

  it('defaultUnits devolve sempre a mesma referência', () => {
    expect(defaultUnits()).toBe(defaultUnits());
  });

  it('resolveUnits mescla campo a campo com os padrões', () => {
    const u = solve({ length: { unit: 'cm', decimals: 1 } });
    expect(u.length.unit).toBe('cm');
    expect(u.length.decimals).toBe(1);
    expect(u.length.suppressZeros).toBe(false);
    expect(u.smallLength).toEqual(defaultUnits().smallLength);
    expect(u.area).toEqual(defaultUnits().area);
  });

  it('resolveUnits limita casas decimais a 0..5', () => {
    expect(solve({ length: { unit: 'm', decimals: -3 } }).length.decimals).toBe(0);
    expect(solve({ length: { unit: 'm', decimals: 9 } }).length.decimals).toBe(5);
    expect(solve({ length: { unit: 'm', decimals: 2.4 } }).length.decimals).toBe(2);
  });

  it('resolveUnits ignora unidade incompatível e denominador inválido', () => {
    const u = resolveUnits({
      length: {
        unit: 'km' as unknown as LengthUnit,
        decimals: 2,
        denominator: 3 as unknown as 4,
      },
    });
    expect(u.length.unit).toBe('m');
    expect(u.length.denominator).toBe(16);
  });

  it('resolveUnits trata símbolo decimal e moeda', () => {
    expect(solve({ decimalSymbol: '.', currency: ' USD ' }).decimalSymbol).toBe('.');
    expect(solve({ currency: ' USD ' }).currency).toBe('USD');
    expect(solve({ currency: '   ' }).currency).toBe('R$');
  });

  it('resolveUnits(undefined) devolve os padrões', () => {
    expect(resolveUnits(undefined)).toBe(defaultUnits());
  });
});

function solve(patch: UnitsSettings): ResolvedUnits {
  return resolvido(patch);
}

describe('unitsOf', () => {
  it('sem projeto ou sem units devolve a mesma referência dos padrões', () => {
    expect(unitsOf(undefined)).toBe(defaultUnits());
    expect(unitsOf({})).toBe(defaultUnits());
    expect(unitsOf({ settings: {} })).toBe(defaultUnits());
  });

  it('memoiza por identidade de settings.units', () => {
    const units: UnitsSettings = { length: { unit: 'cm', decimals: 1 } };
    const projeto = { settings: { units } };
    const a = unitsOf(projeto);
    const b = unitsOf(projeto);
    expect(a).toBe(b);
    expect(a).not.toBe(defaultUnits());
    expect(a.length.unit).toBe('cm');
    expect(unitsOf({ settings: { units: { ...units } } })).not.toBe(a);
  });
});

describe('símbolos e unidades por grandeza', () => {
  it('lista as unidades válidas de cada grandeza', () => {
    expect(quantityUnits('length')).toEqual(['m', 'cm', 'mm', 'ft', 'in', 'ft-in']);
    expect(quantityUnits('smallLength')).toEqual(quantityUnits('length'));
    expect(quantityUnits('area')).toEqual(['m2', 'cm2', 'ft2']);
    expect(quantityUnits('volume')).toEqual(['m3', 'l', 'ft3']);
    expect(quantityUnits('angle')).toEqual(['deg', 'rad']);
    expect(quantityUnits('slope')).toEqual(['percent', 'deg']);
    expect(quantityUnits('currency')).toEqual([]);
  });

  it('devolve o símbolo de cada unidade', () => {
    const comprimentos: Array<[LengthUnit, string]> = [
      ['m', 'm'],
      ['cm', 'cm'],
      ['mm', 'mm'],
      ['ft', 'ft'],
      ['in', 'in'],
      ['ft-in', "'"],
    ];
    for (const [unit, symbol] of comprimentos) {
      expect(unitSymbol(solve({ length: { unit, decimals: 2 } }), 'length')).toBe(symbol);
      expect(unitSymbol(solve({ smallLength: { unit, decimals: 2 } }), 'smallLength')).toBe(symbol);
    }
    expect(unitSymbol(solve({ area: { unit: 'm2', decimals: 2 } }), 'area')).toBe('m²');
    expect(unitSymbol(solve({ area: { unit: 'cm2', decimals: 2 } }), 'area')).toBe('cm²');
    expect(unitSymbol(solve({ area: { unit: 'ft2', decimals: 2 } }), 'area')).toBe('ft²');
    expect(unitSymbol(solve({ volume: { unit: 'm3', decimals: 2 } }), 'volume')).toBe('m³');
    expect(unitSymbol(solve({ volume: { unit: 'l', decimals: 2 } }), 'volume')).toBe('L');
    expect(unitSymbol(solve({ volume: { unit: 'ft3', decimals: 2 } }), 'volume')).toBe('ft³');
    expect(unitSymbol(solve({ angle: { unit: 'deg', decimals: 1 } }), 'angle')).toBe('°');
    expect(unitSymbol(solve({ angle: { unit: 'rad', decimals: 1 } }), 'angle')).toBe('rad');
    expect(unitSymbol(solve({ slope: { unit: 'percent', decimals: 1 } }), 'slope')).toBe('%');
    expect(unitSymbol(solve({ slope: { unit: 'deg', decimals: 1 } }), 'slope')).toBe('°');
    expect(unitSymbol(solve({ currency: 'EUR' }), 'currency')).toBe('EUR');
  });
});

describe('conversões ida e volta', () => {
  const valores = [0, 0.0127, 1.6764, 3.5, -0.25];

  it('comprimento em todas as unidades', () => {
    const unidades: LengthUnit[] = ['m', 'cm', 'mm', 'ft', 'in', 'ft-in'];
    for (const unit of unidades) {
      const u = solve({ length: { unit, decimals: 4 } });
      for (const v of valores) {
        expect(fromDisplay(u, 'length', toDisplay(u, 'length', v))).toBeCloseTo(v, 12);
      }
    }
  });

  it('área em todas as unidades', () => {
    const unidades: AreaUnit[] = ['m2', 'cm2', 'ft2'];
    for (const unit of unidades) {
      const u = solve({ area: { unit, decimals: 4 } });
      for (const v of valores) {
        expect(fromDisplay(u, 'area', toDisplay(u, 'area', v))).toBeCloseTo(v, 12);
      }
    }
  });

  it('volume em todas as unidades', () => {
    const unidades: VolumeUnit[] = ['m3', 'l', 'ft3'];
    for (const unit of unidades) {
      const u = solve({ volume: { unit, decimals: 4 } });
      for (const v of valores) {
        expect(fromDisplay(u, 'volume', toDisplay(u, 'volume', v))).toBeCloseTo(v, 12);
      }
    }
  });

  it('ângulo em graus e radianos', () => {
    for (const unit of ['deg', 'rad'] as const) {
      const u = solve({ angle: { unit, decimals: 4 } });
      for (const v of valores) {
        expect(fromDisplay(u, 'angle', toDisplay(u, 'angle', v))).toBeCloseTo(v, 12);
      }
    }
  });

  it('inclinação: percentual e graus', () => {
    for (const unit of ['percent', 'deg'] as SlopeUnit[]) {
      const u = solve({ slope: { unit, decimals: 4 } });
      for (const v of [-0.5, 0, 0.025, 1]) {
        expect(fromDisplay(u, 'slope', toDisplay(u, 'slope', v))).toBeCloseTo(v, 12);
      }
    }
  });

  it('converte com unidade explícita', () => {
    expect(displayIn('length', 'cm', 1.2)).toBeCloseTo(120, 12);
    expect(siFrom('length', 'cm', 120)).toBeCloseTo(1.2, 12);
    expect(displayIn('volume', 'l', 0.5)).toBeCloseTo(500, 12);
    expect(siFrom('volume', 'l', 500)).toBeCloseTo(0.5, 12);
  });

  it('toDisplay de ft-in devolve pés decimais', () => {
    const u = solve({ length: { unit: 'ft-in', decimals: 2 } });
    expect(toDisplay(u, 'length', 1.6764)).toBeCloseTo(5.5, 10);
    expect(fromDisplay(u, 'length', 5.5)).toBeCloseTo(1.6764, 10);
  });

  it('currency é identidade', () => {
    const u = defaultUnits();
    expect(toDisplay(u, 'currency', 1250)).toBe(1250);
    expect(fromDisplay(u, 'currency', 1250)).toBe(1250);
  });
});

describe('tipos auxiliares', () => {
  it('Quantity cobre as sete grandezas', () => {
    const todas: Quantity[] = ['length', 'smallLength', 'area', 'volume', 'angle', 'slope', 'currency'];
    expect(new Set(todas).size).toBe(7);
    const unidade: QuantityUnit = 'cm';
    expect(unidade).toBe('cm');
  });
});
