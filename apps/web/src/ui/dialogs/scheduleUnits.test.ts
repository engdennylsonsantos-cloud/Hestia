import { describe, expect, it } from 'vitest';
import { defaultUnits, resolveUnits } from '@hestia/model';
import { scheduleCell, scheduleHeader } from './scheduleUnits.ts';

describe('formatação das células dos quadros', () => {
  it('usa as casas decimais do projeto e o símbolo no cabeçalho', () => {
    const units = defaultUnits();
    expect(scheduleCell(units, 'area', 12.345)).toBe('12,35');
    expect(scheduleHeader(units, 'Área', 'area')).toBe('Área (m²)');
  });

  it('acompanha unidades não padrão (pés quadrados e centímetros)', () => {
    const units = resolveUnits({ area: { unit: 'ft2', decimals: 1 }, smallLength: { unit: 'cm', decimals: 0 } });
    expect(scheduleCell(units, 'area', 1)).toBe('10,8');
    expect(scheduleHeader(units, 'Área', 'area')).toBe('Área (ft²)');
    expect(scheduleCell(units, 'smallLength', 0.155, 1)).toBe('15,5');
    expect(scheduleHeader(units, 'Espessura', 'smallLength')).toBe('Espessura (cm)');
  });
});
