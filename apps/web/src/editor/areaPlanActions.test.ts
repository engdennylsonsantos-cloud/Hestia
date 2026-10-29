import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { areaPlanOf, createEmptyProject, DEFAULT_AREA_GRAPHICS, DEFAULT_TAG_FIELDS, makeRoom, makeWall, ProjectStore, type AreaPlan } from '@hestia/model';
import { addMissingTagsAction, applyColorSchemeAction, createAreaPlanAction, createGeneralAreaSheetAction, moveRoomLabelAction, openAreaPlan, recenterTagsAction, setPlanGraphicsAction } from './areaPlanActions.ts';

const ring = (pts: Array<[number, number]>): Vec2[] => pts.map(([x, y]) => ({ x, y }));

function store(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const pts = ring([[0, 0], [0, 5], [4, 5], [4, 0]]);
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior' }) });
  });
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 } }) });
  return s;
}

describe('ações da planta de área', () => {
  it('cria a planta sem nenhuma etiqueta armazenada (o rótulo é derivado do ambiente)', () => {
    const s = store();
    const id = createAreaPlanAction(s, 'lv_0');
    const plan = areaPlanOf(s.project, id)!;
    expect(plan.tags).toHaveLength(0);
  });

  it('etiquetar sem etiqueta materializa uma etiqueta editável', () => {
    const s = store();
    const id = createAreaPlanAction(s, 'lv_0');
    expect(addMissingTagsAction(s, id)).toBe(1);
    expect(areaPlanOf(s.project, id)!.tags).toHaveLength(1);
  });

  it('arrastar para fora e voltar move o rótulo do ambiente (posição compartilhada)', () => {
    const s = store();
    const id = createAreaPlanAction(s, 'lv_0');
    moveRoomLabelAction(s, 'r1', { x: 8, y: 8 });
    expect((s.project.elements.r1 as { labelPosition?: { x: number } }).labelPosition).toEqual({ x: 8, y: 8 });
    expect(areaPlanOf(s.project, id)!.tags).toHaveLength(0);
  });

  it('recentralizar devolve ao centro', () => {
    const s = store();
    const id = createAreaPlanAction(s, 'lv_0');
    moveRoomLabelAction(s, 'r1', { x: 8, y: 8 });
    recenterTagsAction(s, id);
    expect((s.project.elements.r1 as { labelPosition?: unknown }).labelPosition).toBeUndefined();
  });

  it('esquema de cores cria legenda e quadro e liga o preenchimento', () => {
    const s = store();
    const id = createAreaPlanAction(s, 'lv_0');
    applyColorSchemeAction(s, id, 'category');
    const plan = areaPlanOf(s.project, id)!;
    expect(plan.schemeId).toBe(`cs_${id}`);
    expect(plan.graphics.fill).toBe('scheme');
    expect(plan.legend).toBeTruthy();
    expect(plan.table).toBeTruthy();
  });

  it('alterar gráficos não muda a área', () => {
    const s = store();
    const id = createAreaPlanAction(s, 'lv_0');
    setPlanGraphicsAction(s, id, { showWalls: 'hidden', referenceLines: 'never' });
    expect(areaPlanOf(s.project, id)!.graphics.showWalls).toBe('hidden');
    expect((s.project.elements.r1 as { point: { x: number; y: number } }).point).toEqual({ x: 2, y: 2.5 });
  });

  it('prancha geral recebe a vista da planta e o quadro geral', () => {
    const s = store();
    const id = createAreaPlanAction(s, 'lv_0');
    const sheetId = createGeneralAreaSheetAction(s, [id]);
    const sheet = s.project.sheets?.find((x) => x.id === sheetId);
    expect(sheet?.viewports.map((v) => v.view.kind)).toEqual(['areaPlan', 'areaTable']);
    expect(sheet?.viewports[0]!.view).toEqual({ kind: 'areaPlan', planId: id });
    expect(sheet?.name).toBe('Plantas de área');
  });

  it('nasce com as anotações do nível copiadas, com ids novos', () => {
    const s = store();
    s.exec({ type: 'addDimension', levelId: 'lv_0', dimension: { id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1, precision: 2 } });
    s.exec({ type: 'addText', levelId: 'lv_0', text: { id: 't1', at: { x: 1, y: 1 }, text: 'Sala', height: 2.5, rotation: 0 } });
    // Linha de detalhe e etiqueta também acompanham a cópia.
    s.exec({ type: 'addDetailLine', levelId: 'lv_0', item: { id: 'dl1', a: { x: 0, y: 0 }, b: { x: 1, y: 1 } } });
    s.exec({ type: 'addTag', levelId: 'lv_0', item: { id: 'tag1', hostId: 'r1', at: { x: 1, y: 1 }, property: 'name' } });
    const id = createAreaPlanAction(s, 'lv_0');
    const plan = areaPlanOf(s.project, id)!;
    expect(plan.annotations?.dimensions).toHaveLength(1);
    expect(plan.annotations?.dimensions[0]!.id).not.toBe('d1');
    expect(plan.annotations?.texts[0]!.text).toBe('Sala');
    expect(plan.annotations?.detailLines).toHaveLength(1);
    expect(plan.annotations?.tags).toHaveLength(1);
    // O nível continua com as dele.
    expect(s.project.levels[0]!.dimensions).toHaveLength(1);
    expect(s.project.levels[0]!.texts).toHaveLength(1);
  });

  it('abrir planta antiga (sem annotations) semeia a anotação do nível num passo', () => {
    const s = store();
    s.exec({ type: 'addText', levelId: 'lv_0', text: { id: 't1', at: { x: 1, y: 1 }, text: 'Antigo', height: 2.5, rotation: 0 } });
    const plan: AreaPlan = {
      id: 'ap_old',
      name: 'Planta antiga',
      levelId: 'lv_0',
      scale: 50,
      graphics: { ...DEFAULT_AREA_GRAPHICS, tagDefault: { ...DEFAULT_AREA_GRAPHICS.tagDefault, fields: [...DEFAULT_TAG_FIELDS] } },
      tags: [],
    };
    s.exec({ type: 'addAreaPlan', plan });
    expect(areaPlanOf(s.project, 'ap_old')!.annotations).toBeUndefined();
    const version = s.version;
    openAreaPlan(s, 'ap_old');
    expect(areaPlanOf(s.project, 'ap_old')!.annotations?.texts[0]!.text).toBe('Antigo');
    expect(areaPlanOf(s.project, 'ap_old')!.graphics.showAnnotations).toBe(true);
    // Semear + abrir não mexe no nível e é um só passo de desfazer.
    expect(s.project.levels[0]!.texts).toHaveLength(1);
    expect(s.version).toBeGreaterThan(version);
    s.undo();
    expect(areaPlanOf(s.project, 'ap_old')!.annotations).toBeUndefined();
  });
});
