import { describe, expect, it } from 'vitest';
import { gridOf, projectGrids, DEFAULT_GRID_TYPE_ID } from '@hestia/model';
import { P, clickAt, drawWall, makeEnv, tool } from './testEnv.ts';
import type { GridMode, ToolEnv } from './index.ts';

function setup(mode: GridMode = 'line') {
  const m = makeEnv();
  m.options.grid = { mode, typeId: DEFAULT_GRID_TYPE_ID };
  const messages: string[] = [];
  const env: ToolEnv = { ...m.env, say: (s) => { messages.push(s); } };
  return { ...m, env, messages, grids: () => projectGrids(m.store.project) };
}

describe('ferramenta Grade: criação', () => {
  it('linha: dois cliques criam a grade "1" com bolha só no fim', () => {
    const { env, grids } = setup();
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    clickAt(t, 6, 0);
    expect(grids()).toHaveLength(1);
    const g = grids()[0]!;
    expect(g.name).toBe('1');
    expect(g.points).toEqual([{ x: 0, y: 0 }, { x: 6, y: 0 }]);
    expect(g.sag).toBe(0);
    expect(g.bubbleStart).toBe(false);
    expect(g.bubbleEnd).toBe(true);
    expect(g.typeId).toBe(DEFAULT_GRID_TYPE_ID);
  });

  it('nomes automáticos em sequência: 1, 2, 3', () => {
    const { env, grids } = setup();
    const t = tool('grid', env);
    for (const x of [0, 3, 6]) { clickAt(t, x, 0); clickAt(t, x, 5); }
    expect(grids().map((g) => g.name)).toEqual(['1', '2', '3']);
  });

  it('prévia da linha mostra o eixo tracejado e o comprimento', () => {
    const { env } = setup();
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    t.move(P(4, 0));
    expect(t.preview().some((i) => i.kind === 'line' && i.dashed)).toBe(true);
    expect(t.preview()).toContainEqual(expect.objectContaining({ kind: 'label', text: '4,00 m' }));
  });

  it('linha: comprimento digitado + Enter segue a direção do cursor', () => {
    const { env, grids } = setup();
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    t.move(P(1, 0));
    expect(t.type('5')).toBe(true);
    expect(grids()[0]!.points[1]!.x).toBeCloseTo(5);
  });

  it('arco: início, fim e terceiro clique definem a flecha com sinal', () => {
    const { env, grids } = setup('arc');
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    clickAt(t, 6, 0);
    clickAt(t, 3, 1);
    clickAt(t, 0, 0);
    clickAt(t, 6, 0);
    clickAt(t, 3, -1.5);
    expect(grids()[0]!.sag).toBeCloseTo(1);
    expect(grids()[1]!.sag).toBeCloseTo(-1.5);
  });

  it('arco: a flecha é limitada à metade da corda', () => {
    const { env, grids } = setup('arc');
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 2, 10);
    expect(grids()[0]!.sag).toBeCloseTo(2);
  });

  it('arco: flecha digitada', () => {
    const { env, grids } = setup('arc');
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    clickAt(t, 6, 0);
    t.move(P(3, 1));
    expect(t.type('0,8')).toBe(true);
    expect(grids()[0]!.sag).toBeCloseTo(0.8);
  });

  it('escolher linhas: clique na parede cria a grade no eixo; parede curva vira arco', () => {
    const { env, store, grids } = setup('pick');
    drawWall(env, [0, 0], [6, 0]);
    const t = tool('grid', env);
    clickAt(t, 3, 0);
    expect(grids()).toHaveLength(1);
    expect(grids()[0]!.points).toEqual([{ x: 0, y: 0 }, { x: 6, y: 0 }]);
    const w = tool('wall', env);
    env.options().wallShape = 'arc';
    clickAt(w, 0, 5);
    clickAt(w, 6, 5);
    clickAt(w, 3, 7);
    w.cancel();
    env.options().wallShape = 'line';
    const arcWall = Object.values(store.project.elements).find((e) => e.kind === 'wall' && e.sag !== 0)!;
    expect(arcWall).toBeTruthy();
    clickAt(t, 3, 7);
    expect(grids()[1]!.sag).toBeCloseTo((arcWall as { sag: number }).sag);
  });

  it('escolher linhas: clique no vazio só avisa', () => {
    const { env, grids, messages } = setup('pick');
    const t = tool('grid', env);
    clickAt(t, 3, 3);
    expect(grids()).toHaveLength(0);
    expect(messages.at(-1)).toMatch(/parede/);
  });

  it('multissegmento: Enter termina; Esc tira o último ponto e depois sai', () => {
    const { env, grids, done } = setup('multi');
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 4, 3);
    t.cancel();
    clickAt(t, 4, 4);
    t.confirm();
    expect(grids()).toHaveLength(1);
    expect(grids()[0]!.points).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }]);
    clickAt(t, 0, 0);
    t.cancel();
    expect(done()).toBe(0);
    t.cancel();
    expect(done()).toBe(1);
  });

  it('multissegmento: duplo clique termina', () => {
    const { env, grids } = setup('multi');
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 4, 3);
    t.click(P(4, 3));
    expect(grids()[0]!.points).toHaveLength(3);
  });

  it('segue o tipo escolhido nas opções', () => {
    const { env, options, grids } = setup();
    options.grid = { mode: 'line', typeId: 'gt_6mm_pontas' };
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    clickAt(t, 5, 0);
    expect(grids()[0]!.typeId).toBe('gt_6mm_pontas');
  });
});

describe('ferramenta Grade: recusas e histórico', () => {
  it('trecho curto: mensagem e nada gravado', () => {
    const { env, grids, messages } = setup();
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    clickAt(t, 0.02, 0);
    expect(grids()).toHaveLength(0);
    expect(messages.at(-1)).toMatch(/5,0 cm/);
  });

  it('nome repetido: sucessor livre quando a letra já existe', () => {
    const { env, store, grids } = setup();
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    clickAt(t, 5, 0);
    store.exec({ type: 'updateGrid', id: grids()[0]!.id, patch: { name: 'A' } });
    clickAt(t, 0, 2);
    clickAt(t, 5, 2);
    expect(grids().map((g) => g.name)).toEqual(['A', 'B']);
  });

  it('recusa do modelo vira mensagem (tipo inexistente)', () => {
    const { env, options, grids, messages } = setup();
    options.grid = { mode: 'line', typeId: 'nao_existe' };
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    clickAt(t, 5, 0);
    expect(grids()).toHaveLength(0);
    expect(messages.at(-1)).toMatch(/Tipo de grade/);
  });

  it('cada grade é um passo de desfazer; refazer devolve', () => {
    const { env, store, grids } = setup();
    const t = tool('grid', env);
    clickAt(t, 0, 0);
    clickAt(t, 5, 0);
    clickAt(t, 0, 2);
    clickAt(t, 5, 2);
    expect(grids()).toHaveLength(2);
    store.undo();
    expect(grids()).toHaveLength(1);
    store.redo();
    expect(grids()).toHaveLength(2);
    expect(gridOf(store.project, grids()[1]!.id)?.name).toBe('2');
  });
});
