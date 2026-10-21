import * as THREE from 'three';
import type { GraphicsCategory, Id } from '@hestia/model';
import type { ElementRange } from './solids.ts';

/**
 * Picking na vista 3D: raio do cursor (coordenadas normalizadas, −1..1) contra as malhas da cena. Devolve só o ponto (x, y)
 * da primeira superfície atingida, em metros: a ferramenta acha o elemento pela planta (telhado sob o ponto, parede sob o
 * ponto), sem precisar de id por malha (as malhas são agrupadas por material). Ignora linhas (arestas, grade) e o chão,
 * que é um plano de 400 m (`PlaneGeometry`); as malhas do modelo são `BufferGeometry`.
 */
export function pickModelPoint(root: THREE.Object3D, camera: THREE.Camera, ndc: { x: number; y: number }): { x: number; y: number } | null {
  // As matrizes de mundo só são atualizadas ao desenhar; o clique pode vir antes, então atualiza aqui (barato para um clique).
  root.updateMatrixWorld(true);
  const rc = new THREE.Raycaster();
  rc.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  for (const h of rc.intersectObject(root, true)) {
    const m = h.object as THREE.Mesh;
    if (!m.isMesh || m.geometry.type === 'PlaneGeometry') continue;
    return { x: h.point.x, y: h.point.y };
  }
  return null;
}

/** Elemento sob o cursor: o id, o ponto (m) da face atingida e a categoria gráfica (parede, porta, janela, piso, ...). */
export interface ElementHit {
  id: Id;
  point: { x: number; y: number; z: number };
  kind: GraphicsCategory;
}

/**
 * Elemento da face atingida pelo raio do cursor (decisão 0016). Só as malhas do modelo entram: as que têm
 * `userData.ranges` (chão, grade, arestas e realce não têm). O triângulo atingido (`faceIndex`) cai numa faixa, e a faixa
 * dá o id; as esquadrias têm uma faixa com o id da abertura. Sem nada atingido, null.
 */
export function pickElement(root: THREE.Object3D, camera: THREE.Camera, ndc: { x: number; y: number }): ElementHit | null {
  root.updateMatrixWorld(true);
  const targets: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).userData.ranges) targets.push(o as THREE.Mesh);
  });
  if (!targets.length) return null;
  const rc = new THREE.Raycaster();
  rc.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  for (const h of rc.intersectObjects(targets, false)) {
    const m = h.object as THREE.Mesh;
    const at = (h.faceIndex ?? -1) * 3;
    const r = (m.userData.ranges as ElementRange[]).find((x) => at >= x.start && at < x.start + x.count);
    if (r) return { id: r.id, point: { x: h.point.x, y: h.point.y, z: h.point.z }, kind: m.userData.kind as GraphicsCategory };
  }
  return null;
}
