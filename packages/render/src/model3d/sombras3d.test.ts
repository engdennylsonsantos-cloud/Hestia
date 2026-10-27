import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '@hestia/model';
import { ModelScene, sunDirection } from './scene3d.ts';
import {
  SOMBRA_MAX_TRIANGULOS,
  SombraSobDemanda,
  SombrasDaCena,
  aplicarSombra,
  enquadrarSombra,
  orcamentoDeSombra,
  type FaixaDeSombra,
  type MapaDeSombraRenderer,
} from './sombras3d.ts';

/** Renderer de mentira com o campo `shadowMap` do three (o que a sombra sob demanda lê e escreve). */
const renderer = (): MapaDeSombraRenderer => ({ shadowMap: { autoUpdate: true, needsUpdate: false } });

/** Faixa de sombra de teste: caixa centrada em `z` e `alvos` (malhas) que o orçamento liga/desliga. */
function faixa(z: number, triangulos: number, alvos = 1): FaixaDeSombra & { malhas: THREE.Mesh[] } {
  const malhas = Array.from({ length: alvos }, () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  return {
    caixa: new THREE.Box3(new THREE.Vector3(-1, -1, z - 1), new THREE.Vector3(1, 1, z + 1)),
    triangulos,
    alvos: malhas,
    malhas,
  };
}

describe('SombraSobDemanda', () => {
  it('começa suja: o primeiro quadro pede o mapa', () => {
    const s = new SombraSobDemanda();
    expect(s.sujo).toBe(true);
    const r = renderer();
    expect(s.aplicar(r)).toBe(true);
    expect(r.shadowMap.needsUpdate).toBe(true);
  });

  it('desliga a regeneração automática do renderer', () => {
    const r = renderer();
    new SombraSobDemanda().aplicar(r);
    expect(r.shadowMap.autoUpdate).toBe(false);
  });

  it('limpa a marca depois de pedir: quadros seguintes (câmera, zoom) não pedem o mapa de novo', () => {
    const s = new SombraSobDemanda();
    s.aplicar(renderer());
    expect(s.sujo).toBe(false);
    const r = renderer();
    expect(s.aplicar(r)).toBe(false);
    expect(r.shadowMap.needsUpdate).toBe(false);
  });

  it('marcar de novo (o modelo ou o sol mudaram) faz o próximo quadro pedir o mapa', () => {
    const s = new SombraSobDemanda();
    s.aplicar(renderer());
    s.marcar();
    expect(s.sujo).toBe(true);
    expect(s.aplicar(renderer())).toBe(true);
  });
});

describe('orçamento de sombra: faixas mais próximas do alvo até o teto de triângulos', () => {
  const alvo = new THREE.Vector3(0, 0, 50);

  it('sem teto apertado, todas as faixas projetam sombra', () => {
    const fs = [faixa(10, 100), faixa(50, 100), faixa(90, 100)];
    const e = orcamentoDeSombra(fs, alvo, SOMBRA_MAX_TRIANGULOS);
    expect(e.incluidas).toHaveLength(3);
    expect(e.triangulos).toBe(300);
    expect(e.limitada).toBe(false);
    expect(e.caixa!.min.z).toBeCloseTo(9, 6);
    expect(e.caixa!.max.z).toBeCloseTo(91, 6);
  });

  it('escolhe do alvo para fora e para na primeira faixa que não cabe (sem buraco)', () => {
    const fs = [faixa(10, 100), faixa(40, 100), faixa(70, 100), faixa(100, 100)];
    const e = orcamentoDeSombra(fs, alvo, 250);
    // Distâncias ao alvo (z = 50): 8 (z 40) < 19 (z 70) < 39 (z 10) < 49 (z 100).
    expect(e.incluidas).toEqual([1, 2]);
    expect(e.triangulos).toBe(200); // a 3ª faixa (z 10) passaria do teto de 250 e encerra a seleção
    expect(e.limitada).toBe(true);
    expect(e.triangulosDisponiveis).toBe(400);
  });

  it('a faixa mais próxima entra sempre, mesmo sozinha acima do teto', () => {
    const fs = [faixa(50, 5_000_000), faixa(10, 1)];
    const e = orcamentoDeSombra(fs, alvo, 1000);
    expect(e.incluidas).toEqual([0]);
    expect(e.limitada).toBe(true);
  });

  it('faixa sem geometria não consome orçamento nem entra', () => {
    const fs = [faixa(50, 0), faixa(60, 100)];
    const e = orcamentoDeSombra(fs, alvo, 100);
    expect(e.incluidas).toEqual([1]);
    expect(e.limitada).toBe(false);
  });

  it('aplicar liga castShadow só nas faixas escolhidas', () => {
    const a = faixa(0, 100);
    const b = faixa(60, 100);
    for (const m of [...a.malhas, ...b.malhas]) m.castShadow = true;
    const escolha = orcamentoDeSombra([a, b], new THREE.Vector3(0, 0, 0), 100);
    aplicarSombra([a, b], escolha);
    expect(a.malhas.every((m) => m.castShadow)).toBe(true);
    expect(b.malhas.every((m) => !m.castShadow)).toBe(true);
  });
});

describe('enquadramento da câmera do sol: caixa justa em vez do cubo da diagonal', () => {
  const sol = (): THREE.DirectionalLight => {
    const s = new THREE.DirectionalLight(0xffffff, 1);
    s.shadow.mapSize.set(2048, 2048);
    return s;
  };

  it('a caixa justa dá menos metros por texel do que o cubo de lado igual à diagonal', () => {
    const caixa = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(36, 52, 180));
    const r = enquadrarSombra(sol(), caixa, sunDirection(324.46, 51.97))!;
    const antigo = (caixa.getSize(new THREE.Vector3()).length() * 2) / 2048;
    expect(r.texelM).toBeLessThan(antigo * 0.75);
    expect(r.texelM).toBeGreaterThan(0);
  });

  it('a câmera cobre a caixa: os oito cantos caem dentro dos planos e do frustum', () => {
    const caixa = new THREE.Box3(new THREE.Vector3(-18, -26, 0), new THREE.Vector3(18, 26, 180));
    const s = sol();
    const r = enquadrarSombra(s, caixa, sunDirection(30, 60))!;
    const cam = s.shadow.camera;
    cam.updateMatrixWorld();
    const v = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? caixa.max.x : caixa.min.x, i & 2 ? caixa.max.y : caixa.min.y, i & 4 ? caixa.max.z : caixa.min.z);
      v.applyMatrix4(cam.matrixWorldInverse);
      expect(v.z).toBeLessThanOrEqual(-r.near + 1e-6);
      expect(v.z).toBeGreaterThanOrEqual(-r.far - 1e-6);
      expect(v.x).toBeGreaterThanOrEqual(cam.left - 1e-6);
      expect(v.x).toBeLessThanOrEqual(cam.right + 1e-6);
      expect(v.y).toBeGreaterThanOrEqual(cam.bottom - 1e-6);
      expect(v.y).toBeLessThanOrEqual(cam.top + 1e-6);
    }
    // O sol fica do lado da luz, acima da caixa (na direção dada).
    expect(s.position.z).toBeGreaterThan(caixa.max.z);
    expect(s.target.position.distanceTo(caixa.getCenter(new THREE.Vector3()))).toBeLessThan(1e-9);
  });

  it('caixa vazia não mexe na câmera', () => {
    const s = sol();
    const antes = s.shadow.camera.left;
    expect(enquadrarSombra(s, new THREE.Box3(), new THREE.Vector3(0, 0, 1))).toBeNull();
    expect(s.shadow.camera.left).toBe(antes);
  });

  it('caixa pequena (vista aproximada) fica mais nítida que a caixa grande', () => {
    const dir = sunDirection(324.46, 51.97);
    const grande = enquadrarSombra(sol(), new THREE.Box3(new THREE.Vector3(-18, -26, 0), new THREE.Vector3(18, 26, 180)), dir)!;
    const pequena = enquadrarSombra(sol(), new THREE.Box3(new THREE.Vector3(-18, -26, 0), new THREE.Vector3(18, 26, 60)), dir)!;
    expect(pequena.texelM).toBeLessThan(grande.texelM);
  });
});

describe('SombrasDaCena: prepara o passe só quando o mapa vai ser refeito', () => {
  const fs = (): FaixaDeSombra[] => [faixa(0, 100), faixa(60, 100), faixa(120, 100)];
  const dir = sunDirection(324.46, 51.97);

  it('sem needsUpdate, não escolhe nada nem mexe em castShadow', () => {
    const sombras = new SombrasDaCena();
    const lista = fs();
    const r = renderer();
    expect(sombras.preparar(r, lista, new THREE.DirectionalLight(), new THREE.Vector3(0, 0, 0), dir)).toBeNull();
    expect(lista.every((f) => f.alvos.every((m) => m.castShadow === false))).toBe(true);
  });

  it('com needsUpdate, aplica o orçamento e enquadra o sol na caixa escolhida', () => {
    const sombras = new SombrasDaCena();
    const lista = fs();
    const r = renderer();
    r.shadowMap.needsUpdate = true;
    const sol = new THREE.DirectionalLight();
    sol.shadow.mapSize.set(2048, 2048);
    const e = sombras.preparar(r, lista, sol, new THREE.Vector3(0, 0, 10), dir, 100)!;
    expect(e.incluidas.length).toBe(1);
    expect(sombras.ultima).toBe(e);
    expect(sombras.enquadramento!.texelM).toBeGreaterThan(0);
    expect(lista[e.incluidas[0]!]!.alvos.every((m) => m.castShadow)).toBe(true);
    expect(lista.filter((_, i) => i !== e.incluidas[0]).every((f) => f.alvos.every((m) => !m.castShadow))).toBe(true);
  });
});

describe('ModelScene e a sombra sob demanda', () => {
  const opcoes = { edges: false, shadows: true, dark: false };

  it('atualizar o modelo suja o mapa; quadros sem atualização (órbita, realce) não', () => {
    const ms = new ModelScene();
    const p = createEmptyProject('teste');
    ms.update(p, [], opcoes);
    expect(ms.sombra.sujo).toBe(true);
    ms.sombra.aplicar(renderer());
    // Realce (seleção e cursor) não muda a luz nem a geometria: o mapa continua válido.
    ms.highlight([], null);
    expect(ms.sombra.sujo).toBe(false);
    ms.dispose();
  });

  it('o gancho de quadro do three aplica o orçamento de sombra sem a vista chamar nada', () => {
    const ms = new ModelScene({ faixasMax: 2, niveisPorFaixa: 1, sombraMaxTriangulos: 1 });
    const p = createEmptyProject('teste');
    ms.update(p, [], opcoes);
    // Sem geometria não há faixa: nada a orçar.
    expect(ms.orcamentoDeSombra).toBeNull();
    const r = renderer();
    r.shadowMap.needsUpdate = true;
    ms.scene.onBeforeRender(r as never, ms.scene, ms.orbit.camera, undefined as never, undefined as never, undefined as never);
    expect(ms.orcamentoDeSombra).toBeNull();
    ms.dispose();
  });
});
