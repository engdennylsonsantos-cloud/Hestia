import { describe, expect, it } from 'vitest';
import { makeSlab, slabsOnLevel, type Id, type Project, type Slab } from '@hestia/model';
import { clipboardFrom, pasteAlignedCommand } from './clipboard.ts';
import { idsOfCategory, idsOfType, selectedTypeId } from './selectionFilters.ts';
import { pickSlabAt, slabGripAt, slabIdsInBox } from './slabPick.ts';
import { clickAt, makeEnv, P, tool } from './testEnv.ts';
import type { SelectTool } from './selectTool.ts';

/** Ambiente com uma laje retangular 4 × 3 (id s1) no nível 0, selecionada. */
function withSlab() {
  const ctx = makeEnv();
  ctx.store.exec({
    type: 'addSlab',
    slab: makeSlab({ id: 's1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] }),
  });
  ctx.env.setSelection(['s1']);
  return ctx;
}

const slabOf = (store: { project: Project }, id: Id): Slab => store.project.elements[id] as Slab;
const selectTool = (ctx: ReturnType<typeof makeEnv>): SelectTool => tool('select', ctx.env) as SelectTool;

describe('laje: pick, janela e alças (F1)', () => {
  it('clique no interior pega a laje; dentro de furo não; na borda sim', () => {
    const ctx = withSlab();
    ctx.store.exec({ type: 'updateElements', ids: ['s1'], patch: { holes: [[{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1.5, y: 2 }]] } });
    expect(pickSlabAt(ctx.store.project, 'lv_0', { x: 3, y: 2 }, 0.01)).toBe('s1');
    expect(pickSlabAt(ctx.store.project, 'lv_0', { x: 1.5, y: 1.3 }, 0.01)).toBeNull();
    expect(pickSlabAt(ctx.store.project, 'lv_0', { x: 4, y: 1 }, 0.01)).toBe('s1');
    expect(pickSlabAt(ctx.store.project, 'lv_0', { x: 6, y: 1 }, 0.01)).toBeNull();
  });

  it('janela: esq→dir só pega a laje inteira; dir→esq pega a que cruza', () => {
    const ctx = withSlab();
    expect(slabIdsInBox(ctx.store.project, 'lv_0', { x: -1, y: -1 }, { x: 5, y: 4 })).toEqual(['s1']);
    expect(slabIdsInBox(ctx.store.project, 'lv_0', { x: 2, y: -1 }, { x: 6, y: 4 })).toEqual([]);
    expect(slabIdsInBox(ctx.store.project, 'lv_0', { x: 6, y: 1 }, { x: 2, y: 2 })).toEqual(['s1']);
  });

  it('alça: vértice tem prioridade; meio da aresta é alça de aresta; laje não selecionada não tem alça', () => {
    const ctx = withSlab();
    expect(slabGripAt(ctx.store.project, ['s1'], { x: 4, y: 0 }, 0.01)).toMatchObject({ kind: 'vertex', index: 1 });
    expect(slabGripAt(ctx.store.project, ['s1'], { x: 2, y: 0 }, 0.01)).toMatchObject({ kind: 'edge', index: 0 });
    expect(slabGripAt(ctx.store.project, [], { x: 4, y: 0 }, 0.01)).toBeNull();
  });

  it('clique no interior da laje (sem parede) a seleciona', () => {
    const ctx = withSlab();
    ctx.env.setSelection([]);
    const s = selectTool(ctx);
    s.down(P(2, 1.5));
    s.up(P(2, 1.5));
    expect(ctx.sel()).toEqual(['s1']);
  });

  it('janela que contém a laje a seleciona', () => {
    const ctx = withSlab();
    ctx.env.setSelection([]);
    const s = selectTool(ctx);
    s.down(P(-1, -1));
    s.drag(P(5, 4));
    s.up(P(5, 4));
    expect(ctx.sel()).toEqual(['s1']);
  });

  it('arrastar um vértice move só esse vértice', () => {
    const ctx = withSlab();
    const s = selectTool(ctx);
    s.down(P(4, 0));
    s.drag(P(5, 0.02));
    s.up(P(5, 0.02));
    const b = slabOf(ctx.store, 's1').boundary;
    expect(b).toHaveLength(4);
    expect(b[1]!.x).toBeCloseTo(5);
    expect(b[1]!.y).toBeCloseTo(0);
    expect(b[0]).toEqual({ x: 0, y: 0 });
  });

  it('arrastar o meio de uma aresta insere um vértice nela', () => {
    const ctx = withSlab();
    const s = selectTool(ctx);
    s.down(P(2, 0));
    s.drag(P(2, -1));
    s.up(P(2, -1));
    const b = slabOf(ctx.store, 's1').boundary;
    expect(b).toHaveLength(5);
    expect(b[1]!.x).toBeCloseTo(2);
    expect(b[1]!.y).toBeCloseTo(-1);
  });

  it('clicar num vértice o põe em foco; Delete o remove, mantendo ao menos três', () => {
    const ctx = withSlab();
    const s = selectTool(ctx);
    s.down(P(4, 3));
    s.up(P(4, 3));
    expect(s.deleteKey()).toBe(true);
    expect(slabOf(ctx.store, 's1').boundary).toHaveLength(3);
    s.down(P(4, 0));
    s.up(P(4, 0));
    expect(s.deleteKey()).toBe(true);
    expect(slabOf(ctx.store, 's1').boundary).toHaveLength(3);
    s.cancel();
    expect(s.deleteKey()).toBe(false);
  });
});

describe('laje: mover, copiar, espelhar (F1)', () => {
  it('mover desloca o contorno pelo comando transform e mantém o tipo', () => {
    const ctx = withSlab();
    const m = tool('move', ctx.env);
    clickAt(m, 0, 0);
    clickAt(m, 1, 0);
    const s = slabOf(ctx.store, 's1');
    expect(s.boundary[0]!.x).toBeCloseTo(1);
    expect(s.boundary[2]!.x).toBeCloseTo(5);
    expect(s.boundary[2]!.y).toBeCloseTo(3);
    expect(s.typeId).toBe('ls_mac12');
  });

  it('copiar cria uma laje nova com id de laje e deixa a original', () => {
    const ctx = withSlab();
    const c = tool('copy', ctx.env);
    clickAt(c, 0, 0);
    clickAt(c, 0, 5);
    c.cancel();
    const ss = slabsOnLevel(ctx.store.project, 'lv_0');
    expect(ss).toHaveLength(2);
    const copy = ss.find((s) => s.id !== 's1')!;
    expect(copy.id.startsWith('l')).toBe(true);
    expect(copy.boundary[0]!.y).toBeCloseTo(5);
    expect(slabOf(ctx.store, 's1').boundary[0]!.y).toBeCloseTo(0);
  });

  it('espelhar mantém a laje com o mesmo número de vértices', () => {
    const ctx = withSlab();
    const mir = tool('mirror', ctx.env);
    clickAt(mir, 10, -5);
    clickAt(mir, 10, 5);
    const s = slabOf(ctx.store, 's1');
    expect(s.boundary).toHaveLength(4);
    expect(s.boundary[0]!.x).toBeCloseTo(20);
  });
});

describe('laje: área de transferência e filtros (F2, F3)', () => {
  it('copiar e colar alinhado leva a laje ao nível de destino com id novo', () => {
    const ctx = withSlab();
    const clip = clipboardFrom(ctx.store.project, ['s1']);
    expect(clip?.slabs).toHaveLength(1);
    const r = pasteAlignedCommand(ctx.store.project, clip!, 'lv_1', (prefix) => `${prefix}_novo`);
    expect(r).not.toBeNull();
    expect(r!.slabIds).toHaveLength(1);
    ctx.store.exec(r!.command);
    const up = slabsOnLevel(ctx.store.project, 'lv_1');
    expect(up).toHaveLength(1);
    expect(up[0]!.boundary[2]).toEqual({ x: 4, y: 3 });
  });

  it('idsOfType e selectedTypeId enxergam lajes; categoria "slabs" lista só lajes do nível', () => {
    const ctx = withSlab();
    expect(idsOfType(ctx.store.project, 'lv_0', 'ls_mac12')).toEqual(['s1']);
    expect(idsOfCategory(ctx.store.project, 'lv_0', 'slabs')).toEqual(['s1']);
    expect(idsOfCategory(ctx.store.project, 'lv_1', 'slabs')).toEqual([]);
    expect(selectedTypeId(ctx.store.project, ['s1'])).toEqual({ typeId: 'ls_mac12' });
  });
});
