import { describe, expect, it } from 'vitest';
import { LIGHT } from './types.ts';
import { effectiveGridStep, gridDotFills, gridStrokes, visibleGridStep } from './grid.ts';

const view = (zoom: number, gridStep?: number) => ({ cx: 0, cy: 0, zoom, width: 800, height: 600, ...(gridStep ? { gridStep } : {}) });

describe('intervalo da grade de pontos', () => {
  it('sem escolha vale o automático pelo zoom', () => {
    expect(effectiveGridStep(60)).toBe(visibleGridStep(60));
    expect(effectiveGridStep(60, 0)).toBe(visibleGridStep(60));
  });

  it('o intervalo escolhido vale quando legível e o automático volta quando fica denso demais', () => {
    expect(effectiveGridStep(60, 0.5)).toBe(0.5);
    // 0,05 m a 60 px/m dá 3 px entre pontos: ilegível.
    expect(effectiveGridStep(60, 0.05)).toBe(visibleGridStep(60));
  });

  it('o desenho dos pontos usa o mesmo intervalo da captura', () => {
    const v = view(60, 0.5);
    const dots = gridDotFills(v, LIGHT);
    expect(dots.length).toBeGreaterThan(0);
    const step = effectiveGridStep(v.zoom, v.gridStep);
    expect(step).toBe(0.5);
    // Cada ponto desenhado cai num múltiplo do intervalo (a origem é um ponto da grade, como na captura).
    for (const f of dots.slice(0, 20)) {
      const ring = f.polygons[0]?.[0] ?? [];
      const xs = ring.map((p) => p.x);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      expect(Math.abs(cx / step - Math.round(cx / step))).toBeLessThan(1e-6);
    }
  });

  it('as linhas mudam com o intervalo escolhido', () => {
    expect(gridStrokes(view(60, 1), LIGHT).length).not.toBe(gridStrokes(view(60, 0.25), LIGHT).length);
  });
});
