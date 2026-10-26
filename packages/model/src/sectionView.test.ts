import { describe, expect, it } from 'vitest';
import {
  ProjectStore,
  createEmptyProject,
  emptyTitleBlock,
  makeWall,
  sectionLabelOf,
  sectionInvertPatch,
  sectionMarkGeometry,
  sectionPoints,
  sectionTitleOf,
  sectionViewIssue,
  viewNameIssue,
  viewRemovals,
  viewTransformCommands,
  type SectionView,
} from './index.ts';

const view = (patch: Partial<SectionView> = {}): SectionView => ({
  id: 'v1',
  name: 'Corte A',
  kind: 'section',
  a: { x: 0, y: 0 },
  b: { x: 4, y: 0 },
  depth: 5,
  ...patch,
});

describe('inverter o sentido do corte', () => {
  it('troca início e fim e as referências junto, sem perder a associação com a parede', () => {
    const v = view({ refs: { a: { wallId: 'w1', end: 'a' }, b: { wallId: 'w2', end: 'b' } } });
    expect(sectionInvertPatch(v)).toEqual({
      a: { x: 4, y: 0 },
      b: { x: 0, y: 0 },
      refs: { a: { wallId: 'w2', end: 'b' }, b: { wallId: 'w1', end: 'a' } },
    });
  });

  it('corte sem referências inverte só os pontos', () => {
    expect(sectionInvertPatch(view())).toEqual({ a: { x: 4, y: 0 }, b: { x: 0, y: 0 }, refs: undefined });
  });
});

describe('rótulo da marca fica fora da seta', () => {
  it('o rótulo da ponta fica além da ponta da seta, sem sobrepor a seta (padrão)', () => {
    const g = sectionMarkGeometry({ x: 0, y: 0 }, { x: 10, y: 0 }, 'section', 'Corte A', 0.1);
    const ends = g.labels.filter((l) => Math.abs(l.at.x) < 3);
    expect(ends.length).toBeGreaterThan(0);
    const tipDist = Math.abs(g.arrows[0]![1]!.y);
    // Meia altura do texto (2,5 mm de papel, escala 1:100): o centro do rótulo deve ficar além da ponta mais essa meia altura.
    for (const l of g.labels) expect(Math.abs(l.at.y)).toBeGreaterThanOrEqual(tipDist + 0.125 - 1e-9);
  });

  it('um deslocamento vertical menor que a seta não aproxima o rótulo da seta', () => {
    const g = sectionMarkGeometry({ x: 0, y: 0 }, { x: 10, y: 0 }, 'section', 'Corte A', 0.1, { labelOffsetMm: { x: 2, y: 0.2 } });
    const tipDist = Math.abs(g.arrows[0]![1]!.y);
    for (const l of g.labels) expect(Math.abs(l.at.y)).toBeGreaterThanOrEqual(tipDist + 0.125 - 1e-9);
  });
});

describe('vistas de corte e elevação: identidade e geometria', () => {
  it('aceita a vista mínima e recusa geometria inválida', () => {
    expect(sectionViewIssue(view())).toBeNull();
    expect(sectionViewIssue(view({ a: { x: 0, y: 0 }, b: { x: 0, y: 0 } }))).toContain('dois pontos distintos');
    expect(sectionViewIssue(view({ depth: 0 }))).toContain('profundidade');
    expect(sectionViewIssue(view({ mark: { arrowMm: 0.1 } }))).toContain('seta');
    expect(sectionViewIssue(view({ mark: { placement: 'lado' as never } }))).toContain('posição');
  });

  it('recusa nome vazio e nome repetido (menos o próprio id)', () => {
    expect(sectionViewIssue(view({ name: '  ' }))).toContain('nome');
    const views = [view(), view({ id: 'v2' })];
    expect(viewNameIssue(views, 'Corte A')).toContain('Já existe');
    expect(viewNameIssue(views, 'Corte A', 'v1')).toContain('Já existe');
    expect(viewNameIssue([view()], 'Corte A', 'v1')).toBeNull();
    expect(viewNameIssue([view()], 'Corte B')).toBeNull();
  });

  it('segue a extremidade da parede e cai para o ponto guardado quando ela some', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 1, y: 2 }, b: { x: 7, y: 2 } }) });
    const v = view({ a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, refs: { a: { wallId: 'w1', end: 'a' }, b: { wallId: 'w1', end: 'b' } } });
    expect(sectionPoints(store.project, v)).toEqual({ a: { x: 1, y: 2 }, b: { x: 7, y: 2 } });
    store.exec({ type: 'deleteElements', ids: ['w1'] });
    expect(sectionPoints(store.project, v)).toEqual({ a: { x: 0, y: 0 }, b: { x: 4, y: 0 } });
  });

  it('prefere rótulo, depois número, depois nome; título próprio na prancha', () => {
    expect(sectionLabelOf(view({ label: 'A', number: 'B' }))).toBe('A');
    expect(sectionLabelOf(view({ number: 'B' }))).toBe('B');
    expect(sectionLabelOf(view())).toBe('Corte A');
    expect(sectionTitleOf(view({ title: 'Corte AA — Escada' }))).toBe('Corte AA — Escada');
    expect(sectionTitleOf(view())).toBe('Corte A');
  });

  it('desenha a marca em mm de papel, com setas, traço-ponto e rótulo nas pontas', () => {
    const g = sectionMarkGeometry({ x: 0, y: 0 }, { x: 4, y: 0 }, 'section', 'Corte A', 0.1);
    expect(g.segments.length).toBeGreaterThan(4);
    expect(g.arrows).toHaveLength(2);
    expect(g.arrows[0]![1]!.x).toBeCloseTo(0);
    expect(g.arrows[0]![1]!.y).toBeCloseTo(0.3);
    expect(g.labels.map((l) => l.text)).toEqual(['Corte A', 'Corte A']);
    // Rótulo além da ponta da seta: 3 mm de seta + 1,25 mm de meia altura + 0,5 mm de folga = 4,75 mm de papel.
    expect(g.labels[0]!.at.y).toBeCloseTo(0.475);
  });

  it('respeita visibilidade, setas, rótulo e posição no meio', () => {
    expect(sectionMarkGeometry({ x: 0, y: 0 }, { x: 4, y: 0 }, 'section', 'A', 0.1, { visible: false })).toEqual({ segments: [], arrows: [], labels: [] });
    const semSeta = sectionMarkGeometry({ x: 0, y: 0 }, { x: 4, y: 0 }, 'section', 'A', 0.1, { showArrow: false, showLabel: false });
    expect(semSeta.arrows).toHaveLength(0);
    expect(semSeta.labels).toHaveLength(0);
    const meio = sectionMarkGeometry({ x: 0, y: 0 }, { x: 4, y: 0 }, 'section', 'A', 0.1, { placement: 'middle' });
    expect(meio.arrows).toHaveLength(0);
    expect(meio.labels).toHaveLength(1);
    expect(meio.labels[0]!.at.x).toBeCloseTo(2);
  });

  it('copia com nome novo, sem papel de elevação e sem referências; mover também solta as referências', () => {
    const p = createEmptyProject();
    p.views = [view({ role: 'north', refs: { a: { wallId: 'w1', end: 'a' } } })];
    const copy = viewTransformCommands(p, ['v1'], { kind: 'translate', d: { x: 2, y: 3 } }, true);
    expect(copy).toHaveLength(1);
    const add = copy[0]!;
    expect(add.type).toBe('addView');
    if (add.type !== 'addView') return;
    expect(add.view.name).toBe('Corte A cópia');
    expect(add.view.a).toEqual({ x: 2, y: 3 });
    expect(add.view.refs).toBeUndefined();
    expect(add.view.role).toBeUndefined();

    const moved = viewTransformCommands(p, ['v1'], { kind: 'translate', d: { x: 1, y: 0 } }, false);
    expect(moved[0]).toMatchObject({ type: 'updateView', id: 'v1', patch: { a: { x: 1, y: 0 }, b: { x: 5, y: 0 }, refs: undefined } });
    expect(viewRemovals(p, ['v1'])).toEqual([{ type: 'deleteView', id: 'v1' }]);
  });
});

describe('comandos de vista', () => {
  it('recusa nome repetido ao criar e alterar, sem mudar o projeto', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addView', view: view() });
    expect(() => store.exec({ type: 'addView', view: view({ id: 'v2' }) })).toThrow(/Já existe/);
    expect(() => store.exec({ type: 'updateView', id: 'v1', patch: { depth: 0 } })).toThrow(/profundidade/);
    expect(store.project.views[0]!.depth).toBe(5);
    store.exec({ type: 'addView', view: view({ id: 'v2', name: 'Corte B' }) });
    expect(() => store.exec({ type: 'updateView', id: 'v2', patch: { name: 'Corte A' } })).toThrow(/Já existe/);
  });

  it('excluir a vista remove os viewports da prancha no mesmo passo', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addView', view: view() });
    store.exec({
      type: 'addSheet',
      sheet: {
        id: 's1',
        number: 'PR-01',
        name: 'Teste',
        size: 'A3',
        orientation: 'landscape',
        margin: 10,
        titleBlock: emptyTitleBlock(),
        viewports: [],
      },
    });
    store.exec({ type: 'addViewport', sheetId: 's1', viewport: { id: 'vp1', view: { kind: 'section', sectionId: 'v1' }, at: { x: 20, y: 20 }, size: { w: 100, h: 80 }, scale: 100 } });
    store.exec({ type: 'deleteView', id: 'v1' });
    expect(store.project.views).toHaveLength(0);
    expect(store.project.sheets?.[0]?.viewports).toHaveLength(0);
  });
});
