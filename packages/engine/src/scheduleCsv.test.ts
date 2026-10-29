import { describe, expect, it } from 'vitest';
import { defaultUnits, type ResolvedUnits } from '@hestia/model';
import { scheduleCsvCell, scheduleCsvHeader } from './scheduleCsv.ts';

const centimeters = (): ResolvedUnits => ({
  ...defaultUnits(),
  length: { ...defaultUnits().length, unit: 'cm', decimals: 1 },
  area: { ...defaultUnits().area, unit: 'cm2', decimals: 1 },
  volume: { ...defaultUnits().volume, unit: 'l', decimals: 2 },
});

describe('scheduleCsv', () => {
  it('célula usa a unidade do projeto, sem símbolo', () => {
    expect(scheduleCsvCell(defaultUnits(), 'length', 1.5, 2)).toBe('1,50');
    expect(scheduleCsvCell(centimeters(), 'length', 1.5, 1)).toBe('150,0');
    expect(scheduleCsvCell(centimeters(), 'area', 2, 1)).toBe('20000,0');
  });

  it('cabeçalho leva o símbolo da unidade do projeto', () => {
    expect(scheduleCsvHeader(defaultUnits(), 'Comprimento', 'length')).toBe('Comprimento (m)');
    expect(scheduleCsvHeader(centimeters(), 'Comprimento', 'length')).toBe('Comprimento (cm)');
    expect(scheduleCsvHeader(centimeters(), 'Área', 'area')).toBe('Área (cm²)');
  });
});
