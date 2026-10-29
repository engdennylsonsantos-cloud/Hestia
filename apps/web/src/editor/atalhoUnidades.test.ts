import { beforeEach, describe, expect, it } from 'vitest';
import { editor } from './controller.ts';
import { trocarPerfil } from './shortcutConfig.ts';
import { useUi } from './state.ts';

/** Tecla como o `KeyboardEvent` que o App entrega ao controlador. */
const tecla = (key: string): KeyboardEvent => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }) as unknown as KeyboardEvent;

describe('atalho UN abre o diálogo Unidades do projeto', () => {
  beforeEach(() => {
    useUi.setState({ view: 'plan', dialog: null, dialogArg: null, typed: '', prompt: null });
    trocarPerfil('revit');
    editor.setTool('wall');
  });

  it('U, N abre o diálogo e não troca a ferramenta', () => {
    expect(editor.key(tecla('U'))).toBe(true);
    expect(editor.key(tecla('N'))).toBe(true);
    expect(useUi.getState().dialog).toBe('units');
    expect(editor.activeTool.id).toBe('wall');
  });
});
