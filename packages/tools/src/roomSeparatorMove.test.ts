import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, floorsOnLevel, levelRoomSeparators, makeFloor, type Floor, type Id, type RoomSeparator } from '@hestia/model';
import { createTool, type PointerInfo, type Tool, type ToolEnv, type ToolId, type ToolOptions } from './index.ts';

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
const clickAt = (t: Tool, x: number, y: number) => { t.move(P(x, y)); t.click(P(x, y)); };
const floors = (s: ProjectStore): Floor[] => floorsOnLevel(s.project, 'lv_0');
const separators = (s: ProjectStore): RoomSeparator[] => levelRoomSeparators(s.project, 'lv_0');

const RECT = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];

/** Ambiente com uma linha de separação id 'rs1' de (1,1) a (1,3) no nível 0. */
function withSeparator() {
  const ctx = makeEnv();
  ctx.store.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { id: 'rs1', a: { x: 1, y: 1 }, b: { x: 1, y: 3 } } });
  return ctx;
}

/** Ambiente com a linha 'rs1' e um piso retangular 'f1' 4 × 3. */
function withSeparatorAndFloor() {
  const ctx = withSeparator();
  ctx.store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RECT }) });
  return ctx;
}

describe('Mover: linhas de separação', () => {
  it('selecionar a linha e mover por (1, 0) desloca a e b em +1 em x', () => {
    const { store, env } = withSeparator();
    env.setSelection(['rs1']);
    const t = tool('move', env);
    clickAt(t, 0, 0);
    clickAt(t, 1, 0);
    const [r] = separators(store);
    expect(r!.a.x).toBeCloseTo(2, 9);
    expect(r!.a.y).toBeCloseTo(1, 9);
    expect(r!.b.x).toBeCloseTo(2, 9);
    expect(r!.b.y).toBeCloseTo(3, 9);
    expect(separators(store)).toHaveLength(1);
  });

  it('o preview mostra a linha deslocada tracejada durante o movimento', () => {
    const { env } = withSeparator();
    env.setSelection(['rs1']);
    const t = tool('move', env);
    clickAt(t, 0, 0);
    t.move(P(1, 0));
    const ghost = t.preview().find((i) => i.kind === 'line' && i.dashed && i.a.x === 2 && i.b.x === 2);
    expect(ghost).toBeDefined();
    expect(ghost).toMatchObject({ kind: 'line', a: { x: 2, y: 1 }, b: { x: 2, y: 3 }, dashed: true });
  });

  it('copiar com a linha selecionada não cria nova linha', () => {
    const { store, env } = withSeparatorAndFloor();
    env.setSelection(['f1', 'rs1']);
    const t = tool('copy', env);
    clickAt(t, 0, 0);
    clickAt(t, 1, 0);
    expect(floors(store)).toHaveLength(2);
    expect(separators(store)).toHaveLength(1);
    expect(separators(store)[0]!.a).toEqual({ x: 1, y: 1 });
    expect(separators(store)[0]!.b).toEqual({ x: 1, y: 3 });
  });

  it('copiar só com a linha selecionada não faz nada', () => {
    const { store, env } = withSeparator();
    env.setSelection(['rs1']);
    const t = tool('copy', env);
    clickAt(t, 0, 0);
    clickAt(t, 1, 0);
    expect(separators(store)).toHaveLength(1);
    expect(separators(store)[0]!.a).toEqual({ x: 1, y: 1 });
  });

  it('desfazer volta a linha à posição original', () => {
    const { store, env } = withSeparator();
    env.setSelection(['rs1']);
    const t = tool('move', env);
    clickAt(t, 0, 0);
    clickAt(t, 1, 0);
    expect(separators(store)[0]!.a.x).toBeCloseTo(2, 9);
    store.undo();
    const [r] = separators(store);
    expect(r!.a).toEqual({ x: 1, y: 1 });
    expect(r!.b).toEqual({ x: 1, y: 3 });
  });
});
