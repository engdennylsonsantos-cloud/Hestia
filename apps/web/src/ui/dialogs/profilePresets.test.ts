import { describe, expect, it } from 'vitest';
import { profileError, profileHeightAt, profileMax, profileMean, type ProfilePoint } from '@hestia/model';
import { insertPoint, presetDegrau, presetEmpena, presetInclinado, profileRangeError, straightProfile } from './profilePresets.ts';

describe('predefinições de perfil superior', () => {
  it('empena de 6 m com extremos 2,8 m e cumeeira 4,5 m: 3 pontos, cumeeira em t = 3', () => {
    const pts = presetEmpena(6, 2.8, 4.5);
    expect(pts).toEqual([
      { t: 0, h: 2.8 },
      { t: 3, h: 4.5 },
      { t: 6, h: 2.8 },
    ]);
    expect(profileMax(pts)).toBe(4.5);
    expect(profileHeightAt(pts, 1.5)).toBeCloseTo(3.65, 9);
  });

  it('degrau: altura baixa até o degrau e alta depois, com o valor alto no próprio t', () => {
    const pts = presetDegrau(6, 2.4, 3);
    expect(pts).toHaveLength(4);
    expect(profileHeightAt(pts, 2.9)).toBe(2.4);
    expect(profileHeightAt(pts, 3)).toBe(3);
    expect(profileHeightAt(pts, 5)).toBe(3);
  });

  it('todas as predefinições e o topo reto passam em profileError', () => {
    const samples: ProfilePoint[][] = [
      straightProfile(4, 3),
      presetInclinado(4, 2.5, 3.5),
      presetEmpena(6, 2.8, 4.5),
      presetDegrau(6, 2.4, 3),
      presetDegrau(3, 0.1, 0.2, 0),
    ];
    for (const pts of samples) expect(profileError(pts)).toBeNull();
  });

  it('inclinado: altura média é a média dos extremos', () => {
    expect(profileMean(presetInclinado(4, 2, 4), 4)).toBeCloseTo(3, 9);
  });
});

describe('edição de pontos', () => {
  it('insere no meio do maior intervalo, mantendo a ordem e a forma', () => {
    const pts: ProfilePoint[] = [
      { t: 0, h: 2 },
      { t: 1, h: 2 },
      { t: 6, h: 3 },
    ];
    const next = insertPoint(pts, 6);
    expect(next).toHaveLength(4);
    expect(next[2]).toEqual({ t: 3.5, h: profileHeightAt(pts, 3.5) });
    expect(profileError(next)).toBeNull();
    expect(profileHeightAt(next, 3.5)).toBeCloseTo(profileHeightAt(pts, 3.5), 9);
  });

  it('considera a borda final (último ponto até L) como intervalo', () => {
    const next = insertPoint([{ t: 0, h: 1 }, { t: 1, h: 1 }], 10);
    expect(next.map((q) => q.t)).toEqual([0, 1, 5.5]);
    expect(profileError(next)).toBeNull();
  });

  it('lista vazia: cria um ponto no meio da parede', () => {
    expect(insertPoint([], 4)).toEqual([{ t: 2, h: 0 }]);
  });

  it('profileRangeError acusa posições fora de [0, L]', () => {
    expect(profileRangeError(presetEmpena(6, 2.8, 4.5), 6)).toBeNull();
    expect(profileRangeError([{ t: 0, h: 1 }, { t: 7, h: 1 }], 6)).not.toBeNull();
    expect(profileRangeError([{ t: -0.5, h: 1 }, { t: 6, h: 1 }], 6)).not.toBeNull();
  });
});
