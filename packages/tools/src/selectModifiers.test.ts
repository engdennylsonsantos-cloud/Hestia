import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, type Id } from '@hestia/model';
import { createTool, type PointerInfo, type Tool, type ToolEnv, type ToolId, type ToolOptions } from './index.ts';

function makeEnv(store = new ProjectStore(createEmptyProject())) {
  let selection: Id[] = [];
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
    done: () => {},
    options: () => options,
  };
  return { store, env, sel: () => selection };
}

type Mods = Partial<Pick<PointerInfo, 'shift' | 'ctrl'>>;
const P = (x: number, y: number, m: Mods = {}): PointerInfo => ({ raw: { x, y }, shift: !!m.shift, ctrl: !!m.ctrl, alt: false });
const tool = (id: ToolId, env: ToolEnv): Tool => { const t = createTool(id, env); t.start(); return t; };
/** Clique sem arrasto com os modificadores dados. */
const clickAt = (t: Tool, x: number, y: number, m: Mods = {}) => {
  t.move(P(x, y, m));
  t.down!(P(x, y, m));
  t.up!(P(x, y, m));
};
/** Arrasto de janela de `a` até `b`, com os modificadores dados. */
const windowDrag = (t: Tool, a: { x: number; y: number }, b: { x: number; y: number }, m: Mods = {}) => {
  t.move(P(a.x, a.y, m));
  t.down!(P(a.x, a.y, m));
  t.drag!(P(b.x, b.y, m));
  t.up!(P(b.x, b.y, m));
};

/** Três paredes: esquerda (x=0), direita (x=4) e base (y=0). A base cabe inteira numa janela de (-1,-1) a (5,1). */
function withWalls() {
  const ctx = makeEnv();
  const wall = (id: string, a: { x: number; y: number }, b: { x: number; y: number }) =>
    ctx.store.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b }) });
  wall('wl', { x: 0, y: 0 }, { x: 0, y: 4 });
  wall('wr', { x: 4, y: 0 }, { x: 4, y: 4 });
  wall('wb', { x: 0, y: 0 }, { x: 4, y: 0 });
  return ctx;
}

describe('ferramenta Selecionar: Shift e Ctrl no clique e na janela', () => {
  it('Shift+clique acrescenta à seleção', () => {
    const { env, sel } = withWalls();
    const t = tool('select', env);
    clickAt(t, 0, 2);
    clickAt(t, 4, 2, { shift: true });
    expect(sel().sort()).toEqual(['wl', 'wr']);
  });

  it('Ctrl+clique acrescenta à seleção', () => {
    const { env, sel } = withWalls();
    const t = tool('select', env);
    clickAt(t, 0, 2);
    clickAt(t, 4, 2, { ctrl: true });
    expect(sel().sort()).toEqual(['wl', 'wr']);
  });

  it('Ctrl+clique de novo num elemento já selecionado o retira', () => {
    const { env, sel } = withWalls();
    const t = tool('select', env);
    clickAt(t, 0, 2);
    clickAt(t, 4, 2, { ctrl: true });
    clickAt(t, 4, 2, { ctrl: true });
    expect(sel()).toEqual(['wl']);
  });

  it('Shift+clique no vazio não limpa a seleção', () => {
    const { env, sel } = withWalls();
    const t = tool('select', env);
    clickAt(t, 0, 2);
    clickAt(t, 2, 2, { shift: true });
    expect(sel()).toEqual(['wl']);
  });

  it('clique simples sem modificador substitui a seleção', () => {
    const { env, sel } = withWalls();
    const t = tool('select', env);
    clickAt(t, 0, 2);
    clickAt(t, 4, 2);
    expect(sel()).toEqual(['wr']);
  });

  it('janela com Shift soma à seleção existente', () => {
    const { env, sel } = withWalls();
    const t = tool('select', env);
    clickAt(t, 0, 2);
    windowDrag(t, { x: -1, y: -1 }, { x: 5, y: 1 }, { shift: true });
    expect(sel().sort()).toEqual(['wb', 'wl']);
  });

  it('janela com Ctrl soma à seleção existente', () => {
    const { env, sel } = withWalls();
    const t = tool('select', env);
    clickAt(t, 0, 2);
    windowDrag(t, { x: -1, y: -1 }, { x: 5, y: 1 }, { ctrl: true });
    expect(sel().sort()).toEqual(['wb', 'wl']);
  });

  it('janela sem modificador substitui a seleção', () => {
    const { env, sel } = withWalls();
    const t = tool('select', env);
    clickAt(t, 0, 2);
    windowDrag(t, { x: -1, y: -1 }, { x: 5, y: 1 });
    expect(sel()).toEqual(['wb']);
  });
});
