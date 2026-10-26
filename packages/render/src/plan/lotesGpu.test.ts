import { describe, expect, it } from 'vitest';
import { dashSegments, edges, montarLotesCamada, padraoDoTracejado, quad, type LoteGpu } from './lotesGpu.ts';
import type { FillOp, StrokeOp } from './types.ts';

const retangulo = (x0: number, y0: number, x1: number, y1: number) => [[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]];
const lote = (): LoteGpu => ({ key: 's|#000|1', color: '#000', alpha: 1, pos: [], idx: [], traco: { ext: [], dir: [], padrao: [] } });

describe('montarLotesCamada: lotes por cor e alfa, na ordem dos itens', () => {
  it('preenchimentos da mesma cor e alfa seguidos formam um lote só, sem atributos de traço', () => {
    const fills: FillOp[] = [
      { polygons: [retangulo(0, 0, 1, 1)], color: '#aaaaaa', alpha: 1 },
      { polygons: [retangulo(2, 2, 3, 3)], color: '#aaaaaa', alpha: 1 },
    ];
    const lotes = montarLotesCamada(fills, []);
    expect(lotes).toHaveLength(1);
    expect(lotes[0]!.key).toBe('f|#aaaaaa|1');
    expect(lotes[0]!.idx.length).toBe(6 * 2);
    expect(lotes[0]!.traco).toBeUndefined();
  });

  it('cores diferentes viram lotes diferentes, na ordem em que aparecem', () => {
    const fills: FillOp[] = [
      { polygons: [retangulo(0, 0, 1, 1)], color: '#111111', alpha: 1 },
      { polygons: [retangulo(0, 0, 1, 1)], color: '#222222', alpha: 1 },
      { polygons: [retangulo(0, 0, 1, 1)], color: '#111111', alpha: 1 },
    ];
    const cores = montarLotesCamada(fills, []).map((l) => l.color);
    expect(cores).toEqual(['#111111', '#222222', '#111111']);
  });

  it('traços vêm depois dos preenchimentos, com atributos de traço; sem triângulos não há lote', () => {
    const strokes: StrokeOp[] = [{ pts: [{ x: 0, y: 0 }, { x: 2, y: 0 }], closed: false, widthPx: 2, color: '#000000', alpha: 1 }];
    const lotes = montarLotesCamada([], strokes);
    expect(lotes).toHaveLength(1);
    expect(lotes[0]!.key).toBe('s|#000000|1');
    expect(lotes[0]!.traco).toBeDefined();
    expect(montarLotesCamada([], [])).toEqual([]);
  });

  it('a geometria não depende do zoom: a mesma entrada dá o mesmo lote', () => {
    const strokes: StrokeOp[] = [{ pts: [{ x: 0, y: 0 }, { x: 3, y: 1 }], closed: false, widthPx: 2, color: '#000000', alpha: 1, dash: [6, 3] }];
    expect(montarLotesCamada([], strokes)).toEqual(montarLotesCamada([], strokes));
  });

  it('os índices de cada lote são relativos aos seus próprios vértices', () => {
    const lotes = montarLotesCamada([{ polygons: [retangulo(0, 0, 1, 1)], color: '#000000', alpha: 1 }, { polygons: [retangulo(5, 5, 6, 6)], color: '#ffffff', alpha: 1 }], []);
    for (const l of lotes) {
      const nv = l.pos.length / 3;
      expect(l.idx.every((k) => k >= 0 && k < nv)).toBe(true);
    }
  });
});

describe('quad: traço em pixels, deslocado pelo shader', () => {
  it('um traço vira um retângulo de 4 vértices e 2 triângulos, com a largura em pixels em cada vértice', () => {
    const b = lote();
    quad(b, { x: 0, y: 0 }, { x: 2, y: 0 }, 2);
    expect(b.pos).toHaveLength(12);
    expect(b.idx).toEqual([0, 1, 2, 0, 2, 3]);
    // Cada vértice leva (ao longo, lado, largura em px), a direção (1, 0) e a distância do início do trecho.
    expect(b.traco!.ext).toEqual([-1, 1, 2, 1, -1, -1, 2, 1, 1, -1, 2, 1, 1, 1, 2, 1]);
    expect(b.traco!.dir).toEqual([1, 0, 0, 1, 0, 0, 1, 0, 2, 1, 0, 2]);
  });

  it('a distância acumulada cresce com o comprimento e o tracejado vai junto em cada vértice', () => {
    const b = lote();
    const fim = quad(b, { x: 0, y: 0 }, { x: 3, y: 4 }, 1, 10, [6, 9]);
    expect(fim).toBeCloseTo(15);
    expect(b.traco!.dir[2]).toBe(10);
    expect(b.traco!.dir[8]).toBeCloseTo(15);
    expect(b.traco!.padrao.slice(0, 2)).toEqual([6, 9]);
  });

  it('um traço de comprimento zero não gera vértice', () => {
    const b = lote();
    quad(b, { x: 1, y: 1 }, { x: 1, y: 1 }, 2);
    expect(b.idx).toHaveLength(0);
    expect(b.traco!.ext).toHaveLength(0);
  });

  it('quad só aceita lote de traço', () => {
    const b: LoteGpu = { key: 'f|#000|1', color: '#000', alpha: 1, pos: [], idx: [] };
    expect(() => quad(b, { x: 0, y: 0 }, { x: 1, y: 0 }, 1)).toThrow();
  });
});

describe('tracejado', () => {
  it('o padrão em pixels é (traço, traço + vão); sem vão ou sem traço a linha é inteira', () => {
    expect(padraoDoTracejado([6, 3])).toEqual([6, 9]);
    expect(padraoDoTracejado(undefined)).toEqual([0, 0]);
    expect(padraoDoTracejado([0, 3])).toEqual([0, 0]);
    expect(padraoDoTracejado([6, 0])).toEqual([0, 0]);
  });

  it('tracejado de traço 1 e vão 1 numa reta de 4 gera dois trechos ligados (referência em metros)', () => {
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
