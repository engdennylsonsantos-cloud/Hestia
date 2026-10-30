import { beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_STAIR_TYPES, type StairType } from '@hestia/model';
import { I18N, useI18n } from '../../editor/i18n.ts';
import { StairBlondelCard } from './StairBlondelCard.tsx';

const base = (over: Partial<StairType> = {}): StairType => ({ ...structuredClone(DEFAULT_STAIR_TYPES[0]!), ...over });
const render = (type: StairType, heightCm: number): string =>
  renderToStaticMarkup(createElement(StairBlondelCard, { type, heightCm }));

beforeEach(() => {
  // No render de servidor o zustand lê `getInitialState`: ajusta os dois para o teste poder trocar de idioma.
  useI18n.getInitialState().lang = 'pt';
  useI18n.setState({ lang: 'pt' });
});

describe('cartão da fórmula de Blondel', () => {
  it('mostra a fórmula, a conta ao vivo e o resultado com o tipo padrão e 300 cm', () => {
    const html = render(base(), 300);
    expect(html).toContain('2·R + T = 63,0 cm');
    expect(html).toContain('N = 17');
    expect(html).toContain('17,6');
    expect(html).toContain('27,8');
    expect(html).toContain('28,0');
    expect(html).toContain('2 × 17,6 + 28,0 = 63,2 cm');
    expect(html).toContain('✓');
  });

  it('com altura zero mostra a instrução de valores válidos', () => {
    expect(render(base(), 0)).toContain(I18N.pt.stt_bl_invalid);
  });

  it('no estilo poste destaca a nota de caracol e linha de caminhada', () => {
    expect(render(base({ runStyle: 'post' }), 300)).toContain(I18N.pt.stt_bl_note_curved);
  });

  it('traduz título e resultado em inglês', () => {
    useI18n.getInitialState().lang = 'en';
    useI18n.setState({ lang: 'en' });
    const html = render(base(), 300);
    expect(html).toContain('Blondel formula');
    expect(html).toContain('63.2 cm');
  });

  it('todas as chaves stt_bl_* existem em pt e en', () => {
    const keys = (dict: object): string[] => Object.keys(dict).filter((k) => k.startsWith('stt_bl_')).sort();
    expect(keys(I18N.pt)).toEqual(keys(I18N.en));
  });
});
