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

  it('o plano do nível selecionado não bloqueia o picking dos elementos (não é alvo)', () => {
    const scene = new THREE.Scene();
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    plano.userData = { levelsPlane: true, levelId: 'lv_1' };
    scene.add(plano);
    expect(pickLevel(scene, cameraDeCima(), { x: 0, y: 0 })).toBeNull();
  });

  it('sem datum na cena devolve null', () => {
    expect(pickLevel(new THREE.Scene(), cameraDeCima(), { x: 0, y: 0 })).toBeNull();
  });
});

/** Cota mínima: linha de cota em `z = 0` (y = `yLinha`) e a etiqueta (sprite) no ponto dado, com o mesmo info. */
function cota(
  info: { levelId: string; neighborId: string; side: 'below' | 'above'; value: number },
  yLinha: number,
  posEtiqueta: THREE.Vector3,
): { grupo: THREE.Group; linha: THREE.Line; sprite: THREE.Sprite } {
  const grupo = new THREE.Group();
  grupo.userData = { levels: true };
  const linha = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5, yLinha, 0), new THREE.Vector3(5, yLinha, 0)]),
    new THREE.LineBasicMaterial(),
  );
  linha.userData = { dimension: info };
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
  sprite.position.copy(posEtiqueta);
  sprite.scale.set(2, 1, 1);
  sprite.userData = { dimension: info };
  grupo.add(linha, sprite);
  return { grupo, linha, sprite };
}

/** NDC do ponto do mundo projetado na câmera. */
function ndcDe(cam: THREE.Camera, x: number, y: number, z: number): { x: number; y: number } {
  const v = new THREE.Vector3(x, y, z).project(cam);
  return { x: v.x, y: v.y };
}

describe('pickDimension: cota entre os eixos das bolhas', () => {
  it('a etiqueta da cota devolve o intervalo, a etiqueta e a posição dela', () => {
    const scene = new THREE.Scene();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
    sprite.position.set(0, 0, 0);
    sprite.scale.set(2, 1, 1);
    sprite.userData = { dimension: { levelId: 'lv_0', neighborId: 'lv_1', side: 'above', value: 3 } };
    scene.add(sprite);
    const hit = pickDimension(scene, cameraDeCima(), { x: 0, y: 0 });
    expect(hit).toMatchObject({ levelId: 'lv_0', neighborId: 'lv_1', side: 'above', value: 3 });
    expect(hit!.label).toBe(sprite);
    expect(hit!.ndc.x).toBeCloseTo(0, 5);
    expect(hit!.ndc.y).toBeCloseTo(0, 5);
  });

  it('raio que acerta a linha devolve a etiqueta e o NDC do centro dela (não o do ponto atingido)', () => {
    const cam = cameraDeCima();
    const scene = new THREE.Scene();
    // A linha cruza o raio central em (0, 0, 0); a etiqueta fica fora do raio, em (3, 1, 0).
    const { grupo, sprite } = cota({ levelId: 'lv_0', neighborId: 'lv_1', side: 'above', value: 3 }, 0, new THREE.Vector3(3, 1, 0));
    scene.add(grupo);
    const hit = pickDimension(scene, cam, { x: 0, y: 0 });
    expect(hit).not.toBeNull();
    expect(hit!.label).toBe(sprite);
    // O ponto atingido seria (0, 0): o editor abre no centro da etiqueta, onde a cota aparece.
    const esperado = ndcDe(cam, 3, 1, 0);
    expect(hit!.ndc.x).toBeCloseTo(esperado.x, 5);
    expect(hit!.ndc.y).toBeCloseTo(esperado.y, 5);
    expect(Math.abs(hit!.ndc.x)).toBeGreaterThan(0.1);
  });

  it('com duas cotas na cena, a etiqueta devolvida é a do intervalo atingido', () => {
    const cam = cameraDeCima();
    const scene = new THREE.Scene();
    const a = cota({ levelId: 'lv_0', neighborId: 'lv_1', side: 'above', value: 3 }, 0, new THREE.Vector3(3, 1, 0));
    const b = cota({ levelId: 'lv_1', neighborId: 'lv_2', side: 'below', value: 2.8 }, -3, new THREE.Vector3(-3, -1, 0));
    scene.add(a.grupo, b.grupo);
    const hit = pickDimension(scene, cam, { x: 0, y: 0 });
    expect(hit).toMatchObject({ levelId: 'lv_0', neighborId: 'lv_1', side: 'above', value: 3 });
    expect(hit!.label).toBe(a.sprite);
    const esperado = ndcDe(cam, 3, 1, 0);
    expect(hit!.ndc.x).toBeCloseTo(esperado.x, 5);
    expect(hit!.ndc.y).toBeCloseTo(esperado.y, 5);
  });

  it('clique nos tiques (LineSegments) também devolve a etiqueta do intervalo', () => {
    const cam = cameraDeCima();
    const scene = new THREE.Scene();
    const info = { levelId: 'lv_0', neighborId: 'lv_1', side: 'above', value: 3 };
    const grupo = new THREE.Group();
    grupo.userData = { levels: true };
    const tiques = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.2, 0, 0), new THREE.Vector3(0.2, 0, 0)]),
      new THREE.LineBasicMaterial(),
    );
    tiques.userData = { dimension: info };
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
    sprite.position.set(3, 1, 0);
    sprite.scale.set(2, 1, 1);
    sprite.userData = { dimension: info };
    grupo.add(tiques, sprite);
    scene.add(grupo);
    const hit = pickDimension(scene, cam, { x: 0, y: 0 });
    expect(hit).not.toBeNull();
    expect(hit!.label).toBe(sprite);
    const esperado = ndcDe(cam, 3, 1, 0);
    expect(hit!.ndc.x).toBeCloseTo(esperado.x, 5);
  });

  it('sem cota na cena devolve null', () => {
    expect(pickDimension(new THREE.Scene(), cameraDeCima(), { x: 0, y: 0 })).toBeNull();
  });

  it('linha de cota sem etiqueta na cena devolve null (não há onde abrir o editor)', () => {
    const scene = new THREE.Scene();
    const linha = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5, 0, 0), new THREE.Vector3(5, 0, 0)]),
      new THREE.LineBasicMaterial(),
    );
    linha.userData = { dimension: { levelId: 'lv_0', neighborId: 'lv_1', side: 'above', value: 3 } };
    scene.add(linha);
    expect(pickDimension(scene, cameraDeCima(), { x: 0, y: 0 })).toBeNull();
  });
});
