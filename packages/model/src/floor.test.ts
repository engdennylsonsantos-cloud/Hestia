import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOOR_TYPES, floorTypeThickness } from './floor.ts';

describe('tipos de piso padrão', () => {
  const byId = (id: string) => DEFAULT_FLOOR_TYPES.find((t) => t.id === id)!;

  it('ft_acab é o acabamento sobre laje: sem camada estrutural, 4 cm no total', () => {
    const t = byId('ft_acab');
    expect(t.layers.some((l) => l.function === 'structure')).toBe(false);
    expect(floorTypeThickness(t)).toBeCloseTo(0.04, 9);
    expect(t.layers[0]!.function).toBe('finish1');
  });

  it('ft_ceram continua com a camada estrutural de 12 cm (compatibilidade)', () => {
    const t = byId('ft_ceram');
    expect(t.layers.filter((l) => l.function === 'structure').map((l) => l.thickness)).toEqual([0.12]);
    expect(floorTypeThickness(t)).toBeCloseTo(0.19, 9);
  });

  it('os ids do catálogo são únicos', () => {
    const ids = DEFAULT_FLOOR_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
