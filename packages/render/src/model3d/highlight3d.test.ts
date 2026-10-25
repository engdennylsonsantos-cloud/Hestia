import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { highlightOf } from './highlight3d.ts';

/** Um triângulo do modelo com faixa do elemento `r1`, para medir a sobreposição de realce. */
function modeloDeUmTriangulo(): THREE.Object3D {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geo.setIndex([0, 1, 2]);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  mesh.userData.ranges = [{ id: 'r1', start: 0, count: 3 }];
  const grupo = new THREE.Object3D();
  grupo.add(mesh);
  return grupo;
}

describe('realce 3D (sobreposição do elemento selecionado)', () => {
  it('o preenchimento não usa polygonOffset: com as camadas de um telhado 1,5 cm abaixo do topo, o deslocamento puxava a cópia de baixo para a frente e o topo ficava recortado em degraus', () => {
    const out = highlightOf(modeloDeUmTriangulo(), ['r1'], { color: 0xff0000, fill: 0.35, edges: 1 });
    const fill = out.children[0] as THREE.Mesh;
    const mat = fill.material as THREE.MeshBasicMaterial;
    expect(mat.polygonOffset).toBe(false);
    expect(mat.depthWrite).toBe(false);
    expect(mat.depthTest).toBe(true);
  });

  it('elemento sem triângulos para os ids devolve um objeto vazio', () => {
    expect(highlightOf(modeloDeUmTriangulo(), ['outro'], { color: 0xff0000, fill: 0.35, edges: 1 }).children).toHaveLength(0);
  });
});
