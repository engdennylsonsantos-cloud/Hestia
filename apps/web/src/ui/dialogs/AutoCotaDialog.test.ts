import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { editor } from '../../editor/controller.ts';
import { AutoCotaDialog } from './AutoCotaDialog.tsx';

afterEach(() => {
  editor.store.exec({ type: 'setSettings', patch: { dimensions: undefined } });
});

describe('Cotas automáticas', () => {
  it('abre com as referências configuradas no projeto, no vocabulário unificado', () => {
    editor.store.exec({ type: 'setSettings', patch: { dimensions: { wallRef: 'coreFace', openingRef: 'clear' } } });
    const html = renderToStaticMarkup(createElement(AutoCotaDialog));
    expect(html).toContain('value="coreFace" selected=""');
    expect(html).toContain('value="clear" selected=""');
    expect(html).toContain('Face do núcleo');
    expect(html).toContain('Vão livre');
    expect(html).not.toContain('Faces externas');
    expect(html).not.toContain('Arestas do vão');
  });
});
