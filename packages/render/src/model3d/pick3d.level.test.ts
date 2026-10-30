import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { pickDimension, pickLevel } from './pick3d.ts';

/** Câmera de cima sobre a origem, olhando para −z (o raio do centro acerta a linha em y = 0). */
function cameraDeCima(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  cam.position.set(0, 0, 20);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

/** Cena mínima do datum: um grupo `userData.levels` com uma linha em `z = 0` e o `levelId` para o picking. */
function cenaComLinha(levelId = 'lv_0'): THREE.Scene {
  const scene = new THREE.Scene();
  const grupo = new THREE.Group();
  grupo.userData = { levels: true };
  const linha = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5, 0, 0), new THREE.Vector3(5, 0, 0)]),
    new THREE.LineBasicMaterial(),
  );
  linha.userData = { levelId };
  grupo.add(linha);
  scene.add(grupo);
  return scene;
}

describe('pickLevel: datum de nível na vista 3D', () => {
  it('cena mínima com uma linha em z = 0, câmera de cima: devolve o levelId e o ponto', () => {
    const hit = pickLevel(cenaComLinha(), cameraDeCima(), { x: 0, y: 0 });
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe('level');
    expect(hit!.levelId).toBe('lv_0');
    expect(hit!.point.z).toBeCloseTo(0, 6);
  });

  it('o plano do nível selecionado (`levelsPlane`) também é atingido', () => {
    const scene = new THREE.Scene();
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    plano.userData = { levelsPlane: true, levelId: 'lv_1' };
    scene.add(plano);
    const hit = pickLevel(scene, cameraDeCima(), { x: 0, y: 0 });
    expect(hit).not.toBeNull();
    expect(hit!.levelId).toBe('lv_1');
    expect(hit!.point.z).toBeCloseTo(0, 6);
  });

  it('sem datum na cena devolve null', () => {
    expect(pickLevel(new THREE.Scene(), cameraDeCima(), { x: 0, y: 0 })).toBeNull();
  });
});

describe('pickDimension: cota entre os eixos das bolhas', () => {
  it('a etiqueta da cota devolve o intervalo e a posição clicada', () => {
    const scene = new THREE.Scene();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
    sprite.position.set(0, 0, 0);
    sprite.scale.set(2, 1, 1);
    sprite.userData = { dimension: { levelId: 'lv_0', neighborId: 'lv_1', side: 'above', value: 3 } };
    scene.add(sprite);
    const hit = pickDimension(scene, cameraDeCima(), { x: 0, y: 0 });
    expect(hit).toMatchObject({ levelId: 'lv_0', neighborId: 'lv_1', side: 'above', value: 3 });
    expect(hit!.ndc.x).toBeCloseTo(0, 5);
    expect(hit!.ndc.y).toBeCloseTo(0, 5);
  });

  it('sem cota na cena devolve null', () => {
    expect(pickDimension(new THREE.Scene(), cameraDeCima(), { x: 0, y: 0 })).toBeNull();
  });
});
