import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, type Id } from '@hestia/model';
import { createTool, type PointerInfo, type Tool, type ToolEnv, type ToolOptions } from './index.ts';

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
const clickAt = (t: Tool, x: number, y: number) => { t.move(P(x, y)); t.click(P(x, y)); };
const tool = (id: 'roomsep', env: ToolEnv) => { const t = createTool(id, env); t.start(); return t; };
const separators = (s: ProjectStore) => s.project.levels.find((l) => l.id === 'lv_0')?.roomSeparators ?? [];

describe('ferramenta Linha de separação', () => {
  it('dois cliques criam uma linha no nível', () => {
    const { store, env, messages } = makeEnv();
    const t = tool('roomsep', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    const seps = separators(store);
    expect(seps).toHaveLength(1);
    expect(seps[0]!.a).toEqual({ x: 0, y: 0 });
    expect(seps[0]!.b).toEqual({ x: 4, y: 0 });
    expect(seps[0]!.id.startsWith('rs_')).toBe(true);
    expect(messages.at(-1)).toBe(t.hint);
  });

  it('pré-visualização mostra a linha tracejada com o comprimento em metros', () => {
    const { env } = makeEnv();
    const t = tool('roomsep', env);
    clickAt(t, 0, 0);
    t.move(P(3, 0));
    const items = t.preview();
    expect(items.some((i) => i.kind === 'line' && i.dashed)).toBe(true);
    expect(items).toContainEqual(expect.objectContaining({ kind: 'label', text: '3,00 m' }));
  });

  it('clique curto demais mostra a mensagem do modelo e não grava nada', () => {
    const { store, env, messages } = makeEnv();
    const t = tool('roomsep', env);
    clickAt(t, 1, 1);
    clickAt(t, 1, 1);
    expect(messages.at(-1)).toMatch(/dois pontos distintos/);
    expect(separators(store)).toHaveLength(0);
    // Não fica travada: um novo par de cliques válido ainda grava.
    clickAt(t, 0, 0);
    clickAt(t, 2, 0);
    expect(separators(store)).toHaveLength(1);
  });

  it('Esc depois do primeiro clique cancela sem gravar nada', () => {
    const { store, env, done } = makeEnv();
    const t = tool('roomsep', env);
    clickAt(t, 0, 0);
    t.cancel();
    expect(separators(store)).toHaveLength(0);
    expect(done()).toBe(0);
    // Sem passo em andamento, o próximo Esc encerra a ferramenta.
    t.cancel();
    expect(done()).toBe(1);
  });
});
