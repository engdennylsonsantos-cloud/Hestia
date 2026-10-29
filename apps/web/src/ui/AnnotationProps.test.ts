import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectStore, areaPlanOf, createEmptyProject, levelDimensions, levelTexts, makeWall, planAnnotationsOf, type Dimension } from '@hestia/model';
import { createAreaPlanAction } from '../editor/areaPlanActions.ts';
import { editor } from '../editor/controller.ts';
import { deleteSelectionIn } from '../editor/deleteIds.ts';
import { useUi } from '../editor/state.ts';
import { AnnotationProps, selectedNote, updateTextIn } from './AnnotationProps.tsx';

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

  it('excluir texto e nada mais: a seleção sem elementos não quebra', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addText', levelId: LV0, text: { id: 't1', at: { x: 1, y: 1 }, text: 'X', height: 2.5, rotation: 0 } });
    useUi.setState({ selection: ['t1', 'nao_existe'], levelId: LV0 });
    deleteSelectionIn(s);
    expect(levelTexts(s.project, LV0)).toHaveLength(0);
  });
});

describe('anotações da planta de área no painel', () => {
  it('selectedNote com planId acha cota/texto da planta e não os do nível', () => {
    const s = new ProjectStore(createEmptyProject());
    const planId = createAreaPlanAction(s, LV0);
    s.exec({ type: 'addDimension', levelId: LV0, planId, dimension: { id: 'dp', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 } });
    s.exec({ type: 'addText', levelId: LV0, planId, text: { id: 'tp', at: { x: 1, y: 1 }, text: 'Depósito', height: 2.5, rotation: 0 } });
    s.exec({ type: 'addText', levelId: LV0, text: { id: 'tl', at: { x: 2, y: 2 }, text: 'Piso', height: 2.5, rotation: 0 } });
    const p = s.project;
    expect(selectedNote(p, LV0, ['dp'], planId)?.dim?.id).toBe('dp');
    expect(selectedNote(p, LV0, ['tp'], planId)?.text?.id).toBe('tp');
    // Sem planId procura no nível: o texto da planta não aparece e o do nível, sim.
    expect(selectedNote(p, LV0, ['tp'])).toBeNull();
    expect(selectedNote(p, LV0, ['tl'], planId)).toBeNull();
    expect(selectedNote(p, LV0, ['tl'])?.text?.id).toBe('tl');
  });

  it('editar texto da planta grava em plan.annotations, não no nível', () => {
    const s = new ProjectStore(createEmptyProject());
    const planId = createAreaPlanAction(s, LV0);
    s.exec({ type: 'addText', levelId: LV0, planId, text: { id: 'tp', at: { x: 1, y: 1 }, text: 'Antes', height: 2.5, rotation: 0 } });
    updateTextIn(s, LV0, 'tp', { text: 'Depois\nda obra', width: 45, frame: true }, planId);
    const plano = planAnnotationsOf(areaPlanOf(s.project, planId)!).texts;
    expect(plano).toHaveLength(1);
    expect(plano[0]).toMatchObject({ text: 'Depois\nda obra', width: 45, frame: true });
    expect(levelTexts(s.project, LV0)).toHaveLength(0);
  });

  it('excluir na planta de área remove a anotação da planta e não apaga o modelo', () => {
    const s = new ProjectStore(createEmptyProject());
    const planId = createAreaPlanAction(s, LV0);
    s.exec({ type: 'addText', levelId: LV0, planId, text: { id: 'tp', at: { x: 1, y: 1 }, text: 'Depósito', height: 2.5, rotation: 0 } });
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: LV0, a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, locationLine: 'finishInterior' }) });
    useUi.setState({ view: 'plan', planKind: 'area', areaPlanId: planId, levelId: LV0, selection: ['tp', 'w1'] });
    deleteSelectionIn(s);
    expect(planAnnotationsOf(areaPlanOf(s.project, planId)!).texts).toHaveLength(0);
    expect(s.project.elements['w1']).toBeDefined();
    expect(useUi.getState().selection).toEqual([]);
    s.undo();
    expect(planAnnotationsOf(areaPlanOf(s.project, planId)!).texts).toHaveLength(1);
  });

  it('o valor da cota e a unidade seguem as unidades do projeto', () => {
    editor.store.exec({ type: 'setSettings', patch: { units: { length: { unit: 'cm', decimals: 1 } } } });
    const dim: Dimension = { id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 };
    const html = renderToStaticMarkup(createElement(AnnotationProps, { dim }));
    expect(html).toContain('400,0 cm');
    expect(html).toContain('value="project" selected=""');
  });
});
