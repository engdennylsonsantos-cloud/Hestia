import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultUnits } from '@hestia/model';
import { editor } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { NumField } from '../fields.tsx';
import { UnitsDialog } from './UnitsDialog.tsx';
import { applyDraft, draftFrom } from './unitsDialogModel.ts';

const campo = (): string =>
  renderToStaticMarkup(createElement(NumField, { value: 1.2, onCommit: () => undefined, quantity: 'length' }));

afterEach(() => {
  editor.store.exec({ type: 'setSettings', patch: { units: undefined } });
  useUi.setState({ dialog: null });
});

describe('UnitsDialog', () => {
  it('renderiza título, grandezas, símbolos e rodapé', () => {
    const html = renderToStaticMarkup(createElement(UnitsDialog));
    expect(html).toContain('Unidades do projeto');
    expect(html).toContain('Comprimento pequeno (espessuras e folgas)');
    expect(html).toContain('Suprimir zeros');
    expect(html).toContain('aria-label="Símbolo decimal"');
    expect(html).toContain('aria-label="Símbolo de moeda"');
    expect(html).toContain('Exemplo ao vivo');
    expect(html).toContain('Restaurar padrões');
    expect(html).toContain('OK');
    expect(html).toContain('Cancelar');
  });

  it('abre pelo DialogKind units', () => {
    useUi.setState({ dialog: 'units' });
    expect(useUi.getState().dialog).toBe('units');
  });

  it('aplicar o rascunho troca o texto mostrado e desfazer volta num passo', () => {
    const d = draftFrom(defaultUnits());
    d.length.unit = 'cm';
    d.length.decimals = 1;
    editor.store.exec({ type: 'setSettings', patch: { units: applyDraft(d) } });
    expect(campo()).toContain('value="120"');
    expect(campo()).toContain('class="unit">cm<');
    editor.store.undo();
    expect(campo()).toContain('value="1,2"');
    expect(campo()).toContain('class="unit">m<');
  });

  it('cancelar não grava (o rascunho só muda o projeto no OK)', () => {
    const d = draftFrom(defaultUnits());
    const antes = editor.store.project.settings.units;
    d.length.unit = 'cm';
    expect(editor.store.project.settings.units).toBe(antes);
    expect(defaultUnits().length.unit).toBe('m');
  });
});
