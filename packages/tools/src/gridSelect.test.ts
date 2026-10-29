import { describe, expect, it } from 'vitest';
import { projectGrids } from '@hestia/model';
import { P, makeEnv, tool } from './testEnv.ts';
import { deleteSelectionIn } from '../../../apps/web/src/editor/deleteIds.ts';
import { useUi } from '../../../apps/web/src/editor/state.ts';
import type { Tool } from './index.ts';

function setup(sag = 0) {
  const m = makeEnv();
  m.store.exec({ type: 'addGrid', grid: { id: 'g1', name: '1', typeId: 'gt_6mm', points: [{ x: 0, y: 0 }, { x: 6, y: 0 }], sag, bubbleStart: false, bubbleEnd: true } });
  const messages: string[] = [];
  const env = { ...m.env, say: (x: string) => { messages.push(x); } };
  const st = tool('select', env);
  return { ...m, env, messages, st, grids: () => projectGrids(m.store.project) };
}

const click = (t: Tool, x: number, y: number): void => { t.move(P(x, y)); t.down!(P(x, y)); t.up!(P(x, y)); };
const drag = (t: Tool, a: [number, number], b: [number, number]): void => {
  t.move(P(...a));
  t.down!(P(...a));
  t.drag!(P(...b));
  t.up!(P(...b));
};

describe('seleção e edição de grades', () => {
  it('clicar na grade a seleciona; clicar no vazio limpa', () => {
    const { st, sel } = setup();
    click(st, 3, 0.02);
    expect(sel()).toEqual(['g1']);
    click(st, 3, 4);
    expect(sel()).toEqual([]);
  });

  it('janela de seleção pega a grade', () => {
    const { st, sel } = setup();
    drag(st, [-1, -1], [7, 1]);
    expect(sel()).toEqual(['g1']);
  });

  it('Delete exclui a grade (removeGrid) e o desfazer a devolve', () => {
    const { st, sel, store, grids } = setup();
    click(st, 3, 0);
    useUi.setState({ selection: sel(), levelId: 'lv_0' });
    deleteSelectionIn(store);
    expect(grids()).toHaveLength(0);
    store.undo();
    expect(grids()).toHaveLength(1);
  });

  it('alça da ponta: arrastar altera o último ponto', () => {
    const { st, grids } = setup();
    click(st, 3, 0);
    drag(st, [6, 0], [8, 2]);
    expect(grids()[0]!.points[1]).toEqual({ x: 8, y: 2 });
    expect(grids()[0]!.points[0]).toEqual({ x: 0, y: 0 });
  });

  it('alça do início: arrastar altera o primeiro ponto', () => {
    const { st, grids } = setup();
    click(st, 3, 0);
    drag(st, [0, 0], [-2, 0]);
    expect(grids()[0]!.points[0]).toEqual({ x: -2, y: 0 });
  });

  it('arco: alça do meio altera a flecha', () => {
    const { st, grids } = setup(1);
    click(st, 3, 1);
    drag(st, [3, 1], [3, 2]);
    expect(grids()[0]!.sag).toBeCloseTo(2);
  });

  it('arrastar a ponta para perto da outra é recusado e avisa', () => {
    const { st, grids, messages } = setup();
    click(st, 3, 0);
    drag(st, [6, 0], [0.01, 0]);
    expect(grids()[0]!.points[1]).toEqual({ x: 6, y: 0 });
    expect(messages.at(-1)).toMatch(/5 cm/);
  });

  it('arrastar a grade selecionada a move', () => {
    const { st, grids } = setup();
    click(st, 3, 0);
    drag(st, [3, 0], [3, 2]);
    expect(grids()[0]!.points).toEqual([{ x: 0, y: 2 }, { x: 6, y: 2 }]);
  });

  it('Mover e Copiar levam a grade; a cópia ganha nome novo', () => {
    const { st, env, sel, grids, store } = setup();
    click(st, 3, 0);
    expect(sel()).toEqual(['g1']);
    const cp = tool('copy', env);
    cp.move(P(0, 0));
    cp.click(P(0, 0));
    cp.move(P(0, 3));
    cp.click(P(0, 3));
    expect(grids()).toHaveLength(2);
    expect(grids()[1]!.name).toBe('2');
    expect(grids()[1]!.points[0]).toEqual({ x: 0, y: 3 });
    store.undo();
    expect(grids()).toHaveLength(1);
  });
});
