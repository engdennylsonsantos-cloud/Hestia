import { describe, expect, it } from 'vitest';
import type { SectionView } from '@hestia/model';
import { LIGHT } from './types.ts';
import { sectionMarkOps, sectionMarksOf } from './sectionMarks.ts';
import type { PlanPaint } from './style.ts';

const V = { cx: 0, cy: 0, zoom: 50, width: 800, height: 600 };

describe('marcas de corte na planta', () => {
  it('a seta de cada ponta aponta para a esquerda de a→b (lado de visão do corte)', () => {
    // a→b ao longo de +x: a esquerda é +y. As pontas da seta devem ficar em y > 0.
    const m = sectionMarkOps({ a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }, V, LIGHT);
    const tips = m.fills.map((f) => f.polygons[0]![0]!);
    expect(tips).toHaveLength(2);
    for (const ring of tips) {
      const tip = ring[1]!;
      expect(tip.y).toBeGreaterThan(0);
    }
  });

  it('traço-ponto vira segmentos curtos, sem cobrir a linha inteira', () => {
    const m = sectionMarkOps({ a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }, V, LIGHT);
    const dashes = m.strokes.filter((s) => s.pts.length === 2 && s.pts[0]!.y === 0 && s.pts[1]!.y === 0);
    expect(dashes.length).toBeGreaterThan(4);
    const covered = dashes.reduce((acc, s) => acc + Math.abs(s.pts[1]!.x - s.pts[0]!.x), 0);
    expect(covered).toBeLessThan(4);
  });

  it('o nome aparece nas duas pontas quando a marca é de projeto, e não na pré-visualização', () => {
    const placed = sectionMarkOps({ a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, label: 'Corte A' }, V, LIGHT);
    expect(placed.labels.map((l) => l.text)).toEqual(['Corte A', 'Corte A']);
    const preview = sectionMarkOps({ a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, label: 'Corte A', dashed: true }, V, LIGHT);
    expect(preview.labels).toHaveLength(0);
  });

  it('linha de comprimento zero não gera nada', () => {
    const m = sectionMarkOps({ a: { x: 1, y: 1 }, b: { x: 1, y: 1 } }, V, LIGHT);
    expect(m.strokes).toHaveLength(0);
    expect(m.fills).toHaveLength(0);
  });

  it('a planta respeita visibilidade, cor, espessura e seleção da categoria anotação', () => {
    const paint = { visible: true, color: '#123456', cutPx: 2, projPx: 1 } as PlanPaint;
    const view: SectionView = { id: 'v1', name: 'Corte A', kind: 'section', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, depth: 5 };
    const p = { views: [view], elements: {} };
    const normal = sectionMarksOf(p, V, LIGHT, paint, 100);
    expect(normal.strokes[0]!.color).toBe('#123456');
    expect(normal.strokes[0]!.widthPx).toBe(2);
    expect(normal.labels[0]!.fontPx).toBeGreaterThan(0);
    const selected = sectionMarksOf(p, V, LIGHT, paint, 100, ['v1']);
    expect(selected.strokes[0]!.color).toBe(LIGHT.select);
    const hidden = sectionMarksOf(p, V, LIGHT, { ...paint, visible: false }, 100);
    expect(hidden.strokes).toHaveLength(0);
    expect(sectionMarksOf({ views: [{ ...view, mark: { visible: false } }], elements: {} }, V, LIGHT, paint, 100).strokes).toHaveLength(0);
  });
});
