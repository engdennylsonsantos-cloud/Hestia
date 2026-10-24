import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { firstSurfaceDistance, pickModelPoint } from './pick3d.ts';

/** Câmera de cima (olhando para −z) sobre o ponto (2, 3). */
function topCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  cam.position.set(2, 3, 20);
  cam.up.set(0, 1, 0);
  cam.lookAt(2, 3, 0);
  cam.updateMatrixWorld();
  return cam;
}

describe('pickModelPoint (vista 3D)', () => {
  it('devolve o ponto (x, y) da superfície superior da malha sob o centro da tela', () => {
    const scene = new THREE.Scene();
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.2), new THREE.MeshBasicMaterial());
    roof.position.set(2, 3, 3);
    scene.add(roof);
    const hit = pickModelPoint(scene, topCamera(), { x: 0, y: 0 });
    expect(hit?.x).toBeCloseTo(2, 6);
    expect(hit?.y).toBeCloseTo(3, 6);
  });

  it('ignora o chão (PlaneGeometry) e as linhas: fora do modelo, nada', () => {
    const scene = new THREE.Scene();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial());
    scene.add(ground);
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5, 3, 1), new THREE.Vector3(9, 3, 1)]));
    scene.add(lines);
    expect(pickModelPoint(scene, topCamera(), { x: 0, y: 0 })).toBeNull();
  });

  it('a superfície mais próxima da câmera vence', () => {
    const scene = new THREE.Scene();
    const low = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 0.2), new THREE.MeshBasicMaterial());
    low.position.set(2, 3, 0);
    const high = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2), new THREE.MeshBasicMaterial());
    high.position.set(2, 3, 5);
    scene.add(low, high);
    const hit = pickModelPoint(scene, topCamera(), { x: 0, y: 0 });
    expect(hit).not.toBeNull();
  });
});

describe('firstSurfaceDistance: distância à primeira parede no eixo (zoom)', () => {
  const wallAt3 = (): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 4), new THREE.MeshBasicMaterial());
    m.position.set(3, 0, 2);
    return m;
  };

  it('mede até a face mais próxima da origem, na direção dada', () => {
    const root = new THREE.Group();
    root.add(wallAt3());
    expect(firstSurfaceDistance(root, new THREE.Vector3(0, 0, 2), new THREE.Vector3(1, 0, 0))).toBeCloseTo(2.9, 6);
  });

  it('sem nada na direção, devolve null; o chão (PlaneGeometry) não conta', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial()));
    expect(firstSurfaceDistance(root, new THREE.Vector3(0, 0, 2), new THREE.Vector3(1, 0, 0))).toBeNull();
    expect(firstSurfaceDistance(new THREE.Group(), new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, 1))).toBeNull();
  });
});

/** Referência: o que o picking fazia antes do BVH (`Raycaster` sobre a cena inteira, sem as linhas e o chão). */
function refSurface(root: THREE.Object3D, ray: THREE.Raycaster): { point: THREE.Vector3; distance: number } | null {
  root.updateMatrixWorld(true);
  for (const h of ray.intersectObject(root, true)) {
    const m = h.object as THREE.Mesh;
    if (!m.isMesh || m.geometry.type === 'PlaneGeometry') continue;
    return { point: h.point, distance: h.distance };
  }
  return null;
}

const SIDES = [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide, THREE.FrontSide];

/** Malhas de triângulos aleatórios (com e sem índice, com cada lado de material) e os raios de teste. */
function cenaAleatoria(seed: number): { root: THREE.Group; camera: THREE.PerspectiveCamera; ndc: Array<{ x: number; y: number }>; rays: Array<{ o: THREE.Vector3; d: THREE.Vector3 }> } {
  let a = seed >>> 0;
  const random = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const root = new THREE.Group();
  SIDES.forEach((side, k) => {
    const n = 300;
    const pos: number[] = [];
    for (let i = 0; i < n * 9; i++) pos.push((random() * 2 - 1) * 3, (random() * 2 - 1) * 3, (random() * 2 - 1) * 3 + k * 0.5);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    // Malhas pares indexadas; as ímpares não têm índice (caem no Raycaster, como antes).
    if (k % 2 === 0) geo.setIndex(Array.from({ length: n * 3 }, (_, i) => i));
    root.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side })));
  });
  const camera = topCamera();
  const ndc = Array.from({ length: 40 }, () => ({ x: random() * 2 - 1, y: random() * 2 - 1 }));
  const rays = Array.from({ length: 40 }, () => {
    const d = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
    return { o: new THREE.Vector3((random() * 2 - 1) * 4, (random() * 2 - 1) * 4, (random() * 2 - 1) * 4), d };
  });
  return { root, camera, ndc, rays };
}

describe('pick por BVH é igual ao Raycaster (lados de material e malhas sem índice)', () => {
  it('pickModelPoint acha a mesma superfície que o Raycaster', () => {
    const { root, camera, ndc } = cenaAleatoria(7);
    let acertos = 0;
    for (const p of ndc) {
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(p.x, p.y), camera);
      const want = refSurface(root, rc);
      const got = pickModelPoint(root, camera, p);
      if (!want) {
        expect(got).toBeNull();
        continue;
      }
      acertos++;
      expect(got!.x).toBeCloseTo(want.point.x, 9);
      expect(got!.y).toBeCloseTo(want.point.y, 9);
    }
    expect(acertos).toBeGreaterThan(5);
  });

  it('firstSurfaceDistance acha a mesma distância que o Raycaster', () => {
    const { root, rays } = cenaAleatoria(11);
    let acertos = 0;
    for (const r of rays) {
      const rc = new THREE.Raycaster(r.o, r.d);
      const want = refSurface(root, rc);
      const got = firstSurfaceDistance(root, r.o, r.d);
      if (!want) {
        expect(got).toBeNull();
        continue;
      }
      acertos++;
      expect(got).toBeCloseTo(want.distance, 9);
    }
    expect(acertos).toBeGreaterThan(5);
  });
});
