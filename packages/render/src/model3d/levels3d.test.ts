import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTemplate } from '@hestia/model';
import { buildLevels, disposeLevels, layoutLevels, type LevelsGroupData } from './levels3d.ts';
import { levelProjectBox } from './levelsData.ts';

/** Câmera olhando para o centro da obra; `forward` é a horizontal da câmera para o alvo. */
function cameraAt(x: number, y: number, z: number): { camera: THREE.PerspectiveCamera; forward: THREE.Vector3 } {
  const alvo = new THREE.Vector3(5, 5, 1.5);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
  camera.up.set(0, 0, 1);
  camera.position.set(x, y, z);
  camera.lookAt(alvo);
  camera.updateMatrixWorld();
  const forward = alvo.clone().sub(camera.position).setZ(0).normalize();
  return { camera, forward };
}

const dados = (g: THREE.Group): LevelsGroupData => g.userData as LevelsGroupData;

describe('datum de nível no 3D (duas linhas)', () => {
  it('cria linha da esquerda, linha de trás, bolha e texto por nível', () => {
    const g = buildLevels(buildTemplate('house2'), null);
    const info = dados(g);
    expect(info.views).toHaveLength(2);
    expect(info.dimensions).toHaveLength(0);
    // 4 objetos por nível (2 linhas, bolha e texto), sem plano nem cota.
    expect(g.children).toHaveLength(8);
    const v = info.views[0]!;
    expect(v.line).toBeInstanceOf(THREE.Line);
    expect(v.lineBack).toBeInstanceOf(THREE.Line);
    expect(v.bubble).toBeInstanceOf(THREE.Sprite);
    expect(v.bubble.scale.x).toBeCloseTo(0.5, 6);
    expect(v.text).toBeInstanceOf(THREE.Sprite);
    expect(v.text.material.depthTest).toBe(false);
  });

  it('câmera a sudeste: canto NW, linha esquerda W, linha de trás N e bolha em SW', () => {
    const p = buildTemplate('house2');
    const b = levelProjectBox(p);
    const g = buildLevels(p, null);
    const { camera, forward } = cameraAt(20, -20, 15);
    layoutLevels(g, camera, forward);
    const info = dados(g);
    expect(info.layout).toMatchObject({ corner: 'NW', leftSide: 'W', bubbleEnd: 'a' });
    const v = info.views[0]!;
    expect(v.bubble.position.x).toBeCloseTo(b.minX, 6);
    expect(v.bubble.position.y).toBeCloseTo(b.minY, 6);
    const esq = v.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(esq.getX(0)).toBeCloseTo(b.minX, 6);
    expect(esq.getY(0)).toBeCloseTo(b.minY, 6);
    expect(esq.getX(1)).toBeCloseTo(b.minX, 6);
    expect(esq.getY(1)).toBeCloseTo(b.maxY, 6);
    const tras = v.lineBack.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(tras.getX(0)).toBeCloseTo(b.minX, 6);
    expect(tras.getY(0)).toBeCloseTo(b.maxY, 6);
    expect(tras.getX(1)).toBeCloseTo(b.maxX + 1.5, 6);
    expect(tras.getY(1)).toBeCloseTo(b.maxY, 6);
    // O texto segue a linha da esquerda no plano da tela (não fica deitado no chão).
    expect(Math.abs((v.text.material as THREE.SpriteMaterial).rotation)).toBeGreaterThan(0.01);
  });

  it('câmera a noroeste: canto SE, linha esquerda S, linha de trás E e bolha em SW', () => {
    const p = buildTemplate('house2');
    const b = levelProjectBox(p);
    const g = buildLevels(p, null);
    const { camera, forward } = cameraAt(-20, 20, 15);
    layoutLevels(g, camera, forward);
    const info = dados(g);
    expect(info.layout).toMatchObject({ corner: 'SE', leftSide: 'E', bubbleEnd: 'b' });
    const v = info.views[0]!;
    expect(v.bubble.position.x).toBeCloseTo(b.maxX, 6);
    expect(v.bubble.position.y).toBeCloseTo(b.maxY, 6);
    const tras = v.lineBack.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(tras.getX(0)).toBeCloseTo(b.maxX, 6);
    expect(tras.getY(0)).toBeCloseTo(b.minY, 6);
    expect(tras.getX(1)).toBeCloseTo(b.minX - 1.5, 6);
    expect(tras.getY(1)).toBeCloseTo(b.minY, 6);
  });

  it('nível selecionado ganha o plano entre as linhas e a cota no eixo das bolhas', () => {
    const p = buildTemplate('house2');
    const b = levelProjectBox(p);
    const g = buildLevels(p, 'lv_0');
    const info = dados(g);
    expect(info.dimensions).toHaveLength(1);
    const dim = info.dimensions[0]!;
    expect(dim.info.side).toBe('above');
    expect(dim.info.value).toBeCloseTo(3, 6);
    expect(dim.label.userData.dimension).toMatchObject({ levelId: 'lv_0', neighborId: 'lv_1', value: 3 });
    expect(dim.label.scale.x).toBeCloseTo(2.6, 6);
    const { camera, forward } = cameraAt(20, -20, 15);
    layoutLevels(g, camera, forward);
    const v = info.views[0]!;
    const pos = dim.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.getX(0)).toBeCloseTo(v.bubble.position.x - 0.6, 6);
    expect(pos.getZ(0)).toBeCloseTo(0, 6);
    expect(pos.getZ(1)).toBeCloseTo(3, 6);
    expect(dim.label.position.z).toBeCloseTo(1.5, 6);
    const plano = g.children.find((o) => (o as THREE.Mesh).userData?.levelsPlane === true) as THREE.Mesh;
    expect(plano).toBeInstanceOf(THREE.Mesh);
    const geo = plano.geometry as THREE.PlaneGeometry;
    expect(geo.parameters.width).toBeCloseTo(b.maxX - b.minX, 6);
    expect(geo.parameters.height).toBeCloseTo(b.maxY - b.minY, 6);
    expect(plano.position.x).toBeCloseTo((b.minX + b.maxX) / 2, 6);
    expect(plano.position.y).toBeCloseTo((b.minY + b.maxY) / 2, 6);
    expect(plano.position.z).toBeCloseTo(0, 6);
  });

  it('dispose libera e esvazia o grupo', () => {
    const g = buildLevels(buildTemplate('house2'), 'lv_0');
    expect(g.children.length).toBeGreaterThan(0);
    disposeLevels(g);
    expect(g.children).toHaveLength(0);
  });
});
