import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildTemplate } from '@hestia/model';
import { editor } from '../editor/controller.ts';
import { TypePreview } from './TypePreview.tsx';

const projeto = buildTemplate('house2');
const parede = Object.values(projeto.wallTypes)[0]!;

const paredeHtml = (): string =>
  renderToStaticMarkup(createElement(TypePreview, { subject: { kind: 'wall', type: parede, materials: projeto.materials } }));

afterEach(() => {
  editor.store.exec({ type: 'setSettings', patch: { units: undefined } });
});

describe('TypePreview com unidades do projeto', () => {
  it('mostra a espessura em cm no padrão', () => {
    expect(paredeHtml()).toContain('cm');
  });

  it('acompanha unidades não padrão (mm e pés)', () => {
    editor.store.exec({ type: 'setSettings', patch: { units: { smallLength: { unit: 'mm', decimals: 0 } } } });
    expect(paredeHtml()).toContain('mm');
    editor.store.exec({ type: 'setSettings', patch: { units: { smallLength: { unit: 'ft', decimals: 3 } } } });
    expect(paredeHtml()).toContain('ft');
  });
});
