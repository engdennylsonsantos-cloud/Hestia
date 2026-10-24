import { describe, it, expect } from 'vitest';
import { ringArea, type Vec2 } from '@hestia/geom';
import { splitRingByLine } from './splitRing.ts';

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

const area = (r: Vec2[]): number => Math.abs(ringArea(r));

/** Lados de cada anel: X = esquerda do sentido a→b. */
const centroidX = (r: Vec2[]): number => r.reduce((s, p) => s + p.x, 0) / r.length;

describe('splitRingByLine', () => {
  it('retângulo 4x3 cortado por x = 1 vira dois anéis de áreas 3 e 9', () => {
    const ring = rect(0, 0, 4, 3);
    const out = splitRingByLine(ring, { x: 1, y: -1 }, { x: 1, y: 4 });
    expect(out).not.toBeNull();
    const [left, right] = out!;
    // Esquerda do sentido de baixo para cima é x < 1.
    expect(area(left!)).toBeCloseTo(3, 9);
    expect(area(right!)).toBeCloseTo(9, 9);
    expect(centroidX(left!)).toBeLessThan(1);
    expect(centroidX(right!)).toBeGreaterThan(1);
    // Os pontos de corte aparecem nas duas partes.
    expect(left!.some((p) => p.x === 1 && p.y === 0)).toBe(true);
    expect(right!.some((p) => p.x === 1 && p.y === 3)).toBe(true);
  });

  it('reta que não cruza o anel devolve null', () => {
    expect(splitRingByLine(rect(0, 0, 4, 3), { x: 10, y: -1 }, { x: 10, y: 4 })).toBeNull();
  });

  it('reta que passa por vértice devolve null (caso limite não resolvido)', () => {
    // Diagonal (0,0)-(4,3) passa pelos dois vértices opostos.
    expect(splitRingByLine(rect(0, 0, 4, 3), { x: 0, y: 0 }, { x: 4, y: 3 })).toBeNull();
    // Reta colinear a uma aresta (x = 0) também toca vértices.
    expect(splitRingByLine(rect(0, 0, 4, 3), { x: 0, y: -1 }, { x: 0, y: 4 })).toBeNull();
  });

  it('reta que cruza anel côncavo mais de duas vezes devolve null', () => {
    // Forma em U: a reta y = 2 cruza os dois braços (4 cruzamentos).
    const u: Vec2[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
    ];
    expect(splitRingByLine(u, { x: -1, y: 2 }, { x: 4, y: 2 })).toBeNull();
  });

  it('L-shape cortado por y = 1 gera duas partes de áreas 8 e 4', () => {
    const l: Vec2[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ];
    const out = splitRingByLine(l, { x: -1, y: 1 }, { x: 5, y: 1 });
    expect(out).not.toBeNull();
    const [above, below] = out!;
    // Esquerda de um sentido para +x é y > 1: a parte de cima (área 8) vem primeiro.
    expect(area(above!)).toBeCloseTo(8, 9);
    expect(area(below!)).toBeCloseTo(4, 9);
    expect(above!.every((p) => p.y >= 1 - 1e-9)).toBe(true);
    expect(below!.every((p) => p.y <= 1 + 1e-9)).toBe(true);
  });

  it('preserva a orientação horária e a anti-horária da entrada', () => {
    const ccw = rect(0, 0, 4, 3);
    const cw = [...ccw].reverse();
    expect(ringArea(ccw)).toBeGreaterThan(0);
    expect(ringArea(cw)).toBeLessThan(0);

    const fromCcw = splitRingByLine(ccw, { x: 1, y: -1 }, { x: 1, y: 4 })!;
    const fromCw = splitRingByLine(cw, { x: 1, y: -1 }, { x: 1, y: 4 })!;

    expect(ringArea(fromCcw[0]!)).toBeGreaterThan(0);
    expect(ringArea(fromCcw[1]!)).toBeGreaterThan(0);
    expect(ringArea(fromCw[0]!)).toBeLessThan(0);
    expect(ringArea(fromCw[1]!)).toBeLessThan(0);
    // Mesmas áreas, mesmo lado, independentemente da orientação.
    expect(area(fromCw[0]!)).toBeCloseTo(3, 9);
    expect(area(fromCw[1]!)).toBeCloseTo(9, 9);
  });

  it('não muta o anel de entrada', () => {
    const ring = rect(0, 0, 4, 3);
    const snapshot = JSON.parse(JSON.stringify(ring));
    splitRingByLine(ring, { x: 1, y: -1 }, { x: 1, y: 4 });
    expect(ring).toEqual(snapshot);
  });
});
