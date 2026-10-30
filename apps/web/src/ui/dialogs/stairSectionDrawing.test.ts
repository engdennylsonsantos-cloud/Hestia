import { describe, expect, it } from 'vitest';
import { DEFAULT_STAIR_TYPES } from '@hestia/model';
import type { DimensionPrim, LabelPrim, PolygonPrim, Drawing } from '../schematic/drawing.ts';
import { checkDrawing } from '../schematic/geometry.ts';
import { buildStairSectionDrawing, STAIR_DRAWING_TEXT } from './stairSectionDrawing.ts';

const base = DEFAULT_STAIR_TYPES[0]!;

const mono = { ...base, runStyle: 'monolithic' as const, undersideStyle: 'smooth' as const, structuralDepth: 0.12, nosing: 0.015, minHeadroom: 2.1 };
const stepped = { ...mono, undersideStyle: 'stepped' as const };
const assembled = {
  ...base,
  runStyle: 'assembled' as const,
  structuralDepth: 0,
  treadThickness: 0.03,
  riserThickness: 0.02,
  nosing: 0.015,
};
const post = { ...base, runStyle: 'post' as const, structuralDepth: 0, treadThickness: 0.04, treadOverlap: 0.02, nosing: 0.015 };

const byId = (d: Drawing, id: string): PolygonPrim | DimensionPrim | LabelPrim => d.prims.find((p) => p.id === id) as PolygonPrim | DimensionPrim | LabelPrim;
const poly = (d: Drawing, id: string): PolygonPrim => byId(d, id) as PolygonPrim;
const dim = (d: Drawing, id: string): DimensionPrim => byId(d, id) as DimensionPrim;
const label = (d: Drawing, id: string): LabelPrim => byId(d, id) as LabelPrim;
const has = (d: Drawing, id: string): boolean => d.prims.some((p) => p.id === id);

const expectPoint = (p: readonly [number, number], x: number, y: number): void => {
  expect(p[0]).toBeCloseTo(x, 4);
  expect(p[1]).toBeCloseTo(y, 4);
};

describe('buildStairSectionDrawing monolítica lisa', () => {
  const d = buildStairSectionDrawing(mono, { riser: 0.18, tread: 0.28 });

  it('desenha o corpo com 9 pontos', () => {
    const run = poly(d, 'body.run');
    expect(run.pts).toHaveLength(9);
    const expected: Array<[number, number]> = [
      [0, 0],
      [0, 0.18],
      [0.28, 0.18],
      [0.28, 0.36],
      [0.56, 0.36],
      [0.56, 0.54],
      [0.84, 0.54],
      [0.84, 0.39734],
      [0.22192, 0],
    ];
    expected.forEach(([x, y], i) => expectPoint(run.pts[i]!, x, y));
  });

  it('guia dos narizes e do fundo', () => {
    const pitch = d.prims.find((p) => p.id === 'guide.pitch');
    expect(pitch?.kind).toBe('polyline');
    if (pitch?.kind !== 'polyline') return;
    expectPoint(pitch.pts[0]!, 0, 0.18);
    expectPoint(pitch.pts[1]!, 0.56, 0.54);
    const under = d.prims.find((p) => p.id === 'guide.under');
    expect(under?.kind).toBe('line');
    if (under?.kind !== 'line') return;
    expectPoint(under.a, 0.84, 0.39734);
    expectPoint(under.b, 0.90489, 0.43906);
  });

  it('textos das cotas e rótulos', () => {
    expect(dim(d, 'dim.riser').text).toBe('Espelho 18,0 cm');
    expect(dim(d, 'dim.tread').text).toBe('Piso 28,0 cm');
    expect(label(d, 'lbl.theta').text).toBe('θ = 32,7°');
    expect(label(d, 'lbl.nosing').text).toBe('Nariz 1,5 cm');
    expect(dim(d, 'dim.thick').text).toBe('Espessura estrutural\n12,0 cm ⟂ à rampa');
    expect(dim(d, 'dim.headroom').text).toBe('Pé-direito\nmín. 2,10 m');
    expect(dim(d, 'dim.headroom').broken).toBe(true);
    expect(dim(d, 'dim.headroom').p2[1] - dim(d, 'dim.headroom').p1[1]).toBeCloseTo(3 * d.em, 4);
  });

  it('passa no verificador e na escala minima', () => {
    expect(checkDrawing(d)).toEqual([]);
    expect(d.em / (d.frame.x1 - d.frame.x0)).toBeGreaterThanOrEqual(0.026);
  });

  it('nao tem cor literal nem ids repetidos', () => {
    expect(JSON.stringify(d)).not.toContain('#');
    expect(checkDrawing(d).some((i) => i.code === 'dup-id')).toBe(false);
  });
});

describe('buildStairSectionDrawing monolítica escalonada', () => {
  const d = buildStairSectionDrawing(stepped, { riser: 0.18, tread: 0.28 });

  it('desenha o fundo em dentes', () => {
    const run = poly(d, 'body.run');
    expect(run.pts).toHaveLength(13);
    const wanted: Array<[number, number]> = [
      [0.84, 0.21734],
      [0.56, 0.21734],
      [0.56, 0.03734],
      [0.28, 0.03734],
      [0.28, 0],
    ];
    for (const [x, y] of wanted) {
      expect(run.pts.some((p) => Math.abs(p[0] - x) < 1e-4 && Math.abs(p[1] - y) < 1e-4)).toBe(true);
    }
  });

  it('passa no verificador', () => {
    expect(checkDrawing(d)).toEqual([]);
  });
});

describe('buildStairSectionDrawing montada', () => {
  const d = buildStairSectionDrawing(assembled, { riser: 0.18, tread: 0.28 });

  it('tem pisos e espelhos, sem nariz', () => {
    for (let i = 0; i < 3; i++) {
      expect(has(d, `body.tread.${i}`)).toBe(true);
      expect(has(d, `body.riser.${i}`)).toBe(true);
    }
    expect(has(d, 'body.nosing.0')).toBe(false);
    expect(has(d, 'dim.thick')).toBe(false);
    expectPoint(poly(d, 'body.tread.0').pts[0]!, -0.015, 0.15);
    expectPoint(poly(d, 'body.tread.0').pts[1]!, 0.3, 0.15);
    expectPoint(poly(d, 'body.tread.0').pts[2]!, 0.3, 0.18);
    expectPoint(poly(d, 'body.tread.0').pts[3]!, -0.015, 0.18);
    expectPoint(poly(d, 'body.riser.0').pts[0]!, 0, 0);
    expectPoint(poly(d, 'body.riser.0').pts[1]!, 0.02, 0);
    expectPoint(poly(d, 'body.riser.0').pts[2]!, 0.02, 0.15);
    expectPoint(poly(d, 'body.riser.0').pts[3]!, 0, 0.15);
  });

  it('cotas de espessura', () => {
    expect(dim(d, 'dim.treadThick').text).toBe('Piso (espessura)\n3,0 cm');
    expect(dim(d, 'dim.riserThick').text).toBe('Espelho (espessura) 2,0 cm');
    expect(checkDrawing(d)).toEqual([]);
  });
});

describe('buildStairSectionDrawing poste', () => {
  const d = buildStairSectionDrawing(post, { riser: 0.18, tread: 0.28 });

  it('tem degraus em balanço e sobreposição', () => {
    expect(poly(d, 'body.tread.0').pts).toHaveLength(4);
    expectPoint(poly(d, 'body.tread.0').pts[0]!, 0, 0.14);
    expectPoint(poly(d, 'body.tread.0').pts[1]!, 0.3, 0.14);
    expectPoint(poly(d, 'body.tread.0').pts[2]!, 0.3, 0.18);
    expectPoint(poly(d, 'body.tread.0').pts[3]!, 0, 0.18);
    expect(has(d, 'body.riser.0')).toBe(false);
    expect(has(d, 'lbl.nosing')).toBe(false);
    expect(dim(d, 'dim.overlap').text).toBe('Sobreposição\n2,0 cm');
    expect(checkDrawing(d)).toEqual([]);
  });
});

describe('buildStairSectionDrawing casos gerais', () => {
  it('traduz para ingles', () => {
    const d = buildStairSectionDrawing(mono, { riser: 0.18, tread: 0.28, lang: 'en', fmt: (n, dec) => n.toFixed(dec) });
    expect(dim(d, 'dim.riser').text).toBe('Riser 18.0 cm');
  });

  it('rejeita entradas invalidas', () => {
    expect(() => buildStairSectionDrawing(mono, { riser: 0, tread: 0.28 })).toThrow(RangeError);
    expect(() => buildStairSectionDrawing(mono, { riser: 0.18, tread: Number.NaN })).toThrow(RangeError);
  });

  it('mantem a escala em todos os estilos', () => {
    for (const type of [mono, stepped, assembled, post]) {
      for (const tread of [0.28, 0.3]) {
        const d = buildStairSectionDrawing(type, { riser: 0.18, tread });
        expect(d.em / (d.frame.x1 - d.frame.x0)).toBeGreaterThanOrEqual(0.026);
      }
    }
  });

  it('expoe os textos nos dois idiomas', () => {
    expect(STAIR_DRAWING_TEXT.pt.floor).toBe('Piso inferior');
    expect(STAIR_DRAWING_TEXT.en.floor).toBe('Lower floor');
  });
});
