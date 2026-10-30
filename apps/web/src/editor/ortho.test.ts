import { describe, expect, it } from 'vitest';
import { editor } from './controller.ts';
import { useUi } from './state.ts';

const tecla = (key: string): KeyboardEvent => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false } as KeyboardEvent);

describe('F8 — modo ortogonal global', () => {
  it('alterna o modo e avisa na barra de status', () => {
    useUi.setState({ view: 'plan', planKind: 'floor', options: { ...useUi.getState().options, orthoLock: false } });
    expect(editor.key(tecla('F8'))).toBe(true);
    expect(useUi.getState().options.orthoLock).toBe(true);
    expect(useUi.getState().status).toContain('F8');
    expect(editor.key(tecla('F8'))).toBe(true);
    expect(useUi.getState().options.orthoLock).toBe(false);
  });
});
