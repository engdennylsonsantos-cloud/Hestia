import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERFIL_REVIT, TOOL_LABEL, PerimeterTool, type PerimeterModifyKind, type ToolId } from '@hestia/tools';
import { createEmptyProject, type Project } from '@hestia/model';
import { editor } from './controller.ts';
import { perimeterActions } from './perimeter.ts';
import { COMANDO_DO_ESBOCO, DICA_COMANDO, SEM_ESBOCO } from './perimeterComandos.ts';
import { DEFAULT_OPTIONS, useUi } from './state.ts';

/** Tecla com ou sem Ctrl, como o `KeyboardEvent` que o App entrega ao controlador. */
const tecla = (key: string, ctrl = false): KeyboardEvent => ({ key, ctrlKey: ctrl, metaKey: false, shiftKey: false, altKey: false }) as unknown as KeyboardEvent;

/** Espiões do comando de Modificar e do histórico do rascunho, postos na ferramenta do modo (K1 os implementa na ferramenta). */
interface Espias {
  modo: PerimeterModifyKind | null;
  setModify: ReturnType<typeof vi.fn>;
  setShape: ReturnType<typeof vi.fn>;
  undoDraft: ReturnType<typeof vi.fn>;
  redoDraft: ReturnType<typeof vi.fn>;
}

/** Abre o modo para o piso e troca os métodos do comando e do histórico por espiões; a ferramenta real continua no lugar. */
function abreComEspias(): Espias {
  editor.perimetro.begin('floor');
  const t = editor.activeTool as PerimeterTool;
  const e: Espias = {
    modo: null,
    setModify: vi.fn(),
    setShape: vi.fn(),
    undoDraft: vi.fn(() => true),
    redoDraft: vi.fn(() => true),
  };
  e.setModify.mockImplementation((k: PerimeterModifyKind | null) => {
    e.modo = k;
    return true;
  });
  Object.assign(t, {
    modifyKind: () => e.modo,
    setModify: e.setModify,
    setShape: e.setShape,
    undoDraft: e.undoDraft,
    redoDraft: e.redoDraft,
  });
  e.setShape.mockClear();
  return e;
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
    const porAtalho = Object.fromEntries(Object.keys(COMANDO_DO_ESBOCO).map((id) => [PERFIL_REVIT[id as ToolId], id]));
    expect(porAtalho).toMatchObject({ MV: 'move', CO: 'copy', RO: 'rotate', MM: 'mirror', AL: 'align', TR: 'trim', SL: 'split', OF: 'offset', AR: 'array' });
  });

  it('cada comando tem dica na barra de status, e as ferramentas sem sentido no esboço têm motivo', () => {
    for (const k of Object.values(COMANDO_DO_ESBOCO)) expect(DICA_COMANDO[k as PerimeterModifyKind], k).toBeTruthy();
    expect(DICA_COMANDO.delete).toBeTruthy();
    expect(Object.keys(SEM_ESBOCO).sort()).toEqual(['parallel', 'rehost']);
  });
});

describe('comandos de Modificar sobre o esboço: modo', () => {
  beforeEach(() => iniciar());

  it('perimeterActions.setModify liga o comando e a visão do modo (usada pelo painel) reflete', () => {
    const e = abreComEspias();
    perimeterActions.setModify('trim');
    expect(e.setModify).toHaveBeenLastCalledWith('trim');
    expect(editor.perimetro.view().modify).toBe('trim');
  });

  it('clicar no mesmo comando de novo desliga; escolher outro comando liga o outro', () => {
    const e = abreComEspias();
    perimeterActions.setModify('move');
    perimeterActions.setModify('move');
    expect(e.setModify).toHaveBeenLastCalledWith(null);
    perimeterActions.setModify('copy');
    expect(e.setModify).toHaveBeenLastCalledWith('copy');
  });

  it('ligar um comando tira a forma da galeria; escolher uma forma desliga o comando', () => {
    const e = abreComEspias();
    perimeterActions.setModify('offset');
    expect(e.setShape).toHaveBeenLastCalledWith(null);
    e.modo = 'offset';
    e.setModify.mockClear();
    perimeterActions.setShape('rect');
    expect(e.setModify).toHaveBeenCalledWith(null);
    expect(e.setShape).toHaveBeenLastCalledWith('rectangle');
  });

  it('um comando de Modificar pelo atalho (MV) liga o comando sobre o esboço, sem trocar a ferramenta', () => {
    const e = abreComEspias();
    editor.setTool('move');
    expect(e.setModify).toHaveBeenLastCalledWith('move');
    expect(useUi.getState().tool).toBe('perimeter');
    expect(editor.perimetro.ativo).toBe(true);
  });

  it('Selecionar, dentro do modo, tira o comando e a forma: a ferramenta volta às linhas', () => {
    const e = abreComEspias();
    e.modo = 'trim';
    editor.setTool('select');
    expect(e.setModify).toHaveBeenLastCalledWith(null);
    expect(e.setShape).toHaveBeenLastCalledWith(null);
    expect(editor.perimetro.ativo).toBe(true);
  });

  it('ferramenta sem sentido no esboço avisa o motivo e não liga nada', () => {
    const e = abreComEspias();
    editor.setTool('parallel');
    expect(e.setModify).not.toHaveBeenCalled();
    expect(useUi.getState().status).toBe(SEM_ESBOCO.parallel);
    expect(editor.perimetro.ativo).toBe(true);
  });

  it('ferramenta de outro assunto continua recusada com o modo aberto', () => {
    abreComEspias();
    editor.setTool('wall');
    expect(useUi.getState().tool).toBe('perimeter');
    expect(useUi.getState().status).toMatch(/Concluir ou Cancelar/);
  });

  it('comando que o esboço recusa mostra a mensagem de recusa, não a dica', () => {
    const e = abreComEspias();
    e.setModify.mockImplementationOnce(() => false);
    perimeterActions.setModify('split');
    expect(useUi.getState().status).toMatch(/não pode começar/);
  });

  it('Ctrl+Z e Ctrl+Y desfazem e refazem o rascunho, e não o histórico do projeto', () => {
    iniciar();
    editor.store.exec({ type: 'setSettings', patch: { showTags: true } }, 'Teste');
    const e = abreComEspias();
    expect(editor.key(tecla('z', true))).toBe(true);
    expect(e.undoDraft).toHaveBeenCalledTimes(1);
    expect(editor.key(tecla('y', true))).toBe(true);
    expect(e.redoDraft).toHaveBeenCalledTimes(1);
    expect(editor.store.canUndo).toBe(true);
    expect(editor.project.settings.showTags).toBe(true);
  });

  it('Ctrl+Z sem modo segue para o projeto', () => {
    iniciar();
    editor.store.exec({ type: 'setSettings', patch: { showTags: true } }, 'Teste');
    editor.key(tecla('z', true));
    expect(editor.project.settings.showTags).not.toBe(true);
  });

  it('Delete com linhas selecionadas remove as linhas do esboço, não passa pelo comando', () => {
    const e = abreComEspias();
    const t = editor.activeTool as PerimeterTool & { deleteKey: () => boolean };
    const deleteKey = vi.fn(() => true);
    t.deleteKey = deleteKey;
    editor.key(tecla('Delete'));
    expect(deleteKey).toHaveBeenCalledTimes(1);
    expect(e.setModify).not.toHaveBeenCalled();
  });

  it('Excluir (comando "delete") liga pelo modo e não chama a exclusão do projeto', () => {
    const e = abreComEspias();
    const exclui = vi.spyOn(editor, 'deleteSelection');
    editor.perimetro.setModify('delete');
    expect(e.setModify).toHaveBeenLastCalledWith('delete');
    expect(exclui).not.toHaveBeenCalled();
    exclui.mockRestore();
  });
});
