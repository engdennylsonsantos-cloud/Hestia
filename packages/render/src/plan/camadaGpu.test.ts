import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CamadaGpu, MALHAS_LIVRES_MAX, capacidadeDe, escreverIndices, escreverPosicoes } from './camadaGpu.ts';
import type { LoteGpu } from './lotesGpu.ts';

/** Lote de `n` triângulos disjuntos (3 vértices cada), com a cor dada. */
function lote(n: number, cor = '#112233'): LoteGpu {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    pos.push(i, 0, 0, i + 1, 0, 0, i, 1, 0);
    idx.push(i * 3, i * 3 + 1, i * 3 + 2);
  }
  return { key: `f|${cor}|1`, color: cor, alpha: 1, pos, idx };
}

/** Cena de uma camada só: o grupo e a camada que o preenche. */
function camada(base = 0): { grupo: THREE.Group; c: CamadaGpu } {
  const grupo = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial();
  const c = new CamadaGpu(grupo, () => mat, base);
  return { grupo, c };
}

const malhas = (grupo: THREE.Group): THREE.Mesh[] => grupo.children as THREE.Mesh[];

describe('capacidade de buffer (camadaGpu)', () => {
  it('a capacidade é o uso com a folga, nunca abaixo do mínimo', () => {
    expect(capacidadeDe(1)).toBe(64);
    expect(capacidadeDe(1000)).toBe(1500);
  });
});

describe('escrita de buffers: reaproveita quando cabe, aloca quando não cabe', () => {
  it('um lote que cabe na capacidade usa o mesmo array e envia só o trecho usado', () => {
    const g = new THREE.BufferGeometry();
    expect(escreverPosicoes(g, lote(10).pos)).toBe(true);
    const arr = g.getAttribute('position').array;
    expect(escreverPosicoes(g, lote(4).pos)).toBe(false);
    expect(g.getAttribute('position').array).toBe(arr);
    // Só o trecho usado vai para a GPU (faixa de atualização: bufferSubData), não o buffer inteiro.
    const faixas = (g.getAttribute('position') as THREE.BufferAttribute).updateRanges;
    expect(faixas).toHaveLength(1);
    expect(faixas[0]).toEqual({ start: 0, count: lote(4).pos.length });
  });

  it('o índice fixa a faixa de desenho ao uso, mesmo com capacidade maior', () => {
    const g = new THREE.BufferGeometry();
    escreverIndices(g, lote(10).idx);
    const arr = g.index!.array;
    expect(escreverIndices(g, lote(2).idx)).toBe(false);
    expect(g.index!.array).toBe(arr);
    expect(g.drawRange.count).toBe(6);
  });

  it('acima da capacidade, aloca um array novo com a folga', () => {
    const g = new THREE.BufferGeometry();
    escreverPosicoes(g, lote(2).pos);
    const antes = g.getAttribute('position').array;
    expect(escreverPosicoes(g, lote(200).pos)).toBe(true);
    expect(g.getAttribute('position').array).not.toBe(antes);
    expect(g.getAttribute('position').array.length).toBeGreaterThanOrEqual(lote(200).pos.length);
  });
});

describe('CamadaGpu: malhas e buffers entre atualizações', () => {
  it('refazer com a mesma lista reaproveita as malhas e os buffers (nenhuma malha nova)', () => {
    const { grupo, c } = camada();
    c.aplicar([lote(5, '#aaaaaa'), lote(3, '#bbbbbb')]);
    const antes = malhas(grupo);
    const arrays = antes.map((m) => m.geometry.getAttribute('position').array);
    c.aplicar([lote(5, '#aaaaaa'), lote(3, '#bbbbbb')]);
    expect(malhas(grupo)).toEqual(antes);
    expect(malhas(grupo).every((m, i) => m === antes[i])).toBe(true);
    expect(malhas(grupo).every((m, i) => m.geometry.getAttribute('position').array === arrays[i])).toBe(true);
  });

  it('a ordem de desenho é a posição do lote na camada, somada à base da camada', () => {
    const { grupo, c } = camada(3_000_000);
    c.aplicar([lote(1), lote(1, '#000000')]);
    expect(malhas(grupo).map((m) => m.renderOrder)).toEqual([3_000_000, 3_000_001]);
  });

  it('um lote a menos sai do grupo; voltar a ter o lote reaproveita a malha livre', () => {
    const { grupo, c } = camada();
    c.aplicar([lote(2, '#111111'), lote(2, '#222222')]);
    const segunda = malhas(grupo)[1]!;
    c.aplicar([lote(2, '#111111')]);
    expect(grupo.children).toHaveLength(1);
    expect(segunda.parent).toBeNull();
    c.aplicar([lote(2, '#111111'), lote(2, '#222222')]);
    expect(malhas(grupo)[1]).toBe(segunda);
  });

  it('lista vazia limpa a camada (o grupo fica sem malhas)', () => {
    const { grupo, c } = camada();
    c.aplicar([lote(2)]);
    c.aplicar([]);
    expect(grupo.children).toHaveLength(0);
    expect(c.tamanho).toBe(0);
  });

  it('as malhas livres são limitadas: as excedentes têm a geometria liberada', () => {
    const { grupo, c } = camada();
    const excesso = 5;
    c.aplicar(Array.from({ length: MALHAS_LIVRES_MAX + excesso }, () => lote(1)));
    const espias = malhas(grupo).map((m) => vi.spyOn(m.geometry, 'dispose'));
    c.aplicar([]);
    expect(espias.filter((e) => e.mock.calls.length > 0)).toHaveLength(excesso);
    expect(grupo.children).toHaveLength(0);
  });

  it('dispose libera todas as geometrias e esvazia o grupo', () => {
    const { grupo, c } = camada();
    c.aplicar([lote(2), lote(2, '#000000')]);
    const geos = malhas(grupo).map((m) => m.geometry);
    const espias = geos.map((g) => vi.spyOn(g, 'dispose'));
    c.dispose();
    expect(espias.every((e) => e.mock.calls.length === 1)).toBe(true);
    expect(grupo.children).toHaveLength(0);
  });
});
