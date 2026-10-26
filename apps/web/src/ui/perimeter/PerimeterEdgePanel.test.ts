import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PerimeterView } from '../../editor/perimeterApi.ts';

/** `usePerimeter` mockado: o stub de `editor/perimeter.ts` ainda não tem a lógica; o teste troca o estado. */
const estado = vi.hoisted(() => ({ view: null as unknown }));
vi.mock('../../editor/perimeter.ts', () => ({
  usePerimeter: () => estado.view,
  perimeterActions: { setEdge: () => undefined },
}));

const { PerimeterEdgePanel } = await import('./PerimeterEdgePanel.tsx');

const base: PerimeterView = {
  active: true,
  target: 'roof',
  draft: null,
  result: null,
  shape: 'line',
  lineKind: 'boundary',
  options: { overhang: 0.5, slopePct: 30, extendToCore: false, heightOffset: 0 },
  hoverId: null,
  selectedEdge: null,
  status: '',
};

describe('PerimeterEdgePanel', () => {
  it('fora do modo não desenha nada', () => {
    estado.view = { ...base, active: false };
    expect(renderToStaticMarkup(createElement(PerimeterEdgePanel))).toBe('');
  });

  it('no modo, mostra o grupo do telhado com a aresta selecionada', () => {
    estado.view = {
      ...base,
      selectedEdge: { id: 's2', index: 1, total: 4, length: 3.2, definesSlope: true, slopePct: 30, overhang: 0.5 },
    };
    const m = renderToStaticMarkup(createElement(PerimeterEdgePanel));
    expect(m).toContain('Perímetro do telhado');
    expect(m).toContain('2 de 4');
    expect(m).toContain('3,20 m');
    expect(m).toContain('Define inclinação');
  });

  it('sem aresta selecionada, os valores aparecem como travessão', () => {
    estado.view = { ...base, target: 'floor' };
    const m = renderToStaticMarkup(createElement(PerimeterEdgePanel));
    expect(m).toContain('Perímetro do piso');
    expect(m).toContain('—');
    expect(m).not.toContain('Define inclinação');
  });
});
