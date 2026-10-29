import * as THREE from 'three';
import type { Id } from '@hestia/model';
import type { ElementRange } from './solids.ts';
import { caixaDoIntervaloNoMundo, intervalosDeDesenho, mapaDaMalha } from './indiceDeElementos3d.ts';

/**
 * Caixa delimitadora (mundo) dos elementos dados dentro do modelo: as faixas dos elementos nas malhas (decisão 0016) e as
 * aberturas com `userData.elementId`. Devolve null se a seleção é vazia ou não tem geometria no modelo.
 *
 * A caixa de cada intervalo do índice fica em cache por versão da geometria (`indiceDeElementos3d.ts`): a seleção de um
 * pavimento inteiro deixa de varrer os triângulos do pavimento em cada clique.
 */
export function caixaDaSelecao(model: THREE.Object3D, ids: readonly Id[]): THREE.Box3 | null {
  if (!ids.length) return null;
  const want = new Set(ids);
  const box = new THREE.Box3();
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const faixas = mesh.userData.ranges as ElementRange[] | undefined;
    const geo = mesh.geometry as THREE.BufferGeometry | undefined;
    const index = geo?.index;
    if (!mesh.isMesh || !faixas || !index || !geo) {
      // Elementos que podem ter userData.elementId direto (ex: aberturas)
      if (mesh.userData.elementId && want.has(mesh.userData.elementId as Id)) box.expandByObject(mesh);
      return;
    }
    if (want.size <= faixas.length) {
      const porId = mapaDaMalha(faixas);
      const encontradas: ElementRange[] = [];
      for (const id of want) {
        const rs = porId.get(id);
        if (rs) for (const r of rs) encontradas.push(r);
      }
      if (encontradas.length) expandir(box, geo, index, encontradas, mesh.matrixWorld);
      return;
    }
    const encontradas: ElementRange[] = [];
    for (const r of faixas) if (want.has(r.id)) encontradas.push(r);
    if (encontradas.length) expandir(box, geo, index, encontradas, mesh.matrixWorld);
  });
  return box.isEmpty() ? null : box;
}

/** Une à `box` as caixas dos intervalos das faixas (uma caixa por intervalo, não por triângulo). */
function expandir(box: THREE.Box3, geo: THREE.BufferGeometry, index: THREE.BufferAttribute, faixas: readonly ElementRange[], matriz: THREE.Matrix4): void {
  for (const s of intervalosDeDesenho(faixas)) {
    const c = caixaDoIntervaloNoMundo(geo, index, s.start, s.count, matriz);
    if (c) box.union(c);
  }
}
