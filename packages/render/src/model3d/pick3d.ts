import * as THREE from 'three';
import type { GraphicsCategory, Id } from '@hestia/model';
import type { ElementRange } from './solids.ts';
import { buildTriBvh, raycastTriBvh, type TriBvh } from './triBvh.ts';

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
  const inv = new THREE.Matrix4();
  const local = new THREE.Ray();
  let best: { id: Id; point: { x: number; y: number; z: number }; kind: GraphicsCategory; distance: number } | null = null;

  for (const m of targets) {
    const bvh = bvhOf(m);
    if (!bvh) continue;
    const ranges = m.userData.ranges as ElementRange[];
    const rangeOf = (face: number): ElementRange | undefined => {
      const at = face * 3;
      return ranges.find((x) => at >= x.start && at < x.start + x.count);
    };
    inv.copy(m.matrixWorld).invert();
    local.copy(rc.ray).applyMatrix4(inv);
    const side = Array.isArray(m.material) ? THREE.DoubleSide : (m.material?.side ?? THREE.FrontSide);
    const hit = raycastTriBvh(bvh, local, Infinity, side, (face) => rangeOf(face) !== undefined);
    if (!hit) continue;
    const r = rangeOf(hit.faceIndex);
    if (!r) continue;
    const point = hit.point.applyMatrix4(m.matrixWorld);
    const distance = rc.ray.origin.distanceTo(point);
    if (!best || distance < best.distance) {
      best = { id: r.id, point: { x: point.x, y: point.y, z: point.z }, kind: m.userData.kind as GraphicsCategory, distance };
    }
  }
  return best ? { id: best.id, point: best.point, kind: best.kind } : null;
}

const bvhs = new WeakMap<THREE.BufferGeometry, TriBvh | null>();

/** BVH da geometria da malha, montado uma vez por instância de geometria (geometria nova = cache novo). */
function bvhOf(m: THREE.Mesh): TriBvh | null {
  const g = m.geometry;
  let bvh = bvhs.get(g);
  if (bvh === undefined) {
    const pos = g.getAttribute('position');
    const idx = g.getIndex();
    bvh = pos && idx && !(pos instanceof THREE.InterleavedBufferAttribute) ? buildTriBvh(pos.array, idx.array) : null;
    bvhs.set(g, bvh);
  }
  return bvh;
}
