import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ElementRange } from './solids.ts';
import { caixaDoIntervalo, caixaDoIntervaloNoMundo, faixasDosIds, intervalosDeDesenho, mapaDaMalha } from './indiceDeElementos3d.ts';

const faixas: ElementRange[] = [
  { id: 'a', start: 0, count: 3 },
  { id: 'b', start: 3, count: 3 },
  { id: 'a', start: 6, count: 3 },
];

/** Geometria de 3 vértices por faixa, com o índice em ordem (posição = número do vértice). */
function geometria(): { geo: THREE.BufferGeometry; index: THREE.BufferAttribute } {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(27), 3));
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < 9; i++) pos.setXYZ(i, i, i * 2, 0);
  pos.needsUpdate = true;
  const index = new THREE.BufferAttribute(new Uint16Array(9), 1);
  for (let i = 0; i < 9; i++) index.setX(i, i);
  return { geo, index };
}

describe('índice de elementos da cena 3D', () => {
  it('agrupa as faixas por id e reaproveita o mapa da mesma lista', () => {
    const m = mapaDaMalha(faixas);
    expect(m.get('a')).toHaveLength(2);
    expect(m.get('b')).toHaveLength(1);
    expect(mapaDaMalha(faixas)).toBe(m);
  });

  it('faixas dos ids varre a lista menor e mantém a ordem de desenho', () => {
    expect(faixasDosIds(faixas, new Set(['a'])).map((r) => r.start)).toEqual([0, 6]);
    expect(faixasDosIds(faixas, new Set(['a', 'b'])).map((r) => r.start).sort((x, y) => x - y)).toEqual([0, 3, 6]);
    expect(faixasDosIds(faixas, new Set())).toEqual([]);
  });

  it('funde faixas contíguas e sobrepostas em intervalos, independente da ordem de entrada', () => {
    expect(intervalosDeDesenho([...faixas].reverse())).toEqual([{ start: 0, count: 9 }]);
    expect(intervalosDeDesenho([
      { id: 'a', start: 0, count: 2 },
      { id: 'b', start: 4, count: 2 },
      { id: 'c', start: 2, count: 2 },
    ])).toEqual([{ start: 0, count: 6 }]);
    expect(intervalosDeDesenho([{ id: 'a', start: 5, count: 1 }, { id: 'b', start: 0, count: 1 }])).toEqual([
      { start: 0, count: 1 },
      { start: 5, count: 1 },
    ]);
  });

  it('caixa do intervalo usa só os vértices da faixa e fica em cache até a versão mudar', () => {
    const { geo, index } = geometria();
    const caixa = caixaDoIntervalo(geo, index, 3, 3);
    expect(caixa.min.toArray()).toEqual([3, 6, 0]);
    expect(caixa.max.toArray()).toEqual([5, 10, 0]);
    expect(caixaDoIntervalo(geo, index, 3, 3)).toBe(caixa);
    geo.userData.versao = 1;
    expect(caixaDoIntervalo(geo, index, 3, 3)).not.toBe(caixa);
  });

  it('caixa no mundo aplica a matriz e devolve null para intervalo vazio', () => {
    const { geo, index } = geometria();
    const matriz = new THREE.Matrix4().makeTranslation(10, 0, 0);
    const caixa = caixaDoIntervaloNoMundo(geo, index, 0, 3, matriz)!;
    expect(caixa.min.x).toBeCloseTo(10, 9);
    expect(caixa.max.x).toBeCloseTo(12, 9);
    const vazia = caixaDoIntervaloNoMundo(geo, index, 9, 0, new THREE.Matrix4());
    expect(vazia).toBeNull();
  });
});
