// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Drawing, Pt, Prim } from './drawing.ts';
import { SchematicDrawing, SchematicViews } from './SchematicDrawing.tsx';

const frame = { x0: -0.5, y0: -0.5, x1: 1.8, y1: 1.8 };

const polygon = (id: string, pts: Pt[]): Prim => ({
  kind: 'polygon',
  id,
  pts,
  fill: 'body',
  tone: 'body',
  weight: 'normal',
  lineStyle: 'solid',
  role: 'body',
});

const testDrawing = (): Drawing => ({
  frame,
  em: 0.06,
  caption: 'Legenda de teste',
  meta: { kind: 'stair-section' },
  prims: [
    polygon('body.square', [[0, 0], [1, 0], [1, 1], [0, 1]]),
    { kind: 'hatch', id: 'hatch.square', pts: [[0, 0], [1, 0], [1, 1], [0, 1]], pattern: 'concrete' },
    {
      kind: 'dimension',
      id: 'dim.top',
      p1: [0, 1],
      p2: [1, 1],
      axis: 'x',
      line: 1.3,
      text: 'Piso 28,0 cm',
      tone: 'body',
    },
    { kind: 'label', id: 'lbl.a', at: [0.1, 0.5], text: 'A', anchor: 'start', tone: 'muted' },
  ],
});

const html = (): string => renderToStaticMarkup(createElement(SchematicDrawing, { drawing: testDrawing(), ariaLabel: 'Corte de teste' }));

describe('SchematicDrawing', () => {
  it('usa o viewBox, o role e o aria-label', () => {
    const s = html();
    expect(s).toContain('viewBox="-0.5 -1.8 2.3 2.3"');
    expect(s).toContain('role="img"');
    expect(s).toContain('aria-label="Corte de teste"');
    expect(s).toContain('<title>Corte de teste</title>');
  });

  it('nao usa cores literais e usa o halo do texto', () => {
    const s = html();
    expect(s).not.toMatch(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/);
    expect(s).not.toContain('rgb(');
    expect(s).toContain('var(--sheet)');
    expect(s).toContain('paint-order="stroke"');
  });

  it('desenha hachura com pattern', () => {
    expect(html()).toContain('<pattern');
  });

  it('garante tamanho minimo do texto', () => {
    expect(html()).toContain('min-width:');
  });

  it('mostra a legenda abaixo', () => {
    expect(html()).toContain('Legenda de teste');
  });
});

describe('SchematicViews', () => {
  it('com uma vista nao mostra abas', () => {
    const s = renderToStaticMarkup(
      createElement(SchematicViews, {
        tabsLabel: 'Vistas',
        views: [{ id: 'section', label: 'Corte', drawing: testDrawing(), ariaLabel: 'Corte' }],
      }),
    );
    expect(s).not.toContain('role="tablist"');
  });

  it('com duas vistas mostra abas', () => {
    const s = renderToStaticMarkup(
      createElement(SchematicViews, {
        tabsLabel: 'Vistas',
        views: [
          { id: 'section', label: 'Corte', drawing: testDrawing(), ariaLabel: 'Corte' },
          { id: 'plan', label: 'Planta', drawing: testDrawing(), ariaLabel: 'Planta' },
        ],
      }),
    );
    expect(s).toContain('role="tablist"');
    expect(s.match(/role="tab"/g)).toHaveLength(2);
  });
});
