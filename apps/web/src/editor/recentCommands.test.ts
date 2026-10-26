import { beforeEach, describe, expect, it, vi } from 'vitest';

const ed = vi.hoisted(() => ({
  activeTool: { id: 'select' as string },
  project: { elements: {} as Record<string, unknown> },
  setTool: vi.fn(),
}));
vi.mock('./controller.ts', () => ({ editor: ed }));

import { registrarFerramenta, registrarSelecao, repeatLast, selectPrevious, useRecent } from './recentCommands.ts';
import { useUi } from './state.ts';

beforeEach(() => {
  useRecent.setState({ recent: [], last: null, prevSelection: [] });
  ed.activeTool = { id: 'select' };
  ed.project = { elements: { w1: {}, w2: {} } };
  ed.setTool.mockReset();
});

describe('registrarFerramenta', () => {
  it('guarda até 8 ferramentas distintas, a mais recente primeiro', () => {
    for (const id of ['wall', 'door', 'window', 'floor', 'slab', 'ceiling', 'roof', 'stair', 'room'] as const) registrarFerramenta(id);
    const { recent, last } = useRecent.getState();
    expect(recent).toHaveLength(8);
    expect(recent[0]).toBe('room');
    expect(recent).not.toContain('wall');
    expect(last).toBe('room');
  });

  it('usar de novo move a ferramenta para o início, sem duplicar', () => {
    registrarFerramenta('wall');
    registrarFerramenta('door');
    registrarFerramenta('wall');
    expect(useRecent.getState().recent).toEqual(['wall', 'door']);
    expect(useRecent.getState().last).toBe('wall');
  });

  it('Selecionar não entra na lista nem vira último comando', () => {
    registrarFerramenta('wall');
    registrarFerramenta('select');
    expect(useRecent.getState().recent).toEqual(['wall']);
    expect(useRecent.getState().last).toBe('wall');
  });
});

describe('registrarSelecao', () => {
  it('guarda a seleção não vazia que foi trocada', () => {
    registrarSelecao(['a', 'b'], ['c']);
    expect(useRecent.getState().prevSelection).toEqual(['a', 'b']);
  });

  it('seleção vazia não substitui a última seleção útil', () => {
    registrarSelecao(['a'], []);
    registrarSelecao([], ['c']);
    expect(useRecent.getState().prevSelection).toEqual(['a']);
  });

  it('mesma seleção (mesmos ids na mesma ordem) não muda nada', () => {
    registrarSelecao(['a'], ['a']);
    expect(useRecent.getState().prevSelection).toEqual([]);
  });
});

describe('repeatLast', () => {
  it('repete o último comando a partir de Selecionar', () => {
    registrarFerramenta('wall');
    expect(repeatLast()).toBe(true);
    expect(ed.setTool).toHaveBeenCalledWith('wall');
  });

  it('não repete sem último comando nem durante outra ferramenta', () => {
    expect(repeatLast()).toBe(false);
    registrarFerramenta('wall');
    ed.activeTool = { id: 'door' };
    expect(repeatLast()).toBe(false);
    expect(ed.setTool).not.toHaveBeenCalled();
  });
});

describe('selectPrevious', () => {
  it('restaura a seleção anterior sem os elementos excluídos', () => {
    useRecent.setState({ prevSelection: ['w1', 'gone'] });
    expect(selectPrevious()).toBe(true);
    expect(useUi.getState().selection).toEqual(['w1']);
  });

  it('sem nada válido, não muda a seleção', () => {
    useRecent.setState({ prevSelection: ['gone'] });
    useUi.setState({ selection: ['w2'] });
    expect(selectPrevious()).toBe(false);
    expect(useUi.getState().selection).toEqual(['w2']);
  });
});
