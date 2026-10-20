import { describe, expect, it } from 'vitest';
import {
  insertRoofProfilePoint,
  presetArco,
  presetBorboleta,
  presetDenteSerra,
  presetDuasAguas,
  presetMansarda,
  presetUmaAgua,
  profileZAt,
  roofProfileError,
  roofProfileOk,
  roofProfileSlopeError,
  shiftProfile,
} from './roofProfilePresets.ts';

/** Inclinação (%) de cada trecho de um perfil. */
const slopes = (pts: Array<{ t: number; z: number }>): number[] => pts.slice(1).map((q, i) => (100 * Math.abs(q.z - pts[i]!.z)) / (q.t - pts[i]!.t));

describe('presetArco: arco de círculo em 12 trechos', () => {
  it('largura 8 e flecha 1: centro na cota 1, extremos na cota 0, simétrico', () => {
    const a = presetArco(8, 1);
    expect(a).toHaveLength(13);
    expect(a[0]!.t).toBe(0);
    expect(a[12]!.t).toBe(8);
    expect(a[0]!.z).toBe(0);
    expect(a[12]!.z).toBe(0);
    expect(a[6]!.t).toBeCloseTo(4, 12);
    expect(a[6]!.z).toBeCloseTo(1, 12);
    a.forEach((q, i) => expect(q.z).toBeCloseTo(a[12 - i]!.z, 9));
  });

  it('é um arco de círculo: raio (16 + 1) / 2 = 8,5 e a cota em t = 2 é 1 − 8,5 + √(8,5² − 2²)', () => {
    const a = presetArco(8, 1);
    expect(a[3]!.t).toBeCloseTo(2, 12);
    expect(a[3]!.z).toBeCloseTo(1 - 8.5 + Math.sqrt(8.5 * 8.5 - 4), 9);
  });

  it('a soma dos trechos fica a menos de 0,2 % do comprimento do arco 2·R·asin(4/R) = 8,31 m', () => {
    const a = presetArco(8, 1);
    const poly = a.slice(1).reduce((s, q, i) => s + Math.hypot(q.t - a[i]!.t, q.z - a[i]!.z), 0);
    const arc = 2 * 8.5 * Math.asin(4 / 8.5);
    expect(arc).toBeCloseTo(8.31, 1);
    expect(Math.abs(poly - arc) / arc).toBeLessThan(0.002);
  });

  it('n personalizado e flecha não positiva (perfil reto)', () => {
    expect(presetArco(10, 2, 4)).toHaveLength(5);
    expect(presetArco(8, 0).every((q) => q.z === 0)).toBe(true);
    expect(roofProfileOk(presetArco(8, 1))).toBe(true);
  });
});

describe('presets: t de 0 a largura e perfil válido', () => {
  it('todos passam roofProfileOk e têm t de 0 a L', () => {
    const L = 9;
    const all = [
      presetArco(L, 1.2),
      presetMansarda(L, 2, 1.5, 3.5),
      presetDenteSerra(L, 3, 1.5),
      presetBorboleta(L, 1),
      presetUmaAgua(L, 1),
      presetDuasAguas(L, 1.5),
    ];
    for (const pts of all) {
      expect(roofProfileOk(pts)).toBe(true);
      expect(pts[0]!.t).toBeCloseTo(0, 12);
      expect(pts[pts.length - 1]!.t).toBeCloseTo(L, 12);
    }
  });
});

describe('presetMansarda: 4 trechos, íngreme embaixo e suave em cima', () => {
  it('largura 10, inferior 2 m de altura e 1 m de largura, total 3 m: inclinações 200, 25, 25, 200 %', () => {
    const m = presetMansarda(10, 2, 1, 3);
    expect(m.map((q) => q.t)).toEqual([0, 1, 5, 9, 10]);
    expect(m.map((q) => q.z)).toEqual([0, 2, 3, 2, 0]);
    expect(slopes(m).map((x) => Math.round(x))).toEqual([200, 25, 25, 200]);
    expect(roofProfileSlopeError(m)).toBeNull();
  });

  it('o trecho de baixo é mais íngreme que o de cima', () => {
    const s = slopes(presetMansarda(12, 2.4, 1.5, 3.6));
    expect(s[0]!).toBeGreaterThan(s[1]!);
  });

  it('largura inferior maior que a metade faz o perfil inválido', () => {
    expect(roofProfileError(presetMansarda(10, 2, 6, 3))).not.toBeNull();
  });
});

describe('presetDenteSerra: águas repetidas', () => {
  it('largura 6, 3 dentes, altura 2: vales em 0, 2, 4, 6 e cumes em 1, 3, 5', () => {
    const d = presetDenteSerra(6, 3, 2);
    expect(d.map((q) => [q.t, q.z])).toEqual([[0, 0], [1, 2], [2, 0], [3, 2], [4, 0], [5, 2], [6, 0]]);
    expect(roofProfileOk(d)).toBe(true);
    expect(roofProfileSlopeError(d)).toBeNull();
  });
});

describe('presetBorboleta, uma água e duas águas', () => {
  it('borboleta de largura 8 e altura 1: vale de cota 0 em t = 4', () => {
    expect(presetBorboleta(8, 1)).toEqual([{ t: 0, z: 1 }, { t: 4, z: 0 }, { t: 8, z: 1 }]);
  });

  it('uma água de largura 5 e altura 1: dois pontos, de 0 a 1', () => {
    expect(presetUmaAgua(5, 1)).toEqual([{ t: 0, z: 0 }, { t: 5, z: 1 }]);
  });

  it('duas águas de largura 8 e altura 1,5: cumeeira em t = 4 com cota 1,5', () => {
    expect(presetDuasAguas(8, 1.5)).toEqual([{ t: 0, z: 0 }, { t: 4, z: 1.5 }, { t: 8, z: 0 }]);
  });
});

describe('validação do perfil', () => {
  it('exige pelo menos 2 pontos, números finitos e t estritamente crescente', () => {
    expect(roofProfileError([])).not.toBeNull();
    expect(roofProfileError([{ t: 0, z: 0 }])).not.toBeNull();
    expect(roofProfileError([{ t: 0, z: 0 }, { t: 0, z: 1 }])).not.toBeNull();
    expect(roofProfileError([{ t: 2, z: 0 }, { t: 1, z: 1 }])).not.toBeNull();
    expect(roofProfileError([{ t: 0, z: Number.NaN }, { t: 1, z: 1 }])).not.toBeNull();
    expect(roofProfileError([{ t: 0, z: 0 }, { t: 1, z: -0.5 }])).toBeNull();
  });

  it('trecho acima de 200 % é erro de inclinação (300 % aqui)', () => {
    expect(roofProfileSlopeError([{ t: 0, z: 0 }, { t: 1, z: 3 }])).toMatch(/300 %/);
    expect(roofProfileSlopeError([{ t: 0, z: 0 }, { t: 1, z: 2 }])).toBeNull();
  });
});

describe('utilitários do perfil', () => {
  it('profileZAt interpola e mantém a cota do ponto mais próximo fora do intervalo', () => {
    const pts = [{ t: 0, z: 0 }, { t: 8, z: 2 }];
    expect(profileZAt(pts, 4)).toBeCloseTo(1, 12);
    expect(profileZAt(pts, -3)).toBe(0);
    expect(profileZAt(pts, 20)).toBe(2);
  });

  it('insertRoofProfilePoint põe o ponto no meio do maior vão, na cota do perfil', () => {
    const out = insertRoofProfilePoint([{ t: 0, z: 0 }, { t: 8, z: 2 }], 0, 8);
    expect(out).toEqual([{ t: 0, z: 0 }, { t: 4, z: 1 }, { t: 8, z: 2 }]);
  });

  it('shiftProfile desloca só t', () => {
    expect(shiftProfile([{ t: 0, z: 1 }, { t: 2, z: 3 }], -5)).toEqual([{ t: -5, z: 1 }, { t: -3, z: 3 }]);
  });
});
