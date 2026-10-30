import { describe, expect, it } from 'vitest';
import { ProjectStore, buildTemplate, type CadDrawing } from '@hestia/model';
import { cadAciColor, cadPlanOps } from './cad.ts';
import { LIGHT } from './types.ts';

/** Projeto do teste: um CAD no térreo, com duas camadas de cores ACI diferentes, dois traços e um texto. */
function cadProject(patch: Partial<Omit<CadDrawing, 'order'>> = {}): ProjectStore {
  const store = new ProjectStore(buildTemplate('blank'));
  const cad: Omit<CadDrawing, 'order'> = {
    id: 'cad_1',
    kind: 'cad',
    levelId: 'lv_0',
    name: 'Planta do arquiteto',
    source: 'dxf',
    unit: 'm',
    layers: [
      { name: 'PAREDES', color: 1 },
      { name: 'MOBILIARIO', color: 5 },
    ],
    paths: [
      { layer: 'PAREDES', closed: true, pts: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] },
      { layer: 'MOBILIARIO', closed: false, pts: [{ x: 1, y: 1 }, { x: 2, y: 1 }] },
    ],
    texts: [{ layer: 'MOBILIARIO', at: { x: 1, y: 2 }, text: 'SALA', height: 0.2, rotation: 90 }],
    ...patch,
  };
  store.exec({ type: 'addCadDrawing', cad });
  return store;
}

describe('planta do CAD importado', () => {
  it('cada traço vira um Stroke fino na cor da camada; fechado continua fechado', () => {
    const { strokes } = cadPlanOps(cadProject().project, 'lv_0', LIGHT);
    expect(strokes).toHaveLength(2);
    expect(strokes[0]).toMatchObject({ closed: true, widthPx: 1, color: cadAciColor(1, LIGHT), alpha: 1 });
    expect(strokes[1]).toMatchObject({ closed: false, widthPx: 1, color: cadAciColor(5, LIGHT), alpha: 1 });
    expect(strokes[0]!.pts).toHaveLength(4);
  });

  it('cada texto vira um rótulo com a rotação em graus e a cor da camada', () => {
    const { labels } = cadPlanOps(cadProject().project, 'lv_0', LIGHT);
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({ text: 'SALA', at: { x: 1, y: 2 }, rotation: 90, color: cadAciColor(5, LIGHT) });
    // 0,20 m de altura de desenho, em papel de 1:100 (fontMm = altura × 10).
    expect(labels[0]!.papel).toMatchObject({ escala: 100, fontMm: 2 });
  });

  it('a cor da entidade vence a da camada; ACI 7 é a tinta do tema e ausente é a tinta fraca', () => {
    const p = cadProject({
      paths: [
        { layer: 'PAREDES', closed: false, color: 6, pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
        { layer: 'SEM_COR', closed: false, pts: [{ x: 0, y: 1 }, { x: 1, y: 1 }] },
        { layer: 'PAREDES', closed: false, color: 7, pts: [{ x: 0, y: 2 }, { x: 1, y: 2 }] },
      ],
    }).project;
    const { strokes } = cadPlanOps(p, 'lv_0', LIGHT);
    expect(strokes.map((s) => s.color)).toEqual([cadAciColor(6, LIGHT), cadAciColor(undefined, LIGHT), cadAciColor(7, LIGHT)]);
    expect(cadAciColor(7, LIGHT)).toBe(LIGHT.ink);
    expect(cadAciColor(undefined, LIGHT)).toBe(LIGHT.inkSoft);
  });

  it('desenho invisível não desenha nada', () => {
    const p = cadProject({ visible: false }).project;
    expect(cadPlanOps(p, 'lv_0', LIGHT)).toEqual({ strokes: [], labels: [] });
  });
});
