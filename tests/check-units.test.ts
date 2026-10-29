/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { scanText } from '../scripts/check-units.mjs';

const fixtures = import.meta.glob('../scripts/__fixtures__/check-units/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const fixture = (name: string): string => fixtures[`../scripts/__fixtures__/check-units/${name}`] ?? '';

describe('check-units', () => {
  it('não conta formato de máquina nem texto sem medida solta', () => {
    expect(scanText(fixture('limpo.ts'))).toBe(0);
  });

  it('conta uma vez por linha com qualquer padrão proibido', () => {
    expect(scanText(fixture('sujo.ts'))).toBe(7);
  });

  it('isenta a linha com units-ok e a linha seguinte ao comentário', () => {
    expect(scanText(fixture('isento.ts'))).toBe(0);
  });

  it('exige um motivo depois de units-ok', () => {
    expect(scanText('const a = (1).toFixed(2); // units-ok:')).toBe(1);
    expect(scanText('const a = (1).toFixed(2); // units-ok: motivo')).toBe(0);
  });
});
