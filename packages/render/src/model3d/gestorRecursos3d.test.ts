import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { GraphicsCategory } from '@hestia/model';
import { matrizDaCaixa } from './caixas3d.ts';
import type { SolidBatch } from './solids.ts';
import type { EntradaNivel } from './cacheMalhas3d.ts';
import { OrcamentoVram } from '../gpu/orcamento.ts';
import { LoteGeometriaGpu, mesclarLotes, type DadosLote } from '../gpu/loteGeometria.ts';
import { LoteLinhasGpu } from '../gpu/loteLinhas.ts';
import { caixaDeMatrizes, InstanciasGpu } from '../gpu/instanciasGpu.ts';
import { GestorRecursosGpu } from '../gpu/gestorRecursos.ts';

/** Material neutro: estes testes não olham a cor, só os buffers. */
const material = (): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial();

/** Triângulo de um elemento deslocado em x. */
function triangulo(id: string, x: number, categoria: GraphicsCategory = 'wall', materialId = 'm1'): SolidBatch {
  return {
    materialId,
    category: categoria,
    positions: [x, 0, 0, x + 1, 0, 0, x, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: [0, 1, 2],
    ids: [{ id, start: 0, count: 3 }],
  };
}

/** Dados de um lote de teste (um triângulo). */
function dados(id: string, x: number): DadosLote {
  return { positions: [x, 0, 0, x + 1, 0, 0, x, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2], ids: [{ id, start: 0, count: 3 }] };
}

/** Entrada de nível de teste: um lote de piso opcional, uma caixa e arestas. */
function entrada(levelId: string, x: number): EntradaNivel {
  const lote = triangulo(`${levelId}_f`, x, 'floor');
  return {
    levelId,
    chave: levelId,
    grupo: new THREE.Group(),
    picks: [],
    mats: [],
    bytes: 0,
    lotes: [lote],
    instancias: [{ categoria: 'wall', materialId: 'm1', matrizes: Float32Array.from(matrizDaCaixa(x, 0, 0.5, 0, 1, 0.2, 1)) }],
    arestas: new Float32Array([x, 0, 0, x + 1, 0, 0]),
  };
}

const opcoes = (): Parameters<GestorRecursosGpu['atualizar']>[1] => ({ instanciar: true, arestas: true, sombras: false });

describe('OrcamentoVram', () => {
  it('soma por chave, remove e aponta estouro do teto', () => {
    const o = new OrcamentoVram(100);
    o.definir('a', 40);
    o.definir('b', 30);
    expect(o.usado).toBe(70);
    expect(o.livre).toBe(30);
    expect(o.excedido).toBe(false);
    o.definir('a', 80);
    expect(o.usado).toBe(110);
    expect(o.excedido).toBe(true);
    o.remover('b');
    expect(o.usado).toBe(80);
    o.definir('a', 0);
    expect(o.entradas).toEqual([]);
    o.limpar();
    expect(o.usado).toBe(0);
  });
});

describe('LoteGeometriaGpu: um buffer por categoria/material, faixa por nível', () => {
  it('acrescenta níveis e desloca as faixas de elemento', () => {
    const orc = new OrcamentoVram();
    const lote = new LoteGeometriaGpu('floor|m1', 'floor', 'm1', material(), orc);
    lote.definir('a', dados('a', 0));
    lote.definir('b', dados('b', 5));
    expect(lote.finalizar()).toBe(true);
    expect(lote.totalIndices).toBe(6);
    expect(lote.malha.userData.ranges).toEqual([
      { id: 'a', start: 0, count: 3 },
      { id: 'b', start: 3, count: 3 },
    ]);
    expect(lote.malha.geometry.drawRange).toEqual({ start: 0, count: 6 });
    expect(orc.usado).toBe(lote.bytes);
    // O vértice do segundo nível fica no mesmo lugar de antes (índices deslocados pelo segmento).
    const pos = lote.malha.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.getX(3)).toBe(5);
    lote.dispose();
    expect(orc.usado).toBe(0);
  });

  it('mesma contagem: reaproveita a geometria e envia só a faixa do nível alterado', () => {
    const orc = new OrcamentoVram();
    const lote = new LoteGeometriaGpu('floor|m1', 'floor', 'm1', material(), orc);
    lote.definir('a', dados('a', 0));
    lote.definir('b', dados('b', 5));
    lote.finalizar();
    const geo = lote.malha.geometry;
    const versao = Number(geo.userData.versao);
    const posInicial = geo.getAttribute('position') as THREE.BufferAttribute;
    const idxInicial = geo.getIndex()!;
    posInicial.clearUpdateRanges();
    idxInicial.clearUpdateRanges();
    lote.definir('a', dados('a', 2));
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const idx = geo.getIndex()!;
    // Só o primeiro nível pediu envio; o segundo não foi tocado.
    expect(pos.updateRanges).toEqual([{ start: 0, count: 9 }]);
    expect(idx.updateRanges).toEqual([{ start: 0, count: 3 }]);
    expect(pos.getX(0)).toBe(2);
    expect(pos.getX(3)).toBe(5);
    expect(lote.finalizar()).toBe(true);
    expect(lote.malha.geometry).toBe(geo);
    expect(Number(geo.userData.versao)).toBe(versao + 1);
    // Faixas continuam apontando para o mesmo elemento.
    expect(lote.malha.userData.ranges).toEqual([
      { id: 'a', start: 0, count: 3 },
      { id: 'b', start: 3, count: 3 },
    ]);
  });

  it('remover um nível compacta o buffer e mantém as faixas do que sobrou', () => {
    const orc = new OrcamentoVram();
    const lote = new LoteGeometriaGpu('floor|m1', 'floor', 'm1', material(), orc);
    lote.definir('a', dados('a', 0));
    lote.definir('b', dados('b', 5));
    lote.finalizar();
    expect(lote.remover('a')).toBe(true);
    lote.finalizar();
    expect(lote.totalIndices).toBe(3);
    expect(lote.malha.userData.ranges).toEqual([{ id: 'b', start: 0, count: 3 }]);
    const pos = lote.malha.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.getX(0)).toBe(5);
    expect(lote.remover('x')).toBe(false);
  });

  it('mesclarLotes desloca índices e faixas como juntarLotes', () => {
    const d = mesclarLotes([triangulo('a', 0), triangulo('b', 5)]);
    expect(Array.from(d.indices)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(d.ids).toEqual([
      { id: 'a', start: 0, count: 3 },
      { id: 'b', start: 3, count: 3 },
    ]);
  });
});

describe('LoteLinhasGpu: uma linha para as arestas de todos os níveis', () => {
  it('acrescenta, envia só a faixa alterada e remove', () => {
    const orc = new OrcamentoVram();
    const linha = new LoteLinhasGpu(material(), orc);
    linha.definir('a', new Float32Array([0, 0, 0, 1, 0, 0]));
    linha.definir('b', new Float32Array([2, 0, 0, 3, 0, 0]));
    linha.finalizar();
    expect(linha.linhas.geometry.drawRange).toEqual({ start: 0, count: 4 });
    linha.definir('a', new Float32Array([0, 1, 0, 1, 1, 0]));
    const pos = linha.linhas.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.updateRanges).toEqual([{ start: 0, count: 6 }]);
    expect(pos.getY(0)).toBe(1);
    linha.finalizar();
    linha.remover('a');
    linha.finalizar();
    expect(linha.linhas.geometry.drawRange).toEqual({ start: 0, count: 2 });
    expect((linha.linhas.geometry.getAttribute('position') as THREE.BufferAttribute).getX(0)).toBe(2);
    linha.dispose();
    expect(orc.usado).toBe(0);
  });
});

describe('InstanciasGpu: uma InstancedMesh por categoria/material', () => {
  it('mesma contagem: reaproveita a malha e envia só a faixa alterada', () => {
    const orc = new OrcamentoVram();
    const caixa = new THREE.BoxGeometry(1, 1, 1);
    const inst = new InstanciasGpu('wall|m1', 'wall', 'm1', caixa, material(), orc);
    inst.definir('a', Float32Array.from(matrizDaCaixa(0, 0, 0.5, 0, 1, 0.2, 1)));
    inst.finalizar(false);
    const malha = inst.malha!;
    expect(malha.count).toBe(1);
    malha.instanceMatrix.clearUpdateRanges();
    inst.definir('a', Float32Array.from(matrizDaCaixa(2, 0, 0.5, 0, 1, 0.2, 1)));
    expect(inst.malha).toBe(malha);
    expect(malha.instanceMatrix.array[12]).toBe(2);
    expect(malha.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 16 }]);
    inst.finalizar(false);
    expect(malha.count).toBe(1);
    expect(malha.castShadow).toBe(false);
    inst.dispose();
    caixa.dispose();
    expect(orc.usado).toBe(0);
  });

  it('acrescentar nível cresce a malha e preserva as matrizes antigas', () => {
    const orc = new OrcamentoVram();
    const caixa = new THREE.BoxGeometry(1, 1, 1);
    const inst = new InstanciasGpu('wall|m1', 'wall', 'm1', caixa, material(), orc);
    inst.definir('a', Float32Array.from(matrizDaCaixa(0, 0, 0.5, 0, 1, 0.2, 1)));
    inst.finalizar(false);
    const antiga = inst.malha!;
    const espia = vi.spyOn(antiga, 'dispose');
    inst.definir('b', Float32Array.from(matrizDaCaixa(5, 0, 0.5, 0, 1, 0.2, 1)));
    inst.finalizar(false);
    expect(inst.malha).not.toBe(antiga);
    expect(espia).toHaveBeenCalledTimes(1);
    expect(inst.malha!.count).toBe(2);
    expect(inst.malha!.instanceMatrix.array[12]).toBe(0);
    expect(inst.malha!.instanceMatrix.array[28]).toBe(5);
    const b = caixaDeMatrizes(Float32Array.from(matrizDaCaixa(5, 0, 0.5, 0, 1, 0.2, 1)))!;
    expect(b[0]).toBeCloseTo(4.5, 6);
    expect(b[3]).toBeCloseTo(5.5, 6);
    inst.dispose();
    caixa.dispose();
  });
});

describe('GestorRecursosGpu: níveis entram/saem sem refazer o grupo inteiro', () => {
  function gestor(): GestorRecursosGpu {
    return new GestorRecursosGpu({ caixaUnitaria: new THREE.BoxGeometry(1, 1, 1), material: material, materialArestas: material });
  }

  it('junta níveis por categoria/material; atualização repetida não aloca nem reenvia', () => {
    const g = gestor();
    const a = entrada('a', 0);
    const b = entrada('b', 5);
    const r1 = g.atualizar([a, b], opcoes());
    expect(r1.solidas).toHaveLength(1);
    expect(r1.instanciadas).toHaveLength(1);
    expect(r1.arestas).not.toBeNull();
    expect(g.gruposGeometria).toBe(1);
    expect(g.gruposInstanciados).toBe(1);
    const solida = r1.solidas[0]!;
    const versao = Number(solida.geometry.userData.versao);
    const r2 = g.atualizar([a, b], opcoes());
    expect(r2.solidas[0]).toBe(solida);
    expect(Number(solida.geometry.userData.versao)).toBe(versao);
    g.dispose();
  });

  it('trocar um nível com a mesma contagem faz envio parcial; remover compacta', () => {
    const g = gestor();
    const a = entrada('a', 0);
    const b = entrada('b', 5);
    const r1 = g.atualizar([a, b], opcoes());
    const solida = r1.solidas[0]!;
    const inst = r1.instanciadas[0]!;
    const pos = solida.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.clearUpdateRanges();
    inst.instanceMatrix.clearUpdateRanges();
    const a2 = entrada('a', 1);
    const r2 = g.atualizar([a2, b], opcoes());
    expect(r2.solidas[0]).toBe(solida);
    expect(pos.updateRanges).toEqual([{ start: 0, count: 9 }]);
    expect(inst.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 16 }]);
    const r3 = g.atualizar([a2], opcoes());
    expect(r3.solidas).toHaveLength(1);
    expect((r3.solidas[0]!.geometry.getAttribute('position') as THREE.BufferAttribute).getX(0)).toBe(1);
    expect(g.bytes).toBeGreaterThan(0);
    g.dispose();
    expect(g.bytes).toBe(0);
  });

  it('sem caixas instanciadas (wireframe) os grupos de instância somem; arestas desligadas somem da linha', () => {
    const g = gestor();
    g.atualizar([entrada('a', 0)], { instanciar: false, arestas: false, sombras: false });
    expect(g.gruposInstanciados).toBe(0);
    g.atualizar([entrada('a', 0)], { instanciar: true, arestas: true, sombras: false });
    expect(g.gruposInstanciados).toBe(1);
    const r = g.atualizar([entrada('a', 0)], { instanciar: true, arestas: false, sombras: false });
    expect(r.arestas).toBeNull();
    g.dispose();
  });

  it('fechar a montagem põe os níveis na ordem do projeto e corta a capacidade para o tamanho exato', () => {
    const g = gestor();
    // Chega primeiro o nível b; depois a e b, na ordem do projeto (a, b).
    g.atualizar([entrada('b', 5)], opcoes(), false);
    const r = g.atualizar([entrada('a', 0), entrada('b', 5)], opcoes(), true);
    const solida = r.solidas[0]!;
    const pos = solida.geometry.getAttribute('position') as THREE.BufferAttribute;
    // Dois triângulos, sem folga de capacidade: 6 vértices × 3 componentes.
    expect(pos.array.length).toBe(18);
    expect(pos.getX(0)).toBe(0);
    expect(pos.getX(3)).toBe(5);
    expect(solida.userData.ranges).toEqual([
      { id: 'a_f', start: 0, count: 3 },
      { id: 'b_f', start: 3, count: 3 },
    ]);
    const inst = r.instanciadas[0]!;
    expect(inst.instanceMatrix.array.length).toBe(32);
    expect(inst.instanceMatrix.array[12]).toBe(0);
    expect(inst.instanceMatrix.array[28]).toBe(5);
    g.dispose();
  });
});
