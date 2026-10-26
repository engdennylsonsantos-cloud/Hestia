import * as THREE from 'three';
import type { GraphicsCategory, Id } from '@hestia/model';
import type { ElementRange } from './solids.ts';
import { buildTriBvh, raycastTriBvh, type TriBvh } from './triBvh.ts';

// Objetos reaproveitados entre chamadas: o picking roda a cada quadro de hover e a cada roda do zoom. A cena é de um
// thread só e as funções não se chamam de dentro uma da outra, então um só conjunto basta.
const rc = new THREE.Raycaster();
const inv = new THREE.Matrix4();
const local = new THREE.Ray();

/** Primeira superfície do modelo sobre o raio: ponto (m, no mundo) e distância da origem (m). */
interface SurfaceHit {
  point: THREE.Vector3;
  distance: number;
}

/**
 * Picking na vista 3D: raio do cursor (coordenadas normalizadas, −1..1) contra as malhas da cena. Devolve só o ponto (x, y)
 * da primeira superfície atingida, em metros: a ferramenta acha o elemento pela planta (telhado sob o ponto, parede sob o
 * ponto), sem precisar de id por malha (as malhas são agrupadas por material). Ignora linhas (arestas, grade) e o chão,
 * que é um plano de 400 m (`PlaneGeometry`); as malhas do modelo são `BufferGeometry`.
 */
export function pickModelPoint(root: THREE.Object3D, camera: THREE.Camera, ndc: { x: number; y: number }): { x: number; y: number } | null {
  rc.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const hit = firstSurface(root, rc);
  return hit ? { x: hit.point.x, y: hit.point.y } : null;
}

/**
 * Distância (m) de `origin` à primeira superfície do modelo na direção `dir` (unitária), ou null. Mesmas regras de
 * `pickModelPoint`: ignora linhas e o chão. Usada pelo zoom para não atravessar paredes.
 */
export function firstSurfaceDistance(root: THREE.Object3D, origin: THREE.Vector3, dir: THREE.Vector3): number | null {
  rc.ray.set(origin, dir);
  const hit = firstSurface(root, rc);
  return hit ? hit.distance : null;
}

/**
 * Superfície mais próxima do raio de `rc` (já montado, em coordenadas do mundo) entre as malhas de `root`. Cada malha
 * com BVH de triângulos é testada no próprio BVH, no espaço local; a que não tem BVH (geometria sem índice ou
 * entrelaçada, ou material por grupo) passa pelo `Raycaster`, como antes. Malhas `PlaneGeometry` (o chão) não contam.
 */
function firstSurface(root: THREE.Object3D, ray: THREE.Raycaster): SurfaceHit | null {
  root.updateMatrixWorld(true);
  let best: SurfaceHit | null = null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    // Malhas instanciadas (`userData.semPick`) não entram: a geometria delas é a caixa unitária, e o mundo está nas malhas de picking dos níveis.
    if (!m.isMesh || m.geometry.type === 'PlaneGeometry' || m.userData.semPick === true || !o.layers.test(ray.layers)) return;
    const bvh = Array.isArray(m.material) || !m.material ? null : bvhOf(m);
    if (!bvh) {
      for (const h of ray.intersectObject(m, false)) {
        if (!best || h.distance < best.distance) best = { point: h.point.clone(), distance: h.distance };
      }
      return;
    }
    inv.copy(m.matrixWorld).invert();
    local.copy(ray.ray).applyMatrix4(inv);
    const hit = raycastTriBvh(bvh, local, Infinity, (m.material as THREE.Material).side);
    if (!hit) return;
    const point = hit.point.applyMatrix4(m.matrixWorld);
    const distance = ray.ray.origin.distanceTo(point);
    if (!best || distance < best.distance) best = { point, distance };
  });
  return best;
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

  rc.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  let best: { id: Id; point: { x: number; y: number; z: number }; kind: GraphicsCategory; distance: number } | null = null;

  for (const m of targets) {
    const bvh = bvhOf(m);
    if (!bvh) continue;
    const ranges = sortedRanges(m.userData.ranges as ElementRange[]);
    inv.copy(m.matrixWorld).invert();
    local.copy(rc.ray).applyMatrix4(inv);
    const side = Array.isArray(m.material) ? THREE.DoubleSide : (m.material?.side ?? THREE.FrontSide);
    const hit = raycastTriBvh(bvh, local, Infinity, side, (face) => rangeAt(ranges, face) !== undefined);
    if (!hit) continue;
    const r = rangeAt(ranges, hit.faceIndex);
    if (!r) continue;
    const point = hit.point.applyMatrix4(m.matrixWorld);
    const distance = rc.ray.origin.distanceTo(point);
    if (!best || distance < best.distance) {
      best = { id: r.id, point: { x: point.x, y: point.y, z: point.z }, kind: m.userData.kind as GraphicsCategory, distance };
    }
  }
  return best ? { id: best.id, point: best.point, kind: best.kind } : null;
}

const bvhs = new WeakMap<THREE.BufferGeometry, { bvh: TriBvh | null; versao: number }>();

/**
 * BVH da geometria da malha, montado uma vez por versão da geometria. Os lotes globais da cena 3D são atualizados no
 * mesmo `BufferGeometry` (envio parcial); `geometry.userData.versao` diz quando o BVH ficou velho. O BVH cobre só o que
 * o `drawRange` desenha, não a capacidade inteira do buffer.
 */
function bvhOf(m: THREE.Mesh): TriBvh | null {
  const g = m.geometry;
  const versao = Number(g.userData.versao ?? 0);
  const emCache = bvhs.get(g);
  if (emCache && emCache.versao === versao) return emCache.bvh;
  const pos = g.getAttribute('position');
  const idx = g.getIndex();
  const limite = Number.isFinite(g.drawRange.count) ? Math.min(g.drawRange.count, idx?.count ?? 0) : idx?.count ?? 0;
  let bvh: TriBvh | null = null;
  if (pos && idx && !(pos instanceof THREE.InterleavedBufferAttribute) && limite > 0) {
    const todos = idx.array as Uint16Array | Uint32Array;
    const indices = limite === todos.length ? todos : todos.subarray(0, limite);
    bvh = buildTriBvh(pos.array, indices);
  }
  bvhs.set(g, { bvh, versao });
  return bvh;
}

const sortedRangesOf = new WeakMap<ElementRange[], ElementRange[]>();

/** Faixas da malha ordenadas por início (uma vez por lista de faixas: a lista pertence à malha, então sai com ela). */
function sortedRanges(ranges: ElementRange[]): ElementRange[] {
  let s = sortedRangesOf.get(ranges);
  if (!s) {
    s = [...ranges].sort((a, b) => a.start - b.start);
    sortedRangesOf.set(ranges, s);
  }
  return s;
}

/** Faixa que contém o triângulo `face` (busca binária nas faixas ordenadas), ou undefined. */
function rangeAt(ranges: ElementRange[], face: number): ElementRange | undefined {
  const at = face * 3;
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const x = ranges[mid]!;
    if (at < x.start) hi = mid - 1;
    else if (at >= x.start + x.count) lo = mid + 1;
    else return x;
  }
  return undefined;
}
