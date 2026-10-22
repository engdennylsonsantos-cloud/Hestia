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
