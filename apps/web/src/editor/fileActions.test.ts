import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyProject } from '@hestia/model';
import { editor } from './controller.ts';
import { exportDxf } from './fileActions.ts';
import { useUi } from './state.ts';

describe('exportar DXF', () => {
  beforeEach(() => {
    editor.load(createEmptyProject(), 'teste.hestia.json');
  });

  it('abre o diálogo do lote (desenhos e pranchas) em vez de salvar direto', async () => {
    useUi.setState({ dialog: null });
    await exportDxf();
    expect(useUi.getState().dialog).toBe('dxfLayers');
  });
});
