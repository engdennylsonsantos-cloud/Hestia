import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { difference, multiArea, offsetMulti, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { paperMmToPx } from '@hestia/model';
import { espessuraDePapel, espessuraVezes, larguraEmPx } from './espessura.ts';
import { Limiares, assinaturaDeZoom, espessuraAtinge, zoomAtinge } from './limiares.ts';
import { HACHURA_GPU, montarLotesCamada, SEM_TETO, type LoteGpu } from './lotesGpu.ts';
import { cantosDoQuadrado, formaEm, quadradoEm } from './marcadores.ts';
import { hachuraCobre, verticeEmulado } from './rasterSoftware.ts';
import { thinStrokes } from './thin.ts';
import { resolverPreenchimento, resolverRotulo, resolverRotulos, resolverTraco, resolverZoom, tracoVisivel } from './zoomOps.ts';
import type { FillOp, LabelOp, StrokeOp } from './types.ts';

const P = (x: number, y: number): Vec2 => ({ x, y });
const RETANGULO: MultiPolygon = [[[P(0, 0), P(4, 0), P(4, 3), P(0, 3)]]];
/** Faixa de 0,5 mm de papel na escala 1:100: 0,05 m acima de 20 px/m; abaixo disso, o piso de 1 px. */
const FAIXA = espessuraDePapel(0.5, 60, 100);
const FILL_FAIXA: FillOp = { polygons: RETANGULO, color: '#222', alpha: 1, contour: true, faixa: FAIXA };

describe('faixa de contorno em papel (resolverPreenchimento)', () => {
  it('é a região menos o recuo dela pela largura corrente: 0,05 m nos zooms 60 e 220 (acima do piso), 1/12 m no zoom 12', () => {
    for (const [zoom, largura] of [[60, 0.05], [220, 0.05], [12, 1 / 12]] as const) {
      const f = resolverPreenchimento(FILL_FAIXA, zoom)!;
      expect(f.faixa).toBeUndefined();
      expect(f.contour).toBe(true);
      expect(multiArea(f.polygons)).toBeCloseTo(multiArea(difference(RETANGULO, offsetMulti(RETANGULO, -largura))), 9);
    }
  });

  it('a largura na tela é a de papel com piso de 1 px, para qualquer zoom (faixa em metros × zoom)', () => {
    for (const zoom of [12, 60, 220]) {
      const f = resolverPreenchimento(FILL_FAIXA, zoom)!;
      // Faixa de um retângulo 4 × 3: área ≈ perímetro × largura (menos os cantos).
      const l = larguraEmPx(FILL_FAIXA.faixa!, zoom) / zoom;
      expect(multiArea(f.polygons)).toBeCloseTo(14 * l - 4 * l * l, 4); // o recuo do Clipper é arredondado a 1 µm
      expect(l * zoom).toBeCloseTo(paperMmToPx(0.5, zoom, 100), 9);
    }
  });

  it('região vazia não gera faixa (some do resultado)', () => {
    expect(resolverPreenchimento({ ...FILL_FAIXA, polygons: [] }, 60)).toBeNull();
    expect(resolverZoom({ fills: [{ ...FILL_FAIXA, polygons: [] }, FILL_FAIXA], strokes: [], labels: [] }, 60).fills).toHaveLength(1);
  });

  it('o que não depende do zoom volta como veio (mesmo objeto)', () => {
    const f: FillOp = { polygons: RETANGULO, color: '#fff', alpha: 1 };
    expect(resolverPreenchimento(f, 60)).toBe(f);
    const s: StrokeOp = { pts: [P(0, 0), P(1, 0)], closed: false, widthPx: 1, color: '#000', alpha: 1 };
    expect(resolverTraco(s, 60)).toBe(s);
  });

  it('hachura com zoom mínimo: abaixo dele o preenchimento sai sem hachura; a partir dele, com a hachura (sem o zoom mínimo)', () => {
    const f: FillOp = { polygons: RETANGULO, color: '#fff', alpha: 1, hatch: { kind: 'diagonal', color: '#777', zoomMin: 90 } };
    expect(resolverPreenchimento(f, 60)!.hatch).toBeUndefined();
    expect(resolverPreenchimento(f, 90)!.hatch).toEqual({ kind: 'diagonal', color: '#777' });
    expect(resolverPreenchimento(f, 220)!.hatch).toEqual({ kind: 'diagonal', color: '#777' });
  });

  it('traço com zoom mínimo: some da lista abaixo dele', () => {
    const s: StrokeOp = { pts: [P(0, 0), P(1, 0)], closed: false, widthPx: 1, color: '#000', alpha: 1, zoomMin: 30 };
    expect(tracoVisivel(s, 29.9)).toBe(false);
    expect(tracoVisivel(s, 30)).toBe(true);
    expect(resolverZoom({ fills: [], strokes: [s], labels: [] }, 12).strokes).toHaveLength(0);
    expect(resolverZoom({ fills: [], strokes: [s], labels: [] }, 60).strokes).toHaveLength(1);
  });
});

describe('marcadores em pixels (deslocamentoPx)', () => {
  it('o marcador tem o mesmo tamanho na tela em qualquer zoom: (resolvido − âncora) × zoom = deslocamento em px', () => {
    const c = P(3, 2);
    const forma = formaEm(c, cantosDoQuadrado(4.5), true);
    const s: StrokeOp = { ...forma, widthPx: 1.6, color: '#00f', alpha: 1 };
    for (const zoom of [12, 60, 220]) {
      const r = resolverTraco(s, zoom);
      r.pts.forEach((p, i) => {
        expect((p.x - c.x) * zoom).toBeCloseTo(forma.deslocamentoPx[i]!.x, 9);
        expect((p.y - c.y) * zoom).toBeCloseTo(forma.deslocamentoPx[i]!.y, 9);
      });
      expect(r.deslocamentoPx).toBeUndefined();
    }
  });

  it('preenchimento do quadrado: polígono resolvido com o lado de 9 px', () => {
    const q = quadradoEm(P(1, 1), 4.5);
    const f = resolverPreenchimento({ ...q.fill, color: '#fff', alpha: 1 }, 100)!;
    const ring = f.polygons[0]![0]!;
    expect((ring[1]!.x - ring[0]!.x) * 100).toBeCloseTo(9, 9);
    expect(multiArea(f.polygons) * 100 * 100).toBeCloseTo(81, 6);
  });
});

describe('rótulos em papel (resolverRotulo)', () => {
  const base: LabelOp = { at: P(1, 1), text: 'x', papel: { escala: 100, fontMm: 1.6, desvio: { mm: 1.2, uy: -1 } } };

  it('fonte e deslocamento saem de paperMmToPx com o zoom e a escala (piso de 1 px)', () => {
    for (const zoom of [12, 60, 220]) {
      const r = resolverRotulo(base, zoom);
      expect(r.fontPx).toBeCloseTo(paperMmToPx(1.6, zoom, 100), 9);
      expect(r.dy).toBeCloseTo(-paperMmToPx(1.2, zoom, 100), 9);
      expect(r.dx).toBeUndefined();
      expect(r.papel).toBeUndefined();
    }
  });

  it('deslocamento ao lado (ux, uy): dx e dy proporcionais', () => {
    const r = resolverRotulo({ ...base, papel: { escala: 50, desvio: { mm: 2, ux: 0.6, uy: -0.8 } } }, 100);
    const px = paperMmToPx(2, 100, 50);
    expect(r.dx).toBeCloseTo(0.6 * px, 9);
    expect(r.dy).toBeCloseTo(-0.8 * px, 9);
    expect(r.fontPx).toBeUndefined();
  });

  it('rótulo sem papel volta igual, e a lista é a mesma quando nenhum depende do zoom', () => {
    const livre: LabelOp = { at: P(0, 0), text: 'a', dy: -12, tone: 'info' };
    expect(resolverRotulo(livre, 60)).toBe(livre);
    const lista = [livre];
    expect(resolverRotulos(lista, 60)).toBe(lista);
    expect(resolverRotulos([livre, base], 60)).not.toBe(lista);
  });
});

describe('limiares de detalhe e assinatura do zoom', () => {
  it('assinatura = quantos limiares o zoom já alcançou (o limiar conta a partir dele)', () => {
    const lim = [8, 40, 40.5];
    expect([1, 7.99, 8, 39.9, 40, 40.4, 40.5, 1000].map((z) => assinaturaDeZoom(lim, z))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(assinaturaDeZoom([], 60)).toBe(0);
  });

  it('a geometria registra os limiares que consultou, em ordem e sem repetição', () => {
    const lim = new Limiares();
    const v = { cx: 0, cy: 0, zoom: 60, width: 800, height: 600, limiares: lim };
    expect(zoomAtinge(v, 40)).toBe(true);
    expect(zoomAtinge(v, 40)).toBe(true);
    expect(espessuraAtinge(v, 0.19, 5)).toBe(true); // 5 / 0,19 = 26,3 px/m
    expect(espessuraAtinge(v, 0.05, 5)).toBe(false); // 100 px/m
    expect(lim.lista()).toEqual([5 / 0.19, 40, 100].sort((a, b) => a - b));
  });

  it('sem registro (vista comum) só compara; região sem espessura nunca atinge pixels', () => {
    expect(zoomAtinge({ cx: 0, cy: 0, zoom: 39, width: 1, height: 1 }, 40)).toBe(false);
    expect(espessuraAtinge({ cx: 0, cy: 0, zoom: 4000, width: 1, height: 1 }, 0, 1)).toBe(false);
  });
});

describe('peso de papel com fator e teto (largura do símbolo, linhas finas)', () => {
  it('larguraEmPx: fator sobre a largura já com piso; teto limita depois', () => {
    const e = espessuraVezes(espessuraDePapel(0.5, 60, 100), 0.7);
    for (const zoom of [12, 60, 220]) expect(larguraEmPx(e, zoom)).toBeCloseTo(0.7 * paperMmToPx(0.5, zoom, 100), 9);
    const fino: StrokeOp = { pts: [P(0, 0), P(1, 0)], closed: false, ...e, color: '#000', alpha: 1 };
    thinStrokes([fino]);
    // Fica como o traço de antes: a largura do zoom de construção, no máximo 1 px, e o teto vale em qualquer zoom.
    const lista = [fino];
    thinStrokes(lista);
    for (const zoom of [12, 60, 220]) expect(larguraEmPx(lista[0]!, zoom)).toBeCloseTo(Math.min(1, 0.7 * paperMmToPx(0.5, zoom, 100)), 9);
  });

  it('o shader (emulado) dá a mesma largura que larguraEmPx, com fator por vértice e teto por material', () => {
    const traco = (fator: number, teto?: number): StrokeOp => ({ pts: [P(0, 0), P(1, 0)], closed: false, widthPx: 3, papel: { mm: 0.5, escala: 100, fator, ...(teto !== undefined ? { teto } : {}) }, color: '#000', alpha: 1 });
    for (const s of [traco(1), traco(0.7), traco(1.5), traco(0.7, 1), traco(1, 1)]) {
      const [lote] = montarLotesCamada([], [s]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(lote!.pos, 3));
      g.setAttribute('aExt', new THREE.Float32BufferAttribute(lote!.traco!.ext, 4));
      g.setAttribute('aDir', new THREE.Float32BufferAttribute(lote!.traco!.dir, 3));
      g.setAttribute('aPadrao', new THREE.Float32BufferAttribute(lote!.traco!.padrao, 3));
      for (const zoom of [12, 60, 220]) {
        const ys = [0, 1, 2, 3].map((k) => verticeEmulado(g, k, zoom, lote!.papel ?? false).y);
        expect((Math.max(...ys) - Math.min(...ys)) * zoom).toBeCloseTo(larguraEmPx(s, zoom), 4);
      }
    }
  });

  it('traços de fatores diferentes ficam no mesmo lote (o fator é por vértice, não parte da chave)', () => {
    const a: StrokeOp = { pts: [P(0, 0), P(1, 0)], closed: false, widthPx: 1, papel: { mm: 0.5, escala: 100 }, color: '#000', alpha: 1 };
    const b: StrokeOp = { ...a, papel: { mm: 0.5, escala: 100, fator: 0.7 } };
    expect(montarLotesCamada([], [a, b, a])).toHaveLength(1);
    const comTeto: StrokeOp = { ...a, papel: { mm: 0.5, escala: 100, teto: 1 } };
    const lotes = montarLotesCamada([], [a, comTeto]);
    expect(lotes).toHaveLength(2);
    expect(lotes[1]!.papel).toEqual({ teto: 1 });
    expect(lotes[0]!.papel).toEqual({ teto: SEM_TETO });
  });
});

describe('faixa, marcador e hachura resolvidos no shader (sem lote dinâmico)', () => {
  const FAIXAS: FillOp[] = [
    { polygons: RETANGULO, color: '#eee', alpha: 1 },
    FILL_FAIXA,
    { polygons: [[[P(5, 0), P(6, 0), P(6, 1), P(5, 1)]]], color: '#eee', alpha: 1 },
    { ...FILL_FAIXA, polygons: [[[P(5, 0), P(6, 0), P(6, 1), P(5, 1)]]] },
  ];
  const triangulos = (l: LoteGpu): number => l.idx.length / 3;

  it('a faixa é um lote de traço próprio, entre os preenchimentos, com o fator 2 e o lado da região', () => {
    const lotes = montarLotesCamada(FAIXAS, []);
    expect(lotes.map((l) => l.key)).toEqual(['f|#eee|1', 'b|#222|1|p', 'f|#eee|1', 'b|#222|1|p']);
    const banda = lotes[1]!;
    expect(banda.banda).toBe(true);
    expect(banda.traco?.banda).toHaveLength(banda.pos.length / 3);
    // O traço tem o dobro da largura de papel (o fragmento descarta a metade externa).
    expect(banda.traco!.ext.filter((_, i) => i % 4 === 3).every((f) => f === 2)).toBe(true);
    // Nenhum lote guarda a fonte do zoom: a geometria é a mesma em qualquer zoom.
    expect(lotes.every((l) => !('fonte' in l))).toBe(true);
  });

  it('faixa vazia não vira lote nem muda a ordem dos outros (não há mais lote vazio de posição)', () => {
    const vazio: FillOp = { ...FILL_FAIXA, polygons: [] };
    const lotes = montarLotesCamada([FAIXAS[0]!, vazio, { ...FAIXAS[2]!, color: '#ddd' }], []);
    expect(lotes).toHaveLength(2);
    expect(lotes.every((l) => triangulos(l) > 0)).toBe(true);
  });

  it('marcador de traço guarda o deslocamento em px no vértice e a direção vem do próprio deslocamento', () => {
    const marcador: StrokeOp = { ...formaEm(P(1, 1), cantosDoQuadrado(5), true), widthPx: 2, color: '#00f', alpha: 1 };
    const [m] = montarLotesCamada([], [marcador]);
    expect(m!.key).toBe('sd|#00f|1');
    expect(m!.traco?.desl).toHaveLength(m!.pos.length / 3 * 2);
    expect(m!.traco?.desl?.some((x) => x !== 0)).toBe(true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(m!.pos, 3));
    g.setAttribute('aExt', new THREE.Float32BufferAttribute(m!.traco!.ext, 4));
    g.setAttribute('aDir', new THREE.Float32BufferAttribute(m!.traco!.dir, 3));
    g.setAttribute('aPadrao', new THREE.Float32BufferAttribute(m!.traco!.padrao, 3));
    g.setAttribute('aDesl', new THREE.Float32BufferAttribute(m!.traco!.desl!, 2));
    // O marcador tem o mesmo tamanho em tela: em zoom maior o deslocamento em metros é menor.
    const a = verticeEmulado(g, 0, 60);
    const b = verticeEmulado(g, 0, 220);
    expect(Math.hypot(a.x - 1, a.y - 1)).toBeGreaterThan(Math.hypot(b.x - 1, b.y - 1));
  });

  it('hachura é um preenchimento triangulado + padrão no shader (sem segmentos) e respeita o zoom mínimo', () => {
    const f: FillOp = { polygons: RETANGULO, color: '#fff', alpha: 1, hatch: { kind: 'diagonal', color: '#777', zoomMin: 90 } };
    const lotes = montarLotesCamada([f], []);
    const hachura = lotes.find((l) => l.key.startsWith('h|'))!;
    expect(hachura.hatch).toEqual({ kind: 'diagonal', zoomMin: 90 });
    expect(hachura.traco).toBeUndefined();
    // 4 vértices (um por canto) e 2 triângulos: a hachura não tem mais um quad por trecho.
    expect(hachura.pos.length / 3).toBe(4);
    expect(hachura.idx).toHaveLength(6);
    // Abaixo do zoom mínimo o fragmento descarta; acima, um ponto sobre a linha a 45° é pintado.
    const z = HACHURA_GPU.espaco * Math.SQRT2;
    const y = HACHURA_GPU.espaco * Math.SQRT2;
    expect(hachuraCobre(1, 0, 0, 60, 90, HACHURA_GPU.espaco, HACHURA_GPU.linhaPx, HACHURA_GPU.pontoPx, HACHURA_GPU.pontoM)).toBe(false);
    expect(hachuraCobre(1, z, y, 220, 90, HACHURA_GPU.espaco, HACHURA_GPU.linhaPx, HACHURA_GPU.pontoPx, HACHURA_GPU.pontoM)).toBe(true);
  });
});
