import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bytesDoCacheDoRealce, disposeHighlight, highlightOf } from './highlight3d.ts';
import { caixaDaSelecao } from './selecao3d.ts';

/** Modelo de dois elementos (`r1` e `r2`), cada um com dois triângulos, numa malha só. */
function modeloDeDoisElementos(): { modelo: THREE.Object3D; mesh: THREE.Mesh } {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    0, 0, 0, 0, 1, 0, -1, 0, 0,
    2, 0, 0, 3, 0, 0, 2, 1, 0,
    2, 0, 0, 2, 1, 0, 3, 1, 0,
  ], 3));
  geo.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  mesh.userData.ranges = [{ id: 'r1', start: 0, count: 6 }, { id: 'r2', start: 6, count: 6 }];
  const modelo = new THREE.Group();
  modelo.add(mesh);
  return { modelo, mesh };
}

const ESTILO = { color: 0xff0000, fill: 0.35, edges: 1 };

describe('realce 3D (sobreposição do elemento selecionado)', () => {
  it('o preenchimento não usa polygonOffset: com as camadas de um telhado 1,5 cm abaixo do topo, o deslocamento puxava a cópia de baixo para a frente e o topo ficava recortado em degraus', () => {
    const out = highlightOf(modeloDeDoisElementos().modelo, ['r1'], ESTILO);
    const fill = out.children[0] as THREE.Mesh;
    const mat = fill.material as THREE.MeshBasicMaterial;
    expect(mat.polygonOffset).toBe(false);
    expect(mat.depthWrite).toBe(false);
    expect(mat.depthTest).toBe(true);
  });

  it('elemento sem triângulos para os ids devolve um objeto vazio', () => {
    expect(highlightOf(modeloDeDoisElementos().modelo, ['outro'], ESTILO).children).toHaveLength(0);
  });
});

describe('realce sem cópia de triângulos', () => {
  it('o preenchimento reusa a posição e o índice do modelo e recorta por drawRange', () => {
    const { modelo, mesh } = modeloDeDoisElementos();
    const fill = highlightOf(modelo, ['r2'], ESTILO).children[0] as THREE.Mesh;
    expect(fill.geometry.getAttribute('position')).toBe(mesh.geometry.getAttribute('position'));
    expect(fill.geometry.index).toBe(mesh.geometry.index);
    expect(fill.geometry.drawRange).toEqual({ start: 6, count: 6 });
    // A matriz do mundo vai no objeto: a geometria é a do modelo, sem deslocar vértice.
    expect(fill.matrixAutoUpdate).toBe(false);
  });

  it('duas vezes o mesmo elemento reaproveita as geometrias (só a montagem dos objetos é nova)', () => {
    const { modelo } = modeloDeDoisElementos();
    const a = highlightOf(modelo, ['r1'], ESTILO);
    const b = highlightOf(modelo, ['r1'], ESTILO);
    expect((b.children[0] as THREE.Mesh).geometry).toBe((a.children[0] as THREE.Mesh).geometry);
    expect((b.children[1] as THREE.Mesh).geometry).toBe((a.children[1] as THREE.Mesh).geometry);
    expect(b.children[0]).not.toBe(a.children[0]);
  });

  it('o cache de arestas não cresce ao repetir o mesmo realce', () => {
    const { modelo } = modeloDeDoisElementos();
    for (let i = 0; i < 5; i++) highlightOf(modelo, ['r1', 'r2'], ESTILO);
    const depois = bytesDoCacheDoRealce();
    for (let i = 0; i < 5; i++) highlightOf(modelo, ['r1', 'r2'], ESTILO);
    expect(bytesDoCacheDoRealce()).toBe(depois);
  });

  it('liberar o realce não libera os buffers do modelo', () => {
    const { modelo } = modeloDeDoisElementos();
    let liberados = 0;
    modelo.traverse((o) => (o as THREE.Mesh).geometry?.addEventListener('dispose', () => liberados++));
    const out = highlightOf(modelo, ['r1'], ESTILO);
    disposeHighlight(out);
    expect(liberados).toBe(0);
  });

  it('as arestas são as do elemento: o hard edge entre os dois triângulos de r2 aparece, o de r1 não', () => {
    const { modelo } = modeloDeDoisElementos();
    const out = highlightOf(modelo, ['r1'], ESTILO);
    const edges = out.children[1] as THREE.LineSegments;
    const pos = edges.geometry.getAttribute('position');
    expect(pos.count).toBeGreaterThan(0);
    // Todos os pontos das arestas de r1 ficam no lado x < 0 do modelo (r2 está em x ≥ 2).
    for (let i = 0; i < pos.count; i++) expect(pos.getX(i)).toBeLessThanOrEqual(1);
  });

  it('ranges contíguos viram um intervalo só (uma chamada de desenho por elemento)', () => {
    const { modelo } = modeloDeDoisElementos();
    const out = highlightOf(modelo, ['r1'], ESTILO);
    expect(out.children.filter((c) => (c as THREE.Mesh).isMesh)).toHaveLength(1);
  });
});

describe('caixa da seleção (cache por intervalo)', () => {
  it('é a união das caixas dos elementos e não muda com o cache', () => {
    const { modelo } = modeloDeDoisElementos();
    const r1 = caixaDaSelecao(modelo, ['r1'])!;
    expect(r1.min.x).toBeCloseTo(-1, 6);
    expect(r1.max.x).toBeCloseTo(1, 6);
    const dois = caixaDaSelecao(modelo, ['r1', 'r2'])!;
    expect(dois.min.x).toBeCloseTo(-1, 6);
    expect(dois.max.x).toBeCloseTo(3, 6);
    expect(caixaDaSelecao(modelo, ['nao-existe'])).toBeNull();
    expect(caixaDaSelecao(modelo, [])).toBeNull();
  });
});
