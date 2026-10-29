import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, type Id } from '@hestia/model';
import { DEFAULT_SECTION_DEPTH, SectionTool, nextSectionName } from './sectionTool.ts';
import type { PointerInfo, PreviewItem, Tool, ToolEnv, ToolOptions } from './types.ts';

function makeEnv(store = new ProjectStore(createEmptyProject())) {
  let selection: Id[] = [];
  let finished = 0;
  const opened: Id[] = [];
  const options: ToolOptions = {
    wallTypeId: 'wt_alv14', locationLine: 'wallCenter', wallHeight: 2.8, chain: true, wallShape: 'line',
    doorTypeId: 'ot_p80', windowTypeId: 'ot_j120', orthoLock: false, arrayCount: 3, offsetDistance: 1,
    rotateCopy: false, mirrorCopy: false, offsetCopy: true, floorTypeId: 'ft_ceram', floorOffset: 0, slabTypeId: 'ls_mac12', slabOffset: 0, slabSlopePercent: 2,
  };
  const env: ToolEnv = {
    project: () => store.project,
    levelId: () => 'lv_0',
    selection: () => selection,
    setSelection: (ids) => { selection = ids; },
    exec: (c) => store.exec(c),
    transaction: (l, fn) => store.transaction(l, fn),
    metersPerPixel: () => 0.01,
    gridStep: () => 0.1,
    say: () => {},
    done: () => { finished += 1; },
    openView: (id) => { opened.push(id); },
    options: () => options,
  };
  return { store, env, done: () => finished, opened: () => opened };
}

const P = (x: number, y: number, extra: Partial<PointerInfo> = {}): PointerInfo => ({ raw: { x, y }, shift: false, ctrl: false, alt: false, ...extra });
const clickAt = (t: Tool, x: number, y: number) => { t.move(P(x, y)); t.click(P(x, y)); };

describe('nextSectionName', () => {
  it('usa a próxima letra livre', () => {
    expect(nextSectionName([])).toBe('Corte A');
    const views = [
      { id: 'v1', name: 'Corte A', kind: 'section' as const, a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, depth: 6 },
      { id: 'v2', name: 'Corte C', kind: 'section' as const, a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, depth: 6 },
    ];
    expect(nextSectionName(views)).toBe('Corte B');
  });
  it('depois de Z continua com números', () => {
    const views = Array.from({ length: 26 }, (_, i) => ({ id: `v${i}`, name: `Corte ${String.fromCharCode(65 + i)}`, kind: 'section' as const, a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, depth: 6 }));
    expect(nextSectionName(views)).toBe('Corte 27');
  });
});

describe('ferramenta Corte', () => {
  it('dois cliques criam uma vista de corte com profundidade padrão e finalizam', () => {
    const { store, env, done } = makeEnv();
    const t = new SectionTool(env);
    t.start();
    clickAt(t, 0, 0);
    expect(store.project.views).toHaveLength(0);
    clickAt(t, 4, 0);
    expect(store.project.views).toHaveLength(1);
    const v = store.project.views[0]!;
    expect(v.kind).toBe('section');
    expect(v.name).toBe('Corte A');
    expect(v.depth).toBe(DEFAULT_SECTION_DEPTH);
    expect(v.a.x).toBeCloseTo(0);
    expect(v.b.x).toBeCloseTo(4);
    expect(done()).toBe(1);
  });

  it('o corte criado abre sozinho na área de desenho (sem duplo clique no navegador)', () => {
    const { store, env, opened } = makeEnv();
    const t = new SectionTool(env);
    t.start();
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    expect(opened()).toEqual([store.project.views[0]!.id]);
  });

  it('o segundo corte recebe a próxima letra', () => {
    const { store, env } = makeEnv();
    const t = new SectionTool(env);
    t.start();
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    t.start();
    clickAt(t, 0, 2);
    clickAt(t, 0, 6);
    expect(store.project.views.map((v) => v.name)).toEqual(['Corte A', 'Corte B']);
  });

  it('Esc depois do primeiro ponto cancela sem criar vista nem sair', () => {
    const { store, env, done } = makeEnv();
    const t = new SectionTool(env);
    t.start();
    clickAt(t, 0, 0);
    t.cancel();
    expect(store.project.views).toHaveLength(0);
    expect(done()).toBe(0);
    clickAt(t, 1, 1);
    clickAt(t, 3, 1);
    expect(store.project.views).toHaveLength(1);
  });

  it('Esc sem passo em andamento sai da ferramenta', () => {
    const { env, done } = makeEnv();
    const t = new SectionTool(env);
    t.start();
    t.cancel();
    expect(done()).toBe(1);
  });

  it('ignora segundo ponto coincidente com o primeiro', () => {
    const { store, env, done } = makeEnv();
    const t = new SectionTool(env);
    t.start();
    clickAt(t, 2, 2);
    clickAt(t, 2, 2);
    expect(store.project.views).toHaveLength(0);
    expect(done()).toBe(0);
  });

  it('pré-visualização mostra a linha tracejada com a seta', () => {
    const { env } = makeEnv();
    const t = new SectionTool(env);
    t.start();
    t.move(P(0, 0));
    t.click(P(0, 0));
    t.move(P(5, 0));
    const items: PreviewItem[] = t.preview();
    const line = items.find((i) => i.kind === 'sectionLine');
    expect(line).toMatchObject({ kind: 'sectionLine', dashed: true });
  });
});
