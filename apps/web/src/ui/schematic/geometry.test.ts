import { describe, expect, it } from 'vitest';
import type { DimensionPrim, Drawing, LabelPrim, PolygonPrim, Pt, Prim } from './drawing.ts';
import {
  bboxOf,
  checkDrawing,
  dimGeometry,
  dimTextBox,
  expandRect,
  labelBox,
  pointInPolygonStrict,
  rectsOverlap,
  sampleSegment,
  textLines,
} from './geometry.ts';

const em = 0.05;

const polygon = (id: string, pts: Pt[], role: 'body' | 'aux' = 'body'): PolygonPrim => ({
  kind: 'polygon',
  id,
  pts,
  fill: 'body',
  tone: 'body',
  weight: 'normal',
  lineStyle: 'solid',
  role,
});

const label = (id: string, at: Pt, text: string, anchor: LabelPrim['anchor'] = 'start'): LabelPrim => ({
  kind: 'label',
  id,
  at,
  text,
  anchor,
  tone: 'muted',
});

const dim = (id: string, p1: Pt, p2: Pt, axis: DimensionPrim['axis'], line: number, text = 'x'): DimensionPrim => ({
  kind: 'dimension',
  id,
  p1,
  p2,
  axis,
  line,
  text,
  tone: 'body',
});

const drawing = (prims: Prim[], over: Partial<Drawing> = {}): Drawing => ({
  frame: { x0: -0.5, y0: -0.5, x1: 1.4, y1: 1.4 },
  em,
  prims,
  meta: { kind: 'stair-section' },
  ...over,
});

const codes = (d: Drawing): string[] => checkDrawing(d).map((i) => i.code);

describe('textLines e labelBox', () => {
  it('quebra linhas', () => {
    expect(textLines('ab\ncdef')).toEqual(['ab', 'cdef']);
  });

  it('caixa com anchor start, end e middle', () => {
    const box = labelBox(label('l', [1, 2], 'Piso 28,0 cm'), em);
    expect(box.x0).toBeCloseTo(1, 10);
    expect(box.x1).toBeCloseTo(1 + 0.56 * em * 12, 10);
    expect(box.y0).toBeCloseTo(1.97125, 8);
    expect(box.y1).toBeCloseTo(2.02875, 8);
    const end = labelBox(label('l', [1, 2], 'Piso 28,0 cm', 'end'), em);
    expect(end.x1).toBeCloseTo(1, 10);
    const mid = labelBox(label('l', [1, 2], 'Piso 28,0 cm', 'middle'), em);
    expect((mid.x0 + mid.x1) / 2).toBeCloseTo(1, 10);
  });

  it('duas linhas usam a linha mais larga e a altura de duas linhas', () => {
    const box = labelBox(label('l', [0, 0], 'ab\ncdef'), em);
    expect(box.x1 - box.x0).toBeCloseTo(0.56 * em * 4, 10);
    expect(box.y1 - box.y0).toBeCloseTo(2 * 1.15 * em, 10);
  });
});

describe('dimGeometry', () => {
  it('axis x', () => {
    const g = dimGeometry(dim('d', [0, 0.18], [0.28, 0.36], 'x', 0.66), em);
    expect(g.dimLine[0]).toEqual([0, 0.66]);
    expect(g.dimLine[1]).toEqual([0.28, 0.66]);
    expect(g.ext1[0][0]).toBeCloseTo(0, 10);
    expect(g.ext1[0][1]).toBeCloseTo(0.18 + 0.0125, 10);
    expect(g.ext1[1][1]).toBeCloseTo(0.66 + 0.02, 10);
    expect(g.textAnchor).toBe('middle');
    expect(g.textAt[0]).toBeCloseTo(0.14, 10);
    expect(g.textAt[1]).toBeCloseTo(0.66 + 0.04, 10);
  });

  it('axis y', () => {
    const g = dimGeometry(dim('d', [0, 0], [0, 0.18], 'y', -0.11), em);
    expect(g.dimLine[0]).toEqual([-0.11, 0]);
    expect(g.dimLine[1]).toEqual([-0.11, 0.18]);
    expect(g.textAnchor).toBe('end');
    expect(g.textAt[0]).toBeCloseTo(-0.11 - 0.03, 10);
    expect(g.textAt[1]).toBeCloseTo(0.09, 10);
  });

  it('axis aligned', () => {
    const g = dimGeometry(dim('d', [0.84, 0.54], [0.90489, 0.43906], 'aligned', 0.08), em);
    expect(g.dimLine[0][0]).toBeCloseTo(0.84 + 0.0673, 3);
    expect(g.dimLine[0][1]).toBeCloseTo(0.54 + 0.0433, 3);
    expect(g.textAnchor).toBe('start');
  });

  it('dimTextBox acompanha o texto', () => {
    const d = dim('d', [0, 0.18], [0.28, 0.36], 'x', 0.66, 'Piso 28,0 cm');
    const box = dimTextBox(d, em);
    expect(box.x1 - box.x0).toBeCloseTo(0.56 * em * 12, 10);
    expect((box.y0 + box.y1) / 2).toBeCloseTo(0.7, 10);
  });
});

describe('geometria auxiliar', () => {
  const square: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

  it('pointInPolygonStrict exclui a borda', () => {
    expect(pointInPolygonStrict([0.5, 0.5], square, 1e-6)).toBe(true);
    expect(pointInPolygonStrict([1, 0.5], square, 1e-6)).toBe(false);
    expect(pointInPolygonStrict([2, 2], square, 1e-6)).toBe(false);
  });

  it('bboxOf, expandRect, rectsOverlap e sampleSegment', () => {
    const box = bboxOf([polygon('p', square)]);
    expect(box).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
    expect(expandRect(box, 0.5)).toEqual({ x0: -0.5, y0: -0.5, x1: 1.5, y1: 1.5 });
    expect(rectsOverlap(box, { x0: 0.5, y0: 0.5, x1: 1.5, y1: 1.5 })).toBe(true);
    expect(rectsOverlap(box, { x0: 1, y0: 0, x1: 2, y1: 1 })).toBe(false);
    expect(sampleSegment([0, 0], [1, 0], 4)).toHaveLength(5);
    expect(() => bboxOf([])).toThrow(RangeError);
  });
});

describe('checkDrawing', () => {
  it('desenho valido devolve []', () => {
    const d = drawing([polygon('body.square', [[0, 0], [1, 0], [1, 1], [0, 1]]), dim('dim.top', [0, 1], [1, 1], 'x', 1.3)], {
      em: 0.06,
      frame: { x0: -0.5, y0: -0.5, x1: 1.8, y1: 1.8 },
    });
    expect(checkDrawing(d)).toEqual([]);
  });

  it('text-overlap', () => {
    expect(codes(drawing([label('lbl.a', [0.5, 0.5], 'abc'), label('lbl.b', [0.52, 0.5], 'abc')]))).toContain('text-overlap');
  });

  it('text-on-body', () => {
    expect(codes(drawing([polygon('body.square', [[0, 0], [1, 0], [1, 1], [0, 1]]), label('lbl.a', [0.5, 0.5], 'abc')]))).toContain('text-on-body');
  });

  it('dim-on-body', () => {
    expect(
      codes(drawing([polygon('body.square', [[0, 0], [1, 0], [1, 1], [0, 1]]), dim('dim.bad', [0.2, 0], [0.2, 0.6], 'y', 0.5)])),
    ).toContain('dim-on-body');
  });

  it('out-of-frame', () => {
    expect(codes(drawing([label('lbl.far', [2, 2], 'abc')]))).toContain('out-of-frame');
  });

  it('font-too-small', () => {
    expect(codes(drawing([], { em: 0.001, frame: { x0: 0, y0: 0, x1: 1, y1: 1 } }))).toContain('font-too-small');
  });

  it('dup-id', () => {
    const a: Prim = { kind: 'line', id: 'dup', a: [0, 0], b: [0.2, 0], tone: 'muted', weight: 'thin', lineStyle: 'solid', role: 'aux' };
    const b: Prim = { kind: 'line', id: 'dup', a: [0, 0.2], b: [0.2, 0.2], tone: 'muted', weight: 'thin', lineStyle: 'solid', role: 'aux' };
    expect(codes(drawing([a, b]))).toContain('dup-id');
  });

  it('dim-inside-bbox', () => {
    expect(
      codes(drawing([polygon('body.square', [[0, 0], [1, 0], [1, 1], [0, 1]]), dim('dim.in', [0.2, 0], [0.8, 0], 'x', 0.5)])),
    ).toContain('dim-inside-bbox');
  });
});
