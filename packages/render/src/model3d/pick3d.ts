import * as THREE from 'three';

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
