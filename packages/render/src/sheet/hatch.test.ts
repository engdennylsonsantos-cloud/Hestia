import { describe, expect, it } from 'vitest';
import { hatchPartsOf, HATCH_PITCH_MM } from './hatch.ts';
import { partsOf } from './convert.ts';
import type { SheetPoint } from './types.ts';
import { LIGHT, type PlanDrawList } from '../plan/types.ts';

const square = (x0: number, y0: number, x1: number, y1: number): SheetPoint[][] => [
  [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ],
];

const mid = (pts: SheetPoint[]): SheetPoint => ({ x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 });
const inside = (p: SheetPoint, x0: number, y0: number, x1: number, y1: number) => p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1;

describe('hachura de padrão na folha (B6)', () => {
  it('diagonal: traços em 45° recortados ao quadrado, espaçados pelo passo', () => {
    const parts = hatchPartsOf([square(0, 0, 10, 10)], 'diagonal', '#333333');
    expect(parts.fills).toHaveLength(0);
    // Um quadrado de 10 mm tem ~ 10·√2 / passo retas por família.
    const expected = (10 * Math.SQRT2) / HATCH_PITCH_MM;
    expect(parts.paths.length).toBeGreaterThan(expected * 0.8);
    expect(parts.paths.length).toBeLessThan(expected * 1.25);
    for (const path of parts.paths) {
      expect(path.closed).toBe(false);
      expect(path.pts).toHaveLength(2);
      for (const q of path.pts) {
        expect(q.x).toBeGreaterThanOrEqual(-1e-9);
        expect(q.x).toBeLessThanOrEqual(10 + 1e-9);
        expect(q.y).toBeGreaterThanOrEqual(-1e-9);
        expect(q.y).toBeLessThanOrEqual(10 + 1e-9);
      }
      // Traço a 45°: as duas pontas têm a mesma distância em x e em y.
      const [a, b] = path.pts as [SheetPoint, SheetPoint];
      expect(Math.abs(b.x - a.x)).toBeCloseTo(Math.abs(b.y - a.y), 6);
      expect(inside(mid(path.pts), 0, 0, 10, 10)).toBe(true);
    }
  });

  it('cross: duas famílias, uma em cada diagonal', () => {
    const diag = hatchPartsOf([square(0, 0, 10, 10)], 'diagonal', '#333333');
    const cross = hatchPartsOf([square(0, 0, 10, 10)], 'cross', '#333333');
    expect(cross.paths.length).toBeGreaterThan(diag.paths.length * 1.8);
    const slopes = new Set(cross.paths.map(({ pts: [a, b] }) => (Math.sign((b!.y - a!.y) * (b!.x - a!.x)))));
    expect(slopes).toEqual(new Set([1, -1]));
  });

  it('furo: nenhum traço cai dentro do furo (regra par-ímpar)', () => {
    const outer = square(0, 0, 20, 20);
    const hole = square(8, 8, 12, 12);
    const parts = hatchPartsOf([[outer[0]!, hole[0]!]], 'diagonal', '#333333');
    expect(parts.paths.length).toBeGreaterThan(0);
    for (const path of parts.paths) expect(inside(mid(path.pts), 8, 8, 12, 12)).toBe(false);
    // Traço que cruza o furo é cortado nas duas bordas dele: a metade de cada lado continua.
    expect(parts.paths.some((path) => inside(mid(path.pts), 0, 0, 8, 8))).toBe(true);
  });

  it('solid: uma cobertura da cor da hachura, sem traços', () => {
    const polys = [square(0, 0, 5, 5)];
    const parts = hatchPartsOf(polys, 'solid', '#112233');
    expect(parts.paths).toHaveLength(0);
    expect(parts.fills).toEqual([{ polygons: polys, color: '#112233' }]);
  });

  it('dots: pontos em malha, dentro do polígono, todos do mesmo preenchimento', () => {
    const parts = hatchPartsOf([square(0, 0, 10, 10)], 'dots', '#444444');
    expect(parts.paths).toHaveLength(0);
    expect(parts.fills).toHaveLength(1);
    const dots = parts.fills[0]!.polygons;
    expect(dots.length).toBeGreaterThan(10);
    for (const [ring] of dots) {
      const cx = ring!.reduce((s, q) => s + q.x, 0) / 4;
      const cy = ring!.reduce((s, q) => s + q.y, 0) / 4;
      expect(inside({ x: cx, y: cy }, 0, 0, 10, 10)).toBe(true);
    }
  });

  it('none e polígono vazio não desenham nada', () => {
    expect(hatchPartsOf([square(0, 0, 10, 10)], 'none', '#000000')).toEqual({ fills: [], paths: [], texts: [] });
    expect(hatchPartsOf([], 'diagonal', '#000000').paths).toHaveLength(0);
  });

  it('partsOf leva a hachura do preenchimento da planta para a folha, antes dos traços', () => {
    const list: PlanDrawList = {
      background: '#fff',
      fills: [{ polygons: [[[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]]], color: '#cccccc', alpha: 1, hatch: { kind: 'diagonal', color: '#333333' } }],
      strokes: [{ pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }], closed: false, widthPx: 1000, color: '#000000', alpha: 1 }],
      labels: [],
    };
    const parts = partsOf(list, (q) => q, LIGHT);
    expect(parts.fills).toHaveLength(1);
    expect(parts.paths.length).toBeGreaterThan(2);
    expect(parts.paths.at(-1)!.color).toBe('#000000');
    expect(parts.paths[0]!.color).toBe('#333333');
  });
});
