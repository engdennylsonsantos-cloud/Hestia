import * as THREE from 'three';
import type { GraphicsCategory, Id } from '@hestia/model';
import { chaveDaColecao, type ColecaoCaixas } from './caixasDoNivel3d.ts';

/**
 * Malhas instanciadas da cena (desempenho 3D): as caixas de todos os níveis da cena, juntas por categoria e material, numa
 * `InstancedMesh` por grupo. Uma chamada de desenho por grupo, qualquer que seja o número de pavimentos, paredes e esquadrias.
 * As matrizes vêm dos níveis (que as guardam no cache); a malha é refeita a cada atualização, copiando matrizes, sem
 * geometria nova (a caixa unitária é uma só, da cena).
 */

/** Marca das malhas instanciadas: o picking por raio não as testa (a caixa unitária não é a geometria do mundo; ver `pick3d.ts`). */
export const SEM_PICKING = 'semPick';

/** Soma de caixas de um grupo vindo de vários níveis. */
interface Soma {
  categoria: GraphicsCategory;
  materialId: Id;
  partes: Float32Array[];
  total: number;
}

/** Junta as coleções dos níveis por categoria e material, na ordem da primeira aparição. */
export function somarColecoes(colecoes: readonly ColecaoCaixas[]): Soma[] {
  const por = new Map<string, Soma>();
  for (const c of colecoes) {
    const k = chaveDaColecao(c.categoria, c.materialId);
    let s = por.get(k);
    if (!s) {
      s = { categoria: c.categoria, materialId: c.materialId, partes: [], total: 0 };
      por.set(k, s);
    }
    s.partes.push(c.matrizes);
    s.total += c.matrizes.length / 16;
  }
  return [...por.values()];
}

/**
 * Uma `InstancedMesh` por grupo de categoria e material, com a caixa unitária `caixa`. `material` dá o material de cada grupo;
 * `sombras` liga o lançamento e o recebimento de sombra. A malha não leva faixas de elemento (o picking lê as malhas de
 * picking dos níveis) e leva a marca `SEM_PICKING`.
 */
export function malhasInstanciadas(
  colecoes: readonly ColecaoCaixas[],
  caixa: THREE.BufferGeometry,
  material: (categoria: GraphicsCategory, materialId: Id) => THREE.Material,
  sombras: boolean,
): THREE.InstancedMesh[] {
  const out: THREE.InstancedMesh[] = [];
  for (const s of somarColecoes(colecoes)) {
    if (s.total === 0) continue;
    const mesh = new THREE.InstancedMesh(caixa, material(s.categoria, s.materialId), s.total);
    let de = 0;
    for (const parte of s.partes) {
      mesh.instanceMatrix.array.set(parte, de);
      de += parte.length;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = sombras;
    mesh.receiveShadow = sombras;
    mesh.matrixAutoUpdate = false;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.userData = { kind: s.categoria, [SEM_PICKING]: true };
    out.push(mesh);
  }
  return out;
}

/** Uma linha só com as arestas das caixas de todos os níveis (pares de pontos), ou null se não há aresta. */
export function arestasInstanciadas(partes: readonly Float32Array[], material: THREE.Material): THREE.LineSegments | null {
  const total = partes.reduce((s, a) => s + a.length, 0);
  if (!total) return null;
  const todas = new Float32Array(total);
  let de = 0;
  for (const a of partes) {
    todas.set(a, de);
    de += a.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(todas, 3));
  const linhas = new THREE.LineSegments(geo, material);
  linhas.userData = { [SEM_PICKING]: true };
  return linhas;
}

/** Libera os buffers das malhas instanciadas e das arestas (a caixa unitária é da cena e não é liberada aqui). */
export function liberarMalhasInstanciadas(malhas: readonly THREE.InstancedMesh[], arestas?: THREE.LineSegments | null): void {
  for (const m of malhas) m.dispose();
  arestas?.geometry.dispose();
}
