import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_TYPE_ID, ProjectStore, createEmptyProject, gridIssue, gridOf, makeRoof, nextGridName, projectGridTypes, projectGrids, resolveUnits, roofEdgeSag, validateProject, type Grid } from './index.ts';

const g = (id: string, name: string, over: Partial<Grid> = {}): Omit<Grid, 'order'> => ({
  id,
  name,
  typeId: DEFAULT_GRID_TYPE_ID,
  points: [{ x: 0, y: 0 }, { x: 0, y: 10 }],
  sag: 0,
  bubbleStart: false,
  bubbleEnd: true,
  ...over,
});

describe('grades (modelo)', () => {
  it('projeto novo não tem grades e já tem os tipos padrão', () => {
    const p = createEmptyProject();
    expect(projectGrids(p)).toEqual([]);
    expect(projectGridTypes(p).map((t) => t.id)).toContain(DEFAULT_GRID_TYPE_ID);
  });

  it('adiciona, edita e remove com desfazer', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addGrid', grid: g('gr1', '1') });
    expect(gridOf(s.project, 'gr1')?.order).toBeGreaterThan(0);
    s.exec({ type: 'updateGrid', id: 'gr1', patch: { name: 'A', bubbleStart: true } });
    expect(gridOf(s.project, 'gr1')).toMatchObject({ name: 'A', bubbleStart: true });
    s.exec({ type: 'removeGrid', id: 'gr1' });
    expect(projectGrids(s.project)).toHaveLength(0);
    s.undo();
    expect(projectGrids(s.project)).toHaveLength(1);
  });

  it('recusa nome repetido, trecho curto, arco em multissegmento e flecha grande', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addGrid', grid: g('gr1', '1') });
    expect(() => s.exec({ type: 'addGrid', grid: g('gr2', '1') })).toThrow('Já existe uma grade chamada "1"');
    expect(gridIssue(g('x', 'B', { points: [{ x: 0, y: 0 }, { x: 0.01, y: 0 }] }))).toMatch(/5 cm/);
    expect(gridIssue(g('x', 'B', { points: [{ x: 0, y: 0 }, { x: 0.01, y: 0 }] }), resolveUnits({ smallLength: { unit: 'mm', decimals: 0 } }))).toBe(
      'Cada trecho da grade precisa ter pelo menos 50 mm.',
    );
    expect(gridIssue(g('x', 'B', { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }], sag: 0.5 }))).toMatch(/dois pontos/);
    expect(gridIssue(g('x', 'B', { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }], sag: 3 }))).toMatch(/metade da corda/);
    expect(gridIssue(g('x', 'B', { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }], sag: 2 }))).toBeNull();
  });

  it('nome automático segue o padrão do Revit', () => {
    const p = createEmptyProject();
    expect(nextGridName(p)).toBe('1');
    const s = new ProjectStore(p);
    s.exec({ type: 'addGrid', grid: g('a', '1') });
    expect(nextGridName(s.project)).toBe('2');
    s.exec({ type: 'addGrid', grid: g('b', 'A') });
    expect(nextGridName(s.project)).toBe('B');
    s.exec({ type: 'addGrid', grid: g('c', 'Z') });
    expect(nextGridName(s.project)).toBe('AA');
    s.exec({ type: 'addGrid', grid: g('d', 'A9') });
    expect(nextGridName(s.project)).toBe('A10');
  });

  it('tipos: edita um padrão sem perdê-lo, recusa remover em uso e o último', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'updateGridType', id: DEFAULT_GRID_TYPE_ID, patch: { bubbleDiameterMm: 10 } });
    expect(projectGridTypes(s.project).find((t) => t.id === DEFAULT_GRID_TYPE_ID)?.bubbleDiameterMm).toBe(10);
    expect(projectGridTypes(s.project).filter((t) => t.id === DEFAULT_GRID_TYPE_ID)).toHaveLength(1);
    s.exec({ type: 'addGrid', grid: g('a', '1') });
    expect(() => s.exec({ type: 'removeGridType', id: DEFAULT_GRID_TYPE_ID })).toThrow('Há grades usando');
    expect(() => s.exec({ type: 'updateGridType', id: DEFAULT_GRID_TYPE_ID, patch: { weightMm: 0 } })).toThrow();
  });

  it('ida e volta de JSON preserva grades e tipos', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addGrid', grid: g('a', '1', { points: [{ x: 0, y: 0 }, { x: 5, y: 0 }], sag: 1 }) });
    const back = JSON.parse(JSON.stringify(s.project)) as typeof s.project;
    expect(gridOf(back, 'a')).toMatchObject({ name: '1', sag: 1 });
  });
});

describe('telhado: flecha por aresta (edgeSag)', () => {
  const sq = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 0, y: 6 }];
  const roofIn = (edgeSag?: number[]) => {
    const p = createEmptyProject();
    const r = makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: sq, ...(edgeSag ? { edgeSag } : {}) });
    p.elements.r1 = { ...r, order: 1 };
    return p;
  };

  it('ausente vale zero e é válido', () => {
    const p = roofIn();
    expect(roofEdgeSag(p.elements.r1 as never, 2)).toBe(0);
    expect(validateProject(p).filter((i) => i.code.startsWith('roof-edge-sag'))).toEqual([]);
  });

  it('aceita flecha até metade da corda e recusa o resto', () => {
    expect(validateProject(roofIn([0, 3, 0, 0])).filter((i) => i.code.startsWith('roof-edge-sag'))).toEqual([]);
    expect(validateProject(roofIn([0, 3.5, 0, 0])).map((i) => i.code)).toContain('roof-edge-sag-invalid');
    expect(validateProject(roofIn([0, 1])).map((i) => i.code)).toContain('roof-edge-sag-length');
  });
});
