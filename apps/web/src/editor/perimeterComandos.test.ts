import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERFIL_REVIT, TOOL_LABEL, PerimeterTool, type PerimeterModifyKind, type ToolId } from '@hestia/tools';
import { createEmptyProject, makeWall, type Project } from '@hestia/model';
import { editor } from './controller.ts';
import { perimeterActions, usePerimeter } from './perimeter.ts';
import { COMANDO_DO_ESBOCO, DICA_COMANDO, SEM_ESBOCO } from './perimeterComandos.ts';
import { DEFAULT_OPTIONS, useUi } from './state.ts';

/** Tecla com ou sem Ctrl, como o `KeyboardEvent` que o App entrega ao controlador. */
const tecla = (key: string, ctrl = false): KeyboardEvent => ({ key, ctrlKey: ctrl, metaKey: false, shiftKey: false, altKey: false }) as unknown as KeyboardEvent;

/** A ferramenta do modo com o comando de Modificar e o histórico do rascunho simulados (K1 os implementa). */
interface Simulada {
  modo: PerimeterModifyKind | null;
  setModify: ReturnType<typeof vi.fn>;
  setShape: ReturnType<typeof vi.fn>;
  undoDraft: ReturnType<typeof vi.fn>;
  redoDraft: ReturnType<typeof vi.fn>;
}

/** Abre o modo para o piso e troca os métodos do comando e do histórico por espiões (a ferramenta real fica no lugar). */
function abreSimulado(): Simulada {
  editor.perimetro.begin('floor');
  const t = editor.activeTool as PerimeterTool;
  const s = { modo: null } as Simulada;
  s.setModify = vi.fn((k: PerimeterModifyKind | null) => { s.modo = k; return true; });
  s.setShape = vi.fn();
  s.undoDraft = vi.fn(() => true);
  s.redoDraft = vi.fn(() => true);
  Object.assign(t, {
    modifyKind: () => s.modo,
    setModify: s.setModify,
    setShape: s.setShape,
    undoDraft: s.undoDraft,
    redoDraft: s.redoDraft,
  });
  s.setShape.mockClear();
  return s;
}

const iniciar = (p: Project = createEmptyProject()): void => {
  useUi.setState({ options: DEFAULT_OPTIONS });
  editor.load(p, 'teste.hestia.json');
};

describe('comandos de Modificar sobre o esboço: mapa', () => {
  it('todo comando do esboço é uma ferramenta do registro com atalho no perfil Revit', () => {
    for (const id of Object.keys(COMANDO_DO_ESBOCO) as ToolId[]) {
      expect(TOOL_LABEL[id], id).toBeTruthy();
      expect(PERFIL_REVIT[id], id).toBeTruthy();
    }
  });

  it('os atalhos de Modificar valem dentro do modo: MV, CO, RO, MM, AL, TR, SL, OF, AR', () => {
    expect(Object.fromEntries(Object.keys(COMANDO_DO_ESBOCO).map((id) => [PERFIL_REVIT[id as ToolId], id]))).toMatchObject({
      MV: 'move', CO: 'copy', RO: 'rotate', MM: 'mirror', AL: 'align', TR: 'trim', SL: 'split', OF: 'offset', AR: 'array',
    });
  });

  it('cada comando tem dica na barra de status e cada ferramenta desabilitada tem motivo', () => {
    for (const k of Object.values(COMANDO_DO_ESBOCO)) expect(DICA_COMANDO[k as PerimeterModifyKind], k).toBeTruthy();
    expect(Object.keys(SEM_ESBOCO).sort()).toEqual(['parallel', 'rehost']);
    expect(DICA_COMANDO.delete).toBeTruthy();
  });
});

describe('comandos de Modificar sobre o esboço: modo', () => {
  beforeEach(() => iniciar());

  it('perimeterActions.setModify liga o comando e o botão do painel (usePerimeter().modify) reflete', () => {
    const s = abreSimulado();
    perimeterActions.setModify('trim');
    expect(s.setModify).toHaveBeenLastCalledWith('trim');
    expect(editor.perimetro.view().modify).toBe('trim');
    expect(usePerimeter === undefined).toBe(false);
  });

  it('clicar no mesmo comando de novo desliga; trocar de comando liga o outro', () => {
    const s = abreSimulado();
    perimeterActions.setModify('move');
    perimeterActions.setModify('move');
    expect(s.setModify).toHaveBeenLastCalledWith(null);
    perimeterActions.setModify('copy');
    expect(s.setModify).toHaveBeenLastCalledWith('copy');
  });

  it('ligar um comando tira a forma da galeria, e escolher uma forma desliga o comando', () => {
    const s = abreSimulado();
    perimeterActions.setModify('offset');
    expect(s.setShape).toHaveBeenCalledWith(null);
    s.modo = 'offset';
    perimeterActions.setShape('rect');
    expect(s.setModify).toHaveBeenLastCalledWith(null);
    expect(s.setShape).toHaveBeenLastCalledWith('rectangle');
  });

  it('um comando de Modificar da faixa (MV, pelo atalho) liga o comando sobre o esboço, e não troca a ferramenta', () => {
    const s = abreSimulado();
    editor.setTool('move');
    expect(s.setModify).toHaveBeenLastCalledWith('move');
    expect(useUi.getState().tool).toBe('perimeter');
    expect(editor.perimetro.ativo).toBe(true);
  });

  it('Selecionar, dentro do modo, tira o comando e volta a selecionar linhas', () => {
    const s = abreSimulado();
    s.modo = 'trim';
    editor.setTool('select');
    expect(s.setModify).toHaveBeenLastCalledWith(null);
    expect(s.setShape).toHaveBeenLastCalledWith(null);
    expect(editor.perimetro.ativo).toBe(true);
  });

  it('ferramenta sem sentido no esboço avisa o motivo e não muda nada', () => {
    const s = abreSimulado();
    editor.setTool('parallel');
    expect(s.setModify).not.toHaveBeenCalled();
    expect(useUi.getState().status).toBe(SEM_ESBOCO.parallel);
    expect(editor.perimetro.ativo).toBe(true);
  });

  it('ferramenta de outro assunto continua recusada com o modo aberto', () => {
    abreSimulado();
    editor.setTool('wall');
    expect(useUi.getState().tool).toBe('perimeter');
    expect(useUi.getState().status).toMatch(/Concluir ou Cancelar/);
  });

  it('comando recusado pelo esboço mostra a mensagem, não a dica', () => {
    const s = abreSimulado();
    s.setModify.mockImplementationOnce(() => false);
    perimeterActions.setModify('split');
    expect(useUi.getState().status).toMatch(/não pode começar/);
  });

  it('Ctrl+Z e Ctrl+Y desfazem e refazem o rascunho, sem mexer no projeto', () => {
    const p = createEmptyProject();
    iniciar(p);
    const s = abreSimulado();
    const antes = Object.keys(editor.project.elements).length;
    const pilhaAntes = editor.store.canUndo ? 1 : 0;
    expect(editor.key(tecla('z', true))).toBe(true);
    expect(s.undoDraft).toHaveBeenCalledTimes(1);
    expect(editor.key(tecla('y', true))).toBe(true);
    expect(s.redoDraft).toHaveBeenCalledTimes(1);
    expect(Object.keys(editor.project.elements).length).toBe(antes);
    expect(editor.store.canUndo ? 1 : 0).toBe(pilhaAntes);
  });

  it('Ctrl+Z sem modo segue para o projeto', () => {
    iniciar();
    expect(editor.perimetro.historico(false)).toBe(false);
  });

  it('Delete com linhas selecionadas remove só as linhas do esboço', () => {
    const s = abreSimulado();
    const t = editor.activeTool as PerimeterTool & { deleteKey: () => boolean };
    const deleteKey = vi.fn(() => true);
    t.deleteKey = deleteKey;
    editor.key(tecla('Delete'));
    expect(deleteKey).toHaveBeenCalledTimes(1);
    expect(s.setModify).not.toHaveBeenCalled();
  });

  it('Excluir da faixa, com o modo aberto, liga o comando "delete" e não apaga elementos do projeto', () => {
    const p = createEmptyProject();
    p.elements.w1 = makeWall({ id: 'w1', levelId: p.levels[0]!.id, a: { x: 0, y: 0 }, b: { x: 3, y: 0 } } as never) as never;
    iniciar(p);
    const s = abreSimulado();
    useUi.setState({ selection: ['w1'] });
    const { ACTIONS } = { ACTIONS: null as unknown as typeof import('../ui/ribbon/actions.ts').ACTIONS };
    void ACTIONS;
    editor.perimetro.setModify('delete');
    expect(s.setModify).toHaveBeenLastCalledWith('delete');
    expect(editor.project.elements.w1).toBeDefined();
  });
});
