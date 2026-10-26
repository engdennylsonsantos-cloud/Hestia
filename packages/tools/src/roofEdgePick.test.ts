import { describe, expect, it } from 'vitest';
import { isRoof, roofsOnLevel, type Id, type Project } from '@hestia/model';
import { roofEdgeAt, roofEdgeHoverPreview, roofEdgeOnLevel } from './roofPick.ts';
import { clickAt, drawWall, makeEnv, P, tool, walls } from './testEnv.ts';
import type { PointerInfo, Tool } from './types.ts';

/** Telhado retangular de 8 × 6, sem balanço, criado pela ferramenta Telhado. A aresta 0 vai de (0,0) a (8,0). */
function comTelhado() {
  const ctx = makeEnv();
  ctx.options.roofMode = 'rect';
  ctx.options.roofShape = 'gable';
  ctx.options.roofOverhang = 0;
  const t = tool('roof', ctx.env);
  clickAt(t, 0, 0);
  clickAt(t, 8, 6);
  const roof = roofsOnLevel(ctx.store.project, 'lv_0')[0]!;
  // A web grava a alternância por `toggleRoofEdge` (applyRoofPatch); aqui o mesmo efeito, direto no modelo.
  ctx.env.toggleRoofEdge = (roofId, index) => {
    const el = ctx.store.project.elements[roofId];
    if (!isRoof(el)) return false;
    const edgeSlopes = el.edgeSlopes.map((v, k) => (k === index ? (v === null ? el.slopePercent : null) : v));
    ctx.store.exec({ type: 'updateElements', ids: [roofId], patch: { edgeSlopes } });
    return true;
  };
  return { ...ctx, roof };
}

/** Clique com botão: pressiona, e solta sem arrasto. Usa `down` e `up`, como a interface faz. */
const press = (t: Tool, x: number, y: number): void => {
  const p: PointerInfo = P(x, y);
  t.move(p);
  t.down!(p);
  t.up!(p);
};

const slopes = (p: Project, id: Id) => {
  const r = p.elements[id];
  return isRoof(r) ? r.edgeSlopes : null;
};

describe('aresta de telhado não selecionado: achar a aresta sob o cursor', () => {
  it('roofEdgeOnLevel acha a aresta de um telhado do nível que não está selecionado', () => {
    const { store, roof } = comTelhado();
    expect(roofEdgeOnLevel(store.project, 'lv_0', [], P(4, 0.02).raw, 0.01)).toEqual({ roofId: roof.id, index: 0 });
  });

  it('o telhado selecionado fica para roofEdgeAt, não para roofEdgeOnLevel', () => {
    const { store, roof } = comTelhado();
    expect(roofEdgeOnLevel(store.project, 'lv_0', [roof.id], P(4, 0.02).raw, 0.01)).toBeNull();
    expect(roofEdgeAt(store.project, [roof.id], P(4, 0.02).raw, 0.01)).toEqual({ roofId: roof.id, index: 0 });
  });

  it('a tolerância é de 8 px: a 7 px acha, a 9 px não', () => {
    const { store } = comTelhado();
    expect(roofEdgeOnLevel(store.project, 'lv_0', [], P(4, 0.07).raw, 0.01)).not.toBeNull();
    expect(roofEdgeOnLevel(store.project, 'lv_0', [], P(4, 0.09).raw, 0.01)).toBeNull();
  });

  it('longe das arestas não acha nada', () => {
    const { store } = comTelhado();
    expect(roofEdgeOnLevel(store.project, 'lv_0', [], P(4, 3).raw, 0.01)).toBeNull();
  });

  it('o pré-destaque é o segmento da aresta, com o id do telhado', () => {
    const { store, roof } = comTelhado();
    const [item] = roofEdgeHoverPreview(store.project, { roofId: roof.id, index: 0 });
    expect(item).toEqual({ kind: 'roofEdgeHover', a: roof.boundary[0], b: roof.boundary[1] });
    expect(roofEdgeHoverPreview(store.project, null)).toEqual([]);
  });
});

describe('aresta de telhado não selecionado: pré-destaque e clique na ferramenta Selecionar', () => {
  it('passar o cursor sobre a aresta, sem selecionar o telhado, mostra o pré-destaque', () => {
    const { env, roof } = comTelhado();
    env.setSelection([]);
    const t = tool('select', env);
    t.move(P(4, 0.02));
    expect(t.preview().find((i) => i.kind === 'roofEdgeHover')).toMatchObject({ a: roof.boundary[0], b: roof.boundary[1] });
    t.move(P(4, 3));
    expect(t.preview().some((i) => i.kind === 'roofEdgeHover')).toBe(false);
  });

  it('clicar na aresta de telhado não selecionado alterna "define inclinação" e não seleciona o telhado', () => {
    const { env, store, roof } = comTelhado();
    env.setSelection([]);
    const t = tool('select', env);
    const antes = slopes(store.project, roof.id);
    expect(antes?.[0]).not.toBeNull();
    press(t, 4, 0.02);
    expect(slopes(store.project, roof.id)?.[0]).toBeNull();
    expect(env.selection()).toEqual([]);
    press(t, 4, 0.02);
    expect(slopes(store.project, roof.id)?.[0]).toEqual(antes?.[0]);
  });

  it('com o telhado selecionado, o clique na aresta a escolhe para o painel e não alterna', () => {
    const { env, store, roof } = comTelhado();
    env.setSelection([roof.id]);
    const t = tool('select', env);
    const antes = slopes(store.project, roof.id);
    // Fora do meio da aresta (4, 0): ali fica a alça de meio de aresta, que vem antes da aresta na ferramenta.
    press(t, 2.5, 0.02);
    expect(slopes(store.project, roof.id)).toEqual(antes);
    expect(env.selection()).toEqual([roof.id]);
    expect(env.roofEdge?.()).toEqual({ roofId: roof.id, index: 0 });
  });

  it('parede sob a aresta ganha o clique: seleciona a parede e não alterna a aresta', () => {
    const { env, store, roof } = comTelhado();
    drawWall(env, [0, 0], [8, 0]);
    const parede = walls(store)[0]!;
    env.setSelection([]);
    const t = tool('select', env);
    const antes = slopes(store.project, roof.id);
    press(t, 4, 0.02);
    expect(env.selection()).toEqual([parede.id]);
    expect(slopes(store.project, roof.id)).toEqual(antes);
  });

  it('arrastar a partir da aresta de telhado não selecionado faz janela e não alterna', () => {
    const { env, store, roof } = comTelhado();
    env.setSelection([]);
    const t = tool('select', env);
    const antes = slopes(store.project, roof.id);
    t.move(P(4, 0.02));
    t.down!(P(4, 0.02));
    t.drag!(P(-1, -1));
    t.up!(P(-1, -1));
    expect(env.selection()).toEqual([roof.id]);
    expect(slopes(store.project, roof.id)).toEqual(antes);
  });

  it('sem toggleRoofEdge na interface, o clique numa aresta de telhado não selecionado não faz nada', () => {
    const { env, store, roof } = comTelhado();
    delete env.toggleRoofEdge;
    env.setSelection([]);
    const t = tool('select', env);
    const antes = slopes(store.project, roof.id);
    press(t, 4, 0.02);
    expect(slopes(store.project, roof.id)).toEqual(antes);
    expect(env.selection()).toEqual([]);
  });
});
