import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_THEME, alternaFileMenu, toggleFileMenu, useUi } from './state.ts';

afterEach(() => useUi.setState({ fileMenu: false, theme: DEFAULT_THEME }));

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

describe('tema ao abrir o app', () => {
  it('inicia no claro, sem seguir a preferência escura do sistema', () => {
    expect(DEFAULT_THEME).toBe('light');
    expect(useUi.getState().theme).toBe('light');
  });

  it('a escolha manual de escuro ou sistema continua valendo na sessão', () => {
    useUi.setState({ theme: 'dark' });
    expect(useUi.getState().theme).toBe('dark');
    useUi.setState({ theme: 'system' });
    expect(useUi.getState().theme).toBe('system');
    useUi.setState({ theme: 'light' });
    expect(useUi.getState().theme).toBe('light');
  });
});
