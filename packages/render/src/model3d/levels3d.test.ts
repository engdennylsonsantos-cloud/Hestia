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

  it('texto gira no plano da tela no mesmo ângulo da linha da esquerda', () => {
    // NDC tem y para cima; em pixels o eixo y da tela também, mas o x é esticado pelo aspecto.
    for (const [x, y] of [[20, -20], [-20, 20]] as const) {
      const g = buildLevels(buildTemplate('house2'), null);
      const { camera, forward } = cameraAt(x, y, 15);
      layoutLevels(g, camera, forward);
      const info = dados(g);
      const v = info.views[0]!;
      const pos = v.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      // As pontas visíveis da linha da esquerda, na elevação do nível.
      const a = new THREE.Vector3(pos.getX(0), pos.getY(0), pos.getZ(0)).project(camera);
      const b = new THREE.Vector3(pos.getX(1), pos.getY(1), pos.getZ(1)).project(camera);
      const anguloNaTela = Math.atan2((b.y - a.y) / camera.aspect, b.x - a.x);
      const rotacao = (v.text.material as THREE.SpriteMaterial).rotation;
      expect(rotacao).toBeCloseTo(anguloNaTela, 1);
      // Sem o espelhamento do sinal, o texto não fica "de cabeça para baixo".
      expect(Math.abs(rotacao)).toBeLessThan(Math.PI / 2);
      // A linha começa na bolha (a ponta mais à esquerda do lado esquerdo).
      expect(pos.getX(0)).toBeCloseTo(v.bubble.position.x, 6);
      expect(pos.getY(0)).toBeCloseTo(v.bubble.position.y, 6);
    }
  });

  it('etiqueta da cota fica sobre a linha, no meio do intervalo entre os níveis', () => {
    const g = buildLevels(buildTemplate('house2'), 'lv_0');
    const { camera, forward } = cameraAt(-20, 20, 15);
    layoutLevels(g, camera, forward);
    const info = dados(g);
    const dim = info.dimensions[0]!;
    const pos = dim.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    // Sobre a linha de cota: mesma posição no plano (x, y) das duas pontas.
    expect(dim.label.position.x).toBeCloseTo(pos.getX(0), 6);
    expect(dim.label.position.y).toBeCloseTo(pos.getY(0), 6);
    expect(dim.label.position.x).toBeCloseTo(pos.getX(1), 6);
    expect(dim.label.position.y).toBeCloseTo(pos.getY(1), 6);
    // No meio do intervalo: entre as elevações dos dois níveis (0 e 3 m).
    expect(dim.label.position.z).toBeCloseTo((pos.getZ(0) + pos.getZ(1)) / 2, 6);
    expect(dim.label.position.z).toBeCloseTo(1.5, 6);
    // Continua com o tamanho que garante a área de clique.
    expect(dim.label.scale.x).toBeCloseTo(2.6, 6);
    expect(dim.label.scale.y).toBeCloseTo(0.8, 6);
  });

  it('dispose libera e esvazia o grupo', () => {
    const g = buildLevels(buildTemplate('house2'), 'lv_0');
    expect(g.children.length).toBeGreaterThan(0);
    disposeLevels(g);
    expect(g.children).toHaveLength(0);
  });
});
