import { DEFAULT_SNAP } from './types.ts';
import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, openingsOfWall, wallsOnLevel, type Id, type Wall } from '@hestia/model';
import { infer, parseNumber, createTool, type PointerInfo, type Tool, type ToolEnv, type ToolId, type ToolOptions } from './index.ts';

function makeEnv(store = new ProjectStore(createEmptyProject())) {
  let selection: Id[] = [];
  let finished = 0;
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
    say: () => {},
    done: () => { finished += 1; },
    options: () => options,
  };
  return { store, env, options, done: () => finished, sel: () => selection };
}

const P = (x: number, y: number, extra: Partial<PointerInfo> = {}): PointerInfo => ({ raw: { x, y }, shift: false, ctrl: false, alt: false, ...extra });
const clickAt = (t: Tool, x: number, y: number) => { t.move(P(x, y)); t.click(P(x, y)); };
const walls = (s: ProjectStore) => wallsOnLevel(s.project, 'lv_0');
const tool = (id: ToolId, env: ToolEnv) => { const t = createTool(id, env); t.start(); return t; };

describe('parseNumber', () => {
  it.each([['3,5', 3.5], ['3.50+0,15', 3.65], ['(2+1)*0,5', 1.5], ['-2', -2], ['10/4', 2.5]])('%s', (s, v) => {
    expect(parseNumber(s)).toBeCloseTo(v as number);
  });
  it('rejeita lixo', () => {
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('3+')).toBeNull();
    expect(parseNumber('1/0')).toBeNull();
  });
});

describe('inferência', () => {
  it('extremidade vence a grade e alinhamento', () => {
    const { store } = makeEnv();
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 3.03, y: 0 } }) });
    const r = infer({ x: 3.0, y: 0.04 }, { project: store.project, levelId: 'lv_0', mpp: 0.01, gridStep: 0.1 });
    expect(r.kind).toBe('endpoint');
    expect(r.point.x).toBeCloseTo(3.03);
  });
  it('cai na grade quando nada está perto (com a grade ligada)', () => {
    const { store } = makeEnv();
    const r = infer({ x: 1.04, y: 2.07 }, { project: store.project, levelId: 'lv_0', mpp: 0.01, gridStep: 0.1, snap: { ...DEFAULT_SNAP, grid: true } });
    expect(r.kind).toBe('grid');
    expect(r.point.x).toBeCloseTo(1.0);
    expect(r.point.y).toBeCloseTo(2.1);
  });
  it('ortogonal a partir do ponto anterior', () => {
    const { store } = makeEnv();
    const r = infer({ x: 3.0, y: 0.03 }, { project: store.project, levelId: 'lv_0', mpp: 0.01, gridStep: 0.5, from: { x: 0, y: 0 } });
    expect(r.point.y).toBeCloseTo(0);
  });
});

describe('ferramenta de parede', () => {
  it('encadeia, fecha o circuito e cria uma parede por lado', () => {
    const { store, env } = makeEnv();
    const t = tool('wall', env);
    clickAt(t, 0, 0); clickAt(t, 4, 0); clickAt(t, 4, 3); clickAt(t, 0, 3); clickAt(t, 0, 0);
    expect(walls(store)).toHaveLength(4);
    expect(t.inputPrompt()).toBeNull();
  });
  it('digitar o comprimento cria a parede na direção do cursor', () => {
    const { store, env } = makeEnv();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    t.move(P(2, 0));
    expect(t.type('3,5')).toBe(true);
    const w = walls(store)[0]!;
    expect(w.b.x).toBeCloseTo(3.5);
    expect(w.b.y).toBeCloseTo(0);
  });
  it('desfazer remove a parede', () => {
    const { store, env } = makeEnv();
    const t = tool('wall', env);
    clickAt(t, 0, 0); clickAt(t, 4, 0);
    store.undo();
    expect(walls(store)).toHaveLength(0);
  });
  it('Esc em dois passos', () => {
    const { env, done } = makeEnv();
    const t = tool('wall', env);
    clickAt(t, 0, 0);
    t.cancel();
    expect(done()).toBe(0);
    t.cancel();
    expect(done()).toBe(1);
  });
});

describe('aberturas', () => {
  it('insere porta na parede e impede sobreposição', () => {
    const { store, env } = makeEnv();
    const w = tool('wall', env);
    clickAt(w, 0, 0); clickAt(w, 5, 0);
    w.cancel();
    const d = tool('door', env);
    clickAt(d, 1, 0.02);
    const id = walls(store)[0]!.id;
    expect(openingsOfWall(store.project, id)).toHaveLength(1);
    clickAt(d, 1.2, 0.02); // sobrepõe
    expect(openingsOfWall(store.project, id)).toHaveLength(1);
    clickAt(d, 3, 0.02);
    expect(openingsOfWall(store.project, id)).toHaveLength(2);
  });
});

describe('seleção e edição', () => {
  function house() {
    const ctx = makeEnv();
    const w = tool('wall', ctx.env);
    clickAt(w, 0, 0); clickAt(w, 4, 0); clickAt(w, 4, 3);
    w.cancel();
    return ctx;
  }
  it('seleção por janela da esquerda para a direita contém', () => {
    const { env, sel } = house();
    const s = tool('select', env);
    s.down!(P(-1, -1)); s.drag!(P(5, 1)); s.up!(P(5, 1));
    expect(sel()).toHaveLength(1); // só a primeira parede está totalmente dentro
  });
  it('janela da direita para a esquerda cruza', () => {
    const { env, sel } = house();
    const s = tool('select', env);
    s.down!(P(5, 1)); s.drag!(P(-1, -1)); s.up!(P(-1, -1));
    expect(sel()).toHaveLength(2);
  });
  it('mover leva a vizinha junto pela extremidade comum', () => {
    const { store, env, sel } = house();
    const first = walls(store)[0]!;
    env.setSelection([first.id]);
    const m = tool('move', env);
    clickAt(m, 0, 0); clickAt(m, 0, 1);
    const [a, b] = walls(store) as [Wall, Wall];
    expect(a.a.y).toBeCloseTo(1);
    expect(b.a.y).toBeCloseTo(1); // a vizinha acompanhou
    expect(b.b.y).toBeCloseTo(3);
    expect(sel()).toEqual([first.id]);
    store.undo(); // um único passo
    expect(walls(store)[0]!.a.y).toBeCloseTo(0);
    expect(walls(store)[1]!.a.y).toBeCloseTo(0);
  });
  it('copiar mantém o original e leva aberturas', () => {
    const { store, env } = house();
    const id = walls(store)[0]!.id;
    const d = tool('door', env);
    clickAt(d, 2, 0.02);
    env.setSelection([id]);
    const c = tool('copy', env);
    clickAt(c, 0, 0); clickAt(c, 0, 5);
    c.cancel(); c.cancel();
    expect(walls(store)).toHaveLength(3);
    const copy = walls(store)[2]!;
    expect(openingsOfWall(store.project, copy.id)).toHaveLength(1);
  });
  it('espelhar com cópia inverte o lado externo', () => {
    const { store, env, options } = house();
    options.mirrorCopy = true;
    env.setSelection([walls(store)[0]!.id]);
    const m = tool('mirror', env);
    clickAt(m, 0, 2); clickAt(m, 1, 2);
    expect(walls(store)).toHaveLength(3);
    const mirrored = walls(store)[2]!;
    expect(mirrored.a.y).toBeCloseTo(4);
    expect(mirrored.flipped).toBe(true);
  });
  it('girar 90° digitando o ângulo', () => {
    const { store, env } = house();
    env.setSelection([walls(store)[0]!.id]);
    const r = tool('rotate', env);
    clickAt(r, 0, 0);
    expect(r.type('90')).toBe(true);
    const w = walls(store)[0]!;
    expect(w.b.x).toBeCloseTo(0);
    expect(w.b.y).toBeCloseTo(4);
  });
  it('matriz cria N-1 cópias em um passo', () => {
    const { store, env } = house();
    env.setSelection([walls(store)[0]!.id]);
    const a = tool('array', env);
    clickAt(a, 0, 0);
    a.move(P(0, 1));
    expect(a.type('2')).toBe(true);
    expect(walls(store)).toHaveLength(4);
    store.undo();
    expect(walls(store)).toHaveLength(2);
  });
  it('aparar ao canto une duas paredes que se cruzam', () => {
    const ctx = makeEnv();
    const w = tool('wall', ctx.env);
    clickAt(w, 0, 0); clickAt(w, 2, 0); w.cancel();
    const w2 = tool('wall', ctx.env);
    clickAt(w2, 3, -2); clickAt(w2, 3, 2); w2.cancel();
    const t = tool('trim', ctx.env);
    clickAt(t, 0.5, 0); clickAt(t, 3, 1.5);
    const [a, b] = walls(ctx.store) as [Wall, Wall];
    expect(a.b.x).toBeCloseTo(3);
    expect(b.a.y).toBeCloseTo(0);
  });
});

describe('quinas ao encadear paredes (decisão 0009 #13)', () => {
  // Antes a quina em L com acabamento saía em esquadria ao desenhar (#8). Agora o encosto pareia por face, então a
  // quina fica como foi escolhida e as duas paredes não são reescritas.
  it('L com acabamento: a parede nova e a vizinha ficam em encosto na quina', () => {
    const { store, env } = makeEnv();
    const t = tool('wall', env);
    clickAt(t, 0, 0); clickAt(t, 4, 0); clickAt(t, 4, 3);
    t.cancel();
    const [a, b] = walls(store) as [Wall, Wall];
    expect(a.joinEnd.kind).toBe('butt');
    expect(b.joinStart.kind).toBe('butt');
    expect(a.joinStart.kind).toBe('butt');
    expect(b.joinEnd.kind).toBe('butt');
  });

  it('o desenho de L é um só passo de desfazer: a segunda parede sai junto com as junções', () => {
    const { store, env } = makeEnv();
    const t = tool('wall', env);
    clickAt(t, 0, 0); clickAt(t, 4, 0); clickAt(t, 4, 3);
    t.cancel();
    store.undo();
    expect(walls(store)).toHaveLength(1);
    expect(walls(store)[0]!.joinEnd.kind).toBe('butt');
  });

  it('T e paredes colineares continuam em encosto', () => {
    const { store, env } = makeEnv();
    const t = tool('wall', env);
    clickAt(t, 0, 0); clickAt(t, 4, 0);
    t.cancel();
    const t2 = tool('wall', env);
    clickAt(t2, 2, 0); clickAt(t2, 2, 3); // T: começa no meio da parede
    t2.cancel();
    const t3 = tool('wall', env);
    clickAt(t3, 4, 0); clickAt(t3, 8, 0); // colinear
    t3.cancel();
    expect(walls(store).every((w) => w.joinStart.kind === 'butt' && w.joinEnd.kind === 'butt')).toBe(true);
  });
});
