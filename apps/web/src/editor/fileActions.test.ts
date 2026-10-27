import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyProject } from '@hestia/model';
import { editor } from './controller.ts';
import { exportDxf } from './fileActions.ts';
import { useUi } from './state.ts';

describe('exportar DXF com a planta de cobertura ativa', () => {
  beforeEach(() => {
    editor.load(createEmptyProject(), 'teste.hestia.json');
  });

  it('recusa com mensagem clara, sem exportar a planta de piso do nível', async () => {
    useUi.setState({ view: 'plan', planKind: 'roof', status: '' });
    await exportDxf();
    expect(useUi.getState().status).toMatch(/cobertura ainda não exporta DXF/);
  });
});
