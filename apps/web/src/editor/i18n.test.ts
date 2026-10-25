import { describe, expect, it } from 'vitest';
import { TOOL_LABEL } from '@hestia/tools';
import { I18N, toolLabel } from './i18n.ts';

describe('rótulos de ferramenta', () => {
  // TOOL_LABEL é Record<ToolId, string>: suas chaves são todos os ToolIds do registro.
  const ids = Object.keys(TOOL_LABEL) as Array<keyof typeof TOOL_LABEL>;

  it('todo ToolId tem rótulo em PT e EN (tool_<id>), sem cair no id cru', () => {
    for (const id of ids) {
      expect(I18N.pt[`tool_${id}` as keyof typeof I18N.pt], `pt tool_${id}`).toBeTruthy();
      expect(I18N.en[`tool_${id}` as keyof typeof I18N.en], `en tool_${id}`).toBeTruthy();
      expect(toolLabel(id, 'en')).not.toBe(id);
    }
  });

  it('o Corte aparece como "Corte" em PT e "Section" em EN', () => {
    expect(toolLabel('section', 'pt')).toBe('Corte');
    expect(toolLabel('section', 'en')).toBe('Section');
  });

  it('Extrusão de telhado e Separador de ambiente têm rótulo nos dois idiomas', () => {
    expect(toolLabel('roofextrusion', 'pt')).toBe('Extrusão de telhado');
    expect(toolLabel('roofextrusion', 'en')).toBe('Roof by Extrusion');
    expect(toolLabel('roomsep', 'en')).toBe('Room Separator');
  });
});

describe('dicionário PT/EN', () => {
  it('toda chave de PT existe em EN e vice-versa', () => {
    const pt = Object.keys(I18N.pt).sort();
    const en = Object.keys(I18N.en).sort();
    expect(en).toEqual(pt);
  });
});
