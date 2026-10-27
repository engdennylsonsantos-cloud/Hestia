import { describe, expect, it } from 'vitest';
import { buildOpeningModel, frameOfWall, openingGeometry } from '@hestia/engine';
import { DEFAULT_OPENING_TYPES, type OpeningType } from '@hestia/model';
import { LIGHT, openingPlanWorldPaths, type PlanDrawList } from '@hestia/render';
import { drawListToSvg } from './drawListToSvg.ts';
import { previewOpening, previewProject } from './previewProject.ts';
import { previewPlanDrawList } from './previewViews.ts';

const tipo = (id: string): OpeningType => DEFAULT_OPENING_TYPES.find((t) => t.id === id)!;

const contar = (svg: string, op: 'fill' | 'stroke'): number => (svg.match(new RegExp(`data-op="${op}"`, 'g')) ?? []).length;

describe('drawListToSvg da planta', () => {
  const { drawList, box } = previewPlanDrawList(tipo('ot_p90'), { angle: 90 });
  const svg = drawListToSvg(drawList, box, { width: 420, height: 300 });

  it('gera um SVG válido com um path de preenchimento e um de traço por operação', () => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('viewBox="0 0 420 300"');
    expect(contar(svg, 'fill')).toBe(drawList.fills.filter((f) => f.polygons.length > 0).length);
    expect(contar(svg, 'stroke')).toBe(drawList.strokes.filter((s) => s.pts.length > 0).length);
    expect(contar(svg, 'fill')).toBeGreaterThan(0);
    expect(contar(svg, 'stroke')).toBeGreaterThan(0);
  });

  it('usa variáveis de tema nos traços e não desenha rótulos de texto da planta', () => {
    const strokes = [...svg.matchAll(/data-op="stroke"[^>]*stroke="([^"]+)"/g)].map((m) => m[1]!);
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes.every((c) => c.startsWith('var(--'))).toBe(true);
    expect(svg).not.toContain('<text');
  });

  it('a porta ot_p90 em detalhe médio tem o polígono da folha e o arco do fecho', () => {
    const p = previewProject(tipo('ot_p90'));
    const o = previewOpening(p)!;
    const f = frameOfWall(p, o.hostId)!;
    const g = openingGeometry(p, o, f);
    const model = buildOpeningModel(p, o, g, f);
    const paths = openingPlanWorldPaths(g, model, {
      detail: 'mid',
      angle: Math.PI / 2,
      planDisplay: 'symbolic',
      showSwing: true,
      swingStyle: 'arc',
      cutZ: model.height / 2,
    });
    expect(paths.some((path) => path.role === 'leaf' && path.closed)).toBe(true);
    expect(paths.some((path) => path.role === 'swing')).toBe(true);
    // O pipeline da prévia desenha esses traços na lista: folha fechada de 4 lados e arco com vários pontos.
    expect(drawList.strokes.some((s) => s.closed && s.pts.length >= 4)).toBe(true);
    expect(drawList.strokes.some((s) => s.pts.length > 6)).toBe(true);
  });
});

describe('drawListToSvg: cores e opções', () => {
  it('cores de material continuam fixas e cores de tema viram variáveis; rótulos ficam fora', () => {
    const list: PlanDrawList = {
      background: '#ffffff',
      fills: [{ polygons: [[[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]]], color: '#c0693f', alpha: 1 }],
      strokes: [{ pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }], closed: false, widthPx: 1.4, color: LIGHT.ink, alpha: 1 }],
      labels: [{ at: { x: 0.5, y: 0.5 }, text: 'NÃO DEVE APARECER' }],
    };
    const svg = drawListToSvg(list, { minX: -0.5, minY: -0.5, maxX: 1.5, maxY: 1.5 });
    expect(svg).toContain('fill="#c0693f"');
    expect(svg).toContain('stroke="var(--fg)"');
    expect(svg).not.toContain('NÃO DEVE APARECER');
    expect(svg).not.toContain(LIGHT.ink);
  });

  it('sem caixa, enquadra pela própria lista e não gera SVG vazio', () => {
    const list: PlanDrawList = {
      background: '#ffffff',
      fills: [],
      strokes: [{ pts: [{ x: 2, y: 3 }, { x: 4, y: 5 }], closed: false, widthPx: 1, color: LIGHT.inkSoft, alpha: 0.5 }],
      labels: [],
    };
    const svg = drawListToSvg(list);
    expect(svg).toContain('data-op="stroke"');
    expect(svg).toContain('stroke="var(--fg-soft)"');
    expect(svg).toContain('stroke-opacity="0.5"');
  });
});
