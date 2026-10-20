import { describe, expect, it } from 'vitest';
import { roofsOnLevel, type Project, type Roof } from '@hestia/model';
import { clipboardFrom, pasteAlignedCommand } from './clipboard.ts';
import { copyWalls, selectedMovables } from './edit.ts';
import { idsOfCategory, selectedTypeId } from './selectionFilters.ts';
import { pickRoofAt, roofGripAt, roofIdsInBox } from './roofPick.ts';
import { clickAt, drawWall, makeEnv, P, tool } from './testEnv.ts';

/** Telhado retangular 6 × 4 criado pela ferramenta e selecionado. */
function withRoof() {
  const ctx = makeEnv();
  ctx.options.roofMode = 'rect';
  const t = tool('roof', ctx.env);
  clickAt(t, 0, 0);
  clickAt(t, 6, 4);
  const r = roofsOnLevel(ctx.store.project, 'lv_0')[0]!;
  ctx.env.setSelection([r.id]);
  return { ...ctx, roof: () => ctx.store.project.elements[r.id] as Roof, id: r.id };
}

const roofAt = (p: Project, x: number, y: number) => pickRoofAt(p, 'lv_0', { x, y }, 0.01);

describe('telhado: captura e prioridade (A8)', () => {
  it('clique dentro do beiral pega o telhado; fora, nada', () => {
    const ctx = withRoof();
    expect(roofAt(ctx.store.project, 3, 2)).toBe(ctx.id);
    expect(roofAt(ctx.store.project, 9, 9)).toBeNull();
  });

  it('a parede tem prioridade sobre o telhado sob o cursor', () => {
    const ctx = withRoof();
    drawWall(ctx.env, [3, -1], [3, 5]);
    const sel = tool('select', ctx.env);
    ctx.env.setSelection([]);
    sel.down?.(P(3, 2));
    sel.up?.(P(3, 2));
    const selected = ctx.sel();
    expect(selected).toHaveLength(1);
    expect(selected[0]).not.toBe(ctx.id);
    expect(ctx.store.project.elements[selected[0]!]?.kind).toBe('wall');
  });

  it('clique no telhado (sem parede) seleciona o telhado', () => {
    const ctx = withRoof();
    ctx.env.setSelection([]);
    const sel = tool('select', ctx.env);
    sel.move(P(2, 2));
    sel.down?.(P(2, 2));
    sel.up?.(P(2, 2));
    expect(ctx.sel()).toEqual([ctx.id]);
  });

  it('janela de seleção pega o telhado que cabe nela (esq→dir) ou que a cruza (dir→esq)', () => {
    const ctx = withRoof();
    expect(roofIdsInBox(ctx.store.project, 'lv_0', { x: -1, y: -1 }, { x: 7, y: 5 })).toEqual([ctx.id]);
    expect(roofIdsInBox(ctx.store.project, 'lv_0', { x: 2, y: 1 }, { x: 9, y: 9 })).toEqual([]);
    expect(roofIdsInBox(ctx.store.project, 'lv_0', { x: 9, y: 1 }, { x: 4, y: 2 })).toEqual([ctx.id]);
  });
});

describe('telhado: alças nos vértices e no meio das arestas (A8)', () => {
  it('vértice e meio de aresta são reconhecidos só entre os selecionados', () => {
    const ctx = withRoof();
    expect(roofGripAt(ctx.store.project, [ctx.id], { x: 6, y: 0 }, 0.01)).toMatchObject({ kind: 'vertex', index: 1 });
    expect(roofGripAt(ctx.store.project, [ctx.id], { x: 3, y: 0 }, 0.01)).toMatchObject({ kind: 'edge', index: 0 });
    expect(roofGripAt(ctx.store.project, [], { x: 6, y: 0 }, 0.01)).toBeNull();
  });

  it('arrastar um vértice reescreve o contorno do beiral', () => {
    const ctx = withRoof();
    const sel = tool('select', ctx.env);
    sel.move(P(6, 4));
    sel.down?.(P(6, 4));
    sel.drag?.(P(7, 5));
    sel.up?.(P(7, 5));
    expect(ctx.roof().boundary[2]!.x).toBeCloseTo(7);
    expect(ctx.roof().boundary[2]!.y).toBeCloseTo(5);
  });
});

describe('telhado: mover, copiar e colar (F1, F2)', () => {
  it('o telhado entra nos movíveis da seleção', () => {
    const ctx = withRoof();
    expect(selectedMovables(ctx.store.project, [ctx.id])).toEqual([ctx.id]);
  });

  it('copiar com translação cria telhado com id novo e contorno deslocado', () => {
    const ctx = withRoof();
    const [nid] = copyWalls(ctx.env, [ctx.id], { kind: 'translate', d: { x: 10, y: 0 } });
    expect(nid!.startsWith('t')).toBe(true);
    expect(nid).not.toBe(ctx.id);
    expect(roofsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(2);
    const copy = ctx.store.project.elements[nid!] as Roof;
    expect(copy.boundary[0]!.x).toBeCloseTo(10);
    expect(copy.kind).toBe('roof');
  });

  it('copiar e colar alinhado recria o telhado no mesmo lugar com id novo', () => {
    const ctx = withRoof();
    const clip = clipboardFrom(ctx.store.project, [ctx.id]);
    expect(clip?.roofs).toHaveLength(1);
    const pasted = pasteAlignedCommand(ctx.store.project, clip!, 'lv_0', (prefix) => `${prefix}_colado`);
    expect(pasted?.roofIds).toHaveLength(1);
    ctx.store.exec(pasted!.command);
    const rs = roofsOnLevel(ctx.store.project, 'lv_0');
    expect(rs).toHaveLength(2);
    expect(rs.find((r) => r.id === pasted!.roofIds[0])!.boundary[2]).toEqual(ctx.roof().boundary[2]);
  });
});

describe('telhado: filtros de seleção (F3)', () => {
  it('categoria roofs e tipo do telhado', () => {
    const ctx = withRoof();
    expect(idsOfCategory(ctx.store.project, 'lv_0', 'roofs')).toEqual([ctx.id]);
    expect(selectedTypeId(ctx.store.project, [ctx.id])).toEqual({ typeId: 'rt_ceramica' });
  });
});

