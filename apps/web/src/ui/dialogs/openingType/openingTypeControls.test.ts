import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MATERIALS,
  OPENING_FAMILIES,
  openingOptionSupport,
  type OpeningFamily,
  type OpeningFamilyId,
  type OpeningType,
} from '@hestia/model';
import { leavesChoicesFor, newOpeningTypeFromFamily } from '../openingTypeForm.ts';
import { OpeningTypeSections } from './OpeningTypeSections.tsx';
import { visibleComponents, type OpeningComponentId } from './components.ts';
import {
  GLASS_KINDS,
  setGlassKind,
  setLeafMaterialId,
  setRevealDepth,
  setThresholdKind,
  setThresholdThickness,
  setTiltAxis,
  thresholdKind,
} from './openingTypeControls.ts';
import { withOpeningField } from './openingTypeFields.ts';

// As miniaturas leem o projeto pelo controlador; no render em string, um projeto vazio em memória basta.
vi.mock('../../../editor/controller.ts', async () => {
  const { ProjectStore, createEmptyProject } = await import('@hestia/model');
  const store = new ProjectStore(createEmptyProject());
  return { editor: { store }, useProject: () => store.project, useProjectVersion: () => store.version };
});

const familyOf = (id: OpeningFamilyId): OpeningFamily => OPENING_FAMILIES.find((f) => f.id === id)!;
const nova = (id: OpeningFamilyId): OpeningType => newOpeningTypeFromFamily(familyOf(id));
const materials = Object.fromEntries(DEFAULT_MATERIALS.map((m) => [m.id, m]));

const render = (d: OpeningType, family: OpeningFamily, active: OpeningComponentId): string =>
  renderToStaticMarkup(
    createElement(OpeningTypeSections, { d, onChange: () => {}, family, leaves: leavesChoicesFor(family), materials, active }),
  );

const htmlDaFamilia = (familyId: OpeningFamilyId): string => {
  const family = familyOf(familyId);
  const d = nova(familyId);
  return visibleComponents(family.kind, family.id)
    .map((c) => render(d, family, c.id))
    .join('\n');
};
const tem = (html: string, id: string): boolean => html.includes(`id="${id}"`);

const selectedValue = (html: string, id: string): string | null => {
  const start = html.indexOf(`id="${id}"`);
  const end = html.indexOf('</select>', start);
  const select = html.slice(start, end);
  const tag = select.split('<option').find((t) => t.includes('selected')) ?? '';
  return /value="([^"]+)"/.exec(tag)?.[1] ?? null;
};

describe('controles novos: visibilidade derivada da tabela de suporte', () => {
  it.each(OPENING_FAMILIES.map((f) => f.id))('%s', (familyId) => {
    const sup = openingOptionSupport(familyId);
    const html = htmlDaFamilia(familyId);
    expect(tem(html, 'op-leaf-plan'), 'folha em planta').toBe(sup.angle);
    expect(tem(html, 'op-nominal'), 'referência do tamanho').toBe(sup.nominalRef);
    expect(tem(html, 'op-reveal'), 'recuo do batente').toBe(sup.reveal);
    expect(tem(html, 'op-threshold'), 'soleira').toBe(sup.threshold);
    expect(tem(html, 'op-tilt-axis'), 'eixo do basculante').toBe(sup.tiltAxis);
    expect(tem(html, 'op-leaf-mat'), 'material da folha').toBe(sup.leafThickness);
    expect(tem(html, 'op-glass-kind'), 'tipo de vidro').toBe(sup.glassKind);
    expect(html.includes('A soleira vale para os dois lados'), 'aviso da soleira').toBe(sup.threshold);
  });

  it('casos medidos: giro sem soleira; porta com soleira e sem eixo; basculante com eixo e sem soleira', () => {
    expect(tem(htmlDaFamilia('door_void'), 'op-threshold')).toBe(false);
    expect(tem(htmlDaFamilia('door_swing'), 'op-threshold')).toBe(true);
    expect(tem(htmlDaFamilia('door_swing'), 'op-tilt-axis')).toBe(false);
    expect(tem(htmlDaFamilia('window_tilt'), 'op-tilt-axis')).toBe(true);
    expect(tem(htmlDaFamilia('window_tilt'), 'op-threshold')).toBe(false);
    expect(tem(htmlDaFamilia('window_fixed'), 'op-leaf-mat')).toBe(false);
    expect(tem(htmlDaFamilia('window_fixed'), 'op-glass-kind')).toBe(true);
  });
});

describe('controles novos: o recuo só aparece fora do modo "parede inteira"', () => {
  const family = familyOf('door_swing');
  const doModo = (frameDepthMode: OpeningType['frameDepthMode']): boolean =>
    tem(render({ ...nova('door_swing'), frameDepthMode }, family, 'frame'), 'op-reveal');

  it('núcleo e valor fixo mostram; parede inteira esconde', () => {
    expect(doModo('core')).toBe(true);
    expect(doModo('fixed')).toBe(true);
    expect(doModo('wall')).toBe(false);
  });
});

describe('controles novos: alterar grava o campo no tipo', () => {
  it('folha em planta e referência do tamanho removem o campo quando voltam ao padrão', () => {
    const t = nova('door_swing');
    expect(withOpeningField(t, 'leafPlan', 'both', 'open').leafPlan).toBe('both');
    expect('leafPlan' in withOpeningField(t, 'leafPlan', 'open', 'open')).toBe(false);
    expect(withOpeningField(t, 'nominalRef', 'leaf', 'opening').nominalRef).toBe('leaf');
    expect('nominalRef' in withOpeningField(t, 'nominalRef', 'opening', 'opening')).toBe(false);
  });

  it('recuo do batente: positivo grava e preserva a âncora; zero tira o campo', () => {
    const t: OpeningType = { ...nova('door_swing'), reveal: { depth: 0.02, anchor: 'core' } };
    expect(setRevealDepth(t, 0.05).reveal).toEqual({ depth: 0.05, anchor: 'core' });
    expect('reveal' in setRevealDepth(t, 0)).toBe(false);
  });

  it('soleira: tipo, altura e material', () => {
    expect(thresholdKind({})).toBe('none');
    expect(thresholdKind({ threshold: { thickness: 0.02 } })).toBe('flat');
    expect(thresholdKind({ threshold: { thickness: 0.03 } })).toBe('step');
    const comMaterial: OpeningType = { ...nova('door_swing'), threshold: { thickness: 0.02, materialId: 'mat_pedra' } };
    expect(setThresholdKind(comMaterial, 'step').threshold).toEqual({ thickness: 0.03, materialId: 'mat_pedra' });
    expect('threshold' in setThresholdKind(comMaterial, 'none')).toBe(false);
    expect(setThresholdKind(nova('door_swing'), 'flat').threshold).toEqual({ thickness: 0.02 });
    expect(setThresholdThickness(comMaterial, 0.04).threshold).toEqual({ thickness: 0.04, materialId: 'mat_pedra' });
  });

  it('eixo do basculante: excêntrico grava; central tira o campo', () => {
    const t = nova('window_tilt');
    expect(setTiltAxis(t, 0.4).tiltAxis).toBe(0.4);
    expect('tiltAxis' in setTiltAxis({ ...t, tiltAxis: 0.4 }, 0.5)).toBe(false);
  });

  it('tipo de vidro: os nove valores do schema; liso (padrão) tira o campo', () => {
    expect(GLASS_KINDS.map(([v]) => v)).toEqual(['clear', 'ribbed', 'smoke', 'green', 'bronze', 'frosted', 'wired', 'laminated', 'tempered']);
    const t = nova('window_hinged');
    expect(setGlassKind(t, 'bronze').glassKind).toBe('bronze');
    expect('glassKind' in setGlassKind({ ...t, glassKind: 'bronze' }, 'clear')).toBe(false);
  });

  it('material da folha: igual ao do batente tira o campo; diferente grava', () => {
    const t: OpeningType = { ...nova('window_hinged'), frameMaterialId: 'mat_aluminio' };
    expect(setLeafMaterialId(t, 'mat_madeira').leafMaterialId).toBe('mat_madeira');
    expect('leafMaterialId' in setLeafMaterialId({ ...t, leafMaterialId: 'mat_madeira' }, 'mat_aluminio')).toBe(false);
  });
});

describe('controles novos: o seletor mostra o valor efetivo', () => {
  it('folha em planta e referência do tamanho', () => {
    const d = nova('door_swing');
    expect(selectedValue(render(d, familyOf('door_swing'), 'plan'), 'op-leaf-plan')).toBe('open');
    expect(selectedValue(render({ ...d, leafPlan: 'both' }, familyOf('door_swing'), 'plan'), 'op-leaf-plan')).toBe('both');
    expect(selectedValue(render(d, familyOf('door_swing'), 'overview'), 'op-nominal')).toBe('opening');
    expect(selectedValue(render({ ...d, nominalRef: 'leaf' }, familyOf('door_swing'), 'overview'), 'op-nominal')).toBe('leaf');
  });

  it('soleira: nenhuma, plana e degrau; altura só quando há soleira', () => {
    const family = familyOf('door_swing');
    const d = nova('door_swing');
    expect(selectedValue(render(d, family, 'outer'), 'op-threshold')).toBe('none');
    expect(tem(render(d, family, 'outer'), 'op-threshold-h')).toBe(false);
    expect(selectedValue(render({ ...d, threshold: { thickness: 0.02 } }, family, 'outer'), 'op-threshold')).toBe('flat');
    expect(tem(render({ ...d, threshold: { thickness: 0.02 } }, family, 'outer'), 'op-threshold-h')).toBe(true);
    expect(selectedValue(render({ ...d, threshold: { thickness: 0.05 } }, family, 'outer'), 'op-threshold')).toBe('step');
  });

  it('eixo do basculante: central esconde a altura; excêntrico mostra', () => {
    const family = familyOf('window_tilt');
    const d = nova('window_tilt');
    expect(selectedValue(render(d, family, 'sashes'), 'op-tilt-axis')).toBe('central');
    expect(tem(render(d, family, 'sashes'), 'op-tilt-axis-value')).toBe(false);
    expect(selectedValue(render({ ...d, tiltAxis: 0.4 }, family, 'sashes'), 'op-tilt-axis')).toBe('eccentric');
    expect(tem(render({ ...d, tiltAxis: 0.4 }, family, 'sashes'), 'op-tilt-axis-value')).toBe(true);
  });

  it('tipo de vidro e material da folha', () => {
    const family = familyOf('window_hinged');
    const d = nova('window_hinged');
    expect(selectedValue(render(d, family, 'glazing'), 'op-glass-kind')).toBe('clear');
    expect(selectedValue(render({ ...d, glassKind: 'bronze' }, family, 'glazing'), 'op-glass-kind')).toBe('bronze');
    expect(selectedValue(render(d, family, 'glazing'), 'op-leaf-mat')).toBe('mat_aluminio');
    expect(selectedValue(render({ ...d, leafMaterialId: 'mat_madeira' }, family, 'glazing'), 'op-leaf-mat')).toBe('mat_madeira');
  });
});
