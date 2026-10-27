import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, levelRoomSeparators, type Id, type RoomSeparator } from '@hestia/model';
import { gripHoldAt } from './selectGrips.ts';
import { roomSeparatorGripAt } from './roomSeparatorPick.ts';
import type { PointerInfo, ToolEnv, ToolOptions } from './types.ts';

function makeEnv(store = new ProjectStore(createEmptyProject())) {
  let selection: Id[] = [];
  const messages: string[] = [];
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
    say: (m) => { messages.push(m); },
    done: () => {},
    options: () => options,
  };
  return { store, env, messages, select: (ids: Id[]) => { selection = ids; } };
}

const P = (x: number, y: number, extra: Partial<PointerInfo> = {}): PointerInfo => ({ raw: { x, y }, shift: false, ctrl: false, alt: false, ...extra });
const snapTo = (target: Vec2) => () => target;

/** Ambiente com duas linhas no nível 0: 's1' (a (2,1), b (2,5)) e 's2' (x = 8, fora da seleção nos testes). */
function withSeparators() {
  const ctx = makeEnv();
  ctx.store.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { id: 's1', a: { x: 2, y: 1 }, b: { x: 2, y: 5 } } });
  ctx.store.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { id: 's2', a: { x: 8, y: 1 }, b: { x: 8, y: 4 } } });
  return ctx;
}

const separator = (s: ProjectStore, id: Id): RoomSeparator => levelRoomSeparators(s.project, 'lv_0').find((r) => r.id === id)!;

describe('alças das linhas de separação', () => {
  it('acha a extremidade b quando o cursor está perto dela e ignora linhas não selecionadas', () => {
    const { store } = withSeparators();
    expect(roomSeparatorGripAt(store.project, 'lv_0', ['s1'], { x: 2.02, y: 5.01 }, 0.01)).toEqual({ id: 's1', end: 'b', at: { x: 2, y: 5 } });
    // s2 não está na seleção: a extremidade dela não vira alça.
    expect(roomSeparatorGripAt(store.project, 'lv_0', ['s1'], { x: 8, y: 4 }, 0.01)).toBeNull();
    expect(roomSeparatorGripAt(store.project, 'lv_0', [], { x: 2, y: 5 }, 0.01)).toBeNull();
  });

  it('gripHoldAt entrega a alça da linha selecionada', () => {
    const { env, select } = withSeparators();
    select(['s1']);
    const hold = gripHoldAt(env, { x: 2, y: 1.02 });
    expect(hold).not.toBeNull();
    expect(hold!.at).toEqual({ x: 2, y: 1 });
    expect(gripHoldAt(env, { x: 8, y: 4 })).toBeNull();
  });

  it('arrastar a extremidade b para (2, 4) muda só b, e desfazer volta', () => {
    const { store, env, select } = withSeparators();
    select(['s1']);
    const before = separator(store, 's1');
    const hold = gripHoldAt(env, { x: 2, y: 5 })!;
    // Prévia: a linha atual tracejada e a nova com a ponta no destino.
    const items = hold.drag(P(2, 4), snapTo({ x: 2, y: 4 }));
    expect(items).toContainEqual({ kind: 'line', a: { x: 2, y: 1 }, b: { x: 2, y: 5 }, dashed: true });
    expect(items).toContainEqual({ kind: 'line', a: { x: 2, y: 1 }, b: { x: 2, y: 4 } });
    hold.release(P(2, 4), () => {});
    expect(separator(store, 's1')).toEqual({ id: 's1', a: { x: 2, y: 1 }, b: { x: 2, y: 4 } });
    // Só a linha selecionada mudou.
    expect(separator(store, 's2')).toEqual({ id: 's2', a: { x: 8, y: 1 }, b: { x: 8, y: 4 } });
    store.undo();
    expect(separator(store, 's1')).toEqual(before);
  });

  it('destino que deixa a linha com comprimento zero é recusado: mensagem e nada gravado', () => {
    const { store, env, messages, select } = withSeparators();
    select(['s1']);
    const before = separator(store, 's1');
    const hold = gripHoldAt(env, { x: 2, y: 5 })!;
    hold.drag(P(2, 1), snapTo({ x: 2, y: 1 }));
    hold.release(P(2, 1), () => {});
    expect(messages.at(-1)).toBe('A linha de separação precisa de dois pontos distintos.');
    expect(separator(store, 's1')).toEqual(before);
  });
});
