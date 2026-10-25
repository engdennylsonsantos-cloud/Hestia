import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GraphicsCategory } from '@hestia/model';
import { agruparLotes, arestasDosLotes, chaveDoLote, geometriaDoLote, juntarLotes, loteDeGeometria } from './lotesMalha3d.ts';
import type { SolidBatch } from './solids.ts';

/** Triângulo de um elemento, deslocado em x, com material e categoria dados (uma faixa do elemento). */
function triangulo(id: string, x: number, materialId = 'm1', category: GraphicsCategory = 'wall'): SolidBatch {
  return {
    materialId,
    category,
    positions: [x, 0, 0, x + 1, 0, 0, x, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: [0, 1, 2],
    ids: [{ id, start: 0, count: 3 }],
  };
}

/** Elemento da face `face` (triângulo) pelas faixas: o mesmo critério do picking (`pick3d.ts`). */
function idDaFace(lote: SolidBatch, face: number): string | undefined {
  const at = face * 3;
  return lote.ids.find((r) => at >= r.start && at < r.start + r.count)?.id;
}

describe('chave e agrupamento dos lotes', () => {
  it('a chave é a categoria e o material: mesmo material em categorias diferentes não se junta', () => {
    expect(chaveDoLote(triangulo('a', 0, 'm1', 'wall'))).toBe('wall|m1');
    const grupos = agruparLotes([triangulo('a', 0, 'm1', 'wall'), triangulo('b', 0, 'm1', 'floor')]);
    expect(grupos.size).toBe(2);
  });

  it('agrupa na ordem da primeira aparição e ignora lotes sem triângulo', () => {
    const vazio: SolidBatch = { materialId: 'm9', category: 'wall', positions: [], normals: [], indices: [], ids: [] };
    const grupos = agruparLotes([triangulo('a', 0, 'm2'), vazio, triangulo('b', 5, 'm1'), triangulo('c', 9, 'm2')]);
    expect([...grupos.keys()]).toEqual(['wall|m2', 'wall|m1']);
    expect(grupos.get('wall|m2')).toHaveLength(2);
    expect(grupos.has('wall|m9')).toBe(false);
  });
});

describe('juntarLotes', () => {
  it('um lote por grupo de categoria e material, com os vértices e os índices deslocados', () => {
    const [m1, m2] = juntarLotes([triangulo('a', 0), triangulo('b', 5), triangulo('c', 0, 'm2')]);
    expect(m1!.materialId).toBe('m1');
    expect(m1!.positions).toHaveLength(18);
    expect(m1!.indices).toEqual([0, 1, 2, 3, 4, 5]);
    expect(m2!.materialId).toBe('m2');
    expect(m2!.indices).toEqual([0, 1, 2]);
  });

  it('desloca as faixas de elemento pelos índices já juntados: a face de cada elemento continua sendo o mesmo elemento', () => {
    const [m1] = juntarLotes([triangulo('a', 0), triangulo('b', 5), triangulo('c', 9)]);
    expect(m1!.ids).toEqual([
      { id: 'a', start: 0, count: 3 },
      { id: 'b', start: 3, count: 3 },
      { id: 'c', start: 6, count: 3 },
    ]);
    expect(idDaFace(m1!, 0)).toBe('a');
    expect(idDaFace(m1!, 1)).toBe('b');
    expect(idDaFace(m1!, 2)).toBe('c');
  });

  it('a posição de cada triângulo não muda: o vértice do segundo elemento sai no mesmo lugar', () => {
    const [m1] = juntarLotes([triangulo('a', 0), triangulo('b', 5)]);
    // Segundo triângulo: vértices 3, 4 e 5 do lote juntado, que são (5,0,0), (6,0,0) e (5,1,0).
    expect(m1!.positions.slice(9, 18)).toEqual([5, 0, 0, 6, 0, 0, 5, 1, 0]);
    expect(m1!.indices.slice(3)).toEqual([3, 4, 5]);
  });

  it('não altera os lotes de entrada (o nível reaproveitado usa os mesmos arrays)', () => {
    const a = triangulo('a', 0);
    juntarLotes([a, triangulo('b', 5)]);
    expect(a.indices).toEqual([0, 1, 2]);
    expect(a.ids).toEqual([{ id: 'a', start: 0, count: 3 }]);
  });
});

describe('geometria e arestas dos lotes', () => {
  it('geometriaDoLote leva posições, normais e índices do lote', () => {
    const g = geometriaDoLote(triangulo('a', 0));
    expect(g.getAttribute('position').count).toBe(3);
    expect(g.getAttribute('normal').count).toBe(3);
    expect(g.index!.count).toBe(3);
    g.dispose();
  });

  it('arestasDosLotes: sem triângulos, null; com triângulos, as arestas de cada lote (um triângulo solto tem 3)', () => {
    expect(arestasDosLotes([], 28)).toBeNull();
    const arestas = arestasDosLotes([triangulo('a', 0), triangulo('b', 5)], 28)!;
    // 3 arestas por triângulo solto, 2 vértices cada: 12 vértices no total.
    expect(arestas.getAttribute('position').count).toBe(12);
  });

  it('loteDeGeometria: a geometria inteira vira um lote com a faixa do elemento', () => {
    const caixa = new THREE.BoxGeometry(1, 1, 1);
    const lote = loteDeGeometria(caixa, 'm3', 'door', 'd1');
    expect(lote.materialId).toBe('m3');
    expect(lote.category).toBe('door');
    expect(lote.ids).toEqual([{ id: 'd1', start: 0, count: 36 }]);
    expect(lote.positions).toHaveLength(72);
    expect(lote.indices).toHaveLength(36);
    caixa.dispose();
  });
});
