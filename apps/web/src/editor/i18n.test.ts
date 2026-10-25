import { describe, expect, it } from 'vitest';
import { TOOL_LABEL, type ToolId } from '@hestia/tools';
import { I18N, toolLabel } from './i18n.ts';

describe('rótulos de ferramenta no idioma', () => {
  // TOOL_LABEL tem uma entrada por ToolId (o tipo obriga), então percorre todas as ferramentas.
  const ids = Object.keys(TOOL_LABEL) as ToolId[];

  it('toda ferramenta tem rótulo em português e em inglês', () => {
    const semPt = ids.filter((id) => !I18N.pt[`tool_${id}` as keyof typeof I18N.pt]);
    const semEn = ids.filter((id) => !I18N.en[`tool_${id}` as keyof typeof I18N.en]);
    expect(semPt).toEqual([]);
    expect(semEn).toEqual([]);
  });

  it('o Corte aparece como Corte (PT) e Section (EN), não como o id', () => {
    expect(toolLabel('section', 'pt')).toBe('Corte');
    expect(toolLabel('section', 'en')).toBe('Section');
  });

  it('o dicionário PT e EN têm as mesmas chaves de ferramenta', () => {
    const chaves = (d: object): string[] => Object.keys(d).filter((k) => k.startsWith('tool_')).sort();
    expect(chaves(I18N.en)).toEqual(chaves(I18N.pt));
  });
});
