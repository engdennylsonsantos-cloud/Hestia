import { describe, expect, it } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createEmptyProject, makeLevel, type Project } from '@hestia/model';
import { RampLevelsFields, rampLevelsValue, rampRiseFromLevels, rampRiseText, type RampLevelsValue } from './RampLevelsFields.tsx';

// Térreo (0 m), Nível 2 (3 m) e Cobertura (6 m): a rampa do Térreo tem o Nível 2 logo acima.
const p: Project = {
  ...createEmptyProject(),
  levels: [
    makeLevel({ id: 'lv_0', name: 'Térreo', elevation: 0 }),
    makeLevel({ id: 'lv_1', name: 'Nível 2', elevation: 3 }),
    makeLevel({ id: 'lv_2', name: 'Cobertura', elevation: 6 }),
  ],
};

const base: RampLevelsValue = { topLevelId: null, baseOffset: 0, topOffset: 0, height: 0.8 };

/** Campo no formato da barra (`<label>` envolvendo o controle). */
const BarField = ({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) =>
  createElement('label', { htmlFor }, label, children);

const markup = (levelId: string, value: RampLevelsValue, idPrefix = 'opt-ramp'): string =>
  renderToStaticMarkup(createElement(RampLevelsFields, { project: p, levelId, idPrefix, value, onChange: () => undefined, Field: BarField }));

describe('desnível da rampa pelos níveis', () => {
  it('automático: sobe até o nível acima (Nível 2 = 3 m)', () => {
    expect(rampRiseFromLevels(p, 'lv_0', base)).toBe(3);
  });

  it('deslocamentos da base e do topo entram no desnível', () => {
    expect(rampRiseFromLevels(p, 'lv_0', { ...base, baseOffset: 0.5, topOffset: -0.2 })).toBeCloseTo(2.3, 10);
  });

  it('topo explícito (Até Cobertura) ignora o nível acima', () => {
    expect(rampRiseFromLevels(p, 'lv_0', { ...base, topLevelId: 'lv_2' })).toBe(6);
  });

  it('sem nível acima, vale a altura informada', () => {
    expect(rampRiseFromLevels(p, 'lv_2', base)).toBe(0.8);
  });
});

describe('texto do desnível', () => {
  it('usa vírgula decimal em PT e ponto em EN', () => {
    expect(rampRiseText(1.5, 'pt')).toBe('Desnível: 1,50 m');
    expect(rampRiseText(1.5, 'en')).toBe('Rise: 1.50 m');
  });
});

describe('campos de níveis da rampa', () => {
  it('lista o nível de topo ("Até Nível 2") com o nível ativo fora da lista e sem campo de altura', () => {
    const html = markup('lv_0', base);
    expect(html).toContain('Até Nível 2');
    expect(html).toContain('Até Cobertura');
    expect(html).not.toContain('Até Térreo');
    expect(html).toContain('id="opt-ramp-top"');
    expect(html).not.toContain('id="opt-ramp-height"');
  });

  it('sem nível acima e sem topo explícito mostra a altura', () => {
    const html = markup('lv_2', base);
    expect(html).toContain('id="opt-ramp-height"');
    expect(html).toContain('Nível base');
  });

  it('com topo explícito some a altura', () => {
    expect(markup('lv_2', { ...base, topLevelId: 'lv_0' })).not.toContain('id="opt-ramp-height"');
  });

  it('usa o prefixo dos ids para as propriedades (place-ramp)', () => {
    const html = markup('lv_0', base, 'place-ramp');
    expect(html).toContain('id="place-ramp-base"');
    expect(html).toContain('id="place-ramp-topoff"');
  });

  it('opções da ferramenta ausentes viram topo automático, deslocamentos zero e altura padrão', () => {
    expect(rampLevelsValue({})).toEqual(base);
    expect(rampLevelsValue({ topLevelId: 'lv_1', baseOffset: 0.3, topOffset: 0.1, height: 2 })).toEqual({ topLevelId: 'lv_1', baseOffset: 0.3, topOffset: 0.1, height: 2 });
  });
});
