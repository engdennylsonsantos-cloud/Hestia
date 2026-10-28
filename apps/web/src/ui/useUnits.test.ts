import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultUnits } from '@hestia/model';
import { editor } from '../editor/controller.ts';
import { currentUnits, useFormat, useUnits } from './useUnits.ts';

function Amostra(): ReturnType<typeof createElement> {
  const units = useUnits();
  const format = useFormat();
  return createElement('span', null, `${format('length', 1.2)}|${units.length.unit}`);
}

const html = (): string => renderToStaticMarkup(createElement(Amostra));

afterEach(() => {
  editor.store.exec({ type: 'setSettings', patch: { units: undefined } });
});

describe('useUnits', () => {
  it('começa com os padrões e formata na unidade do projeto', () => {
    expect(html()).toBe('<span>1,20 m|m</span>');
    expect(currentUnits()).toBe(defaultUnits());
  });

  it('mudar settings.units troca o texto produzido', () => {
    editor.store.exec({ type: 'setSettings', patch: { units: { length: { unit: 'cm', decimals: 1 } } } });
    expect(html()).toBe('<span>120,0 cm|cm</span>');
    expect(currentUnits().length.unit).toBe('cm');
  });

  it('outra edição do projeto mantém a referência das unidades', () => {
    editor.store.exec({ type: 'setSettings', patch: { units: { length: { unit: 'cm', decimals: 1 } } } });
    const antes = currentUnits();
    editor.store.exec({ type: 'setSettings', patch: { showTags: true } });
    expect(currentUnits()).toBe(antes);
  });
});
