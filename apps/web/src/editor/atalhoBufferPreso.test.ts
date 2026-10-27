import { beforeEach, describe, expect, it, vi } from 'vitest';
import { editor } from './controller.ts';
import { useUi } from './state.ts';

/** Tecla como o `KeyboardEvent` que o App entrega ao controlador. */
const tecla = (key: string): KeyboardEvent => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }) as unknown as KeyboardEvent;

describe('buffer numérico não pode prender os atalhos', () => {
  beforeEach(() => {
    useUi.setState({ view: 'plan', dialog: null, typed: '', prompt: null });
    editor.setTool('wall');
  });

  it('dígito digitado com a caixa visível vai para o buffer', () => {
    vi.spyOn(editor.activeTool, 'inputPrompt').mockReturnValue('Comprimento');
    editor.bump();
    editor.key(tecla('3'));
    expect(useUi.getState().typed).toBe('3');
  });

  it('quando a ferramenta deixa de pedir número, o buffer zera e a letra volta a ser atalho', () => {
    const prompt = vi.spyOn(editor.activeTool, 'inputPrompt').mockReturnValue('Comprimento');
    editor.bump();
    editor.key(tecla('3'));
    expect(useUi.getState().typed).toBe('3');

    // A caixa some (prompt null) sem Enter nem Esc: antes, o buffer "3" ficava preso e todas as letras eram ignoradas.
    prompt.mockReturnValue(null);
    editor.bump();
    expect(useUi.getState().typed).toBe('');
    expect(editor.key(tecla('W'))).toBe(true);
    expect(useUi.getState().typed).toBe('');
  });

  it('trocar para a vista 3D zera o buffer numérico', () => {
    vi.spyOn(editor.activeTool, 'inputPrompt').mockReturnValue('Comprimento');
    editor.bump();
    editor.key(tecla('3'));
    editor.setView('3d');
    expect(useUi.getState().typed).toBe('');
  });
});
