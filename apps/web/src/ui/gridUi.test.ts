import { describe, expect, it } from 'vitest';
import { createEmptyProject, DEFAULT_GRID_TYPE_ID, type Grid, type GridType } from '@hestia/model';
import { camposDoSegmento, copiaDoTipo, gradeDaSelecao, gridToolOf } from './gridUi.ts';

const grade = (over: Partial<Grid> = {}): Grid => ({
  id: 'g1',
  name: '1',
  typeId: DEFAULT_GRID_TYPE_ID,
  points: [{ x: 0, y: 0 }, { x: 5, y: 0 }],
  sag: 0,
  bubbleStart: false,
  bubbleEnd: true,
  order: 0,
  ...over,
});

describe('opções da ferramenta Grade', () => {
  it('sem opção gravada: linha e o tipo padrão', () => {
    expect(gridToolOf({}, createEmptyProject())).toEqual({ mode: 'line', typeId: DEFAULT_GRID_TYPE_ID });
  });

  it('mantém o modo e o tipo gravados quando o tipo existe', () => {
    expect(gridToolOf({ grid: { mode: 'multi', typeId: DEFAULT_GRID_TYPE_ID } }, createEmptyProject())).toEqual({ mode: 'multi', typeId: DEFAULT_GRID_TYPE_ID });
  });

  it('tipo gravado que sumiu do projeto cai no padrão', () => {
    expect(gridToolOf({ grid: { mode: 'arc', typeId: 'gt_sumiu' } }, createEmptyProject())).toEqual({ mode: 'arc', typeId: DEFAULT_GRID_TYPE_ID });
  });
});

describe('campos do tipo conforme o segmento central', () => {
  it("'continuous': sem pontas nem centro próprio (a linha é uma coisa só)", () => {
    expect(camposDoSegmento('continuous')).toEqual({ pontas: false, centro: false });
  });

  it("'none': pontas, sem centro", () => {
    expect(camposDoSegmento('none')).toEqual({ pontas: true, centro: false });
  });

  it("'custom': pontas e centro", () => {
    expect(camposDoSegmento('custom')).toEqual({ pontas: true, centro: true });
  });
});

describe('cópia de tipo', () => {
  const base: GridType = {
    id: 'gt_6mm',
    name: 'Bolha 6 mm',
    centerSegment: 'continuous',
    endLengthMm: 25,
    weightMm: 0.25,
    color: null,
    pattern: 'dashdot',
    centerWeightMm: 0.18,
    centerColor: null,
    centerPattern: 'dashdot',
    bubbleDiameterMm: 8,
    bubbleTextMm: 3,
  };

  it('tem outro id e "(cópia)" no nome, e não mexe no original', () => {
    const c = copiaDoTipo(base);
    expect(c.id).not.toBe(base.id);
    expect(c.name).toBe('Bolha 6 mm (cópia)');
    expect(base.name).toBe('Bolha 6 mm');
    expect({ ...c, id: base.id, name: base.name }).toEqual(base);
  });
});

describe('grade selecionada', () => {
  it('uma grade existente, selecionada sozinha', () => {
    const p = { ...createEmptyProject(), grids: [grade()] };
    expect(gradeDaSelecao(p, ['g1'])?.name).toBe('1');
  });

  it('seleção vazia, mista ou de id que não é grade: nenhuma', () => {
    const p = { ...createEmptyProject(), grids: [grade()] };
    expect(gradeDaSelecao(p, [])).toBeUndefined();
    expect(gradeDaSelecao(p, ['g1', 'g1'])).toBeUndefined();
    expect(gradeDaSelecao(p, ['parede_x'])).toBeUndefined();
  });
});
