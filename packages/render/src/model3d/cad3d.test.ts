import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyProject, type CadDrawing, type Project } from '@hestia/model';
import { buildCadLines, cadLineData } from './cad3d.ts';

/**
 * Projeto com um desenho CAD no nível `lv_0`: dois traços em camadas com cor ACI (um fechado, com cor própria) e um
 * terceiro sem cor nenhuma (o cinza escuro de reserva). `offsetZ` de 0,5 m sobre a cota do nível.
 */
function projetoCad(extra: Partial<CadDrawing> = {}): Project {
  const p = createEmptyProject();
  const cad: CadDrawing = {
    id: 'cad_1',
    kind: 'cad',
    levelId: 'lv_0',
    name: 'Planta importada',
    source: 'dxf',
    unit: 'm',
    offsetZ: 0.5,
    layers: [
      { name: 'A', color: 1 },
      { name: 'B', color: 5 },
      { name: 'C' },
    ],
    paths: [
      { layer: 'A', pts: [{ x: 0, y: 0 }, { x: 2, y: 0 }], closed: false },
      { layer: 'B', pts: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }], closed: true, color: 3 },
      { layer: 'C', pts: [{ x: 0, y: 3 }, { x: 1, y: 3 }], closed: false },
    ],
    texts: [],
    order: 1,
    ...extra,
  };
  p.elements[cad.id] = cad;
  return p;
}

/** Cor (RGB) do vértice `i` (0..1). */
function corDoVertice(dados: { colors: number[] }, i: number): number[] {
  return dados.colors.slice(i * 3, i * 3 + 3);
}

describe('cadLineData', () => {
  it('põe todos os vértices em z = elevação + offsetZ e fecha o traço fechado', () => {
    const dados = cadLineData(projetoCad(), 'lv_0', 3);
    expect(dados).not.toBeNull();
    // 1 segmento do traço aberto + 3 do fechado + 1 do terceiro = 5 segmentos (10 vértices).
    expect(dados!.positions).toHaveLength(10 * 3);
    const zs = dados!.positions.filter((_, i) => i % 3 === 2);
    expect(zs).toHaveLength(10);
    for (const z of zs) expect(z).toBeCloseTo(3.5, 9);
    // O fecho do traço fechado volta ao primeiro ponto: último segmento dele de (2,2) para (0,0), antes do terceiro traço.
    const fecho = dados!.positions.slice(18, 24);
    expect(fecho).toEqual([2, 2, 3.5, 0, 0, 3.5]);
  });

  it('desenho oculto (visible: false) não gera linhas', () => {
    expect(cadLineData(projetoCad({ visible: false }), 'lv_0', 3)).toBeNull();
  });

  it('nível sem desenho também devolve null', () => {
    expect(cadLineData(projetoCad(), 'lv_1', 3)).toBeNull();
  });

  it('a cor é a da entidade, depois a da camada e, sem nenhuma, cinza escuro', () => {
    const dados = cadLineData(projetoCad(), 'lv_0', 3)!;
    expect(corDoVertice(dados, 0)).toEqual([1, 0, 0]); // camada A, ACI 1 = vermelho
    expect(corDoVertice(dados, 1)).toEqual([1, 0, 0]);
    expect(corDoVertice(dados, 2)).toEqual([0, 1, 0]); // entidade, ACI 3 = verde (vence a camada B, azul)
    expect(corDoVertice(dados, 8)).toEqual([0.25, 0.25, 0.25]); // camada C sem cor
  });
});

describe('buildCadLines', () => {
  it('monta as linhas com cores por vértice e guarda os ids do CAD no userData', () => {
    const linhas = buildCadLines(projetoCad(), 'lv_0', 3);
    expect(linhas).toBeInstanceOf(THREE.LineSegments);
    expect(linhas!.frustumCulled).toBe(false);
    expect((linhas!.material as THREE.LineBasicMaterial).vertexColors).toBe(true);
    expect(linhas!.geometry.getAttribute('position').count).toBe(10);
    expect(linhas!.userData.cadIds).toEqual(['cad_1']);
    expect(linhas!.userData.elementIds).toEqual(['cad_1']);
  });

  it('sem desenho visível devolve null', () => {
    expect(buildCadLines(projetoCad({ visible: false }), 'lv_0', 3)).toBeNull();
  });
});
