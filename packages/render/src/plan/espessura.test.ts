import * as THREE from 'three';
import { paperMmToPx } from '@hestia/model';
import { describe, expect, it } from 'vitest';
import { defaultPaint } from './style.ts';
import { espessuraDePapel, kPapel, larguraEmPx } from './espessura.ts';
import { montarLotesCamada } from './lotesGpu.ts';
import { verticeEmulado } from './rasterSoftware.ts';
import { thinStrokes } from './thin.ts';
import type { StrokeOp } from './types.ts';

const TRACO_PAPEL: StrokeOp = { pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }], closed: false, ...espessuraDePapel(0.3, 50, 100), color: '#000000', alpha: 1 };
const TRACO_PX: StrokeOp = { pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }], closed: false, widthPx: 3, color: '#000000', alpha: 1 };

/** Geometria de traço como a GPU a recebe (uma malha por lote de traço), para conferir o que o shader faria. */
function geometriaDoLote(s: StrokeOp): { geo: THREE.BufferGeometry; lote: ReturnType<typeof montarLotesCamada>[number] } {
  const [lote] = montarLotesCamada([], [s]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(lote!.pos, 3));
  geo.setAttribute('aExt', new THREE.Float32BufferAttribute(lote!.traco!.ext, 3));
  geo.setAttribute('aDir', new THREE.Float32BufferAttribute(lote!.traco!.dir, 3));
  geo.setAttribute('aPadrao', new THREE.Float32BufferAttribute(lote!.traco!.padrao, 2));
  geo.setIndex(lote!.idx);
  return { geo, lote: lote! };
}

/** Espessura em pixels que o shader dá ao traço no zoom (diferença de y dos vértices de um traço horizontal). */
function espessuraEmTela(s: StrokeOp, zoom: number): number {
  const { geo, lote } = geometriaDoLote(s);
  const papel = lote.papel === true;
  const ys = Array.from({ length: geo.getAttribute('position').count }, (_, k) => verticeEmulado(geo, k, zoom, papel).y);
  return (Math.max(...ys) - Math.min(...ys)) * zoom;
}

describe('espessura de papel (mm) converte com o zoom', () => {
  it('kPapel vezes o zoom dá a mesma largura de paperMmToPx (quando passa de 1 px)', () => {
    for (const zoom of [60, 220]) {
      expect(kPapel({ mm: 0.5, escala: 100 }) * zoom).toBeCloseTo(paperMmToPx(0.5, zoom, 100), 9);
    }
  });

  it('larguraEmPx usa o papel quando há, com piso de 1 px; sem papel, devolve widthPx', () => {
    expect(larguraEmPx(TRACO_PAPEL, 50)).toBe(paperMmToPx(0.3, 50, 100));
    expect(larguraEmPx(TRACO_PAPEL, 10)).toBe(1);
    expect(larguraEmPx(TRACO_PX, 220)).toBe(3);
  });

  it('espessuraDePapel guarda o papel e a largura do zoom de construção', () => {
    const e = espessuraDePapel(0.5, 60, 100);
    expect(e.papel).toEqual({ mm: 0.5, escala: 100 });
    expect(e.widthPx).toBe(3);
  });

  it.each([12, 60, 220])('no zoom %s o vertex shader põe o traço de papel na largura de paperMmToPx', (zoom) => {
    expect(espessuraEmTela(TRACO_PAPEL, zoom)).toBeCloseTo(paperMmToPx(0.3, zoom, 100), 6);
  });

  it('o traço de papel tem piso de 1 px no shader (zoom baixo)', () => {
    expect(espessuraEmTela(TRACO_PAPEL, 5)).toBeCloseTo(1, 6);
  });

  it('o traço sem papel mantém a espessura em px em qualquer zoom', () => {
    expect(espessuraEmTela(TRACO_PX, 12)).toBeCloseTo(3, 6);
    expect(espessuraEmTela(TRACO_PX, 220)).toBeCloseTo(3, 6);
  });
});

describe('lotes de traço separam o papel do px', () => {
  it('um traço de papel e um de px da mesma cor e alfa vão em lotes diferentes (material diferente)', () => {
    const lotes = montarLotesCamada([], [TRACO_PAPEL, { ...TRACO_PX, color: TRACO_PAPEL.color }]);
    expect(lotes).toHaveLength(2);
    expect(lotes[0]!.papel).toBe(true);
    expect(lotes[1]!.papel).toBeUndefined();
    expect(lotes[0]!.key).not.toBe(lotes[1]!.key);
  });
});

describe('thinStrokes com traço de papel', () => {
  it('traço de papel sai em 1 px e sem papel (senão o shader aplicaria o zoom de novo)', () => {
    const lista = [{ ...TRACO_PAPEL }];
    thinStrokes(lista);
    expect(lista[0]!.widthPx).toBe(1);
    expect(lista[0]!.papel).toBeUndefined();
  });

  it('traço em px acima de 1 px sai em 1 px; abaixo ou igual fica como estava', () => {
    const lista: StrokeOp[] = [{ ...TRACO_PX }, { ...TRACO_PX, widthPx: 0.5 }];
    thinStrokes(lista);
    expect(lista.map((s) => s.widthPx)).toEqual([1, 0.5]);
  });
});

describe('paleta da planta: espessura de papel junto da px', () => {
  it('cut e proj têm a mesma largura px de cutPx e projPx, com o papel guardado', () => {
    const pt = defaultPaint('wall', 100);
    expect(pt.cut.widthPx).toBe(pt.cutPx);
    expect(pt.proj.widthPx).toBe(pt.projPx);
    expect(pt.cut.papel?.escala).toBe(100);
    expect(pt.cut.papel?.mm).toBeGreaterThan(0);
  });
});
