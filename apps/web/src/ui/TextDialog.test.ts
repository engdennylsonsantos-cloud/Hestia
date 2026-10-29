import { describe, expect, it } from 'vitest';
import { areaPlanOf, createEmptyProject, levelTexts, planAnnotationsOf, ProjectStore } from '@hestia/model';
import { createAreaPlanAction } from '../editor/areaPlanActions.ts';
import { centroDaVista, comandoCaixaDeTexto } from './dialogs/TextDialog.tsx';

const LV0 = 'lv_0';

describe('caixa de texto (ação pura do diálogo)', () => {
  it('cria TextNote com moldura, largura, quebra de linha e o planId da planta de área', () => {
    const cmd = comandoCaixaDeTexto(
      { levelId: LV0, planId: 'ap1' },
      { x: 2, y: 3 },
      { text: 'Sala\nde estar', height: 3, width: 40, frame: true, rotation: 15, align: 'center' },
    );
    expect(cmd).toMatchObject({
      type: 'addText',
      levelId: LV0,
      planId: 'ap1',
      text: { at: { x: 2, y: 3 }, text: 'Sala\nde estar', height: 3, width: 40, frame: true, rotation: 15, align: 'center' },
    });
  });

  it('sem planta de área não leva planId (texto do nível) e texto vazio não cria nada', () => {
    const cmd = comandoCaixaDeTexto({ levelId: LV0 }, { x: 0, y: 0 }, { text: 'Nota', height: 2.5, frame: false, rotation: 0 });
    expect(cmd).not.toBeNull();
    expect(cmd).not.toHaveProperty('planId');
    expect(comandoCaixaDeTexto({ levelId: LV0 }, { x: 0, y: 0 }, { text: '   ', height: 2.5, frame: false, rotation: 0 })).toBeNull();
  });

  it('executado na planta de área grava em plan.annotations, não no nível', () => {
    const s = new ProjectStore(createEmptyProject());
    const planId = createAreaPlanAction(s, LV0);
    const cmd = comandoCaixaDeTexto(
      { levelId: LV0, planId },
      { x: 1, y: 2 },
      { text: 'Depósito', height: 2.5, width: 30, frame: true, rotation: 0, align: 'left' },
    )!;
    s.exec(cmd);
    expect(planAnnotationsOf(areaPlanOf(s.project, planId)!).texts).toHaveLength(1);
    expect(levelTexts(s.project, LV0)).toHaveLength(0);
    expect(planAnnotationsOf(areaPlanOf(s.project, planId)!).texts[0]).toMatchObject({ frame: true, width: 30 });
  });

  it('centro da vista usa o centro do viewport e, sem ele, o centro da caixa do nível', () => {
    expect(centroDaVista({ cx: 4, cy: 5 }, { minX: 0, minY: 0, maxX: 10, maxY: 10 })).toEqual({ x: 4, y: 5 });
    expect(centroDaVista(null, { minX: 2, minY: 4, maxX: 6, maxY: 10 })).toEqual({ x: 4, y: 7 });
  });
});
