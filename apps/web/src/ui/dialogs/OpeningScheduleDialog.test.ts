import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../editor/controller.ts', async () => {
  const { ProjectStore, createEmptyProject, makeWall } = await import('@hestia/model');
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  store.exec({
    type: 'addOpening',
    opening: { id: 'd1', kind: 'door', typeId: 'ot_pgiro80', hostId: 'w', offset: 1, flipHand: true, flipFacing: false, sillOverride: null, mark: '' },
  });
  return { editor: { store }, useProject: () => store.project, useProjectVersion: () => store.version };
});

import { OpeningScheduleDialog } from './OpeningScheduleDialog.tsx';

describe('quadro de portas e janelas (diálogo)', () => {
  const html = renderToStaticMarkup(createElement(OpeningScheduleDialog));

  it('as colunas novas vêm no fim da tabela, depois das áreas, na ordem da exportação', () => {
    const cabecalhos = ['Área total (m²)', 'Folha largura (m)', 'Folha altura (m)', 'Material do batente', 'Sentido', 'Material da folha', 'Ferragens'];
    let anterior = -1;
    for (const rotulo of cabecalhos) {
      const posicao = html.indexOf(rotulo);
      expect(posicao, rotulo).toBeGreaterThan(anterior);
      anterior = posicao;
    }
  });

  it('a linha mostra o sentido da instância e as ferragens da porta de giro', () => {
    expect(html).toContain('dobradiça invertida, abre à esquerda de a→b');
    expect(html).toContain('maçaneta a 1,00 m; 3 dobradiças; folga inferior 0,7 cm');
    expect(html).toContain('Madeira');
  });
});
