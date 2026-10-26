import { describe, expect, it } from 'vitest';
import { ringArea } from './polygon.ts';
import type { SketchSeg } from './sketchTypes.ts';
import { validateSketch } from './sketchValidate.ts';

type P = [number, number];

const line = (id: string, a: P, b: P): SketchSeg => ({ id, a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } });
const arc = (id: string, a: P, b: P, sag: number): SketchSeg => ({ ...line(id, a, b), sag });

/** Retângulo de quatro linhas, anti-horário, com ids `${p}0..3`. */
function rect(p: string, x0: number, y0: number, x1: number, y1: number): SketchSeg[] {
  return [
    line(`${p}0`, [x0, y0], [x1, y0]),
    line(`${p}1`, [x1, y0], [x1, y1]),
    line(`${p}2`, [x1, y1], [x0, y1]),
    line(`${p}3`, [x0, y1], [x0, y0]),
  ];
}

const codes = (segs: SketchSeg[]): string[] => validateSketch(segs).issues.map((i) => i.code);

describe('validateSketch', () => {
  it('sem linhas devolve vazio', () => {
    const r = validateSketch([]);
    expect(r.ok).toBe(false);
    expect(r.loops).toEqual([]);
    expect(r.issues.map((i) => i.code)).toEqual(['empty']);
  });

  it('retângulo fechado é válido, com um laço externo', () => {
    const r = validateSketch(rect('r', 0, 0, 10, 10));
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.loops).toHaveLength(1);
    expect(r.loops[0]!.role).toBe('outer');
    expect(r.loops[0]!.segs.map((s) => s.id)).toHaveLength(4);
    expect(Math.abs(ringArea(r.loops[0]!.ring))).toBeCloseTo(100, 6);
  });

  it('retângulo com furo interno é válido; o externo vem primeiro', () => {
    const r = validateSketch([...rect('h', 2, 2, 4, 4), ...rect('o', 0, 0, 10, 10)]);
    expect(r.ok).toBe(true);
    expect(r.loops.map((l) => l.role)).toEqual(['outer', 'hole']);
    expect(Math.abs(ringArea(r.loops[0]!.ring))).toBeCloseTo(100, 6);
    expect(Math.abs(ringArea(r.loops[1]!.ring))).toBeCloseTo(4, 6);
  });

  it('furo que encosta na borda por um vértice dá laços se tocam', () => {
    // Vértice (5,0) do triângulo cai no meio da aresta inferior do retângulo.
    const tri = [line('t0', [5, 0], [7, 3]), line('t1', [7, 3], [3, 3]), line('t2', [3, 3], [5, 0])];
    const r = validateSketch([...rect('o', 0, 0, 10, 10), ...tri]);
    expect(r.ok).toBe(false);
    expect(codes([...rect('o', 0, 0, 10, 10), ...tri])).toEqual(['loops-touch']);
    const touch = r.issues[0]!;
    expect(touch.at!.x).toBeCloseTo(5);
    expect(touch.at!.y).toBeCloseTo(0);
  });

  it('dois laços que compartilham um canto dão laços se tocam', () => {
    const shared = [line('s0', [0, 0], [3, 1]), line('s1', [3, 1], [1, 3]), line('s2', [1, 3], [0, 0])];
    expect(codes([...rect('o', 0, 0, 10, 10), ...shared])).toEqual(['loops-touch']);
  });

  it('laço aberto gera erro open', () => {
    const open = [line('a', [0, 0], [10, 0]), line('b', [10, 0], [10, 10]), line('c', [10, 10], [0, 10])];
    const r = validateSketch(open);
    expect(r.ok).toBe(false);
    expect(r.loops).toEqual([]);
    expect(r.issues.map((i) => i.code)).toEqual(['open']);
    expect(r.issues[0]!.segIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('linha única ou D com reta e arco é laço com poucos lados', () => {
    const d = [line('l', [0, 0], [2, 0]), arc('a', [2, 0], [0, 0], 1)];
    expect(codes(d)).toEqual(['too-few']);
  });

  it('linha de comprimento zero é apontada e não entra no laço', () => {
    const r = validateSketch([...rect('r', 0, 0, 10, 10), line('z', [5, 5], [5, 5])]);
    expect(r.issues.map((i) => i.code)).toEqual(['zero-length']);
    expect(r.issues[0]!.segIds).toEqual(['z']);
    expect(r.loops).toHaveLength(1);
    expect(r.ok).toBe(false);
  });

  it('autointerseção em oito (duas diagonais se cruzam) é self-cross', () => {
    const bow = [line('e0', [0, 0], [10, 10]), line('e1', [10, 10], [10, 0]), line('e2', [10, 0], [0, 10]), line('e3', [0, 10], [0, 0])];
    const r = validateSketch(bow);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(['self-cross']);
    expect(r.issues[0]!.segIds.sort()).toEqual(['e0', 'e2']);
    expect(r.issues[0]!.at!.x).toBeCloseTo(5);
    expect(r.issues[0]!.at!.y).toBeCloseTo(5);
  });

  it('linha colinear sobreposta a uma aresta é overlap', () => {
    const segs = [...rect('r', 0, 0, 10, 10), line('x', [3, 0], [7, 0])];
    expect(codes(segs)).toContain('overlap');
    expect(validateSketch(segs).ok).toBe(false);
  });

  it('aresta dividida em dois trechos colineares continua válida', () => {
    const segs = [line('a', [0, 0], [5, 0]), line('b', [5, 0], [10, 0]), line('c', [10, 0], [10, 10]), line('d', [10, 10], [0, 10]), line('e', [0, 10], [0, 0])];
    expect(validateSketch(segs).ok).toBe(true);
  });

  it('círculo feito de dois arcos de 180° é um laço válido', () => {
    const r = validateSketch([arc('a', [-1, 0], [1, 0], 1), arc('b', [1, 0], [-1, 0], 1)]);
    expect(r.ok).toBe(true);
    expect(r.loops).toHaveLength(1);
    // Anel amostrado com erro de corda de 2 mm: área inscrita um pouco menor que π.
    expect(Math.abs(ringArea(r.loops[0]!.ring))).toBeCloseTo(Math.PI, 1);
  });

  it('lente de dois arcos é um laço válido', () => {
    const r = validateSketch([arc('a', [0, 0], [2, 0], 0.5), arc('b', [2, 0], [0, 0], 0.5)]);
    expect(r.ok).toBe(true);
    expect(r.loops).toHaveLength(1);
  });

  it('furos que se cruzam dão laços se cruzam', () => {
    const segs = [...rect('o', 0, 0, 10, 10), ...rect('p', 2, 2, 5, 5), ...rect('q', 4, 4, 7, 7)];
    const r = validateSketch(segs);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(['loops-cross']);
  });

  it('furo que sai do externo dá furo fora do externo', () => {
    const segs = [...rect('o', 0, 0, 10, 10), ...rect('h', 8, 4, 12, 6)];
    expect(codes(segs)).toEqual(['hole-outside']);
  });

  it('laço dentro de furo é hole-in-hole', () => {
    const segs = [...rect('o', 0, 0, 10, 10), ...rect('a', 3, 3, 7, 7), ...rect('b', 4, 4, 6, 6)];
    const r = validateSketch(segs);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(['hole-in-hole']);
    expect(r.loops.map((l) => l.role)).toEqual(['outer', 'hole', 'hole']);
  });

  it('dois contornos externos disjuntos são multi-outer', () => {
    const r = validateSketch([...rect('a', 0, 0, 10, 10), ...rect('b', 20, 20, 25, 25)]);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(['multi-outer']);
  });
});
