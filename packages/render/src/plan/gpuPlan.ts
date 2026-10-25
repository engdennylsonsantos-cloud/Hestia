import * as THREE from 'three';
import type { Viewport } from '../viewport.ts';
import type { FillOp, PlanDrawList, StrokeOp } from './types.ts';
import { CamadaGpu } from './camadaGpu.ts';
import { montarLotesCamada, type LoteGpu } from './lotesGpu.ts';

export { PlanFrame, planFrameUpdateOf, sameView } from './planFrame.ts';

/**
 * Camadas da cena da planta, na ordem de desenho: preenchimentos da geometria, preenchimentos da sobreposição, grade,
 * traços da geometria e traços da sobreposição. Cada uma tem o seu grupo e as suas malhas: refazer a sobreposição não toca as outras.
 */
export type PlanSlot = 'fillsBase' | 'fillsOver' | 'grid' | 'strokesBase' | 'strokesOver';
const SLOTS: readonly PlanSlot[] = ['fillsBase', 'fillsOver', 'grid', 'strokesBase', 'strokesOver'];
/** Faixa de `renderOrder` por camada: a ordem dentro de uma camada não alcança a seguinte. */
const SLOT_STRIDE = 1_000_000;

/**
 * Traço no vertex shader: cada vértice é deslocado em tela (metros = pixels / zoom). `aExt` é (ao longo, lado, largura em
 * px), `aDir` é (ux, uy, distância ao início do traço em metros) e `aPadrao` é (traço, período) em px.
 */
const VERTEX_TRACO = /* glsl */ `
attribute vec3 aExt;
attribute vec3 aDir;
attribute vec2 aPadrao;
uniform float uZoom;
varying float vDist;
varying float vMeia;
varying vec2 vPadrao;
void main() {
  float meia = 0.5 * aExt.z / uZoom;
  vec2 u = aDir.xy;
  vec2 n = vec2(-u.y, u.x);
  vec2 p = position.xy + u * (aExt.x * meia) + n * (aExt.y * meia);
  vDist = aDir.z * uZoom + aExt.x * 0.5 * aExt.z;
  vMeia = 0.5 * aExt.z;
  vPadrao = aPadrao;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, position.z, 1.0);
}
`;

/** Traço no fragment shader: o tracejado recorta o fragmento pela distância em pixels; cada trecho ganha a ponta de meia espessura. */
const FRAGMENT_TRACO = /* glsl */ `
uniform vec3 uCor;
uniform float uAlfa;
varying float vDist;
varying float vMeia;
varying vec2 vPadrao;
void main() {
  if (vPadrao.y > 0.0) {
    float r = mod(vDist, vPadrao.y);
    if (r > vPadrao.x + vMeia && r < vPadrao.y - vMeia) discard;
  }
  gl_FragColor = vec4(uCor, uAlfa);
  #include <colorspace_fragment>
}
`;

/** Cena ortográfica 2D: consome as camadas de desenho neutras e as transforma em malhas na GPU. */
export class PlanScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  /** Zoom da vista, compartilhado por todos os materiais de traço: trocá-lo não refaz a geometria. */
  private readonly uZoom = { value: 1 };
  private camadas = new Map<PlanSlot, CamadaGpu>();
  private mats = new Map<string, THREE.Material>();

  constructor() {
    SLOTS.forEach((s, i) => {
      const grupo = new THREE.Group();
      this.scene.add(grupo);
      this.camadas.set(s, new CamadaGpu(grupo, (lote) => this.materialDo(lote), i * SLOT_STRIDE));
    });
    this.camera.position.set(0, 0, 10);
  }

  /**
   * Todo material é transparente (mesmo opaco): o three.js desenha os opacos antes dos transparentes, e isso poria a hachura
   * por cima das paredes, que vêm depois na lista. Com tudo transparente, a ordem é a da lista (`renderOrder`),
   * como no CPU (decisão 0015 §2.4). A hachura é vetorial (linhas e pontos), então não há textura para amostrar com o zoom.
   */
  private materialDo(lote: LoteGpu): THREE.Material {
    const key = lote.key;
    let m = this.mats.get(key);
    if (!m) {
      m = lote.traco ? this.materialTraco(lote) : this.materialPreenchimento(lote);
      this.mats.set(key, m);
    }
    return m;
  }

  private materialPreenchimento(lote: LoteGpu): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(lote.color),
      transparent: true,
      opacity: lote.alpha,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /** Material de traço: a espessura e o tracejado saem do shader, com o zoom compartilhado (`uZoom`). */
  private materialTraco(lote: LoteGpu): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { uZoom: this.uZoom, uCor: { value: new THREE.Color(lote.color) }, uAlfa: { value: lote.alpha } },
      vertexShader: VERTEX_TRACO,
      fragmentShader: FRAGMENT_TRACO,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  setViewport(v: Viewport): void {
    const hw = v.width / 2 / v.zoom;
    const hh = v.height / 2 / v.zoom;
    this.camera.left = -hw;
    this.camera.right = hw;
    this.camera.top = hh;
    this.camera.bottom = -hh;
    this.camera.position.set(v.cx, v.cy, 10);
    this.camera.updateProjectionMatrix();
    this.uZoom.value = v.zoom;
  }

  setBackground(color: string): void {
    this.scene.background = new THREE.Color(color);
  }

  /**
   * Refaz uma camada: preenchimentos (com a hachura vetorial) e traços. A espessura dos traços sai do shader, então o zoom
   * de `v` só atualiza o uniform. Listas vazias limpam a camada. Só a camada indicada é tocada; as malhas e os buffers
   * que já existem são reaproveitados.
   */
  setSlot(slot: PlanSlot, fills: FillOp[], strokes: StrokeOp[], v: Viewport): void {
    this.uZoom.value = v.zoom;
    this.camadas.get(slot)!.aplicar(montarLotesCamada(fills, strokes));
  }

  /** Lista de desenho inteira (fundo, preenchimentos e traços) numa só troca: as camadas de sobreposição e grade ficam vazias. */
  setDrawList(dl: PlanDrawList, v: Viewport): void {
    this.setBackground(dl.background);
    for (const s of SLOTS) this.setSlot(s, [], [], v);
    this.setSlot('fillsBase', dl.fills, [], v);
    this.setSlot('strokesBase', [], dl.strokes, v);
  }

  dispose(): void {
    for (const c of this.camadas.values()) c.dispose();
    for (const m of this.mats.values()) m.dispose();
  }
}
