import { describe, expect, it } from 'vitest';
import { machineNumber } from './numberText.ts';

describe('machineNumber', () => {
  it('usa ponto decimal e remove zeros inúteis', () => {
    expect(machineNumber(1.5)).toBe('1.5');
    expect(machineNumber(2)).toBe('2');
    expect(machineNumber(1.23456)).toBe('1.235');
    expect(machineNumber(100)).toBe('100');
    expect(machineNumber(0.1 + 0.2)).toBe('0.3');
  });

  it('respeita as casas pedidas', () => {
    expect(machineNumber(1.23456, 1)).toBe('1.2');
    expect(machineNumber(1.23456, 0)).toBe('1');
    expect(machineNumber(1.5, 0)).toBe('2');
  });

  it('zera o -0 e valores que arredondam para zero', () => {
    expect(machineNumber(-0)).toBe('0');
    expect(machineNumber(-0.0004)).toBe('0');
    expect(machineNumber(0.0004, 2)).toBe('0');
  });

  it('mantém o sinal dos negativos', () => {
    expect(machineNumber(-2.25)).toBe('-2.25');
  });

  it('valor não finito vira zero', () => {
    expect(machineNumber(Number.NaN)).toBe('0');
    expect(machineNumber(Number.POSITIVE_INFINITY)).toBe('0');
  });
});
