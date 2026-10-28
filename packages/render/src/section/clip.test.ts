import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  RecorteGpu,
  aplicarPlanosDeRecorte,
  habilitarRecorteLocal,
  planosDaCaixa,
  planosDaVista,
  planosDoCorte,
  planosDoIntervaloDeVista,
  planosDoIntervaloNoModelo,
  planosDoRecorte,
  pontoDoDesenho,
} from './clip.ts';

/** Distância assinada ao plano: >= 0 é o lado que o three mantém. */
const lado = (p: THREE.Plane, x: number, y: number, z = 0): number => p.distanceToPoint(new THREE.Vector3(x, y, z));

const malha = (material: THREE.Material): THREE.Mesh => new THREE.Mesh(new THREE.BufferGeometry(), material);

describe('planos do corte no modelo (3D)', () => {
  it('linha ao longo de x: mantém o lado da normal e a profundidade, sem passar das pontas', () => {
    const [perto, fundo, inicio, fim] = planosDoCorte({ a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, depth: 4 }) as [THREE.Plane, THREE.Plane, THREE.Plane, THREE.Plane];
    // n = (0, 1): o que aparece está em y >= 0, até y <= 4.
    expect(lado(perto, 5, 2)).toBeGreaterThan(0);
    expect(lado(perto, 5, -1)).toBeLessThan(0);
    expect(lado(fundo, 5, 2)).toBeGreaterThan(0);
    expect(lado(fundo, 5, 5)).toBeLessThan(0);
    // Extremidades: 0 <= x <= 10.
    expect(lado(inicio, 3, 2)).toBeGreaterThan(0);
    expect(lado(inicio, -1, 2)).toBeLessThan(0);
    expect(lado(fim, 9, 2)).toBeGreaterThan(0);
    expect(lado(fim, 11, 2)).toBeLessThan(0);
  });

  it('linha vertical: a normal à esquerda aponta para −x, como o `sectionFrame` do motor', () => {
    const [perto, fundo] = planosDoCorte({ a: { x: 4, y: -2 }, b: { x: 4, y: 12 }, depth: 14 }) as [THREE.Plane, THREE.Plane];
    expect(lado(perto, 2, 5)).toBeGreaterThan(0); // x <= 4 aparece
    expect(lado(perto, 6, 5)).toBeLessThan(0);
    expect(lado(fundo, -9, 5)).toBeGreaterThan(0); // x >= 4 − 14
    expect(lado(fundo, -11, 5)).toBeLessThan(0);
  });

  it('todos os planos saem normalizados (distância em metros)', () => {
    for (const p of planosDoCorte({ a: { x: 1, y: 2 }, b: { x: 7, y: 9 }, depth: 3 })) expect(p.normal.length()).toBeCloseTo(1, 12);
  });

  it('section box mantém o interior e corta fora', () => {
    const ps = planosDaCaixa({ x: 0, y: 0, z: 0 }, { x: 4, y: 6, z: 3 });
    expect(ps).toHaveLength(6);
    for (const p of ps) expect(lado(p, 2, 3, 1.5)).toBeGreaterThan(0);
    expect(ps.some((p) => lado(p, 5, 3, 1.5) < 0)).toBe(true);
    expect(ps.some((p) => lado(p, 2, -1, 1.5) < 0)).toBe(true);
    expect(ps.some((p) => lado(p, 2, 3, 4) < 0)).toBe(true);
  });

  it('intervalo de vista do nível vira base e topo em z absoluto', () => {
    const [base, topo] = planosDoIntervaloNoModelo({ top: 2.3, bottom: 0 }, 3) as [THREE.Plane, THREE.Plane];
    expect(lado(base, 0, 0, 2.99)).toBeLessThan(0); // z = 3 + 0
    expect(lado(base, 0, 0, 3.2)).toBeGreaterThan(0);
    expect(lado(topo, 0, 0, 5.2)).toBeGreaterThan(0); // z = 3 + 2,3
    expect(lado(topo, 0, 0, 5.4)).toBeLessThan(0);
  });
});

describe('recorte do desenho do corte/elevação (2D: x = t, y = cota)', () => {
  it('região de recorte mantém o retângulo e corta os quatro lados', () => {
    const [esq, dir, baixo, cima] = planosDoRecorte({ tMin: 1, tMax: 5, zMin: 0.5, zMax: 3 }) as [THREE.Plane, THREE.Plane, THREE.Plane, THREE.Plane];
    expect(lado(esq, 3, 2)).toBeGreaterThan(0);
    expect(lado(esq, 0.5, 2)).toBeLessThan(0);
    expect(lado(dir, 3, 2)).toBeGreaterThan(0);
    expect(lado(dir, 6, 2)).toBeLessThan(0);
    expect(lado(baixo, 3, 2)).toBeGreaterThan(0);
    expect(lado(baixo, 3, 0.1)).toBeLessThan(0);
    expect(lado(cima, 3, 2)).toBeGreaterThan(0);
    expect(lado(cima, 3, 4)).toBeLessThan(0);
  });

  it('intervalo de vista no desenho usa cotas relativas ao nível', () => {
    const [baixo, cima] = planosDoIntervaloDeVista({ top: 2.3, bottom: 0.2 }, 5) as [THREE.Plane, THREE.Plane];
    expect(lado(baixo, 0, 5.3)).toBeGreaterThan(0);
    expect(lado(baixo, 0, 5.1)).toBeLessThan(0);
    expect(lado(cima, 0, 7.2)).toBeGreaterThan(0);
    expect(lado(cima, 0, 7.4)).toBeLessThan(0);
  });

  it('sem crop nem intervalo de vista, não há recorte (imagem de sempre)', () => {
    expect(planosDaVista({})).toEqual([]);
    expect(planosDaVista({ crop: { tMin: 0, tMax: 1, zMin: 0, zMax: 1 } })).toHaveLength(4);
    expect(planosDaVista({ viewRange: { top: 2, bottom: 0 } })).toHaveLength(2);
  });

  it('ponto (t, z) do desenho volta ao modelo pela linha', () => {
    expect(pontoDoDesenho({ a: { x: 0, y: 0 }, b: { x: 0, y: 10 }, depth: 3 }, 4, 2.5)).toEqual({ x: 0, y: 4, z: 2.5 });
  });
});

describe('aplicação na cena (material.clippingPlanes)', () => {
  it('aplica em materiais distintos uma vez e restaura o estado anterior', () => {
    const compartilhado = new THREE.MeshBasicMaterial();
    const outro = new THREE.MeshBasicMaterial();
    const anterior = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    outro.clippingPlanes = [anterior];
    const raiz = new THREE.Group();
    raiz.add(malha(compartilhado), malha(compartilhado), malha(outro));
    const planos = planosDoRecorte({ tMin: 0, tMax: 1, zMin: 0, zMax: 1 });
    const recorte = aplicarPlanosDeRecorte(raiz, planos);
    expect(recorte.materiais).toBe(2);
    expect(compartilhado.clippingPlanes).toBe(planos);
    expect(outro.clippingPlanes).toBe(planos);
    expect(compartilhado.clipShadows).toBe(true);
    recorte.restaurar();
    expect(compartilhado.clippingPlanes).toBeNull();
    expect(outro.clippingPlanes).toEqual([anterior]);
  });

  it('`RecorteGpu.atualizar` troca valores sem recompilar o material (mesma lista)', () => {
    const mat = new THREE.MeshBasicMaterial();
    const raiz = new THREE.Group();
    raiz.add(malha(mat));
    const gpu = new RecorteGpu();
    gpu.aplicar(raiz, planosDoRecorte({ tMin: 0, tMax: 2, zMin: 0, zMax: 2 }));
    const lista = mat.clippingPlanes;
    expect(gpu.quantidade).toBe(4);
    expect(gpu.materiais).toBe(1);
    expect(gpu.cena).toBe(raiz);
    expect(gpu.atualizar(planosDoRecorte({ tMin: 1, tMax: 3, zMin: 0.5, zMax: 2.5 }))).toBe(true);
    // Mesma referência de lista: o shader já compilado continua valendo; só os valores mudaram.
    expect(mat.clippingPlanes).toBe(lista);
    expect(mat.clippingPlanes![0]!.constant).toBeCloseTo(-1, 12);
    expect(gpu.atualizar(planosDaCaixa({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }))).toBe(false); // 6 ≠ 4
    gpu.restaurar();
    expect(mat.clippingPlanes).toBeNull();
    expect(gpu.quantidade).toBe(0);
  });

  it('sem planos, `RecorteGpu.aplicar` não toca nos materiais', () => {
    const mat = new THREE.MeshBasicMaterial();
    const raiz = new THREE.Group();
    raiz.add(malha(mat));
    const gpu = new RecorteGpu();
    gpu.aplicar(raiz, []);
    expect(gpu.quantidade).toBe(0);
    expect(gpu.materiais).toBe(0);
    expect(mat.clippingPlanes).toBeNull();
  });

  it('`habilitarRecorteLocal` liga no renderer e devolve o valor anterior', () => {
    const renderer = { localClippingEnabled: false };
    expect(habilitarRecorteLocal(renderer)).toBe(false);
    expect(renderer.localClippingEnabled).toBe(true);
    expect(habilitarRecorteLocal(renderer, false)).toBe(true);
    expect(renderer.localClippingEnabled).toBe(false);
  });
});
