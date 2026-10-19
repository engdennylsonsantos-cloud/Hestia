import { describe, expect, it } from 'vitest';
import { LIGHT } from './types.ts';
import { sectionMarkOps } from './sectionMarks.ts';

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
});
