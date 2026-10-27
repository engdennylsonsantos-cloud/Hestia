import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, type Id, type Wall } from '@hestia/model';
import { createTool, type PointerInfo, type Tool, type ToolEnv, type ToolId, type ToolOptions } from './index.ts';

/** Ambiente de teste igual ao de splitTool.test.ts, mas expõe as mensagens e as opções para ajustar. */
function makeEnv() {
  const store = new ProjectStore(createEmptyProject());
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
  return { store, env, options, done: () => finished, messages };
}

const P = (x: number, y: number, extra: Partial<PointerInfo> = {}): PointerInfo => ({ raw: { x, y }, shift: false, ctrl: false, alt: false, ...extra });
const clickAt = (t: Tool, x: number, y: number) => { t.move(P(x, y)); t.click(P(x, y)); };
const tool = (id: ToolId, env: ToolEnv) => { const t = createTool(id, env); t.start(); return t; };

/** Parede de 0 a 6 m no eixo X, criada pelo próprio store. */
function oneWall() {
  const ctx = makeEnv();
  ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 } }) as Wall });
  return ctx;
}

describe('ferramenta Medir: cota temporária', () => {
  it('a cota fica desenhada depois do segundo clique, sem tocar no modelo', () => {
    const { store, env, messages } = makeEnv();
    const t = tool('measure', env);
    clickAt(t, 0, 0);
    clickAt(t, 3, 4);
    expect(t.preview()).toContainEqual({ kind: 'line', a: { x: 0, y: 0 }, b: { x: 3, y: 4 } });
    expect(t.preview()).toContainEqual({ kind: 'label', at: { x: 1.5, y: 2 }, text: '5,000 m' });
    expect(messages.at(-1)).toContain('Distância 5,000 m');
    expect(Object.keys(store.project.elements)).toHaveLength(0);
  });

  it('Esc apaga a cota; o segundo Esc sai da ferramenta', () => {
    const { env, done } = makeEnv();
    const t = tool('measure', env);
    clickAt(t, 0, 0);
    clickAt(t, 3, 4);
    t.cancel();
    expect(t.preview()).toEqual([]);
    expect(done()).toBe(0);
    t.cancel();
    expect(done()).toBe(1);
  });

  it('um novo clique apaga a cota anterior e começa outra medição', () => {
    const { env } = makeEnv();
    const t = tool('measure', env);
    clickAt(t, 0, 0);
    clickAt(t, 3, 4);
    t.click(P(1, 1));
    expect(t.preview().some((i) => i.kind === 'line')).toBe(false);
  });
});

describe('ferramenta Parede paralela: modo da medida', () => {
  it('ao ativar, a barra de status diz que a medida é face a face (padrão)', () => {
    const { env, messages } = makeEnv();
    tool('parallel', env);
    expect(messages.at(-1)).toContain('face a face');
  });

  it('com a opção Eixos, a mensagem diz entre eixos', () => {
    const { env, options, messages } = makeEnv();
    options.offsetFrom = 'axis';
    tool('parallel', env);
    expect(messages.at(-1)).toContain('entre eixos');
  });
});

describe('ferramenta Unir geometria: explica o clique ignorado', () => {
  it('clique no meio do vão diz que só atua nas pontas', () => {
    const { env, messages } = oneWall();
    const t = tool('joins', env);
    clickAt(t, 3, 0);
    expect(messages.at(-1)).toContain('No meio de uma parede');
  });

  it('clique numa ponta que não encontra outra parede diz o motivo', () => {
    const { store, env, messages } = oneWall();
    const t = tool('joins', env);
    clickAt(t, 0, 0);
    expect(messages.at(-1)).toContain('não encontra outra parede');
    expect((store.project.elements.w as Wall).joinStart.kind).toBe('butt');
  });
});

describe('ferramenta Dividir: texto da distância digitada', () => {
  it('a medida digitada é "do início do trecho"', () => {
    const { store, env, messages } = oneWall();
    const t = tool('split', env);
    t.move(P(3, 0.02));
    expect(t.type('1,5')).toBe(true);
    expect(messages.at(-1)).toBe('Parede dividida a 1,50 m do início do trecho.');
    expect(Object.keys(store.project.elements).length).toBeGreaterThan(1);
  });
});
