import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultUnits, resolveUnits } from '@hestia/model';
import { editor } from '../editor/controller.ts';
import { NumField, formatQuantityField, parseQuantityField, quantityStep } from './fields.tsx';

const cm = resolveUnits({ length: { unit: 'cm', decimals: 2 }, smallLength: { unit: 'cm', decimals: 1 } });
const pes = resolveUnits({ length: { unit: 'ft-in', decimals: 2, denominator: 16 } });

const campo = (value: number | null, quantity: 'length' | 'smallLength'): string =>
  renderToStaticMarkup(createElement(NumField, { value, onCommit: () => undefined, quantity }));

afterEach(() => {
  editor.store.exec({ type: 'setSettings', patch: { units: undefined } });
});

describe('formatQuantityField e parseQuantityField', () => {
  it('exibe até 4 casas sem zeros à direita', () => {
    expect(formatQuantityField(cm, 'length', 1.2, false)).toBe('120');
    expect(formatQuantityField(defaultUnits(), 'length', 1.2, false)).toBe('1,2');
    expect(formatQuantityField(defaultUnits(), 'length', 1.23456, false)).toBe('1,2346');
    expect(formatQuantityField(defaultUnits(), 'length', null, false)).toBe('');
    expect(formatQuantityField(defaultUnits(), 'length', 1.2, true)).toBe('');
  });

  it('lê número simples, com unidade e expressão', () => {
    expect(parseQuantityField(cm, 'length', '120')).toBeCloseTo(1.2, 12);
    expect(parseQuantityField(defaultUnits(), 'length', '120cm')).toBeCloseTo(1.2, 12);
    expect(parseQuantityField(defaultUnits(), 'length', '1,2m')).toBeCloseTo(1.2, 12);
    expect(parseQuantityField(cm, 'length', '60+60')).toBeCloseTo(1.2, 12);
  });

  it('texto inválido não devolve valor (o campo mantém o anterior)', () => {
    expect(parseQuantityField(defaultUnits(), 'length', 'abc')).toBeNull();
    expect(parseQuantityField(defaultUnits(), 'length', '')).toBeNull();
  });
});

describe('quantityStep', () => {
  it('usa 1 unidade do último dígito exibido', () => {
    expect(quantityStep(cm, 'length', '120')).toBeCloseTo(0.01, 12);
    expect(quantityStep(defaultUnits(), 'length', '1,2')).toBeCloseTo(0.1, 12);
    expect(quantityStep(defaultUnits(), 'currency', '1250,50')).toBeCloseTo(0.01, 12);
  });

  it('em pés e polegadas usa uma fração do denominador', () => {
    expect(quantityStep(pes, 'length', `5' 6"`)).toBeCloseTo(0.3048 / 192, 12);
  });
});

describe('NumField com quantity', () => {
  it('mostra 1,2 m como 120 na unidade cm', () => {
    editor.store.exec({ type: 'setSettings', patch: { units: { length: { unit: 'cm', decimals: 2 } } } });
    const html = campo(1.2, 'length');
    expect(html).toContain('value="120"');
    expect(html).toContain('class="unit">cm<');
  });

  it('smallLength padrão mostra cm', () => {
    const html = campo(0.015, 'smallLength');
    expect(html).toContain('value="1,5"');
    expect(html).toContain('class="unit">cm<');
  });

  it('em pés e polegadas o valor já traz a unidade, sem sufixo solto', () => {
    editor.store.exec({ type: 'setSettings', patch: { units: { length: { unit: 'ft-in', decimals: 2 } } } });
    const html = campo(1.6764, 'length');
    expect(html).not.toContain('class="unit"');
  });

  it('sem quantity mostra número puro com casas e sufixo técnico', () => {
    const html = renderToStaticMarkup(
      createElement(NumField, { value: 1.2, onCommit: () => undefined, suffix: 'cm', decimals: 1 }),
    );
    expect(html).toContain('value="1,2"');
    expect(html).toContain('class="unit">cm<');
  });
});
