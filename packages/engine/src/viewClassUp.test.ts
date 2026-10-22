import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW_RANGE, ProjectStore, createEmptyProject, makeCeiling, makeFloor, makeWall, type ViewRange } from '@hestia/model';
import { classifyLevelEntries, classifyLevelForView, viewClassOf } from './viewClass.ts';
import { viewRangeWarnings } from './viewWarnings.ts';

/** Planta de forro (decisão 0021): mesma faixa, direção para cima. */
const UP: ViewRange = { ...DEFAULT_VIEW_RANGE, direction: 'up' };
const sq = (s: number) => [
  { x: 0, y: 0 },
  { x: s, y: 0 },
  { x: s, y: s },
  { x: 0, y: s },
];

describe('viewClassOf na direção para cima', () => {
  it('forro acima do corte aparece, mesmo acima do topo padrão (2,30 m)', () => {
    expect(viewClassOf(DEFAULT_VIEW_RANGE, 0, 2.5, 2.6)).toBe('hidden');
    expect(viewClassOf(UP, 0, 2.5, 2.6)).toBe('projection-above');
  });

  it('o que fica abaixo do corte não aparece na planta de forro', () => {
    expect(viewClassOf(UP, 0, 0, 0.15)).toBe('hidden');
    expect(viewClassOf(UP, 0, 0.1, 0.5)).toBe('hidden');
  });

  it('parede que atravessa o corte é cortada', () => {
    expect(viewClassOf(UP, 0, 0, 2.8)).toBe('cut');
    expect(viewClassOf(UP, 2, 2.1, 4.8)).toBe('cut');
  });

  it('sem limite superior: a base e a profundidade não entram na vista de cima', () => {
    expect(viewClassOf({ ...UP, bottom: 0.5, depth: -1 }, 0, 0.2, 0.9)).toBe('hidden');
  });
});

describe('classifyLevelForView conforme a direção', () => {
  function build(): ProjectStore {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c', typeId: 'ct_gesso', levelId: 'lv_0', boundary: sq(3) }) });
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_laje12', levelId: 'lv_0', boundary: sq(3) }) });
    return s;
  }

  it('o forro só aparece na planta de forro', () => {
    const s = build();
    expect(classifyLevelForView(s.project, 'lv_0', DEFAULT_VIEW_RANGE).get('c')).toBe('hidden');
    expect(classifyLevelForView(s.project, 'lv_0', UP).get('c')).toBe('projection-above');
  });

  it('o piso abaixo do corte sai da planta de forro e continua na planta baixa', () => {
    const s = build();
    expect(classifyLevelForView(s.project, 'lv_0', UP).get('f')).toBe('hidden');
    expect(classifyLevelForView(s.project, 'lv_0', DEFAULT_VIEW_RANGE).get('f')).toBe('projection-below');
  });

  it('a categoria do forro é "ceiling"', () => {
    const s = build();
    expect(classifyLevelEntries(s.project, 'lv_0', UP).find((e) => e.id === 'c')?.category).toBe('ceiling');
  });

  it('o aviso de intervalo não cita forros na planta baixa', () => {
    const s = build();
    expect(viewRangeWarnings(s.project, 'lv_0', DEFAULT_VIEW_RANGE).some((w) => w.category === 'ceiling')).toBe(false);
  });
});
