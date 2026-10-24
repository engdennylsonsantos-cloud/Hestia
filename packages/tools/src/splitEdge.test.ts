import { describe, expect, it } from 'vitest';
import { ringArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, floorsOnLevel, makeFloor, type Floor, type Id } from '@hestia/model';
import { createTool, type PointerInfo, type Tool, type ToolEnv, type ToolId, type ToolOptions } from './index.ts';
import { OUTLINE_LOCKED_MSG } from './outlineEdit.ts';

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
const tool = (id: ToolId, env: ToolEnv) => { const t = createTool(id, env); t.start(); return t; };
const floors = (s: ProjectStore): Floor[] => floorsOnLevel(s.project, 'lv_0');
const area = (r: Vec2[]): number => Math.abs(ringArea(r));

const RECT = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];

/** Piso retangular 4 × 3 no nível 0, id 'f1'. */
function rectFloor(extra: Partial<Floor> = {}) {
  const ctx = makeEnv();
  ctx.store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RECT, ...extra }) });
  return ctx;
}

describe('ferramenta Dividir: aresta e piso', () => {
  it('clicar numa aresta de piso insere um vértice nela (anel com 5 vértices)', () => {
    const { store, env } = rectFloor();
    const t = tool('split', env);
    t.move(P(2, 0.01));
    expect(t.inference()?.point.y).toBeCloseTo(0);
    t.click(P(2, 0.01));
    const [f] = floors(store);
    expect(floors(store)).toHaveLength(1);
    expect(f!.boundary).toHaveLength(5);
    expect(f!.boundary[1]!.x).toBeCloseTo(2);
    expect(f!.boundary[1]!.y).toBeCloseTo(0);
    expect(area(f!.boundary)).toBeCloseTo(12, 9);
  });

  it('dividir retângulo 4x3 por x = 2 vira dois pisos de áreas 6 e 6', () => {
    const { store, env } = rectFloor();
    const t = tool('split', env);
    clickAt(t, 2, 1);
    clickAt(t, 2, 2);
    const fs = floors(store);
    expect(fs).toHaveLength(2);
    const areas = fs.map((f) => area(f.boundary)).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(6, 9);
    expect(areas[1]).toBeCloseTo(6, 9);
    const ids = fs.map((f) => f.id);
    expect(ids).toContain('f1');
    expect(new Set(ids).size).toBe(2);
    const novo = fs.find((f) => f.id !== 'f1')!;
    expect(novo.id.startsWith('f_')).toBe(true);
    expect(novo.typeId).toBe('ft_ceram');
    expect(novo.levelId).toBe('lv_0');
    expect(novo.holes).toEqual([]);
    expect(novo.outlineSource).toBeUndefined();
  });

  it('linha que não cruza o contorno em dois pontos: aviso e nada gravado', () => {
    // Forma em U: a reta horizontal y = 2 corta o contorno em quatro pontos.
    const U = [
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 2, y: 3 },
      { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 3 }, { x: 0, y: 3 },
    ];
    const { store, env, messages } = rectFloor({ boundary: U });
    const t = tool('split', env);
    clickAt(t, 0.5, 2);
    clickAt(t, 1.5, 2);
    expect(messages.at(-1)).toBe('A linha precisa cruzar o contorno em dois pontos.');
    expect(floors(store)).toHaveLength(1);
    expect(floors(store)[0]!.boundary).toEqual(U);
  });

  it('piso vinculado às paredes fica travado: nada gravado e mensagem de travamento', () => {
    const { store, env, messages } = rectFloor({ outlineSource: { mode: 'walls-finish', linked: true } });
    const t = tool('split', env);
    clickAt(t, 2, 1);
    clickAt(t, 2, 2);
    expect(messages).toContain(OUTLINE_LOCKED_MSG);
    expect(floors(store)).toHaveLength(1);
    expect(floors(store)[0]!.boundary).toEqual(RECT);
  });

  it('desfazer volta aos dois pisos para um só', () => {
    const { store, env } = rectFloor();
    const t = tool('split', env);
    clickAt(t, 2, 1);
    clickAt(t, 2, 2);
    expect(floors(store)).toHaveLength(2);
    store.undo();
    const fs = floors(store);
    expect(fs).toHaveLength(1);
    expect(fs[0]!.id).toBe('f1');
    expect(fs[0]!.boundary).toEqual(RECT);
  });
});
