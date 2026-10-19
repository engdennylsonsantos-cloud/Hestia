import { describe, expect, it } from 'vitest';
import { makeFloor, floorsOnLevel, type Floor, type Id } from '@hestia/model';
import { clipboardFrom, pasteAlignedCommand } from './clipboard.ts';
import { idsOfCategory, idsOfType, selectedTypeId } from './selectionFilters.ts';
import { clickAt, makeEnv, P, tool } from './testEnv.ts';
import type { SelectTool } from './selectTool.ts';

/** Ambiente com um piso retangular 4 × 3 selecionado no nível 0. */
function withFloor() {
  const ctx = makeEnv();
  ctx.store.exec({
    type: 'addFloor',
    floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] }),
  });
  ctx.env.setSelection(['f1']);
  return ctx;
}

/** Ferramenta Selecionar (com arrasto e Delete de vértice). */
const selectTool = (ctx: ReturnType<typeof makeEnv>): SelectTool => tool('select', ctx.env) as SelectTool;

const floorOf = (store: { project: import('@hestia/model').Project }, id: Id): Floor => store.project.elements[id] as Floor;

describe('piso: mover, copiar e seleção (F1, F3)', () => {
  it('mover desloca o contorno pelo comando transform', () => {
    const ctx = withFloor();
    const m = tool('move', ctx.env);
    clickAt(m, 0, 0);
    clickAt(m, 1, 0);
    const f = floorOf(ctx.store, 'f1');
    expect(f.boundary[0]!.x).toBeCloseTo(1);
    expect(f.boundary[2]!.x).toBeCloseTo(5);
    expect(f.boundary[2]!.y).toBeCloseTo(3);
  });

  it('copiar cria um piso novo com id de piso e deixa o original', () => {
    const ctx = withFloor();
    const c = tool('copy', ctx.env);
    clickAt(c, 0, 0);
    clickAt(c, 0, 5);
    c.cancel();
    const fs = floorsOnLevel(ctx.store.project, 'lv_0');
    expect(fs).toHaveLength(2);
    const copy = fs.find((f) => f.id !== 'f1')!;
    expect(copy.id.startsWith('f')).toBe(true);
    expect(copy.boundary[0]!.y).toBeCloseTo(5);
    expect(floorOf(ctx.store, 'f1').boundary[0]!.y).toBeCloseTo(0);
  });

  it('espelhar inverte o piso no eixo sem perder o contorno', () => {
    const ctx = withFloor();
    const mir = tool('mirror', ctx.env);
    clickAt(mir, 10, -5);
    clickAt(mir, 10, 5);
    const f = floorOf(ctx.store, 'f1');
    expect(f.boundary).toHaveLength(4);
    expect(f.boundary[0]!.x).toBeCloseTo(20);
  });

  it('clique no interior do piso (sem parede) seleciona o piso', () => {
    const ctx = withFloor();
    ctx.env.setSelection([]);
    const s = selectTool(ctx);
    s.down(P(2, 1.5));
    s.up(P(2, 1.5));
    expect(ctx.sel()).toEqual(['f1']);
  });

  it('janela que contém o piso o seleciona', () => {
    const ctx = withFloor();
    ctx.env.setSelection([]);
    const s = selectTool(ctx);
    s.down(P(-1, -1));
    s.drag(P(5, 4));
    s.up(P(5, 4));
    expect(ctx.sel()).toEqual(['f1']);
  });
});

describe('piso: edição do contorno (A5)', () => {
  it('arrastar um vértice move só esse vértice (com captura)', () => {
    const ctx = withFloor();
    const s = selectTool(ctx);
    s.down(P(4, 0));
    s.drag(P(5, 0.02));
    s.up(P(5, 0.02));
    const b = floorOf(ctx.store, 'f1').boundary;
    expect(b).toHaveLength(4);
    expect(b[1]!.x).toBeCloseTo(5);
    expect(b[1]!.y).toBeCloseTo(0);
    expect(b[0]).toEqual({ x: 0, y: 0 });
  });

  it('arrastar o meio de uma aresta insere um vértice nela', () => {
    const ctx = withFloor();
    const s = selectTool(ctx);
    s.down(P(2, 0));
    s.drag(P(2, -1));
    s.up(P(2, -1));
    const b = floorOf(ctx.store, 'f1').boundary;
    expect(b).toHaveLength(5);
    expect(b[1]!.x).toBeCloseTo(2);
    expect(b[1]!.y).toBeCloseTo(-1);
  });

  it('clicar num vértice o põe em foco; Delete o remove', () => {
    const ctx = withFloor();
    const s = selectTool(ctx);
    s.down(P(4, 3));
    s.up(P(4, 3));
    expect(s.deleteKey()).toBe(true);
    const b = floorOf(ctx.store, 'f1').boundary;
    expect(b).toHaveLength(3);
    expect(b.some((q) => q.x === 4 && q.y === 3)).toBe(false);
  });

  it('Delete não remove o vértice quando restariam menos de três', () => {
    const ctx = withFloor();
    const s = selectTool(ctx);
    s.down(P(4, 3));
    s.up(P(4, 3));
    s.deleteKey();
    s.down(P(4, 0));
    s.up(P(4, 0));
    expect(s.deleteKey()).toBe(true);
    expect(floorOf(ctx.store, 'f1').boundary).toHaveLength(3);
    // Sem foco válido, o Delete segue para a exclusão da seleção (devolve false).
    s.cancel();
    expect(s.deleteKey()).toBe(false);
  });

  it('Delete sem vértice em foco não é consumido pela ferramenta', () => {
    const ctx = withFloor();
    const s = selectTool(ctx);
    expect(s.deleteKey()).toBe(false);
  });
});

describe('piso: área de transferência e filtros', () => {
  it('copiar e colar alinhado leva os pisos ao nível de destino com ids novos', () => {
    const ctx = withFloor();
    const clip = clipboardFrom(ctx.store.project, ['f1']);
    expect(clip?.floors).toHaveLength(1);
    const r = pasteAlignedCommand(ctx.store.project, clip!, 'lv_1', (prefix) => `${prefix}_novo`);
    expect(r).not.toBeNull();
    expect(r!.floorIds).toHaveLength(1);
    ctx.store.exec(r!.command);
    const onUpper = floorsOnLevel(ctx.store.project, 'lv_1');
    expect(onUpper).toHaveLength(1);
    expect(onUpper[0]!.boundary[2]).toEqual({ x: 4, y: 3 });
  });

  it('idsOfType e selectedTypeId enxergam pisos; categoria "floors" lista só pisos do nível', () => {
    const ctx = withFloor();
    expect(idsOfType(ctx.store.project, 'lv_0', 'ft_ceram')).toEqual(['f1']);
    expect(idsOfCategory(ctx.store.project, 'lv_0', 'floors')).toEqual(['f1']);
    expect(idsOfCategory(ctx.store.project, 'lv_1', 'floors')).toEqual([]);
    expect(selectedTypeId(ctx.store.project, ['f1'])).toEqual({ typeId: 'ft_ceram' });
  });
});
