import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_MATERIALS, OPENING_FAMILIES, openingCompositionOf, openingOptionSupport, type OpeningComposition, type OpeningFamily, type OpeningFamilyId, type OpeningType } from '@hestia/model';
import { leavesChoicesFor, newOpeningTypeFromFamily } from '../../openingTypeForm.ts';
import type { PanelProps } from '../panels/panelKit.tsx';
import { CasingPanel } from './CasingPanel.tsx';
import { GlassPanel } from './GlassPanel.tsx';
import { ProfilePanel } from './ProfilePanel.tsx';
import { PROFILE_COMPONENTS } from './profileComponents.ts';

// Os painéis leem os presets do projeto pelo controlador; no render em string, um projeto vazio em memória basta.
vi.mock('../../../../editor/controller.ts', async () => {
  const { ProjectStore, createEmptyProject } = await import('@hestia/model');
  const store = new ProjectStore(createEmptyProject());
  return { editor: { store }, useProject: () => store.project, useProjectVersion: () => store.version };
});

const familia = (id: OpeningFamilyId): OpeningFamily => OPENING_FAMILIES.find((f) => f.id === id)!;
/** Tipo com a composição derivada (ou gravada) trocada por `f(composição)`. */
const comComp = (d: OpeningType, f: (c: OpeningComposition) => OpeningComposition): OpeningType => ({ ...d, composition: f(openingCompositionOf(d)) });
const materials = Object.fromEntries(DEFAULT_MATERIALS.map((m) => [m.id, m]));

const render = (Panel: ComponentType<PanelProps>, d: OpeningType, id: OpeningFamilyId): string => {
  const f = familia(id);
  return renderToStaticMarkup(
    createElement(Panel, { d, onChange: () => {}, family: f, support: openingOptionSupport(f.id), leaves: leavesChoicesFor(f), materials }),
  );
};

/** Marcação de um elemento pelo id (abre a tag e lê os atributos). */
const tag = (html: string, id: string): string => {
  const i = html.indexOf(`id="${id}"`);
  if (i < 0) return '';
  return html.slice(html.lastIndexOf('<', i), html.indexOf('>', i) + 1);
};

describe('painel de perfis do quadro', () => {
  const porta = (): OpeningType => newOpeningTypeFromFamily(familia('door_swing'));

  it('lista os presets de batente e marca "a validar" no batedor (não confirmado)', () => {
    const html = render(ProfilePanel, porta(), 'door_swing');
    expect(html).toContain('Madeira batente 5×9 (padrão Hestia)');
    expect(html).not.toContain('Madeira divisor 5×9');
    expect(html).toContain('a validar');
    expect(tag(html, 'op-pf-batente-preset')).toContain('<select');
  });

  it('mostra erro de validação inline', () => {
    const quebrado = comComp(porta(), (c) => ({ ...c, nominal: { ...c.nominal, width: 0 } }));
    const html = render(ProfilePanel, quebrado, 'door_swing');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Dimensões nominais devem ser positivas');
  });
});

describe('painel de alizar', () => {
  it('sem alizar, o retorno do acabamento não aparece e os campos de medida ficam desabilitados', () => {
    const d = newOpeningTypeFromFamily(familia('window_fixed'));
    const html = render(CasingPanel, d, 'window_fixed');
    expect(tag(html, 'op-cas-faces')).toContain('<select');
    expect(html).not.toContain('id="op-cas-closure"');
    expect(tag(html, 'op-cas-w')).toContain('disabled');
  });

  it('com alizar ligado, o retorno do acabamento aparece desabilitado com a explicação', () => {
    const d = newOpeningTypeFromFamily(familia('window_fixed'));
    const ligado = comComp(d, (c) => ({ ...c, casing: { faces: 'both', width: 0.07, thickness: 0.015, setback: 0 } }));
    const html = render(CasingPanel, ligado, 'window_fixed');
    expect(tag(html, 'op-cas-closure')).toContain('disabled');
    expect(html).toContain('Com alizar não há retorno do acabamento');
    expect(tag(html, 'op-cas-w')).not.toContain('disabled');
  });
});

describe('painel de vidro', () => {
  it('janela com bandeira fixa mostra tipo, montagem e a marca "a validar" no rebaixo', () => {
    // Janela fixa pura é uma célula de folha; o vidro vem da bandeira fixa.
    const d: OpeningType = { ...newOpeningTypeFromFamily(familia('window_hinged')), transom: { height: 0.4, fixed: true } };
    const html = render(GlassPanel, d, 'window_hinged');
    expect(tag(html, 'op-gl-kind')).toContain('<select');
    expect(tag(html, 'op-gl-mount')).toContain('<select');
    expect(html).toContain('Profundidade do rebaixo');
    expect(html).toContain('a validar');
  });

  it('sem célula de vidro, avisa em vez de mostrar campos', () => {
    const d = newOpeningTypeFromFamily(familia('door_void'));
    const sem = comComp(d, (c) => ({ ...c, layout: { kind: 'cell', id: 'x', content: { kind: 'panel', thickness: 0.04 } } }));
    const html = render(GlassPanel, sem, 'door_void');
    expect(html).toContain('Esta composição não tem célula de vidro.');
    expect(html).not.toContain('id="op-gl-kind"');
  });
});

describe('registro PROFILE_COMPONENTS', () => {
  it('tem perfil, alizar e vidro, com os rótulos e painéis', () => {
    expect(PROFILE_COMPONENTS.map((c) => c.id)).toEqual(['profile', 'casing', 'glass']);
    expect(PROFILE_COMPONENTS.map((c) => c.labelKey)).toEqual(['oc_profile', 'oc_casing', 'oc_glass']);
    expect(PROFILE_COMPONENTS[0]!.Panel).toBe(ProfilePanel);
  });
});
