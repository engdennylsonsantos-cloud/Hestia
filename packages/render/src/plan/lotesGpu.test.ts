import { describe, expect, it } from 'vitest';
import { dashSegments, edges, montarLotesCamada, quad, type LoteGpu } from './lotesGpu.ts';
import type { FillOp, StrokeOp } from './types.ts';
import type { Viewport } from '../viewport.ts';

const V: Viewport = { cx: 0, cy: 0, zoom: 10, width: 400, height: 300 };
const retangulo = (x0: number, y0: number, x1: number, y1: number) => [[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]];

describe('montarLotesCamada: lotes por cor e alfa, na ordem dos itens', () => {
  it('preenchimentos da mesma cor e alfa seguidos formam um lote só', () => {
    const fills: FillOp[] = [
      { polygons: [retangulo(0, 0, 1, 1)], color: '#aaaaaa', alpha: 1 },
      { polygons: [retangulo(2, 2, 3, 3)], color: '#aaaaaa', alpha: 1 },
    ];
    const lotes = montarLotesCamada(fills, [], V);
    expect(lotes).toHaveLength(1);
    expect(lotes[0]!.key).toBe('f|#aaaaaa|1');
    expect(lotes[0]!.idx.length).toBe(6 * 2);
  });

  it('cores diferentes viram lotes diferentes, na ordem em que aparecem', () => {
    const fills: FillOp[] = [
      { polygons: [retangulo(0, 0, 1, 1)], color: '#111111', alpha: 1 },
      { polygons: [retangulo(0, 0, 1, 1)], color: '#222222', alpha: 1 },
      { polygons: [retangulo(0, 0, 1, 1)], color: '#111111', alpha: 1 },
    ];
    const cores = montarLotesCamada(fills, [], V).map((l) => l.color);
    expect(cores).toEqual(['#111111', '#222222', '#111111']);
  });

  it('traços vêm depois dos preenchimentos; sem triângulos não há lote', () => {
    const strokes: StrokeOp[] = [{ pts: [{ x: 0, y: 0 }, { x: 2, y: 0 }], closed: false, widthPx: 2, color: '#000000', alpha: 1 }];
    const lotes = montarLotesCamada([], strokes, V);
    expect(lotes).toHaveLength(1);
    expect(lotes[0]!.key).toBe('s|#000000|1');
    expect(montarLotesCamada([], [], V)).toEqual([]);
  });

  it('os índices de cada lote são relativos aos seus próprios vértices', () => {
    const lotes = montarLotesCamada([{ polygons: [retangulo(0, 0, 1, 1)], color: '#000000', alpha: 1 }, { polygons: [retangulo(5, 5, 6, 6)], color: '#ffffff', alpha: 1 }], [], V);
    for (const l of lotes) {
      const nv = l.pos.length / 3;
      expect(l.idx.every((k) => k >= 0 && k < nv)).toBe(true);
    }
  });
});

describe('quad e tracejado', () => {
  it('um traço vira um retângulo de 4 vértices e 2 triângulos', () => {
    const b: LoteGpu = { key: 'k', color: '#000', alpha: 1, pos: [], idx: [] };
    quad(b, { x: 0, y: 0 }, { x: 2, y: 0 }, 0.2);
    expect(b.pos).toHaveLength(12);
    expect(b.idx).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('um traço de comprimento zero não gera vértice', () => {
    const b: LoteGpu = { key: 'k', color: '#000', alpha: 1, pos: [], idx: [] };
    quad(b, { x: 1, y: 1 }, { x: 1, y: 1 }, 0.2);
    expect(b.idx).toHaveLength(0);
  });

  it('tracejado de traço 1 e vão 1 numa reta de 4 gera dois trechos ligados', () => {
    const trechos = dashSegments([{ x: 0, y: 0 }, { x: 4, y: 0 }], false, 1, 1);
    expect(trechos).toHaveLength(2);
    expect(trechos[0]![0].x).toBe(0);
    expect(trechos[1]![0].x).toBeCloseTo(2);
  });

  it('a polilinha fechada ganha a aresta de volta só com pelo menos três pontos', () => {
    const quadrado = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    expect(edges(quadrado, true)).toHaveLength(3);
    expect(edges([{ x: 0, y: 0 }, { x: 1, y: 0 }], true)).toHaveLength(1);
  });
});
