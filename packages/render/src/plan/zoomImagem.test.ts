import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Viewport } from '../viewport.ts';
import { cenarios, estadoDe, type Cenario } from './cenariosZoom.ts';
import { PlanScene } from './gpuPlan.ts';
import { PlanFrame, planFrameUpdateOf } from './planFrame.ts';
import { malhasNaOrdem, rasterizarCena, verticeEmulado, verticePlano } from './rasterSoftware.ts';
import { DARK, LIGHT } from './types.ts';
import { resolverLista } from './zoomOps.ts';

/*
 * Imagem igual nos zooms 12, 60 e 220. A geometria do nível não guarda mais o zoom: faixas de contorno e marcadores em
 * pixels são lotes dinâmicos que a cena refaz no zoom corrente, e a espessura e o tracejado saem do shader. Estes testes
 * conferem, para cada cenário e cada par (zoom em que a geometria foi feita, zoom em que é vista):
 *  (1) a imagem rasterizada é a da cena feita direto no zoom visto (referência: geometria nova);
 *  (2) é também a da lista de desenho resolvida no zoom e posta na cena sem lote dinâmico (o caminho de antes);
 *  (3) os vértices de todas as malhas, levados à tela, batem dentro de 1e-3 px.
 */

const W = 360;
const H = 270;
const ZOOMS = [12, 60, 220];
/** Cenários que juntam todos os tipos de item que dependem do zoom (faixas, marcadores, rótulos, hachura, símbolos). */
const NOMES = ['completo', 'completo escuro', 'completo linhas finas', 'completo fino', 'completo 1:50', 'forro', 'seleção de telhado e escadas', 'seleção de piso, laje e ambiente', 'prévia da ferramenta', 'premium térreo'];
const CENARIOS = cenarios().filter((c) => NOMES.includes(c.nome));
const vista = (zoom: number, cx = 5, cy = 3.5): Viewport => ({ cx, cy, zoom, width: W, height: H });
/** Centro da vista de cada cenário: o do desenho (a planta de forro tem só 4 × 5 m). */
const centro = (c: Cenario): [number, number] => (c.nome === 'forro' ? [2, 2.5] : [5, 3.5]);

/** Cena com o quadro posto em cada vista da sequência (como o app faz a cada quadro). */
function cenaApos(c: Cenario, vistas: Viewport[]): PlanScene {
  const scene = new PlanScene();
  const frame = new PlanFrame(scene);
  for (const v of vistas) frame.update(planFrameUpdateOf(estadoDe(c, v)));
  return scene;
}

/** Imagem da cena na vista dada. */
const imagem = (scene: PlanScene, v: Viewport): Float64Array => rasterizarCena(scene, v, W, H);

/**
 * Cena com a lista de desenho do quadro já resolvida no zoom (`resolverZoom`): nenhum lote dinâmico, tudo posto como
 * geometria em metros (o caminho de antes de o zoom sair da geometria). A lista de `buildPlanDrawList` é a mesma, menos o
 * contorno fantasma dos ocultos selecionados, que só o quadro da tela acrescenta.
 */
function cenaEstatica(c: Cenario, v: Viewport): PlanScene {
  const scene = new PlanScene();
  const frame = new PlanFrame(scene);
  frame.update(planFrameUpdateOf(estadoDe(c, v, false)));
  const estatica = new PlanScene();
  estatica.setDrawList(resolverLista(frame.drawList(c.dark ? DARK : LIGHT), v.zoom), v);
  scene.dispose();
  return estatica;
}

/** Maior diferença entre duas imagens e quantos canais diferem. */
function diferenca(a: Float64Array, b: Float64Array): { max: number; canais: number } {
  expect(a.length).toBe(b.length);
  let max = 0;
  let canais = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i]! - b[i]!);
    if (d > 1e-9) canais++;
    max = Math.max(max, d);
  }
  return { max, canais };
}

/** Vértices de todas as malhas levados à tela (px), na ordem de desenho: x e y de cada vértice indexado. */
function verticesEmTela(scene: PlanScene, v: Viewport): number[] {
  scene.setViewport(v);
  const cam = scene.camera;
  const esq = cam.position.x + cam.left;
  const dir = cam.position.x + cam.right;
  const topo = cam.position.y + cam.top;
  const base = cam.position.y + cam.bottom;
  const out: number[] = [];
  for (const m of malhasNaOrdem(scene) as THREE.Mesh[]) {
    const geo = m.geometry;
    const idx = geo.index!;
    const mat = m.material as THREE.ShaderMaterial;
    const traco = mat.uniforms !== undefined;
    const papel = traco && mat.uniforms.uPapel!.value === 1 ? { teto: mat.uniforms.uTeto!.value as number } : false;
    const n = geo.drawRange.count;
    for (let t = 0; t < n; t++) {
      const e = traco ? verticeEmulado(geo, idx.getX(t), v.zoom, papel) : verticePlano(geo, idx.getX(t));
      out.push(((e.x - esq) / (dir - esq)) * W, ((topo - e.y) / (topo - base)) * H);
    }
  }
  return out;
}

describe('imagem igual ao trocar o zoom sem refazer a geometria (zooms 12, 60 e 220)', () => {
  for (const c of CENARIOS) {
    for (const visto of ZOOMS) {
      it(`${c.nome}: vista a ${visto} depois de feita em cada zoom = feita direto a ${visto}`, () => {
        const v = vista(visto, ...centro(c));
        const referencia = cenaApos(c, [v]);
        const imgRef = imagem(referencia, v);
        const estatica = cenaEstatica(c, v);
        const imgEst = imagem(estatica, v);
        // (2) o caminho de antes (lista resolvida, sem lote dinâmico) dá a mesma imagem que a cena de hoje.
        expect(diferenca(imgRef, imgEst)).toEqual({ max: 0, canais: 0 });
        const ref = verticesEmTela(referencia, v);
        for (const feito of ZOOMS) {
          const cena = cenaApos(c, [vista(feito, ...centro(c)), v]);
          // (1) imagem; (3) vértices em tela.
          expect(diferenca(imagem(cena, v), imgRef)).toEqual({ max: 0, canais: 0 });
          const tela = verticesEmTela(cena, v);
          expect(tela.length).toBe(ref.length);
          let pior = 0;
          for (let i = 0; i < tela.length; i++) pior = Math.max(pior, Math.abs(tela[i]! - ref[i]!));
          expect(pior).toBeLessThan(1e-3);
        }
        // Sanidade: a imagem tem conteúdo (não é uma comparação de páginas em branco).
        expect(imgRef.some((x) => x < 0.99)).toBe(true);
        referencia.dispose();
        estatica.dispose();
      }, 120_000);
    }
  }

  it('a vista em outro ponto (canto, zoom 220) também dá a mesma imagem', () => {
    const c = CENARIOS.find((x) => x.nome === 'completo')!;
    const v = vista(220, 0.2, 0.2);
    const a = cenaApos(c, [vista(12), v]);
    const b = cenaApos(c, [v]);
    expect(diferenca(imagem(a, v), imagem(b, v))).toEqual({ max: 0, canais: 0 });
    a.dispose();
    b.dispose();
  }, 120_000);
});
