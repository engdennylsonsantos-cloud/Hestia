import { describe, expect, it } from 'vitest';
import { intersectCircleLine, intersectCircles, v2 } from './index.ts';

describe('interseção de circunferências', () => {
  it('reta que corta o círculo devolve os dois pontos', () => {
    const pts = intersectCircleLine(v2(0, 0), 5, v2(-10, 3), v2(1, 0));
    expect(pts).toHaveLength(2);
    expect(pts[0]!.x).toBeCloseTo(-4);
    expect(pts[0]!.y).toBeCloseTo(3);
    expect(pts[1]!.x).toBeCloseTo(4);
    expect(pts[1]!.y).toBeCloseTo(3);
  });

  it('reta tangente devolve um ponto (duas raízes coincidentes)', () => {
    const pts = intersectCircleLine(v2(0, 0), 5, v2(-10, 5), v2(1, 0));
    expect(pts).toHaveLength(2);
    expect(pts[0]!.x).toBeCloseTo(0);
    expect(pts[1]!.x).toBeCloseTo(0);
    expect(pts[0]!.y).toBeCloseTo(5);
  });

  it('reta sem contato devolve vazio; direção nula também', () => {
    expect(intersectCircleLine(v2(0, 0), 5, v2(-10, 6), v2(1, 0))).toEqual([]);
    expect(intersectCircleLine(v2(0, 0), 5, v2(0, 0), v2(0, 0))).toEqual([]);
  });

  it('dois círculos que se cortam devolvem os dois pontos', () => {
    const pts = intersectCircles(v2(0, 0), 5, v2(8, 0), 5);
    expect(pts).toHaveLength(2);
    for (const p of pts) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(5);
      expect(Math.hypot(p.x - 8, p.y)).toBeCloseTo(5);
      expect(p.x).toBeCloseTo(4);
      expect(Math.abs(p.y)).toBeCloseTo(3);
    }
  });

  it('círculos tangentes devolvem um ponto; separados ou concêntricos, nenhum', () => {
    const tangente = intersectCircles(v2(0, 0), 5, v2(10, 0), 5);
    expect(tangente).toHaveLength(2);
    expect(tangente[0]!.x).toBeCloseTo(5);
    expect(tangente[0]!.y).toBeCloseTo(0);
    expect(intersectCircles(v2(0, 0), 5, v2(11, 0), 5)).toEqual([]);
    expect(intersectCircles(v2(0, 0), 5, v2(0, 0), 5)).toEqual([]);
  });
});
