import { describe, expect, it } from 'vitest';
import { defaultUnits, resolveUnits } from '@hestia/model';
import { parseQuantityText, lengthUnitName } from './numeric.ts';

const m = defaultUnits();
const cm = resolveUnits({ length: { unit: 'cm', decimals: 2 }, smallLength: { unit: 'cm', decimals: 2 } });
const deg = resolveUnits({ angle: { unit: 'deg', decimals: 1 } });

describe('parseQuantityText', () => {
  it('aceita valor com unidade antes de tentar expressão', () => {
    expect(parseQuantityText('120cm', m, 'length')).toBeCloseTo(1.2, 12);
    expect(parseQuantityText('1,2m', m, 'length')).toBeCloseTo(1.2, 12);
    expect(parseQuantityText('5%', m, 'slope')).toBeCloseTo(0.05, 12);
  });

  it('interpreta expressões na unidade de exibição', () => {
    expect(parseQuantityText('1,2+0,3', m, 'length')).toBeCloseTo(1.5, 12);
    expect(parseQuantityText('1,2+0,3', cm, 'length')).toBeCloseTo(0.015, 12);
    expect(parseQuantityText('(2+1)*0,5', cm, 'length')).toBeCloseTo(0.015, 12);
    expect(parseQuantityText('2*5', cm, 'smallLength')).toBeCloseTo(0.1, 12);
  });

  it('converte expressão de ângulo e moeda', () => {
    expect(parseQuantityText('45+45', deg, 'angle')).toBeCloseTo(Math.PI / 2, 12);
    expect(parseQuantityText('10+5', m, 'currency')).toBe(15);
  });

  it('recusa sufixo dentro de expressão e texto inválido', () => {
    expect(parseQuantityText('2*60cm', m, 'length')).toBeNull();
    expect(parseQuantityText('abc', m, 'length')).toBeNull();
    expect(parseQuantityText('', m, 'length')).toBeNull();
    expect(parseQuantityText('1/0', m, 'length')).toBeNull();
    expect(parseQuantityText('3+', m, 'length')).toBeNull();
  });

  it('não altera o comportamento de parseNumber', () => {
    expect(parseQuantityText('3,5', m, 'length')).toBeCloseTo(3.5, 12);
    expect(parseQuantityText('-2', m, 'length')).toBeCloseTo(-2, 12);
  });
});

describe('lengthUnitName', () => {
  it('nomeia a unidade de comprimento do projeto por extenso', () => {
    expect(lengthUnitName(m)).toBe('metros');
    expect(lengthUnitName(cm)).toBe('centímetros');
    expect(lengthUnitName(resolveUnits({ length: { unit: 'mm', decimals: 0 } }))).toBe('milímetros');
    expect(lengthUnitName(resolveUnits({ length: { unit: 'ft', decimals: 2 } }))).toBe('pés');
    expect(lengthUnitName(resolveUnits({ length: { unit: 'in', decimals: 2 } }))).toBe('polegadas');
    expect(lengthUnitName(resolveUnits({ length: { unit: 'ft-in', decimals: 2 } }))).toBe('pés e polegadas');
  });
});
