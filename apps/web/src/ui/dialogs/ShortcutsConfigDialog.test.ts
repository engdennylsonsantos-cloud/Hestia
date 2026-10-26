import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShortcutsConfigDialog } from './ShortcutsConfigDialog.tsx';

describe('tela de atalhos de teclado', () => {
  it('renderiza o filtro, os perfis e as ações da tabela', () => {
    const html = renderToStaticMarkup(createElement(ShortcutsConfigDialog));
    expect(html).toContain('Atalhos de teclado');
    expect(html).toContain('Filtrar comandos por nome');
    expect(html).toContain('Restaurar tudo');
  });
});
