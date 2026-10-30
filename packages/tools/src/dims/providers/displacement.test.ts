import { describe, expect, it } from 'vitest';
import { createEmptyProject, dimensionSettingsOf } from '@hestia/model';
import { displacementDimProvider } from './displacement.ts';

describe('provedor de cotas do deslocamento', () => {
  it('mede a distância do ponto-base ao cursor e não edita (a digitação já existe)', () => {
    const p = createEmptyProject();
    const dims = displacementDimProvider.compute(
      { project: p, levelId: 'lv_0', settings: dimensionSettingsOf(p), overrides: {} },
      { from: { x: 0, y: 0 }, to: { x: 3, y: 4 } },
    );
    expect(dims).toHaveLength(1);
    expect(dims[0]!.value).toBeCloseTo(5, 9);
    expect(dims[0]!.edit).toBeUndefined();
    expect(displacementDimProvider.compute({ project: p, levelId: 'lv_0', settings: dimensionSettingsOf(p), overrides: {} }, { from: { x: 1, y: 1 }, to: { x: 1, y: 1 } })).toEqual([]);
  });

  it('mostra também o ângulo da direção do deslocamento, em radianos (SI)', () => {
    const p = createEmptyProject();
    const dims = displacementDimProvider.compute(
      { project: p, levelId: 'lv_0', settings: dimensionSettingsOf(p), overrides: {} },
      { from: { x: 0, y: 0 }, to: { x: 3, y: 4 } },
    );
    expect(dims[0]!.secondary).toEqual({ quantity: 'angle', value: expect.closeTo(Math.atan2(4, 3), 9) });
    // Sentido negativo também é informado (o valor não é módulo).
    const baixo = displacementDimProvider.compute(
      { project: p, levelId: 'lv_0', settings: dimensionSettingsOf(p), overrides: {} },
      { from: { x: 0, y: 0 }, to: { x: 0, y: -2 } },
    );
    expect(baixo[0]!.secondary!.value).toBeCloseTo(-Math.PI / 2, 9);
  });
});
