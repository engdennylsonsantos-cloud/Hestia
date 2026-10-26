import { describe, expect, it } from 'vitest';
import { polygonArea, ringArea, type Vec2 } from '@hestia/geom';
import { makeRoof, type Roof } from '@hestia/model';
import { editRingEdges, offsetEdge, presetEdgeSlopes, roofOverhangPatch, roofRingPatch, roofShapePatch } from './roofEdges.ts';
import { eaveOutlinePerEdge } from './roofGeom.ts';

const rect = (w: number, h: number): Vec2[] => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
];

/** Forma em L de 6 × 4 com o degrau de 2 × 2 no canto superior direito (6 arestas, sentido anti-horário). */
const L: Vec2[] = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 2 },
  { x: 2, y: 2 },
  { x: 2, y: 4 },
  { x: 0, y: 4 },
];

describe('predefinições por aresta (A10, A3)', () => {
  it('duas águas: arestas paralelas à cumeeira definem inclinação; as outras são empenas', () => {
    expect(presetEdgeSlopes(rect(8, 6), 'gable', { x: 1, y: 0 }, 30)).toEqual([30, null, 30, null]);
    expect(presetEdgeSlopes(rect(8, 6), 'gable', { x: 0, y: 1 }, 30)).toEqual([null, 30, null, 30]);
  });

  it('quatro águas e por arestas: todas as arestas definem a inclinação da barra', () => {
    expect(presetEdgeSlopes(rect(8, 6), 'hip', { x: 1, y: 0 }, 25)).toEqual([25, 25, 25, 25]);
    expect(presetEdgeSlopes(L, 'hip', { x: 1, y: 0 }, 25)).toHaveLength(6);
    expect(presetEdgeSlopes(L, 'hip', { x: 1, y: 0 }, 25).every((v) => v === 25)).toBe(true);
    expect(presetEdgeSlopes(L, 'edges', { x: 1, y: 0 }, 40).every((v) => v === 40)).toBe(true);
  });

  it('uma água: só a aresta mais baixa em relação à subida define inclinação', () => {
    // Subida em +x: a aresta mais baixa é a da esquerda (x = 0).
    expect(presetEdgeSlopes(rect(8, 6), 'shed', { x: 1, y: 0 }, 30)).toEqual([null, null, null, 30]);
    // Subida em -x: a aresta mais baixa é a da direita (x = 8), que é a aresta 1.
    expect(presetEdgeSlopes(rect(8, 6), 'shed', { x: -1, y: 0 }, 30)).toEqual([null, 30, null, null]);
  });

  it('contorno em L com duas águas: sem erro, com as arestas paralelas ao eixo definindo', () => {
    const v = presetEdgeSlopes(L, 'gable', { x: 1, y: 0 }, 30);
    expect(v).toHaveLength(6);
    expect(v).toEqual([30, null, 30, null, 30, null]);
  });
});

describe('deslocar uma aresta (A11)', () => {
  it('aresta 0 do retângulo 8 × 6 deslocada 1 m para fora: 8 × 7', () => {
    const r = offsetEdge(rect(8, 6), 0, 1)!;
    expect(r).toHaveLength(4);
    expect(Math.abs(ringArea(r))).toBeCloseTo(56, 9);
    expect(r[0]!.y).toBeCloseTo(-1, 9);
    expect(r[1]!.y).toBeCloseTo(-1, 9);
  });

  it('aresta 1 (lado direito) deslocada 1 m para fora: 9 × 6', () => {
    const r = offsetEdge(rect(8, 6), 1, 1)!;
    expect(Math.abs(ringArea(r))).toBeCloseTo(54, 9);
    expect(r[1]!.x).toBeCloseTo(9, 9);
  });

  it('deslocar para dentro reduz; deslocamento zero não muda; anti-horário e horário dão o mesmo resultado', () => {
    expect(Math.abs(ringArea(offsetEdge(rect(8, 6), 1, -1)!))).toBeCloseTo(42, 9);
    expect(offsetEdge(rect(8, 6), 2, 0)).toEqual(rect(8, 6));
    const cw = [...rect(8, 6)].reverse();
    // Na lista invertida, o lado direito é a aresta de índice 1 (de (8,6) a (8,0)).
    expect(Math.abs(ringArea(offsetEdge(cw, 1, 1)!))).toBeCloseTo(54, 9);
  });

  it('deslocar só a aresta do L não mexe nas outras', () => {
    const r = offsetEdge(L, 0, 1)!;
    expect(r[2]).toEqual(L[2]);
    expect(r[3]).toEqual(L[3]);
    expect(r[0]!.y).toBeCloseTo(-1, 9);
    // O L tem área 16; a aresta de 6 m para fora por 1 m soma 6 m².
    expect(polygonArea([L])).toBeCloseTo(16, 9);
    expect(Math.abs(ringArea(r))).toBeCloseTo(22, 9);
  });
});

describe('vetor por aresta acompanha os vértices (A11)', () => {
  it('inserir vértice na aresta i duplica o valor nas duas metades', () => {
    expect(editRingEdges([30, null, 30, null], { kind: 'insert', edge: 0 })).toEqual([30, 30, null, 30, null]);
    expect(editRingEdges([30, null, 30, null], { kind: 'insert', edge: 3 })).toEqual([30, null, 30, null, null]);
  });

  it('remover vértice funde as arestas vizinhas e herda o valor da primeira (v-1)', () => {
    // Vértice 2: as arestas 1 (null) e 2 (30) viram uma só, com o valor null da aresta 1.
    expect(editRingEdges([30, null, 30, 45], { kind: 'remove', vertex: 2 })).toEqual([30, null, 45]);
    // Vértice 1: arestas 0 (30) e 1 (null) viram uma só, com 30.
    expect(editRingEdges([30, null, 30, 45], { kind: 'remove', vertex: 1 })).toEqual([30, 30, 45]);
  });

  it('o tamanho do vetor continua igual ao número de arestas do contorno', () => {
    const ring = rect(8, 6);
    const grown = [...ring.slice(0, 1), { x: 4, y: 0 }, ...ring.slice(1)];
    expect(editRingEdges([30, 30, 30, 30], { kind: 'insert', edge: 0 })).toHaveLength(grown.length);
    expect(editRingEdges([30, 30, 30, 30, 30], { kind: 'remove', vertex: 4 })).toHaveLength(4);
  });
});

describe('troca de forma pelas Propriedades', () => {
  const base: Roof = { ...makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect(8, 6), shape: 'shed', slopePercent: 30, dir: { x: 1, y: 0 } }), order: 0 };

  it('uma água para duas águas gira a cumeeira 90° e vira por arestas', () => {
    const patch = roofShapePatch(base, 'gable', 30);
    expect(patch.shape).toBe('edges');
    expect(patch.dir).toEqual({ x: 0, y: 1 });
    // A cumeeira agora é vertical: as arestas verticais (1 e 3) definem inclinação.
    expect(patch.edgeSlopes).toEqual([null, 30, null, 30]);
  });

  it('águas livres: uma água sobre o contorno, com a subida da direção do telhado', () => {
    const patch = roofShapePatch(base, 'free', 20);
    expect(patch.shape).toBe('free');
    expect(patch.planes).toHaveLength(1);
    expect(patch.planes![0]!.polygon).toEqual(base.boundary);
    expect(patch.planes![0]!.percent).toBe(20);
    expect(patch.planes![0]!.origin).toEqual({ x: 0, y: 0 });
  });

  it('mesma forma ou extrusão não muda nada', () => {
    expect(roofShapePatch(base, 'shed')).toEqual({});
    expect(roofShapePatch(base, 'extrusion')).toEqual({});
  });
});

describe('telhado: balanço por aresta com pegada (roofOverhangPatch)', () => {
  /** Telhado 4 × 3 com pegada e beiral de 0,5 m em todas as arestas. */
  const withFootprint = (): Roof => {
    const footprint = rect(4, 3);
    return { ...makeRoof({ id: 't', typeId: 'rt_ceramica', levelId: 'lv_0', footprint, boundary: eaveOutlinePerEdge(footprint, [0.5, 0.5, 0.5, 0.5]), edgeOverhangs: [0.5, 0.5, 0.5, 0.5] }), order: 0 };
  };

  it('com pegada, mudar o balanço de uma aresta refaz o beiral da pegada', () => {
    const r = withFootprint();
    const patch = roofOverhangPatch(r, 1, 1)!;
    expect(patch.edgeOverhangs).toEqual([0.5, 1, 0.5, 0.5]);
    // A aresta 1 é a direita (x = 4): sai 1 m, então o beiral vai até x = 5.
    expect(Math.max(...patch.boundary!.map((q) => q.x))).toBeCloseTo(5, 9);
    expect(patch.boundary).toHaveLength(4);
  });

  it('voltar ao balanço anterior recria o mesmo beiral (sem deriva acumulada)', () => {
    const r = withFootprint();
    const moved = { ...r, ...roofOverhangPatch(r, 1, 1)! };
    const back = roofOverhangPatch(moved, 1, 0.5)!;
    back.boundary!.forEach((q, i) => {
      expect(q.x).toBeCloseTo(r.boundary[i]!.x, 9);
      expect(q.y).toBeCloseTo(r.boundary[i]!.y, 9);
    });
  });

  it('sem pegada, a aresta anda pela diferença para o balanço anterior, como antes', () => {
    const r = { ...makeRoof({ id: 't', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect(4, 3) }), order: 0 };
    const patch = roofOverhangPatch(r, 1, 1)!;
    expect(patch.edgeOverhangs).toEqual([0, 1, 0, 0]);
    expect(Math.max(...patch.boundary!.map((q) => q.x))).toBeCloseTo(5, 9);
    expect(polygonArea([patch.boundary!])).toBeCloseTo(4 * 3 + 3, 6);
  });

  it('editar um vértice à mão tira a pegada: o contorno editado passa a valer', () => {
    const r = withFootprint();
    const ring = r.boundary.map((q, i) => (i === 2 ? { x: q.x + 1, y: q.y } : q));
    const patch = roofRingPatch(r, ring, null);
    expect(patch.footprint).toBeUndefined();
    expect(patch.boundary).toEqual(ring);
  });
});
