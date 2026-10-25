import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, levelRoomSeparators, makeFloor, type Id } from '@hestia/model';
import { createTool, type PointerInfo, type Tool, type ToolEnv, type ToolId, type ToolOptions } from './index.ts';
import { deleteSelectionIn } from '../../../apps/web/src/editor/deleteIds.ts';
import { useUi } from '../../../apps/web/src/editor/state.ts';

function makeEnv(store = new ProjectStore(createEmptyProject())) {
  let selection: Id[] = [];
  let finished = 0;
  const messages: string[] = [];
  const options: ToolOptions = {
    wallTypeId: 'wt_alv14', locationLine: 'wallCenter', wallHeight: 2.8, chain: true, wallShape: 'line',
    doorTypeId: 'ot_p80', windowTypeId: 'ot_j120', orthoLock: false, arrayCount: 3, offsetDistance: 1,
    rotateCopy: false, mirrorCopy: false, offsetCopy: true, floorTypeId: 'ft_ceram', floorOffset: 0, floorMode: 'poly', slabTypeId: 'ls_mac12', slabOffset: 0, slabMode: 'poly', slabSlopePercent: 2,
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
    say: (m) => { messages.push(m); },
    done: () => { finished += 1; },
    options: () => options,
  };
  return { store, env, options, done: () => finished, sel: () => selection, messages };
}

const P = (x: number, y: number, extra: Partial<PointerInfo> = {}): PointerInfo => ({ raw: { x, y }, shift: false, ctrl: false, alt: false, ...extra });
const tool = (id: ToolId, env: ToolEnv) => { const t = createTool(id, env); t.start(); return t; };
/** Clique sem arrasto: move, pressiona e solta no mesmo ponto (Shift opcional). */
const clickAt = (t: Tool, x: number, y: number, shift = false) => {
  t.move(P(x, y, { shift }));
  t.down!(P(x, y, { shift }));
  t.up!(P(x, y, { shift }));
};

const RECT = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
/** Linha de separação horizontal de (1, 1.5) a (3, 1.5), id 'rs1', no nível 0 (fora de project.elements). */
const SEP = { id: 'rs1', a: { x: 1, y: 1.5 }, b: { x: 3, y: 1.5 } };

function withSeparator() {
  const ctx = makeEnv();
  ctx.store.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { ...SEP } });
  return ctx;
}

describe('ferramenta Selecionar: linhas de separação de ambiente', () => {
  it('clique numa linha seleciona a linha', () => {
    const { env, sel } = withSeparator();
    const t = tool('select', env);
    clickAt(t, 2, 1.5);
    expect(sel()).toContain('rs1');
    expect(sel()).toEqual(['rs1']);
  });

  it('Shift+clique numa segunda linha acrescenta à seleção', () => {
    const { store, env, sel } = withSeparator();
    store.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { id: 'rs2', a: { x: 1, y: 2.5 }, b: { x: 3, y: 2.5 } } });
    const t = tool('select', env);
    clickAt(t, 2, 1.5);
    clickAt(t, 2, 2.5, true);
    expect(sel().sort()).toEqual(['rs1', 'rs2']);
  });

  it('clique no vazio limpa a seleção', () => {
    const { env, sel } = withSeparator();
    const t = tool('select', env);
    clickAt(t, 2, 1.5);
    expect(sel()).toEqual(['rs1']);
    clickAt(t, 3.5, 0.2);
    expect(sel()).toEqual([]);
  });

  it('parede ou piso sob o mesmo ponto continua tendo prioridade sobre a linha', () => {
    const { store, env, sel } = withSeparator();
    store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RECT }) });
    const t = tool('select', env);
    clickAt(t, 2, 1.5);
    expect(sel()).toEqual(['f1']);
  });

  it('mover o cursor sobre a linha e clicar com elementos selecionados não quebra', () => {
    const { env, sel } = withSeparator();
    const t = tool('select', env);
    clickAt(t, 2, 1.5);
    t.move(P(2.5, 1.5));
    expect(() => (t as { selectionBox?: () => unknown }).selectionBox?.()).not.toThrow();
    expect(sel()).toEqual(['rs1']);
  });

  it('Delete (exclusão da seleção) remove a linha do nível e o desfazer a devolve', () => {
    const { store, env } = withSeparator();
    const t = tool('select', env);
    clickAt(t, 2, 1.5);
    useUi.setState({ selection: ['rs1'], levelId: 'lv_0' });
    try {
      deleteSelectionIn(store);
    } finally {
      useUi.setState({ selection: [] });
    }
    expect(levelRoomSeparators(store.project, 'lv_0')).toEqual([]);
    store.undo();
    expect(levelRoomSeparators(store.project, 'lv_0')).toEqual([SEP]);
  });
});
