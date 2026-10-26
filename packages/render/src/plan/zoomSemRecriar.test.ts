import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Viewport } from '../viewport.ts';
import { buildPlanGeometry, buildPlanScreenOverlay } from './build.ts';
import { cenarios, entradaDe, estadoDe, type Cenario } from './cenariosZoom.ts';
import { PlanScene } from './gpuPlan.ts';
import { assinaturaDeZoom } from './limiares.ts';
import { PlanFrame, planFrameUpdateOf } from './planFrame.ts';

/*
 * Trocar o zoom não recria nada: a geometria do nível não é refeita enquanto o zoom fica entre dois limiares de detalhe, as
 * malhas e os buffers são os mesmos, e só os lotes dinâmicos (faixas de contorno e marcadores em pixels) são reescritos.
 */

const vista = (zoom: number): Viewport => ({ cx: 5, cy: 3.5, zoom, width: 800, height: 600 });
const completo = (): Cenario => cenarios().find((c) => c.nome === 'completo')!;

/** Quadro com contadores nas duas funções que refazem as camadas. */
function quadroContado(c: Cenario) {
  const scene = new PlanScene();
  const frame = new PlanFrame(scene);
  const contagem = { geometria: 0, sobreposicao: 0 };
  const atualizar = (zoom: number): void => {
    const u = planFrameUpdateOf(estadoDe(c, vista(zoom)));
    frame.update({
      ...u,
      geometry: () => {
        contagem.geometria++;
        return u.geometry();
      },
      overlay: () => {
        contagem.sobreposicao++;
        return u.overlay();
      },
    });
    scene.setViewport(vista(zoom));
  };
  return { scene, frame, contagem, atualizar };
}

/** Inventário dos buffers da cena: por malha, a geometria, os arrays dos atributos e a versão de cada um. */
function inventario(scene: PlanScene) {
  const malhas = (scene.scene.children as THREE.Group[]).flatMap((g) => g.children as THREE.Mesh[]);
  const atributos = malhas.map((m) => {
    const geo = m.geometry;
    const nomes = Object.keys(geo.attributes);
    return { geo, arrays: nomes.map((n) => (geo.getAttribute(n) as THREE.BufferAttribute).array), versoes: nomes.map((n) => (geo.getAttribute(n) as THREE.BufferAttribute).version), indice: geo.index!.array, versaoIndice: geo.index!.version };
  });
  return { malhas, atributos };
}

/** Zooms de um mesmo intervalo de limiares, em torno de `zoom`: o começo do intervalo, `zoom` e um ponto perto do fim. */
function zoomsDoIntervalo(limiares: number[], zoom: number): number[] {
  const sig = assinaturaDeZoom(limiares, zoom);
  const lo = sig === 0 ? 0 : limiares[sig - 1]!;
  const hi = sig < limiares.length ? limiares[sig]! : Number.POSITIVE_INFINITY;
  const inicio = lo === 0 ? zoom / 2 : lo;
  const fim = Number.isFinite(hi) ? lo + (hi - lo) * 0.9 : zoom * 2;
  return [inicio, zoom, fim];
}

describe('trocar o zoom não recria geometria nem buffers', () => {
  const c = completo();
  const limiares = buildPlanGeometry(entradaDe(c, 60)).limiares!;

  it('a geometria guarda os limiares de detalhe que consultou (hachura a 40 px/m e espessuras equivalentes das regiões)', () => {
    expect(limiares).toContain(40);
    expect(limiares).toEqual([...limiares].sort((a, b) => a - b));
    expect(new Set(limiares).size).toBe(limiares.length);
  });

  it('dentro do mesmo intervalo de limiares: nenhuma geometria nem sobreposição refeita, nenhuma malha nem buffer criado', () => {
    const [a, b, d] = zoomsDoIntervalo(limiares, 60);
    expect(assinaturaDeZoom(limiares, a!)).toBe(assinaturaDeZoom(limiares, d!));
    const { scene, contagem, atualizar } = quadroContado(c);
    atualizar(b!);
    expect(contagem).toEqual({ geometria: 1, sobreposicao: 1 });
    const antes = inventario(scene);
    atualizar(a!);
    atualizar(d!);
    atualizar(b!);
    expect(contagem).toEqual({ geometria: 1, sobreposicao: 1 });
    const depois = inventario(scene);
    // Mesmas malhas e mesmas geometrias (nada criado, nada descartado).
    expect(depois.malhas.length).toBe(antes.malhas.length);
    depois.malhas.forEach((m, i) => expect(m).toBe(antes.malhas[i]));
    // Mesmos arrays de atributos e de índices (nenhum buffer novo foi alocado).
    let reescritos = 0;
    depois.atributos.forEach((x, i) => {
      const y = antes.atributos[i]!;
      expect(x.geo).toBe(y.geo);
      x.arrays.forEach((arr, k) => expect(arr).toBe(y.arrays[k]));
      expect(x.indice).toBe(y.indice);
      if (x.versoes.some((v, k) => v !== y.versoes[k]) || x.versaoIndice !== y.versaoIndice) reescritos++;
    });
    // Só os lotes dinâmicos foram reescritos; os demais (a maior parte) ficaram como estavam.
    const dinamicos = scene.lotesDinamicos();
    expect(dinamicos).toBeGreaterThan(0);
    expect(reescritos).toBeLessThanOrEqual(dinamicos);
    expect(reescritos).toBeLessThan(depois.malhas.length / 2);
    scene.dispose();
  });

  it('só a câmera muda quando não há lote dinâmico: nenhum buffer é reescrito', () => {
    const vazio = cenarios().find((x) => x.nome === 'completo grosseiro')!;
    const lim = buildPlanGeometry(entradaDe(vazio, 60)).limiares!;
    const [a, b, d] = zoomsDoIntervalo(lim, 60);
    const { scene, contagem, atualizar } = quadroContado(vazio);
    atualizar(b!);
    const antes = inventario(scene);
    atualizar(a!);
    atualizar(d!);
    expect(contagem.geometria).toBe(1);
    const depois = inventario(scene);
    depois.atributos.forEach((x, i) => expect(x.versoes).toEqual(antes.atributos[i]!.versoes));
    scene.dispose();
  });

  it('passar de um limiar refaz a geometria uma vez; voltar ao intervalo anterior refaz de novo, e a imagem é a do zoom (sequência 12, 60, 220)', () => {
    const { scene, contagem, atualizar } = quadroContado(c);
    const sequencia = [12, 60, 220, 60, 12];
    let esperado = 0;
    let anterior = -1;
    for (const z of sequencia) {
      atualizar(z);
      const sig = assinaturaDeZoom(limiares, z);
      if (sig !== anterior) esperado++;
      anterior = sig;
      expect(contagem.geometria).toBe(esperado);
    }
    // A sobreposição nunca é refeita por causa do zoom.
    expect(contagem.sobreposicao).toBe(1);
    scene.dispose();
  });

  it('a sobreposição (seleção, prévia, captura) também não depende do zoom: a mesma lista em qualquer zoom, sem refazer', () => {
    const sel = cenarios().find((x) => x.nome === 'prévia da ferramenta')!;
    const { scene, contagem, atualizar } = quadroContado(sel);
    for (const z of [12, 60, 220, 12]) atualizar(z);
    expect(contagem.sobreposicao).toBe(1);
    // E a lista da sobreposição tem os marcadores como especificação em pixels, não como metros de um zoom.
    const ov = buildPlanScreenOverlay(entradaDe(sel, 12));
    const ov2 = buildPlanScreenOverlay(entradaDe(sel, 220));
    expect(JSON.stringify(ov)).toBe(JSON.stringify(ov2));
    scene.dispose();
  });
});
