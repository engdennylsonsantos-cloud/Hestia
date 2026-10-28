import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { compositionCells, DEFAULT_MATERIALS, DEFAULT_OPENING_TYPES, OPENING_FAMILIES, openingCompositionOf, openingOptionSupport, type OpeningType } from '@hestia/model';
import type { PanelProps } from '../panels/panelKit.tsx';
import { COMPOSITION_COMPONENTS } from './index.ts';
import { aplicaAcao, defineLuz } from './compositionControls.ts';

const porta = (): OpeningType => DEFAULT_OPENING_TYPES.find((x) => x.kind === 'door' && x.nominalRef === 'leaf' && x.width === 0.9 && x.height === 2.1 && x.leaves === 1)!;

/** Renderiza o painel "Módulos" com as props que o diálogo passa a todo painel. */
function render(d: OpeningType): string {
  const props: PanelProps = {
    d,
    onChange: () => {},
    family: OPENING_FAMILIES.find((f) => f.id === 'door_swing') ?? null,
    support: openingOptionSupport('door_swing'),
    leaves: [],
    materials: Object.fromEntries(DEFAULT_MATERIALS.map((m) => [m.id, m])),
  };
  const { Panel } = COMPOSITION_COMPONENTS[0]!;
  return renderToStaticMarkup(createElement(Panel, props));
}

describe('painel Módulos', () => {
  it('é o componente "composition" e vale para qualquer tipo', () => {
    const d = COMPOSITION_COMPONENTS[0]!;
    expect(d.id).toBe('composition');
    expect(d.labelKey).toBe('oc_composition');
    expect(d.visible('door', 'door_swing')).toBe(true);
    expect(d.visible('window', 'window_fixed')).toBe(true);
  });

  it('porta mostra as ações de porta, o vão total e a árvore', () => {
    const html = render(porta());
    expect(html).toContain('Bandeira superior');
    expect(html).toContain('Painel fixo lateral');
    expect(html).not.toContain('Dividir em duas colunas');
    expect(html).toContain('Vão total');
    expect(html).toContain('0,98');
    expect(html).toContain('Folha');
  });

  it('janela mostra as ações de janela', () => {
    const html = render({ ...porta(), kind: 'window', nominalRef: 'opening', width: 1.6, height: 1.2 });
    expect(html).toContain('Dividir em duas colunas');
    expect(html).toContain('Empilhar bandeira');
    expect(html).not.toContain('Lateral esquerda');
  });

  it('erro de validação aparece inline (role alert)', () => {
    const t = aplicaAcao(porta(), 'esquerda');
    const vidro = compositionCells(openingCompositionOf(t)).find((x) => x.content.kind === 'glass')!;
    const html = render(defineLuz(t, vidro.id, { mode: 'fill' }));
    expect(html).toContain('role="alert"');
  });

  it('sem erro, não há mensagem de alerta', () => {
    expect(render(aplicaAcao(porta(), 'esquerda'))).not.toContain('role="alert"');
  });
});
