import { describe, expect, it } from 'vitest';
import { DEFAULT_RAMP_TYPES } from '@hestia/model';
import type { DimensionPrim, Drawing, LabelPrim, PolygonPrim, PolylinePrim } from '../schematic/drawing.ts';
import { checkDrawing } from '../schematic/geometry.ts';
import { buildRampSectionDrawing, RAMP_DRAWING_TEXT } from './rampSectionDrawing.ts';

const nbr = DEFAULT_RAMP_TYPES[0]!;
const ada = DEFAULT_RAMP_TYPES[1]!;

const byId = (d: Drawing, id: string): DimensionPrim | LabelPrim | PolygonPrim | PolylinePrim => d.prims.find((p) => p.id === id) as DimensionPrim | LabelPrim | PolygonPrim | PolylinePrim;
const dim = (d: Drawing, id: string): DimensionPrim => byId(d, id) as DimensionPrim;
const label = (d: Drawing, id: string): LabelPrim => byId(d, id) as LabelPrim;
const poly = (d: Drawing, id: string): PolygonPrim => byId(d, id) as PolygonPrim;
const has = (d: Drawing, id: string): boolean => d.prims.some((p) => p.id === id);

const expectPoint = (p: readonly [number, number], x: number, y: number, dec = 4): void => {
  expect(p[0]).toBeCloseTo(x, dec);
  expect(p[1]).toBeCloseTo(y, dec);
};

describe('buildRampSectionDrawing corte', () => {
  const d = buildRampSectionDrawing(nbr, { view: 'section', slope: 1 / 12, totalRise: 1.2 });

  it('calcula o exagero vertical e a legenda', () => {
    expect(d.meta.vExag).toBe(4);
    expect(d.meta.kind).toBe('ramp-section');
    expect(d.caption?.startsWith('Escala vertical ×4')).toBe(true);
  });

  it('desenha os corpos', () => {
    const f0 = poly(d, 'body.flight.0').pts;
    expectPoint(f0[0]!, 0, 0);
    expectPoint(f0[1]!, 9.6, 3.2);
    expectPoint(f0[2]!, 9.6, 3.2 - 0.602075);
    expectPoint(f0[3]!, 0, -0.602075);
    const land = poly(d, 'body.landing.0').pts;
    expectPoint(land[0]!, 9.6, 3.2);
    expectPoint(land[1]!, 10.8, 3.2);
    expectPoint(land[2]!, 10.8, 2.6);
    expectPoint(land[3]!, 9.6, 2.6);
    const f1 = poly(d, 'body.flight.1').pts;
    expectPoint(f1[0]!, 10.8, 3.2);
    expectPoint(f1[1]!, 15.6, 4.8);
    expectPoint(f1[2]!, 15.6, 4.197925);
    expectPoint(f1[3]!, 10.8, 2.597925);
  });

  it('textos das cotas', () => {
    expect(dim(d, 'dim.run.0').text).toBe('c = 9,60 m');
    expect(dim(d, 'dim.run.1').text).toBe('c = 4,80 m');
    expect(dim(d, 'dim.landing').text).toBe('Patamar ≥ 1,20 m');
    expect(dim(d, 'dim.total').text).toBe('L = 15,60 m');
    expect(dim(d, 'dim.rise.0').text).toBe('h = 0,80 m\nmáx. 0,80 m ✓ · a conferir');
    expect(dim(d, 'dim.rise.0').tone).toBe('ok');
    expect(label(d, 'lbl.slope').text).toBe('i = h ÷ c = 8,33 % (1:12)');
    expect(dim(d, 'dim.headroom').text).toBe('Pé-direito livre\nmín. 2,10 m');
    expect(dim(d, 'dim.headroom').broken).toBe(true);
  });

  it('passa no verificador e na escala minima', () => {
    expect(checkDrawing(d)).toEqual([]);
    expect(d.em / (d.frame.x1 - d.frame.x0)).toBeGreaterThanOrEqual(0.026);
  });
});

describe('buildRampSectionDrawing casos', () => {
  it('ADA usa o limite da tabela e marca a norma conferida', () => {
    const d = buildRampSectionDrawing(ada, { view: 'section', slope: 1 / 12 });
    expect(dim(d, 'dim.rise.0').text).toBe('h = 0,76 m\nmáx. 0,76 m ✓');
    expect(checkDrawing(d)).toEqual([]);
  });

  it('um lance omite patamar, segundo lance e total', () => {
    const d = buildRampSectionDrawing(nbr, { view: 'section', totalRise: 0.5 });
    expect(has(d, 'body.landing.0')).toBe(false);
    expect(has(d, 'body.flight.1')).toBe(false);
    expect(has(d, 'dim.landing')).toBe(false);
    expect(has(d, 'dim.total')).toBe(false);
    expect(has(d, 'lbl.flight.1')).toBe(false);
    expect(checkDrawing(d)).toEqual([]);
  });

  it('inclinacao acima da norma mostra o aviso', () => {
    const d = buildRampSectionDrawing(nbr, { view: 'section', slope: 0.1 });
    expect(has(d, 'lbl.limit')).toBe(true);
    expect(label(d, 'lbl.limit').tone).toBe('danger');
    expect(label(d, 'lbl.limit').text).toContain('Inclinação acima da norma');
    expect(dim(d, 'dim.rise.0').tone).toBe('danger');
    expect(checkDrawing(d)).toEqual([]);
  });

  it('traduz para ingles', () => {
    const d = buildRampSectionDrawing(nbr, { view: 'section', slope: 1 / 12, totalRise: 1.2, lang: 'en', fmt: (n, dec) => n.toFixed(dec) });
    expect(dim(d, 'dim.run.0').text).toBe('c = 9.60 m');
    expect(label(d, 'lbl.slope').text).toBe('i = h ÷ c = 8.33 % (1:12)');
  });

  it('rejeita inclinacao invalida', () => {
    expect(() => buildRampSectionDrawing(nbr, { view: 'section', slope: 0 })).toThrow(RangeError);
  });
});

describe('buildRampSectionDrawing planta', () => {
  const d = buildRampSectionDrawing(nbr, { view: 'plan', totalRise: 1.2 });

  it('desenha os retangulos da planta em U', () => {
    expect(d.meta.kind).toBe('ramp-plan');
    const f0 = poly(d, 'body.flight.0').pts;
    expectPoint(f0[0]!, 0, 0);
    expectPoint(f0[1]!, 9.6, 0);
    expectPoint(f0[2]!, 9.6, 1.5);
    expectPoint(f0[3]!, 0, 1.5);
    const land = poly(d, 'body.landing.0').pts;
    expectPoint(land[0]!, 9.6, 0);
    expectPoint(land[1]!, 11.1, 0);
    expectPoint(land[2]!, 11.1, 3);
    expectPoint(land[3]!, 9.6, 3);
    const f1 = poly(d, 'body.flight.1').pts;
    expectPoint(f1[0]!, 4.8, 1.5);
    expectPoint(f1[1]!, 9.6, 1.5);
    expectPoint(f1[2]!, 9.6, 3);
    expectPoint(f1[3]!, 4.8, 3);
  });

  it('seta de subida, cotas e legenda', () => {
    const arrow = byId(d, 'guide.arrow');
    expect(arrow.kind).toBe('polyline');
    expect(arrow.kind === 'polyline' && arrow.arrowEnd).toBe(true);
    expect(dim(d, 'dim.width').text).toBe('Largura 1,50 m');
    expect(dim(d, 'dim.width').tone).toBe('body');
    expect(checkDrawing(d)).toEqual([]);
  });

  it('largura abaixo do minimo fica em perigo', () => {
    const narrow = { ...nbr, defaultWidth: 0.9, minWidth: 1.2 };
    const dn = buildRampSectionDrawing(narrow, { view: 'plan', totalRise: 1.2 });
    expect(dim(dn, 'dim.width').tone).toBe('danger');
    expect(checkDrawing(dn)).toEqual([]);
  });
});

describe('buildRampSectionDrawing invariantes', () => {
  it('nao usa cor literal e expoe os textos', () => {
    const d = buildRampSectionDrawing(nbr, { view: 'section', slope: 1 / 12, totalRise: 1.2 });
    expect(JSON.stringify(d)).not.toContain('#');
    expect(RAMP_DRAWING_TEXT.pt.up).toBe('Sobe');
    expect(RAMP_DRAWING_TEXT.en.up).toBe('Up');
  });

  it('mantem a escala nas duas vistas', () => {
    for (const view of ['section', 'plan'] as const) {
      const d = buildRampSectionDrawing(nbr, { view, totalRise: 1.2 });
      expect(d.em / (d.frame.x1 - d.frame.x0)).toBeGreaterThanOrEqual(0.026);
    }
  });
});
