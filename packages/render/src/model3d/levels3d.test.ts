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

describe('datum de nível no 3D', () => {
  it('cria linha, bolha e texto por nível; bolha 0,5 m e texto em sprite', () => {
    const g = buildLevels(buildTemplate('house2'), null);
    const info = dados(g);
    expect(info.views).toHaveLength(2);
    expect(info.dimensions).toHaveLength(0);
    // 3 objetos por nível (linha, bolha, texto), sem plano nem cota.
    expect(g.children).toHaveLength(6);
    const v = info.views[0]!;
    expect(v.line.material).toBeInstanceOf(THREE.LineDashedMaterial);
    expect(v.bubble).toBeInstanceOf(THREE.Sprite);
    expect(v.bubble.scale.x).toBeCloseTo(0.5, 6);
    expect(v.text).toBeInstanceOf(THREE.Sprite);
    expect(v.text.material.depthTest).toBe(false);
  });

  it('câmera a sudeste: lado oeste, bolha na ponta sudoeste e linha fora da obra', () => {
    const p = buildTemplate('house2');
    const b = levelProjectBox(p);
    const g = buildLevels(p, null);
    const { camera, forward } = cameraAt(20, -20, 15);
    layoutLevels(g, camera, forward);
    const info = dados(g);
    expect(info.layout.side).toBe('W');
    const v = info.views[0]!;
    expect(v.bubble.position.x).toBeCloseTo(b.minX - 1.2, 6);
    expect(v.bubble.position.y).toBeCloseTo(b.minY - 1.5, 6);
    const pos = v.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.getX(0)).toBeCloseTo(b.minX - 1.2, 6);
    expect(pos.getY(0)).toBeCloseTo(b.minY - 1.5, 6);
    expect(pos.getX(1)).toBeCloseTo(b.minX - 1.2, 6);
    expect(pos.getY(1)).toBeCloseTo(b.maxY + 1.5, 6);
    // Texto acima da linha e à direita da bolha (na direção do lado).
    expect(v.text.position.x).toBeCloseTo(v.bubble.position.x, 6);
    expect(v.text.position.y).toBeGreaterThan(v.bubble.position.y);
    expect(v.text.position.z).toBeGreaterThan(v.datum.elevation);
  });

  it('câmera a noroeste: troca para o lado leste e a bolha continua na ponta esquerda', () => {
    const p = buildTemplate('house2');
    const b = levelProjectBox(p);
    const g = buildLevels(p, null);
    const { camera, forward } = cameraAt(-20, 20, 15);
    layoutLevels(g, camera, forward);
    const info = dados(g);
    expect(info.layout.side).toBe('E');
    const v = info.views[0]!;
    expect(v.bubble.position.x).toBeCloseTo(b.maxX + 1.2, 6);
    expect(v.bubble.position.y).toBeCloseTo(b.maxY + 1.5, 6);
  });

  it('nível selecionado ganha plano azul e a cota entre os eixos das bolhas', () => {
    const p = buildTemplate('house2');
    const g = buildLevels(p, 'lv_0');
    const info = dados(g);
    expect(info.dimensions).toHaveLength(1);
    const dim = info.dimensions[0]!;
    expect(dim.info.side).toBe('above');
    expect(dim.info.value).toBeCloseTo(3, 6);
    expect(dim.label.userData.dimension).toMatchObject({ levelId: 'lv_0', neighborId: 'lv_1', value: 3 });
    const { camera, forward } = cameraAt(20, -20, 15);
    layoutLevels(g, camera, forward);
    const v = info.views[0]!;
    // Linha de cota deslocada para fora do eixo das bolhas, de z 0 a 3.
    const pos = dim.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.getX(0)).toBeCloseTo(v.bubble.position.x - 0.6, 6);
    expect(pos.getZ(0)).toBeCloseTo(0, 6);
    expect(pos.getZ(1)).toBeCloseTo(3, 6);
    expect(dim.label.position.z).toBeCloseTo(1.5, 6);
    expect(g.children.some((o) => (o as THREE.Mesh).userData?.levelsPlane === true)).toBe(true);
  });

  it('dispose libera e esvazia o grupo', () => {
    const g = buildLevels(buildTemplate('house2'), 'lv_0');
    expect(g.children.length).toBeGreaterThan(0);
    disposeLevels(g);
    expect(g.children).toHaveLength(0);
  });
});
