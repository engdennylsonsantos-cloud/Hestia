import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_DISJOIN } from '@hestia/tools';
import { DEFAULT_OPTIONS } from '../editor/state.ts';
import { DISJOIN_HINT, DisjoinCheck } from './DisjoinCheck.tsx';

const caixa = (id: string, checked: boolean): string =>
  renderToStaticMarkup(createElement(DisjoinCheck, { id, checked, onChange: () => undefined }));

describe('opção Desconectar', () => {
  it('padrões do app: Mover e Espelhar acompanham; Rotacionar é livre', () => {
    expect(DEFAULT_OPTIONS.moveDisjoin).toBe(false);
    expect(DEFAULT_OPTIONS.rotateDisjoin).toBe(true);
    expect(DEFAULT_OPTIONS.mirrorDisjoin).toBe(false);
    expect(DEFAULT_DISJOIN).toEqual({ move: false, rotate: true, mirror: false });
  });

  it('renderiza a caixa com a dica curta, marcada ou desmarcada', () => {
    for (const id of ['opt-mdisjoin', 'opt-rdisjoin', 'opt-mirrordisjoin']) {
      const m = caixa(id, true);
      expect(m).toContain(`id="${id}"`);
      expect(m).toContain('type="checkbox"');
      expect(m).toContain('Desconectar');
      expect(m).toContain(DISJOIN_HINT);
      expect(m).toContain('checked=""');
    }
    expect(caixa('opt-mdisjoin', false)).not.toContain('checked=""');
  });
});
