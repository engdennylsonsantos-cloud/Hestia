import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectStore, createEmptyProject, levelDimensions, levelTexts, type Dimension } from '@hestia/model';
import { editor } from '../editor/controller.ts';
import { deleteSelectionIn } from '../editor/deleteIds.ts';
import { useUi } from '../editor/state.ts';
import { AnnotationProps, selectedNote } from './AnnotationProps.tsx';

// O painel real assina o projeto pelo editor; no teste basta o projeto atual (sem `getServerSnapshot` no render de servidor).
vi.mock('../editor/controller.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor/controller.ts')>();
  return { ...actual, useProject: () => actual.editor.project };
});

afterEach(() => {
  editor.store.exec({ type: 'setSettings', patch: { units: undefined } });
});

const LV0 = 'lv_0';

describe('seleção de anotação no painel de propriedades', () => {
  it('reconhece a cota e o texto selecionados pelo id no nível ativo', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 } });
    s.exec({ type: 'addText', levelId: LV0, text: { id: 't1', at: { x: 1, y: 1 }, text: 'Sala', height: 2.5, rotation: 0 } });
    expect(selectedNote(s.project, LV0, ['d1'])?.dim?.id).toBe('d1');
    expect(selectedNote(s.project, LV0, ['t1'])?.text?.text).toBe('Sala');
    expect(selectedNote(s.project, LV0, ['d1', 't1'])).toBeNull();
    expect(selectedNote(s.project, 'lv_outro', ['d1'])).toBeNull();
    expect(selectedNote(s.project, LV0, [])).toBeNull();
  });

  it('excluir a seleção remove a cota pelo próprio comando e volta com o desfazer', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 } });
    useUi.setState({ selection: ['d1'], levelId: LV0 });
    deleteSelectionIn(s);
    expect(levelDimensions(s.project, LV0)).toHaveLength(0);
    expect(useUi.getState().selection).toEqual([]);
    s.undo();
    expect(levelDimensions(s.project, LV0)).toHaveLength(1);
  });

  it('o valor da cota e a unidade seguem as unidades do projeto', () => {
    editor.store.exec({ type: 'setSettings', patch: { units: { length: { unit: 'cm', decimals: 1 } } } });
    const dim: Dimension = { id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 };
    const html = renderToStaticMarkup(createElement(AnnotationProps, { dim }));
    expect(html).toContain('400,0 cm');
    expect(html).toContain('value="project" selected=""');
  });

  it('excluir texto e nada mais: a seleção sem elementos não quebra', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addText', levelId: LV0, text: { id: 't1', at: { x: 1, y: 1 }, text: 'X', height: 2.5, rotation: 0 } });
    useUi.setState({ selection: ['t1', 'nao_existe'], levelId: LV0 });
    deleteSelectionIn(s);
    expect(levelTexts(s.project, LV0)).toHaveLength(0);
  });
});
