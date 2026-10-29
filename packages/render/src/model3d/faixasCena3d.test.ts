import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { resolveLevel, type ResolvedLevel } from '@hestia/engine';
import { view3dOf, type Project } from '@hestia/model';
import { predio } from './fixturesInstanciada3d.ts';
import { contarFaixas } from './faixas3d.ts';
import { ModelScene } from './scene3d.ts';

/** Renderer de mentira com o `shadowMap` do three (o gancho de quadro só lê estes campos). */
const renderer = (needsUpdate: boolean) => ({ shadowMap: { autoUpdate: false, needsUpdate, enabled: true } });

const OPT = { edges: true, shadows: true, dark: false } as const;

function montar(p: Project, opcoes: ConstructorParameters<typeof ModelScene>[0] = {}): ModelScene {
  const pv: Project = { ...p, view3d: { ...view3dOf(p), style: 'realistic', shadows: true, edges: true } };
  const niveis: ResolvedLevel[] = pv.levels.map((l) => resolveLevel(pv, l.id));
  const ms = new ModelScene(opcoes);
  ms.update(pv, niveis, OPT);
  return ms;
}

/** Triângulos das malhas de face visíveis da cena (sem contar chão e grade). */
function triangulosDaCena(ms: ModelScene): number {
  let total = 0;
  ms.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.kind === undefined) return;
    let visivel = true;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) visivel &&= p.visible;
    if (!visivel) return;
    const g = o.geometry;
    const indices = Math.min(g.drawRange.count, g.index ? g.index.count : g.attributes.position.count);
    total += (indices / 3) * (o instanceof THREE.InstancedMesh ? o.count : 1);
  });
  return Math.round(total);
}

/** Arestas (segmentos) das linhas visíveis do modelo. */
function segmentosDaCena(ms: ModelScene): number {
  let total = 0;
  ms.scene.traverse((o) => {
    if (!(o instanceof THREE.LineSegments) || o instanceof THREE.GridHelper) return;
    let visivel = true;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) visivel &&= p.visible;
    if (visivel) total += Math.min(o.geometry.drawRange.count, o.geometry.getAttribute('position').count) / 2;
  });
  return total;
}

describe('faixas na cena: mesmo conteúdo, dividido para o culling', () => {
  it('24 pavimentos viram 2 faixas; 1 faixa (faixasMax = 1) desenha exatamente os mesmos triângulos e arestas', () => {
    const p = predio(24, { aberturas: true });
    const uma = montar(p, { faixasMax: 1 });
    const tres = montar(p);
    expect(contarFaixas(24)).toBe(2);
    expect(tres.faixas).toHaveLength(2);
    expect(uma.faixas).toHaveLength(1);
    expect(triangulosDaCena(tres)).toBe(triangulosDaCena(uma));
    expect(segmentosDaCena(tres)).toBe(segmentosDaCena(uma));
    // A memória de GPU é a mesma geometria, só repartida: não multiplica pelo número de faixas (sem duplicar buffers).
    expect(tres.memoriaGpu).toBeLessThan(uma.memoriaGpu * 1.5);
    expect(tres.memoriaGpu).toBeGreaterThan(uma.memoriaGpu * 0.5);
    uma.dispose();
    tres.dispose();
  }, 30000);

  it('a caixa de cada faixa é disjunta em cota: o culling do three descarta as faixas fora do frustum', () => {
    const ms = montar(predio(24, { aberturas: true }));
    const caixas = ms.faixas.map((f) => f.caixa);
    expect(caixas.length).toBeGreaterThan(1);
    for (let i = 1; i < caixas.length; i++) expect(caixas[i - 1]!.max.z).toBeLessThanOrEqual(caixas[i]!.min.z + 1e-6);
    // Frustum estreito em volta do térreo: só a primeira faixa é intersectada.
    const camera = new THREE.OrthographicCamera(-40, 40, 40, -40, 0.1, 40);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    ms.scene.updateMatrixWorld(true);
    const visiveis = ms.faixas.map((f) => {
      const malhas = [...f.solidas, ...f.instanciadas];
      return malhas.some((m) => frustum.intersectsObject(m));
    });
    expect(visiveis[0]).toBe(true);
    expect(visiveis.slice(1).every((v) => v === false)).toBe(true);
    ms.dispose();
  });

  it('picking e caixa da seleção continuam iguais com faixas', () => {
    const p = predio(24, { aberturas: true });
    const uma = montar(p, { faixasMax: 1 });
    const tres = montar(p);
    for (const ids of [['w_12_0'], ['d_12'], ['j_2', 'w_0_2']]) {
      const a = uma.selectionBounds(ids)!;
      const b = tres.selectionBounds(ids)!;
      expect(a.min.distanceTo(b.min)).toBeLessThan(1e-6);
      expect(a.max.distanceTo(b.max)).toBeLessThan(1e-6);
    }
    uma.dispose();
    tres.dispose();
  });
});

describe('gancho de quadro: orçamento de sombra e enquadramento do sol', () => {
  const disparar = (ms: ModelScene, needsUpdate = true): void => {
    ms.scene.onBeforeRender(renderer(needsUpdate) as never, ms.scene, ms.orbit.camera, undefined as never, undefined as never, undefined as never);
  };

  it('com orçamento apertado, só as faixas mais próximas do alvo projetam sombra', () => {
    const ms = montar(predio(24, { aberturas: true }), { sombraMaxTriangulos: 1 });
    ms.fit();
    disparar(ms);
    const escolha = ms.orcamentoDeSombra!;
    expect(escolha.limitada).toBe(true);
    expect(escolha.incluidas).toHaveLength(1);
    const projetam = ms.faixas.map((f) => [...f.solidas, ...f.instanciadas].some((m) => m.castShadow));
    expect(projetam.filter(Boolean)).toHaveLength(1);
    // O mapa de sombra é enquadrado no volume (projetores + chão onde a sombra cai): nitidez na casa do pixel de tela.
    expect(ms.enquadramentoSombra!.mapa).toBeGreaterThanOrEqual(512);
    expect(ms.enquadramentoSombra!.texelM).toBeLessThan(0.5);
    expect(ms.enquadramentoSombra!.far).toBeGreaterThan(ms.enquadramentoSombra!.near);
    ms.dispose();
  });

  it('sem refazer o mapa (needsUpdate falso), o orçamento não é recalculado', () => {
    const ms = montar(predio(24, { aberturas: true }), { sombraMaxTriangulos: 1 });
    ms.fit();
    disparar(ms, false);
    expect(ms.orcamentoDeSombra).toBeNull();
    ms.dispose();
  });

  it('com orçamento folgado, todas as faixas projetam sombra e o enquadramento cobre o modelo', () => {
    const ms = montar(predio(24, { aberturas: true }), { sombraMaxTriangulos: 1e9 });
    ms.fit();
    disparar(ms);
    expect(ms.orcamentoDeSombra!.limitada).toBe(false);
    expect(ms.faixas.every((f) => [...f.solidas, ...f.instanciadas].every((m) => m.castShadow))).toBe(true);
    const enq = ms.enquadramentoSombra!;
    const caixa = ms.bounds().getSize(new THREE.Vector3());
    // Cobre pelo menos a altura e a largura do modelo em todos os eixos de tela.
    expect(enq.largura).toBeGreaterThanOrEqual(Math.min(caixa.x, caixa.y) * 0.9);
    expect(enq.altura).toBeGreaterThan(0);
    ms.dispose();
  });

  it('o diagnóstico de precisão e de origem sai da cena sem tocar na imagem', () => {
    const ms = montar(predio(6, { aberturas: true }));
    ms.fit();
    const p = ms.precisao;
    expect(p.near).toBe(ms.orbit.camera.near);
    expect(p.far).toBe(ms.orbit.camera.far);
    expect(p.relacao).toBeGreaterThan(1);
    expect(p.resolucao.em100m).toBeGreaterThan(0);
    const o = ms.origem;
    expect(o.maiorCoordenada).toBeGreaterThan(0);
    expect(o.rebaseNecessario).toBe(false);
    ms.dispose();
  });
});
