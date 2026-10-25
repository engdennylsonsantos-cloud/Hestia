import * as THREE from 'three';
import type { Id } from '@hestia/model';
import type { ElementRange } from './solids.ts';

/**
 * Caixa delimitadora (mundo) dos elementos dados dentro do modelo: as faixas dos elementos nas malhas (decisão 0016) e as
 * aberturas com `userData.elementId`. Devolve null se a seleção é vazia ou não tem geometria no modelo.
 */
export function caixaDaSelecao(model: THREE.Object3D, ids: readonly Id[]): THREE.Box3 | null {
  if (!ids.length) return null;
  const want = new Set(ids);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const ranges = mesh.userData.ranges as ElementRange[] | undefined;
    const index = (mesh.geometry as THREE.BufferGeometry | undefined)?.index;
    if (!mesh.isMesh || !ranges || !index) {
      // Elementos que podem ter userData.elementId direto (ex: aberturas)
      if (mesh.userData.elementId && want.has(mesh.userData.elementId as Id)) {
        box.expandByObject(mesh);
      }
      return;
    }
    const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (const r of ranges) {
      if (!want.has(r.id)) continue;
      for (let k = r.start; k < r.start + r.count; k++) {
        v.fromBufferAttribute(attr, index.getX(k)).applyMatrix4(mesh.matrixWorld);
        box.expandByPoint(v);
      }
    }
  });
  return box.isEmpty() ? null : box;
}
