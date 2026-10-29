import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Generic } from '@hestia/model';
import { genericAt } from './pick.ts';

const gen = (id: string, levelId = 'lv_0', square = 1): Generic => ({
  id,
  kind: 'generic',
  levelId,
  name: id,
  sourceClass: 'IFCBEAM',
  mesh: { positions: [0, 0, 0, square, 0, 0, 0, square, 0], indices: [0, 1, 2] },
  outline: [
    { x: 0, y: 0 },
    { x: square, y: 0 },
    { x: square, y: square },
    { x: 0, y: square },
  ],
  order: 1,
});

const project = (...items: Generic[]) => {
  const p = createEmptyProject();
  p.elements = Object.fromEntries(items.map((g) => [g.id, g]));
  return p;
};

describe('seleção do objeto importado na planta', () => {
  it('acha dentro do contorno e na borda (tolerância de clique)', () => {
    const p = project(gen('g_a'));
    expect(genericAt(p, 'lv_0', { x: 0.5, y: 0.5 }, 0.01)).toBe('g_a');
    expect(genericAt(p, 'lv_0', { x: 1.01, y: 0.5 }, 0.01)).toBe('g_a');
  });

  it('não acha fora, em outro nível ou sem contorno', () => {
    const p = project(gen('g_a'), gen('g_b', 'lv_1'), { ...gen('g_c'), outline: undefined });
    expect(genericAt(p, 'lv_0', { x: 2, y: 2 }, 0.01)).toBeNull();
    expect(genericAt(p, 'lv_0', { x: 0.5, y: 0.5 }, 0.01)).toBe('g_a');
    expect(genericAt(p, 'lv_1', { x: 0.5, y: 0.5 }, 0.01)).toBe('g_b');
  });

  it('entre dois sobrepostos vence o de menor área', () => {
    const p = project(gen('g_grande', 'lv_0', 4), gen('g_pequeno', 'lv_0', 1));
    expect(genericAt(p, 'lv_0', { x: 0.5, y: 0.5 }, 0.01)).toBe('g_pequeno');
  });
});
