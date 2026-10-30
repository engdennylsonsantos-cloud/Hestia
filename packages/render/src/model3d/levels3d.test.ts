import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEmptyProject } from '@hestia/model';
import { buildLevelLines, levelLineData, levelMarkersOf } from './levels3d.ts';
import { pickLevel } from './pick3d.ts';

/** Projeto vazio: dois níveis, Térreo em 0 e Pavimento 2 em 3 m (sem paredes, então a caixa é a de reserva). */
const projeto = () => createEmptyProject();

/** Câmera de cima sobre a borda y = 0 do retângulo, olhando para −z (o raio do centro acerta a linha). */
function cameraDeCima(z = 20): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  cam.position.set(5, 0, z);
  cam.up.set(0, 1, 0);
  cam.lookAt(5, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

describe('levelLineData', () => {
  it('um retângulo (4 segmentos) por nível, na cota dele', () => {
    const dados = levelLineData(projeto());
    expect(dados.map((d) => d.levelId)).toEqual(['lv_0', 'lv_1']);
    for (const d of dados) expect(d.positions).toHaveLength(4 * 2 * 3);
    const z0 = new Set(dados[0]!.positions.filter((_, i) => i % 3 === 2));
    const z3 = new Set(dados[1]!.positions.filter((_, i) => i % 3 === 2));
    expect([...z0]).toEqual([0]);
    expect([...z3]).toEqual([3]);
  });

  it('sem paredes, usa a caixa de reserva 0..10 m', () => {
    const xs = levelLineData(projeto())[0]!.positions.filter((_, i) => i % 3 === 0);
    const ys = levelLineData(projeto())[0]!.positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(10);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(10);
  });
});

describe('levelMarkersOf', () => {
  it('texto = nome + cota em metros com sinal e duas casas', () => {
    const marcadores = levelMarkersOf(projeto());
    expect(marcadores.map((m) => m.text)).toEqual(['Térreo +0,00', 'Pavimento 2 +3,00']);
    expect(marcadores.map((m) => m.levelId)).toEqual(['lv_0', 'lv_1']);
    expect(marcadores[1]!.elevation).toBe(3);
  });
});

describe('pickLevel', () => {
  it('devolve o nível do retângulo mais próximo da câmera e o ponto atingido', () => {
    const cena = new THREE.Scene();
    const grupo = buildLevelLines(projeto());
    expect(grupo).not.toBeNull();
    expect(grupo!.userData.levels).toBe(true);
    cena.add(grupo!);
    // De cima, o retângulo de 3 m está na frente do de 0 m.
    const hit = pickLevel(cena, cameraDeCima(), { x: 0, y: 0 });
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe('level');
    expect(hit!.levelId).toBe('lv_1');
    expect(hit!.point.z).toBeCloseTo(3, 6);
  });

  it('sem linhas de nível na cena devolve null', () => {
    expect(pickLevel(new THREE.Scene(), cameraDeCima(), { x: 0, y: 0 })).toBeNull();
  });
});
