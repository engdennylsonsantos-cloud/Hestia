import { describe, expect, it } from 'vitest';
import { applyCommand, createEmptyProject, type CadDrawing, type Project } from '@hestia/model';
import { infer, type InferContext } from './infer.ts';
import { cadDrawingIdsInBox, cadNear, cadSnapIndexes } from './snapCad.ts';
import { DEFAULT_SNAP } from './types.ts';

/** Escala de teste: 1 px = 0,005 m, então a tolerância de captura (10 px) é 0,05 m. */
const MPP = 0.005;

/** Projeto com um DXF: quadrado (1 × 1) e uma linha solta. */
function projeto(patch: Partial<Omit<CadDrawing, 'order'>> = {}): Project {
  const p = createEmptyProject();
  const cad: Omit<CadDrawing, 'order'> = {
    id: 'cad_1',
    kind: 'cad',
    levelId: 'lv_0',
    name: 'planta',
    source: 'dxf',
    unit: 'm',
    layers: [{ name: '0' }],
    paths: [
      { layer: '0', closed: true, pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
      { layer: '0', closed: false, pts: [{ x: 2, y: 0 }, { x: 3, y: 0 }] },
    ],
    texts: [],
    ...patch,
  };
  applyCommand(p, { type: 'addCadDrawing', cad });
  return p;
}

const at = (p: Project, x: number, y: number, extra: Partial<InferContext> = {}) =>
  infer({ x, y }, { project: p, levelId: 'lv_0', mpp: MPP, gridStep: 0.1, cad: cadSnapIndexes(p, ['lv_0']), ...extra });

describe('captura nas linhas do CAD importado (DXF)', () => {
  it('vértice do traço vira extremidade (endpoint)', () => {
    const r = at(projeto(), 1.02, 0.98);
    expect(r.kind).toBe('endpoint');
    expect(r.point).toEqual({ x: 1, y: 1 });
  });

  it('ponto médio do traço vira midpoint', () => {
    const r = at(projeto(), 0.51, 0.01);
    expect(r.kind).toBe('midpoint');
    expect(r.point).toEqual({ x: 0.5, y: 0 });
  });

  it('ponto sobre a linha vira nearest (referência para desenhar por cima)', () => {
    const r = at(projeto(), 0.3, 0.02);
    expect(r.kind).toBe('nearest');
    expect(r.point).toEqual({ x: 0.3, y: 0 });
  });

  it('cruzamento de duas linhas vira interseção', () => {
    const p = projeto({ paths: [{ layer: '0', closed: false, pts: [{ x: 0, y: 0 }, { x: 2, y: 0 }] }, { layer: '0', closed: false, pts: [{ x: 1, y: -1 }, { x: 1, y: 1 }] }] });
    const r = at(p, 1.01, 0.02);
    expect(r.kind).toBe('intersection');
    expect(r.point).toEqual({ x: 1, y: 0 });
  });

  it('captura de CAD desligada não devolve o traço', () => {
    const r = at(projeto(), 0.3, 0.02, { snap: { ...DEFAULT_SNAP, cad: false, grid: false } });
    expect(r.kind).not.toBe('nearest');
  });

  it('desenho com visible: false não entra no índice nem na captura', () => {
    const p = projeto({ visible: false });
    expect(cadSnapIndexes(p, ['lv_0'])).toHaveLength(0);
    expect(at(p, 0.3, 0.02).kind).not.toBe('nearest');
  });

  it('desenho de outro nível fica fora', () => {
    const p = projeto();
    expect(cadSnapIndexes(p, ['lv_9'])).toHaveLength(0);
  });
});

describe('seleção do desenho CAD na planta', () => {
  it('clique na linha encontra o desenho; longe dele, não', () => {
    const p = projeto();
    const ix = cadSnapIndexes(p, ['lv_0']);
    expect(cadNear(ix, { x: 0.3, y: 0.02 }, 4 * MPP)).toBe('cad_1');
    expect(cadNear(ix, { x: 5, y: 5 }, 4 * MPP)).toBeNull();
  });

  it('janela que contém o desenho o seleciona', () => {
    const p = projeto();
    const ix = cadSnapIndexes(p, ['lv_0']);
    expect(cadDrawingIdsInBox(ix, { x: -1, y: -1 }, { x: 4, y: 2 })).toEqual(['cad_1']);
    expect(cadDrawingIdsInBox(ix, { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 })).toEqual([]);
  });
});
