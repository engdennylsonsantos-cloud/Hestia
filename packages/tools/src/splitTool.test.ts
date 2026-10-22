import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, wallsOnLevel, type Id, type Opening, type Wall } from '@hestia/model';
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
const clickAt = (t: Tool, x: number, y: number) => { t.move(P(x, y)); t.click(P(x, y)); };
const walls = (s: ProjectStore) => wallsOnLevel(s.project, 'lv_0');
const tool = (id: ToolId, env: ToolEnv) => { const t = createTool(id, env); t.start(); return t; };

/** Parede de 0 a 6 m no eixo X, criada pelo próprio store. */
function oneWall(extra: Partial<Wall> = {}) {
  const ctx = makeEnv();
  ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, ...extra }) });
  return ctx;
}

describe('ferramenta Dividir', () => {
  it('destaca a parede e marca o ponto de corte projetado na grade', () => {
    const { env } = oneWall();
    const t = tool('split', env);
    t.move(P(2.03, 0.02));
    expect(t.preview()).toContainEqual({ kind: 'highlight', ids: ['w'] });
    expect(t.inference()?.point.x).toBeCloseTo(2.0);
    expect(t.inference()?.point.y).toBeCloseTo(0);
  });

  it('clique divide a parede no ponto projetado, em um passo de desfazer', () => {
    const { store, env } = oneWall();
    const t = tool('split', env);
    clickAt(t, 2.03, 0.02);
    const [first, second] = walls(store) as [Wall, Wall];
    expect(walls(store)).toHaveLength(2);
    expect(first.id).toBe('w');
    expect(first.b.x).toBeCloseTo(2);
    expect(second.a.x).toBeCloseTo(2);
    expect(second.b.x).toBeCloseTo(6);
    store.undo();
    expect(walls(store)).toHaveLength(1);
  });

  it('digitar a distância e Enter corta a essa medida do início', () => {
    const { store, env } = oneWall();
    const t = tool('split', env);
    t.move(P(1, 0.02));
    expect(t.inputPrompt()).toBe('Distância do início da parede');
    expect(t.type('3,5')).toBe(true);
    const [first, second] = walls(store) as [Wall, Wall];
    expect(first.b.x).toBeCloseTo(3.5);
    expect(second.a.x).toBeCloseTo(3.5);
  });

  it('medida digitada fora da parede é recusada com o motivo na barra de status', () => {
    const { store, env, messages } = oneWall();
    const t = tool('split', env);
    t.move(P(1, 0.02));
    expect(t.type('9')).toBe(false);
    expect(walls(store)).toHaveLength(1);
    expect(messages.at(-1)).toBe('Ponto de corte inválido para esta parede');
  });

  it('sem parede em destaque não há campo numérico', () => {
    const { env } = oneWall();
    const t = tool('split', env);
    t.move(P(20, 20));
    expect(t.inputPrompt()).toBeNull();
    expect(t.type('2')).toBe(false);
  });

  it('com intervalo: dois cliques removem o trecho entre eles', () => {
    const { store, env } = oneWall();
    const t = tool('split', env);
    t.tab();
    t.move(P(2, 0.02));
    expect(t.inputPrompt()).toBeNull();
    t.click(P(2, 0.02));
    t.move(P(2.5, 0.02));
    t.click(P(2.5, 0.02));
    const [first, second] = walls(store) as [Wall, Wall];
    expect(walls(store)).toHaveLength(2);
    expect(first.b.x).toBeCloseTo(2);
    expect(second.a.x).toBeCloseTo(2.5);
    expect(first.b.x).toBeLessThan(second.a.x);
  });

  it('com intervalo aceita os cliques em qualquer ordem', () => {
    const { store, env } = oneWall();
    const t = tool('split', env);
    t.tab();
    clickAt(t, 3, 0.02);
    clickAt(t, 2, 0.02);
    const [first, second] = walls(store) as [Wall, Wall];
    expect(first.b.x).toBeCloseTo(2);
    expect(second.a.x).toBeCloseTo(3);
  });

  it('Esc cancela o primeiro clique do intervalo antes de sair da ferramenta', () => {
    const { env, done } = oneWall();
    const t = tool('split', env);
    t.tab();
    clickAt(t, 2, 0.02);
    t.cancel();
    expect(done()).toBe(0);
    t.cancel();
    expect(done()).toBe(1);
  });

  it('clicar numa abertura divide a parede que a hospeda e a destaca', () => {
    const { store, env } = oneWall();
    const door: Opening = { id: 'd1', kind: 'door', typeId: 'ot_p80', hostId: 'w', offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' };
    store.exec({ type: 'addOpening', opening: door });
    const t = tool('split', env);
    t.move(P(3, 0.02));
    expect(t.preview()).toContainEqual({ kind: 'highlight', ids: ['w'] });
  });

  it('divide parede em arco pelo ponto clicado sobre o arco', () => {
    const { store, env } = oneWall({ sag: 0.5 });
    const t = tool('split', env);
    clickAt(t, 3, 0.5); // o meio do arco fica a uma flecha da corda
    const [first, second] = walls(store) as [Wall, Wall];
    expect(walls(store)).toHaveLength(2);
    expect(first.sag).not.toBe(0);
    expect(second.sag).not.toBe(0);
    expect(first.b.x).toBeCloseTo(second.a.x);
    expect(first.b.y).toBeCloseTo(second.a.y);
    expect(first.b.y).toBeCloseTo(0.5, 1);
  });

  it('no arco, digitar a distância usa o comprimento do arco', () => {
    const { store, env } = oneWall({ sag: 1 });
    const t = tool('split', env);
    t.move(P(3, 1));
    expect(t.type('3')).toBe(true);
    const [first] = walls(store) as [Wall, Wall];
    expect(first.sag).not.toBe(0);
    expect(first.b.x).toBeLessThan(3);
  });
});
