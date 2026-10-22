import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall } from '@hestia/model';
import { editor } from './controller.ts';
import { selectionAfterClick } from './selectionClick.ts';
import { clickSelect3d, useUi } from './state.ts';

/** Tecla sem modificadores, como o `KeyboardEvent` que o App entrega ao controlador. */
const tecla = (key: string): KeyboardEvent => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }) as unknown as KeyboardEvent;

describe('seleção por clique na vista 3D (decisão 0016 §3)', () => {
  it('sem Shift/Ctrl, o clique substitui a seleção pelo elemento clicado', () => {
    expect(selectionAfterClick(['a', 'b'], 'c', false)).toEqual(['c']);
    expect(selectionAfterClick([], 'a', false)).toEqual(['a']);
  });

  it('clique no vazio sem Shift limpa a seleção', () => {
    expect(selectionAfterClick(['a', 'b'], null, false)).toEqual([]);
  });

  it('clique no vazio com Shift mantém a seleção', () => {
    expect(selectionAfterClick(['a', 'b'], null, true)).toEqual(['a', 'b']);
  });

  it('com Shift/Ctrl, o elemento entra na seleção (seleção múltipla) ou sai dela (alterna)', () => {
    expect(selectionAfterClick(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(selectionAfterClick(['a', 'b'], 'a', true)).toEqual(['b']);
    expect(selectionAfterClick(['a'], 'a', true)).toEqual([]);
  });

  it('não muta a seleção recebida', () => {
    const atual = ['a'];
    selectionAfterClick(atual, 'b', true);
    expect(atual).toEqual(['a']);
  });
});

describe('controlador na vista 3D: seleção e teclas', () => {
  beforeEach(() => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 4, y: 3 } }) });
    editor.load(store.project, 'teste.hestia.json');
    useUi.setState({ view: '3d', selection: [] });
  });

  it('clickSelect3d: o clique escolhe, o Shift acrescenta, o vazio limpa', () => {
    clickSelect3d('w1', false);
    expect(useUi.getState().selection).toEqual(['w1']);
    clickSelect3d('w2', true);
    expect(useUi.getState().selection).toEqual(['w1', 'w2']);
    clickSelect3d(null, false);
    expect(useUi.getState().selection).toEqual([]);
  });

  it('Esc na vista 3D com a Selecionar limpa a seleção e é consumida', () => {
    useUi.setState({ selection: ['w1'] });
    expect(editor.key(tecla('Escape'))).toBe(true);
    expect(useUi.getState().selection).toEqual([]);
  });

  it('Delete na vista 3D exclui o elemento selecionado', () => {
    clickSelect3d('w1', false);
    expect(editor.key(tecla('Delete'))).toBe(true);
    expect(editor.project.elements.w1).toBeUndefined();
    expect(editor.project.elements.w2).toBeDefined();
    expect(useUi.getState().selection).toEqual([]);
  });

  it('Backspace na vista 3D também exclui; sem seleção, a tecla não é consumida', () => {
    expect(editor.key(tecla('Delete'))).toBe(false);
    clickSelect3d('w2', false);
    expect(editor.key(tecla('Backspace'))).toBe(true);
    expect(editor.project.elements.w2).toBeUndefined();
  });

  it('teclas de ferramenta não trocam a ferramenta na vista 3D (sem desenho no 3D)', () => {
    expect(editor.key(tecla('w'))).toBe(false);
    expect(editor.activeTool.id).toBe('select');
  });
});

describe('Esc na vista 3D segue o da planta (decisão 0016 §5)', () => {
  const ponto = { raw: { x: 1, y: 1 }, shift: false, ctrl: false, alt: false };

  beforeEach(() => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    editor.load(store.project, 'teste.hestia.json');
    useUi.setState({ view: 'plan', selection: [], typed: '' });
    editor.setTool('select');
    useUi.setState({ view: '3d' });
  });

  it('com a ferramenta de parede em operação, o primeiro Esc cancela a operação e fica na parede', () => {
    useUi.setState({ view: 'plan' });
    editor.setTool('wall');
    editor.pointer('click', ponto);
    useUi.setState({ view: '3d' });
    expect(editor.key(tecla('Escape'))).toBe(true);
    expect(useUi.getState().tool).toBe('wall');
  });

  it('sem operação, o Esc com a ferramenta de parede volta à Selecionar e mantém a seleção', () => {
    editor.setTool('wall');
    useUi.setState({ selection: ['w1'] });
    expect(editor.key(tecla('Escape'))).toBe(true);
    expect(useUi.getState().tool).toBe('select');
    expect(useUi.getState().selection).toEqual(['w1']);
  });

  it('na Selecionar sem operação, o Esc limpa a seleção; sem seleção, também é consumido', () => {
    useUi.setState({ selection: ['w1'] });
    expect(editor.key(tecla('Escape'))).toBe(true);
    expect(useUi.getState().selection).toEqual([]);
    expect(editor.key(tecla('Escape'))).toBe(true);
    expect(useUi.getState().tool).toBe('select');
  });

  it('Delete continua excluindo a seleção na 3D', () => {
    clickSelect3d('w1', false);
    expect(editor.key(tecla('Delete'))).toBe(true);
    expect(editor.project.elements.w1).toBeUndefined();
  });
});
