import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { visibleBounds, type Viewport } from '../viewport.ts';
import { PlanScene } from './gpuPlan.ts';
import { gridStrokes } from './grid.ts';
import { DARK, LIGHT, type PlanTheme, type StrokeOp } from './types.ts';

const W = 320;
const H = 240;

/** Grade na ordem anterior à otimização: verticais (uma a uma), horizontais e eixos, com a cor trocando a cada linha. */
function gradeAntiga(v: Viewport, theme: PlanTheme): StrokeOp[] {
  const step = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100].find((s) => s * v.zoom >= 14) ?? 100;
  const { minX: bx0, minY: by0, maxX: bx1, maxY: by1 } = visibleBounds(v);
  const major = step * 5;
  const out: StrokeOp[] = [];
  for (let x = Math.floor(bx0 / step) * step; x <= bx1; x += step) {
    const maior = Math.abs(x / major - Math.round(x / major)) < 1e-6;
    out.push({ pts: [{ x, y: by0 }, { x, y: by1 }], closed: false, widthPx: 1, color: maior ? theme.gridMajor : theme.gridMinor, alpha: 1 });
  }
  for (let y = Math.floor(by0 / step) * step; y <= by1; y += step) {
    const maior = Math.abs(y / major - Math.round(y / major)) < 1e-6;
    out.push({ pts: [{ x: bx0, y }, { x: bx1, y }], closed: false, widthPx: 1, color: maior ? theme.gridMajor : theme.gridMinor, alpha: 1 });
  }
  out.push({ pts: [{ x: 0, y: by0 }, { x: 0, y: by1 }], closed: false, widthPx: 1, color: theme.inkSoft, alpha: 0.5 });
  out.push({ pts: [{ x: bx0, y: 0 }, { x: bx1, y: 0 }], closed: false, widthPx: 1, color: theme.inkSoft, alpha: 0.5 });
  return out;
}

/** Malhas da camada da grade, na ordem de desenho. */
function malhasDaGrade(scene: PlanScene): THREE.Mesh[] {
  const grupo = scene.scene.children[2] as THREE.Group;
  return grupo.children as THREE.Mesh[];
}

/**
 * Rasteriza as malhas da cena em `W × H` pixels, na ordem de `renderOrder`, com a mistura alfa de cada material: a imagem
 * depende da ordem dos triângulos que se sobrepõem, como na GPU. Só lê a câmera e os materiais (sem three.js renderer).
 */
function rasterizar(scene: PlanScene, v: Viewport): Float64Array {
  scene.setViewport(v);
  const cam = scene.camera;
  const esq = cam.position.x + cam.left;
  const dir = cam.position.x + cam.right;
  const topo = cam.position.y + cam.top;
  const base = cam.position.y + cam.bottom;
  const buf = new Float64Array(W * H * 3).fill(1);
  const malhas = (scene.scene.children as THREE.Group[]).flatMap((g) => g.children as THREE.Mesh[]).sort((a, b) => a.renderOrder - b.renderOrder);
  for (const m of malhas) {
    const pos = m.geometry.getAttribute('position');
    const idx = m.geometry.getIndex()!;
    const mat = m.material as THREE.MeshBasicMaterial;
    const { r, g, b } = mat.color;
    const a = mat.opacity;
    const px = (i: number): number => ((pos.getX(i) - esq) / (dir - esq)) * W;
    const py = (i: number): number => ((topo - pos.getY(i)) / (topo - base)) * H;
    for (let t = 0; t < idx.count; t += 3) {
      const [i0, i1, i2] = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
      const [x0, y0, x1, y1, x2, y2] = [px(i0), py(i0), px(i1), py(i1), px(i2), py(i2)];
      const area = edge(x0, y0, x1, y1, x2, y2);
      if (area === 0) continue;
      const x0m = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
      const x1m = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
      const y0m = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
      const y1m = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
      for (let y = y0m; y <= y1m; y++) {
        for (let x = x0m; x <= x1m; x++) {
          const cx = x + 0.5;
          const cy = y + 0.5;
          const w0 = edge(x1, y1, x2, y2, cx, cy) / area;
          const w1 = edge(x2, y2, x0, y0, cx, cy) / area;
          const w2 = edge(x0, y0, x1, y1, cx, cy) / area;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
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

/** Função de aresta: positiva de um lado da reta de (ax, ay) a (bx, by), negativa do outro. */
function edge(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

/** Grade de uma vista (com a cena da grade montada) e a imagem rasterizada dela. */
function cena(strokes: StrokeOp[], v: Viewport): { scene: PlanScene; imagem: Float64Array } {
  const scene = new PlanScene();
  scene.setSlot('grid', [], strokes, v);
  return { scene, imagem: rasterizar(scene, v) };
}

const vistas = (zoom: number, cx = 4, cy = 3): Viewport => ({ cx, cy, zoom, width: W, height: H });

describe('grade (grid): mesma imagem e menos malhas', () => {
  it.each([
    ['claro, zoom 12', LIGHT, vistas(12)],
    ['claro, zoom 60', LIGHT, vistas(60)],
    ['claro, zoom 220', LIGHT, vistas(220, 1.3, 0.7)],
    ['escuro, zoom 60', DARK, vistas(60, -2.4, 5.1)],
  ])('a imagem da grade é a mesma que a da ordem antiga (%s)', (_nome, tema, v) => {
    const antiga = cena(gradeAntiga(v, tema), v);
    const nova = cena(gridStrokes(v, tema), v);
    expect(nova.imagem).toEqual(antiga.imagem);
    // Sanidade: a grade desenha algo (não compara duas imagens vazias).
    expect(nova.imagem.some((c) => c !== 1)).toBe(true);
    antiga.scene.dispose();
    nova.scene.dispose();
  });

  it('as mesmas linhas (cor, alfa, espessura e pontos), só em outra ordem', () => {
    const v = vistas(60);
    const chave = (s: StrokeOp) => JSON.stringify([s.color, s.alpha, s.widthPx, s.pts]);
    expect(gridStrokes(v, LIGHT).map(chave).sort()).toEqual(gradeAntiga(v, LIGHT).map(chave).sort());
  });

  it('a grade inteira vira no máximo 5 malhas (verticais menor e maior, horizontais menor e maior, eixos) numa vista de tela cheia', () => {
    const v: Viewport = { cx: 10, cy: 6.5, zoom: 60, width: 1200, height: 800 };
    const scene = new PlanScene();
    scene.setSlot('grid', [], gridStrokes(v, LIGHT), v);
    const antiga = new PlanScene();
    antiga.setSlot('grid', [], gradeAntiga(v, LIGHT), v);
    expect(malhasDaGrade(scene).length).toBeLessThanOrEqual(5);
    expect(malhasDaGrade(scene).length).toBeLessThan(malhasDaGrade(antiga).length);
    scene.dispose();
    antiga.dispose();
  });
});
