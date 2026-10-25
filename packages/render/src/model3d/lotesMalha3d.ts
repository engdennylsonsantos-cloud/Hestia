import * as THREE from 'three';
import type { GraphicsCategory, Id } from '@hestia/model';
import type { SolidBatch } from './solids.ts';

/**
 * Juntada dos lotes de um nível em malhas (desempenho 3D): cada grupo de categoria e material vira uma malha só, em vez de
 * uma por lote. A cena paga uma chamada de desenho por malha, então juntar reduz o trabalho da GPU e da CPU. As faixas de
 * elemento (`ids`, decisão 0016) são deslocadas pelo que já foi juntado: o picking e o realce continuam achando o elemento
 * pelo triângulo, sem mudar `pick3d.ts`.
 */

/** Chave do grupo: a categoria (visibilidade e substituição, decisão 0015) e o material. */
export function chaveDoLote(b: SolidBatch): string {
  return `${b.category}|${b.materialId}`;
}

/** Lote sem triângulo não gera malha nem arestas. */
const comTriangulos = (b: SolidBatch): boolean => b.indices.length > 0;

/** Agrupa os lotes com triângulos pela chave, na ordem da primeira aparição. */
export function agruparLotes(lotes: readonly SolidBatch[]): Map<string, SolidBatch[]> {
  const grupos = new Map<string, SolidBatch[]>();
  for (const b of lotes) {
    if (!comTriangulos(b)) continue;
    const k = chaveDoLote(b);
    const g = grupos.get(k);
    if (g) g.push(b);
    else grupos.set(k, [b]);
  }
  return grupos;
}

/**
 * Um lote só com os lotes dados (mesma categoria e material). Os índices de vértice saem deslocados pelos vértices já
 * juntados, e as faixas de elemento pelos índices já juntados (as faixas contam índices, não triângulos).
 */
export function juntarLote(fontes: readonly SolidBatch[]): SolidBatch {
  const out: SolidBatch = { materialId: fontes[0]!.materialId, category: fontes[0]!.category, positions: [], normals: [], indices: [], ids: [] };
  for (const f of fontes) {
    const vBase = out.positions.length / 3;
    const iBase = out.indices.length;
    for (const x of f.positions) out.positions.push(x);
    for (const n of f.normals) out.normals.push(n);
    for (const i of f.indices) out.indices.push(i + vBase);
    for (const r of f.ids) out.ids.push({ id: r.id, start: r.start + iBase, count: r.count });
  }
  return out;
}

/** Os lotes juntados por chave: um lote por grupo (ver `agruparLotes`). Lotes vazios saem. */
export function juntarLotes(lotes: readonly SolidBatch[]): SolidBatch[] {
  return [...agruparLotes(lotes).values()].map((g) => juntarLote(g));
}

/** Geometria de um lote (posições, normais e índices), pronta para a malha. */
export function geometriaDoLote(b: SolidBatch): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  g.setIndex(b.indices);
  return g;
}

/**
 * Arestas dos lotes dados, numa geometria só. Cada lote gera as arestas da sua própria geometria (com o mesmo ângulo de
 * antes), para que as juntas entre peças continuem desenhadas. Sem triângulos, devolve null.
 */
export function arestasDosLotes(lotes: readonly SolidBatch[], angulo: number): THREE.BufferGeometry | null {
  const pos: number[] = [];
  for (const b of lotes) {
    if (!comTriangulos(b)) continue;
    const g = geometriaDoLote(b);
    const e = new THREE.EdgesGeometry(g, angulo);
    for (const x of e.getAttribute('position').array) pos.push(x);
    g.dispose();
    e.dispose();
  }
  if (!pos.length) return null;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return out;
}

/**
 * Lote de uma geometria indexada já no mundo do nível (ex.: a caixa de uma esquadria fixa, com a transformação do vão
 * aplicada), com uma faixa que cobre a geometria inteira para o elemento `id`.
 */
export function loteDeGeometria(g: THREE.BufferGeometry, materialId: Id, category: GraphicsCategory, id: Id): SolidBatch {
  const index = g.index!;
  return {
    materialId,
    category,
    positions: Array.from(g.getAttribute('position').array),
    normals: Array.from(g.getAttribute('normal').array),
    indices: Array.from(index.array),
    ids: [{ id, start: 0, count: index.count }],
  };
}
