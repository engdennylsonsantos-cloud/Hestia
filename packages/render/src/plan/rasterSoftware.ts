import type * as THREE from 'three';
import type { Viewport } from '../viewport.ts';
import type { PlanScene } from './gpuPlan.ts';

/**
 * Rasterizador de software da planta, só para testes: emula o vertex e o fragment shader de traço (ver `gpuPlan.ts`) e a
 * mistura alfa de cada material, sem renderer. Serve para conferir que a imagem não muda quando só o zoom muda.
 */

/** Vértice como o vertex shader de traço o põe em metros, com os varyings que o fragment shader lê. */
export interface VerticeEmulado {
  x: number;
  y: number;
  dist: number;
  meia: number;
  padrao: [number, number];
}

/**
 * Vértice `k` da geometria com o deslocamento do shader para o zoom dado. Geometria sem `aExt` (preenchimento) devolve só a
 * posição, sem deslocamento nem tracejado.
 */
export function verticeEmulado(geo: THREE.BufferGeometry, k: number, zoom: number): VerticeEmulado {
  const pos = geo.getAttribute('position');
  const ext = geo.getAttribute('aExt');
  if (!ext) return { x: pos.getX(k), y: pos.getY(k), dist: 0, meia: 0, padrao: [0, 0] };
  const dir = geo.getAttribute('aDir');
  const pad = geo.getAttribute('aPadrao');
  const meia = (0.5 * ext.getZ(k)) / zoom;
  const along = ext.getX(k);
  const side = ext.getY(k);
  const ux = dir.getX(k);
  const uy = dir.getY(k);
  return {
    x: pos.getX(k) + ux * along * meia - uy * side * meia,
    y: pos.getY(k) + uy * along * meia + ux * side * meia,
    dist: dir.getZ(k) * zoom + along * 0.5 * ext.getZ(k),
    meia: 0.5 * ext.getZ(k),
    padrao: [pad.getX(k), pad.getY(k)],
  };
}

/** Malhas da cena na ordem de desenho (`renderOrder`), todas as camadas juntas. */
export function malhasNaOrdem(scene: PlanScene): THREE.Mesh[] {
  const grupos = scene.scene.children as THREE.Group[];
  return grupos.flatMap((g) => g.children as THREE.Mesh[]).sort((a, b) => a.renderOrder - b.renderOrder);
}

/**
 * Rasteriza as malhas em `W × H` pixels com a câmera dada, na ordem de `renderOrder`. Cada fragmento é interpolado a partir
 * dos vértices emulados; um fragmento de traço fora do tracejado é descartado (como o `discard` do shader). A cor é a linear
 * do material, como no shader. Devolve RGB por pixel em `Float64Array`.
 */
export function rasterizarMalhas(malhas: readonly THREE.Mesh[], cam: THREE.OrthographicCamera, zoom: number, W: number, H: number): Float64Array {
  const esq = cam.position.x + cam.left;
  const dir = cam.position.x + cam.right;
  const topo = cam.position.y + cam.top;
  const base = cam.position.y + cam.bottom;
  const buf = new Float64Array(W * H * 3).fill(1);
  for (const m of malhas) {
    const geo = m.geometry;
    const idx = geo.getIndex()!;
    const traco = geo.getAttribute('aExt') !== undefined;
    const mat = m.material as THREE.MeshBasicMaterial & { uniforms?: Record<string, { value: unknown }> };
    const cor = traco ? (mat.uniforms!.uCor!.value as THREE.Color) : mat.color;
    const a = traco ? (mat.uniforms!.uAlfa!.value as number) : mat.opacity;
    const { r, g, b } = cor;
    const vs = [0, 1, 2].map(() => ({ x: 0, y: 0, dist: 0, meia: 0, padrao: [0, 0] as [number, number] }));
    for (let t = 0; t < idx.count; t += 3) {
      for (let c = 0; c < 3; c++) {
        const e = verticeEmulado(geo, idx.getX(t + c), zoom);
        vs[c] = {
          x: ((e.x - esq) / (dir - esq)) * W,
          y: ((topo - e.y) / (topo - base)) * H,
          dist: e.dist,
          meia: e.meia,
          padrao: e.padrao,
        };
      }
      const [v0, v1, v2] = vs as [(typeof vs)[0], (typeof vs)[0], (typeof vs)[0]];
      const area = funcaoAresta(v0.x, v0.y, v1.x, v1.y, v2.x, v2.y);
      if (area === 0) continue;
      const x0m = Math.max(0, Math.floor(Math.min(v0.x, v1.x, v2.x)));
      const x1m = Math.min(W - 1, Math.ceil(Math.max(v0.x, v1.x, v2.x)));
      const y0m = Math.max(0, Math.floor(Math.min(v0.y, v1.y, v2.y)));
      const y1m = Math.min(H - 1, Math.ceil(Math.max(v0.y, v1.y, v2.y)));
      for (let y = y0m; y <= y1m; y++) {
        for (let x = x0m; x <= x1m; x++) {
          const cx = x + 0.5;
          const cy = y + 0.5;
          const w0 = funcaoAresta(v1.x, v1.y, v2.x, v2.y, cx, cy) / area;
          const w1 = funcaoAresta(v2.x, v2.y, v0.x, v0.y, cx, cy) / area;
          const w2 = funcaoAresta(v0.x, v0.y, v1.x, v1.y, cx, cy) / area;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          if (traco && descartado(w0 * v0.dist + w1 * v1.dist + w2 * v2.dist, v0.padrao, w0 * v0.meia + w1 * v1.meia + w2 * v2.meia)) continue;
          const k = (y * W + x) * 3;
          buf[k] = r * a + buf[k]! * (1 - a);
          buf[k + 1] = g * a + buf[k + 1]! * (1 - a);
          buf[k + 2] = b * a + buf[k + 2]! * (1 - a);
        }
      }
    }
  }
  return buf;
}

/** Rasteriza a cena da planta na vista dada (atualiza a câmera e o zoom antes, como o quadro faz). */
export function rasterizarCena(scene: PlanScene, v: Viewport, W: number, H: number): Float64Array {
  scene.setViewport(v);
  return rasterizarMalhas(malhasNaOrdem(scene), scene.camera, v.zoom, W, H);
}

/**
 * O tracejado do fragmento: `dist` em pixels, `padrao` (traço, período) e a meia espessura. Descarta quando o fragmento cai
 * no vão (fora da faixa de traço mais as pontas). Período 0 é linha inteira, nunca descarta.
 */
export function descartado(dist: number, padrao: [number, number], meia: number): boolean {
  const [traco, periodo] = padrao;
  if (periodo <= 0) return false;
  const r = dist - periodo * Math.floor(dist / periodo);
  return r > traco + meia && r < periodo - meia;
}

/** Função de aresta: positiva de um lado da reta de (ax, ay) a (bx, by), negativa do outro. */
export function funcaoAresta(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}
