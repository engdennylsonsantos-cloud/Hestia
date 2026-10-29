import { afterEach, describe, expect, it } from 'vitest';
import { alternaFileMenu, toggleFileMenu, useUi } from './state.ts';

afterEach(() => useUi.setState({ fileMenu: false }));

describe('botão H da barra de título: menu Arquivo', () => {
  it('fechado abre e aberto fecha', () => {
    expect(alternaFileMenu(false)).toBe(true);
    expect(alternaFileMenu(true)).toBe(false);
  });

  it('a ação do botão abre, fecha e abre de novo', () => {
    toggleFileMenu();
    expect(useUi.getState().fileMenu).toBe(true);
    toggleFileMenu();
    expect(useUi.getState().fileMenu).toBe(false);
    toggleFileMenu();
    expect(useUi.getState().fileMenu).toBe(true);
  });
});
