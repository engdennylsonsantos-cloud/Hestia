import { describe, expect, it } from 'vitest';
import { polygonArea, ringArea, type Vec2 } from '@hestia/geom';
import { roofAutoOffset, degToPercent, defaultRoofDir, eaveOutline, percentToDeg, roofDirFor, roofSlopeError, ROOF_DEFAULT_OFFSET } from './roofGeom.ts';
import { makeEnv } from './testEnv.ts';

const rect = (w: number, h: number): Vec2[] => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
];

const rotate = (ring: Vec2[], angle: number): Vec2[] => ring.map((q) => ({ x: q.x * Math.cos(angle) - q.y * Math.sin(angle), y: q.x * Math.sin(angle) + q.y * Math.cos(angle) }));

describe('telhado: inclinação em % e graus (B3, A3)', () => {
  it('100 % é 45° e a conversão vai e volta', () => {
    expect(percentToDeg(100)).toBeCloseTo(45, 9);
    expect(degToPercent(45)).toBeCloseTo(100, 9);
    expect(degToPercent(percentToDeg(30))).toBeCloseTo(30, 9);
  });

  it('erro para inclinação não finita, não positiva ou acima de 200 %', () => {
    expect(roofSlopeError(Number.NaN)).not.toBeNull();
    expect(roofSlopeError(0)).not.toBeNull();
    expect(roofSlopeError(-5)).not.toBeNull();
    expect(roofSlopeError(250)).not.toBeNull();
    expect(roofSlopeError(30)).toBeNull();
  });
});

describe('telhado: direção padrão da cumeeira (A4)', () => {
  it('cumeeira no lado maior do retângulo, nos dois sentidos de desenho', () => {
    expect(defaultRoofDir(rect(10, 4))).toEqual({ x: 1, y: 0 });
    expect(defaultRoofDir(rect(4, 10))).toEqual({ x: 0, y: 1 });
    expect(defaultRoofDir([...rect(10, 4)].reverse())).toEqual({ x: 1, y: 0 });
  });

  it('acompanha um retângulo girado: o eixo do lado maior, com sentido canônico', () => {
    const angle = Math.PI / 6;
    const d = defaultRoofDir(rotate(rect(10, 4), angle));
    expect(d.x).toBeCloseTo(Math.cos(angle), 9);
    expect(d.y).toBeCloseTo(Math.sin(angle), 9);
  });

  it('é determinística para o mesmo contorno', () => {
    const l = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 5 }, { x: 0, y: 5 }];
    expect(defaultRoofDir(l)).toEqual(defaultRoofDir(l));
  });

  it('Tab troca para o eixo ortogonal; uma água sobe no eixo curto', () => {
    expect(roofDirFor('gable', { x: 1, y: 0 }, false)).toEqual({ x: 1, y: 0 });
    expect(roofDirFor('gable', { x: 1, y: 0 }, true)).toEqual({ x: 0, y: 1 });
    expect(roofDirFor('shed', { x: 1, y: 0 }, false)).toEqual({ x: 0, y: 1 });
  });
});

describe('telhado: contorno do beiral pelo balanço (A2)', () => {
  it('balanço zero devolve o próprio contorno', () => {
    const r = rect(4, 3);
    expect(eaveOutline(r, 0)).toBe(r);
  });

  it('balanço de 0,5 m sobre retângulo com cantos em esquadria: área A + 0,5 × perímetro + 1', () => {
    const r = rect(4, 3);
    const eave = eaveOutline(r, 0.5);
    expect(Math.abs(ringArea(eave))).toBeCloseTo(12 + 0.5 * 14 + 1, 6);
    expect(eave).toHaveLength(4);
  });
});

describe('telhado: altura padrão do beiral (B3)', () => {
  it('sem paredes no nível, 2,8 m', () => {
    const { store } = makeEnv();
    expect(roofAutoOffset(store.project, 'lv_0')).toBe(ROOF_DEFAULT_OFFSET);
    expect(ROOF_DEFAULT_OFFSET).toBe(2.8);
  });
});

describe('telhado: área de polígono usada nos testes', () => {
  it('retângulo 4 × 3', () => {
    expect(polygonArea([rect(4, 3)])).toBeCloseTo(12, 9);
  });
});
