import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { difference, multiArea, offsetMulti, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { paperMmToPx } from '@hestia/model';
import { espessuraDePapel, espessuraVezes, larguraEmPx } from './espessura.ts';
import { Limiares, assinaturaDeZoom, espessuraAtinge, zoomAtinge } from './limiares.ts';
import { montarLotesCamada, reexpandirLote, SEM_TETO, type LoteGpu } from './lotesGpu.ts';
import { cantosDoQuadrado, formaEm, quadradoEm } from './marcadores.ts';
import { verticeEmulado } from './rasterSoftware.ts';
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

describe('lotes dinâmicos e zoom mínimo no lote de traço', () => {
  const FAIXAS: FillOp[] = [
    { polygons: RETANGULO, color: '#eee', alpha: 1 },
    FILL_FAIXA,
    { polygons: [[[P(5, 0), P(6, 0), P(6, 1), P(5, 1)]]], color: '#eee', alpha: 1 },
    { ...FILL_FAIXA, polygons: [[[P(5, 0), P(6, 0), P(6, 1), P(5, 1)]]] },
  ];
  const triangulos = (l: LoteGpu): number => l.idx.length / 3;

  it('a faixa é um lote próprio entre os preenchimentos, na ordem; os estáticos não dependem do zoom', () => {
    const a = montarLotesCamada(FAIXAS, [], 60);
    const b = montarLotesCamada(FAIXAS, [], 220);
    expect(a.map((l) => !!l.fonte)).toEqual([false, true, false, true]);
    expect(a.map((l) => l.material ?? l.key)).toEqual(['f|#eee|1', 'f|#222|1', 'f|#eee|1', 'f|#222|1']);
    expect(a[0]!.pos).toEqual(b[0]!.pos);
    expect(a[2]!.pos).toEqual(b[2]!.pos);
  });

  it('reexpandirLote refaz só a geometria da faixa no zoom novo: igual a montar direto nesse zoom', () => {
    const lotes = montarLotesCamada(FAIXAS, [], 220);
    const antes = lotes[1]!.pos.slice();
    reexpandirLote(lotes[1]!, 12);
    const direto = montarLotesCamada(FAIXAS, [], 12);
    expect(lotes[1]!.pos).toEqual(direto[1]!.pos);
    expect(lotes[1]!.idx).toEqual(direto[1]!.idx);
    expect(lotes[1]!.pos).not.toEqual(antes);
  });

  it('o lote dinâmico fica na lista mesmo vazio (a posição dos demais não muda)', () => {
    const vazio: FillOp = { ...FILL_FAIXA, polygons: [] };
    const lotes = montarLotesCamada([FAIXAS[0]!, vazio, FAIXAS[2]!], [], 60);
    expect(lotes).toHaveLength(3);
    expect(triangulos(lotes[1]!)).toBe(0);
  });

  it('sem zoom (lista já resolvida) não há lote dinâmico; marcador de traço também é dinâmico com zoom', () => {
    expect(montarLotesCamada(FAIXAS, [], null).some((l) => l.fonte)).toBe(false);
    const marcador: StrokeOp = { ...formaEm(P(1, 1), cantosDoQuadrado(5), true), widthPx: 2, color: '#00f', alpha: 1 };
    const [m] = montarLotesCamada([], [marcador], 60);
    expect(m!.fonte).toBeDefined();
    expect(m!.material).toBe('s|#00f|1');
    const lote220 = montarLotesCamada([], [marcador], 220)[0]!;
    expect(m!.pos).not.toEqual(lote220.pos);
  });

  it('zoom mínimo da hachura e do traço vai ao vértice (aPadrao.z) e o emulador esconde abaixo dele', () => {
    const f: FillOp = { polygons: RETANGULO, color: '#fff', alpha: 1, hatch: { kind: 'diagonal', color: '#777', zoomMin: 90 } };
    const s: StrokeOp = { pts: [P(0, 0), P(2, 0)], closed: false, widthPx: 1, color: '#000', alpha: 1, zoomMin: 30 };
    const lotes = montarLotesCamada([f], [s]);
    const hachura = lotes.find((l) => l.key.startsWith('h|'))!;
    const linha = lotes.find((l) => l.key.startsWith('s|'))!;
    expect(hachura.traco!.padrao.filter((_, i) => i % 3 === 2).every((z) => z === 90)).toBe(true);
    expect(linha.traco!.padrao.filter((_, i) => i % 3 === 2).every((z) => z === 30)).toBe(true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(linha.pos, 3));
    g.setAttribute('aExt', new THREE.Float32BufferAttribute(linha.traco!.ext, 4));
    g.setAttribute('aDir', new THREE.Float32BufferAttribute(linha.traco!.dir, 3));
    g.setAttribute('aPadrao', new THREE.Float32BufferAttribute(linha.traco!.padrao, 3));
    expect(verticeEmulado(g, 0, 12).visivel).toBe(false);
    expect(verticeEmulado(g, 0, 30).visivel).toBe(true);
    expect(verticeEmulado(g, 0, 220).visivel).toBe(true);
  });
});
