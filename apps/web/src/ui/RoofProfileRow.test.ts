import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRoof, type Roof } from '@hestia/model';
import { editor } from '../editor/controller.ts';
import { RoofProfileRow } from './RoofProfileRow.tsx';

const telhado: Roof = {
  ...makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] }),
  order: 0,
  profile: [{ t: 0, z: 0 }, { t: 2, z: 2 }],
};

const html = (): string => renderToStaticMarkup(createElement(RoofProfileRow, { roof: telhado }));

afterEach(() => {
  editor.store.exec({ type: 'setSettings', patch: { units: undefined } });
});

describe('resumo do perfil do telhado nas unidades do projeto', () => {
  it('usa metros no padrão', () => {
    expect(html()).toContain('altura máx. 2,00 m');
  });

  it('acompanha unidades não padrão (centímetros)', () => {
    editor.store.exec({ type: 'setSettings', patch: { units: { length: { unit: 'cm', decimals: 1 } } } });
    expect(html()).toContain('altura máx. 200,0 cm');
  });
});
