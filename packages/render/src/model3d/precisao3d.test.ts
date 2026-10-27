import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  BITS_PROFUNDIDADE,
  EXTENSAO_CLIP_CONTROL,
  clipControlDisponivel,
  diagnosticarOrigem,
  diagnosticarProfundidade,
  resolucaoProfundidade,
} from './precisao3d.ts';

describe('resolução do buffer de profundidade', () => {
  it('a resolução piora com o quadrado da distância', () => {
    const perto = resolucaoProfundidade(10, 0.5, 2000);
    const meio = resolucaoProfundidade(100, 0.5, 2000);
    const longe = resolucaoProfundidade(600, 0.5, 2000);
    expect(meio / perto).toBeGreaterThan(50); // (100/10)² = 100, descontado o termo (f−n)/f
    expect(longe).toBeGreaterThan(meio);
  });

  it('24 bits com plano próximo de 0,5 m dão resolução milimétrica a 100 m (o z-fighting não é falta de bits)', () => {
    const d = resolucaoProfundidade(100, 0.5, 2000, 24);
    expect(d).toBeGreaterThan(0.0005);
    expect(d).toBeLessThan(0.002);
    // A 600 m (zoom máximo) ainda fica abaixo de 10 cm.
    expect(resolucaoProfundidade(600, 0.5, 2000, 24)).toBeLessThan(0.1);
  });

  it('encurtar o plano distante quase não muda a resolução (o plano próximo domina)', () => {
    const a = resolucaoProfundidade(100, 0.5, 2000, 24);
    const b = resolucaoProfundidade(100, 0.5, 500, 24);
    expect(Math.abs(b - a) / a).toBeLessThan(0.01);
  });

  it('mais bits sempre melhora; plano próximo maior melhora a precisão longe (mas recorta o que está perto)', () => {
    expect(resolucaoProfundidade(100, 0.5, 2000, 32)).toBeLessThan(resolucaoProfundidade(100, 0.5, 2000, 24));
    // É o motivo de o plano próximo continuar pequeno: ele é o que deixa a câmera chegar na parede (ver `cameraClip`).
    expect(resolucaoProfundidade(100, 2, 2000, 24)).toBeLessThan(resolucaoProfundidade(100, 0.5, 2000, 24));
    expect(Number.isFinite(resolucaoProfundidade(Number.NaN, Number.NaN, Number.NaN, Number.NaN))).toBe(true);
    expect(resolucaoProfundidade(-5, 0.5, 2000)).toBe(0);
  });

  it('diagnóstico da câmera: planos, relação, pontos de referência e profundidade reversa', () => {
    const d = diagnosticarProfundidade({ near: 0.5, far: 2000 });
    expect(d.bits).toBe(BITS_PROFUNDIDADE);
    expect(d.relacao).toBe(4000);
    expect(d.resolucao.em100m).toBeCloseTo(resolucaoProfundidade(100, 0.5, 2000), 12);
    expect(d.reversa).toBe(false);
    expect(diagnosticarProfundidade({ near: 0.5, far: 2000, reversedDepth: true }).reversa).toBe(true);
    // Planos inválidos: normaliza para algo finito e não negativo.
    const ruim = diagnosticarProfundidade({ near: Number.NaN, far: Number.POSITIVE_INFINITY });
    expect(Number.isFinite(ruim.near)).toBe(true);
    expect(Number.isFinite(ruim.far)).toBe(true);
  });
});

describe('profundidade reversa: detecção da extensão que o three exige', () => {
  const gl = (ext: unknown): { getExtension(nome: string): unknown } => ({ getExtension: (nome) => (nome === EXTENSAO_CLIP_CONTROL ? ext : null) });

  it('EXT_clip_control presente: dá para ligar reversedDepthBuffer no renderer', () => {
    expect(clipControlDisponivel(gl({}))).toBe(true);
  });

  it('sem a extensão (ou sem contexto), o caminho é o clássico', () => {
    expect(clipControlDisponivel(gl(null))).toBe(false);
    expect(clipControlDisponivel(null)).toBe(false);
    expect(clipControlDisponivel(undefined)).toBe(false);
    const quebrado = { getExtension: () => { throw new Error('contexto perdido'); } };
    expect(clipControlDisponivel(quebrado)).toBe(false);
  });
});

describe('rebase de origem (RTC)', () => {
  const caixa = (min: [number, number, number], max: [number, number, number]) => new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));

  it('projeto local (60 pavimentos em volta da origem): float32 resolve abaixo de 1 mm, sem rebase', () => {
    const d = diagnosticarOrigem(caixa([-18, -26, 0], [18, 26, 180]));
    expect(d.maiorCoordenada).toBe(180);
    expect(d.resolucaoFloat32).toBeLessThan(0.001);
    expect(d.rebaseNecessario).toBe(false);
  });

  it('projeto georreferenciado (UTM ~500 km): float32 perde centímetros e pede rebase', () => {
    const d = diagnosticarOrigem(caixa([500000, 7000000, 0], [500036, 7000052, 180]));
    expect(d.rebaseNecessario).toBe(true);
    expect(d.resolucaoFloat32).toBeGreaterThan(0.1);
    expect(d.origemSugerida).toEqual({ x: 500018, y: 7000026, z: 90 });
  });

  it('sem caixa (cena vazia): nada a rebasear', () => {
    expect(diagnosticarOrigem(null)).toEqual({ maiorCoordenada: 0, resolucaoFloat32: 0, rebaseNecessario: false, origemSugerida: { x: 0, y: 0, z: 0 } });
  });
});
