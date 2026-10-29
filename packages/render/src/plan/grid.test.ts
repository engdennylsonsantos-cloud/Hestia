import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { visibleBounds, type Viewport } from '../viewport.ts';
import { PlanScene } from './gpuPlan.ts';
import { gridDotFills, gridStrokes } from './grid.ts';
import { rasterizarCena } from './rasterSoftware.ts';
import { DARK, LIGHT, type PlanTheme, type StrokeOp } from './types.ts';
import { resolverZoom } from './zoomOps.ts';

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
  const grupo = scene.scene.children[0] as THREE.Group;
  return grupo.children as THREE.Mesh[];
}

/** Grade de uma vista (com a cena da grade montada) e a imagem rasterizada dela. */
function cena(strokes: StrokeOp[], v: Viewport): { scene: PlanScene; imagem: Float64Array } {
  const scene = new PlanScene();
  scene.setSlot('grid', [], strokes, v);
  return { scene, imagem: rasterizarCena(scene, v, W, H) };
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

describe('pontinhos da grade (marcadores em pixels)', () => {
  const vista = (zoom: number): Viewport => ({ cx: 0, cy: 0, zoom, width: W, height: H });

  it('cada ponto é uma âncora repetida; a forma vem em deslocamentoPx, com cantos de 1,6 px', () => {
    const fills = gridDotFills(vista(60), LIGHT);
    expect(fills.length).toBeGreaterThan(0);
    for (const f of fills) {
      expect(f.deslocamentoPx).toBeDefined();
      expect(f.deslocamentoPx).toHaveLength(f.polygons.length);
      for (const [i, poly] of f.polygons.entries()) {
        // A âncora repetida: o polígono não tem área própria (o shader aplica a forma em pixels).
        const unicos = new Set(poly[0]!.map((p) => `${p.x},${p.y}`));
        expect(unicos.size).toBe(1);
        for (const canto of f.deslocamentoPx![i]![0]!) {
          expect(Math.abs(canto.x)).toBeCloseTo(1.6, 9);
          expect(Math.abs(canto.y)).toBeCloseTo(1.6, 9);
        }
      }
    }
  });

  it('o pontinho tem o mesmo tamanho em pixels em qualquer zoom', () => {
    const tamanho = (zoom: number): { w: number; h: number } => {
      const r = resolverZoom({ fills: gridDotFills(vista(zoom), LIGHT), strokes: [], labels: [] }, zoom);
      const ring = r.fills[0]!.polygons[0]![0]!;
      const xs = ring.map((p) => p.x);
      const ys = ring.map((p) => p.y);
      return { w: (Math.max(...xs) - Math.min(...xs)) * zoom, h: (Math.max(...ys) - Math.min(...ys)) * zoom };
    };
    // 2 × 1,6 px de meio-lado = 3,2 px de lado, do zoom 60 ao 220.
    for (const zoom of [60, 220]) {
      expect(tamanho(zoom).w).toBeCloseTo(3.2, 9);
      expect(tamanho(zoom).h).toBeCloseTo(3.2, 9);
    }
  });
});
