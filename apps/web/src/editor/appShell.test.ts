import { describe, expect, it } from 'vitest';
import {
  deveBloquearArrastar,
  deveBloquearContextMenu,
  deveBloquearSelecao,
  deveBloquearSelecionarTudo,
  deveBloquearZoomDaPagina,
  deveBloquearZoomPorRoda,
  ehTeclaDeZoomDaPagina,
} from './appShell.ts';

const CONTENTEDITABLE = '[contenteditable]:not([contenteditable="false"])';

/** Elemento simulado: `closest` acha o seletor se ele for um dos `tags` (cada entrada é um seletor simples). */
function alvo(...tags: string[]) {
  return {
    closest: (seletor: string) =>
      seletor
        .split(',')
        .map((s) => s.trim())
        .some((s) => tags.includes(s))
        ? {}
        : null,
  };
}

function tecla(key: string, mods: { ctrl?: boolean; meta?: boolean; code?: string } = {}) {
  return { key, code: mods.code, ctrlKey: !!mods.ctrl, metaKey: !!mods.meta };
}

describe('menu de contexto', () => {
  it('bloqueia numa área comum da interface', () => {
    expect(deveBloquearContextMenu(alvo('div'))).toBe(true);
    expect(deveBloquearContextMenu(null)).toBe(true);
  });

  it('deixa o menu nativo em campos de texto', () => {
    expect(deveBloquearContextMenu(alvo('input'))).toBe(false);
    expect(deveBloquearContextMenu(alvo('textarea'))).toBe(false);
    expect(deveBloquearContextMenu(alvo('select'))).toBe(false);
    expect(deveBloquearContextMenu(alvo(CONTENTEDITABLE))).toBe(false);
  });

  it('deixa o menu nativo em trechos .selectable', () => {
    expect(deveBloquearContextMenu(alvo('.selectable'))).toBe(false);
  });
});

describe('arrastar', () => {
  it('bloqueia arrastar imagem, ícone vetorial e link', () => {
    expect(deveBloquearArrastar(alvo('img'))).toBe(true);
    expect(deveBloquearArrastar(alvo('svg'))).toBe(true);
    expect(deveBloquearArrastar(alvo('a'))).toBe(true);
  });

  it('libera o que foi marcado como draggable="true"', () => {
    expect(deveBloquearArrastar(alvo('img', '[draggable="true"]'))).toBe(false);
  });

  it('não mexe em outros elementos', () => {
    expect(deveBloquearArrastar(alvo('div'))).toBe(false);
    expect(deveBloquearArrastar(null)).toBe(false);
  });
});

describe('zoom da página pelo teclado', () => {
  it('reconhece +, =, -, 0 com Ctrl ou Cmd e as teclas do numérico', () => {
    expect(ehTeclaDeZoomDaPagina(tecla('+', { ctrl: true }))).toBe(true);
    expect(ehTeclaDeZoomDaPagina(tecla('=', { ctrl: true }))).toBe(true);
    expect(ehTeclaDeZoomDaPagina(tecla('-', { meta: true }))).toBe(true);
    expect(ehTeclaDeZoomDaPagina(tecla('0', { ctrl: true }))).toBe(true);
    expect(ehTeclaDeZoomDaPagina(tecla('+', { ctrl: true, code: 'NumpadAdd' }))).toBe(true);
    expect(ehTeclaDeZoomDaPagina(tecla('-', { ctrl: true, code: 'NumpadSubtract' }))).toBe(true);
  });

  it('não bloqueia os atalhos da aplicação nem teclas sem modificador', () => {
    for (const k of ['z', 'y', 's', 'c', 'v', 'p']) {
      expect(ehTeclaDeZoomDaPagina(tecla(k, { ctrl: true }))).toBe(false);
    }
    expect(ehTeclaDeZoomDaPagina(tecla('F5'))).toBe(false);
    expect(ehTeclaDeZoomDaPagina(tecla('F12'))).toBe(false);
    expect(ehTeclaDeZoomDaPagina(tecla('+'))).toBe(false);
  });

  it('bloqueia fora de campo de texto e deixa passar dentro dele', () => {
    expect(deveBloquearZoomDaPagina(tecla('+', { ctrl: true }), alvo('div'))).toBe(true);
    expect(deveBloquearZoomDaPagina(tecla('+', { ctrl: true }), alvo('input'))).toBe(false);
  });
});

describe('zoom da página pela roda', () => {
  it('bloqueia Ctrl+roda fora do canvas', () => {
    expect(deveBloquearZoomPorRoda({ ctrlKey: true, metaKey: false }, alvo('div'))).toBe(true);
    expect(deveBloquearZoomPorRoda({ ctrlKey: false, metaKey: true }, alvo('div'))).toBe(true);
  });

  it('deixa o canvas tratar o próprio Ctrl+roda', () => {
    expect(deveBloquearZoomPorRoda({ ctrlKey: true, metaKey: false }, alvo('.canvas-wrap'))).toBe(false);
  });

  it('não mexe na roda sem modificador', () => {
    expect(deveBloquearZoomPorRoda({ ctrlKey: false, metaKey: false }, alvo('div'))).toBe(false);
  });
});

describe('selecionar tudo', () => {
  it('bloqueia Ctrl+A fora de campo de texto, inclusive com Shift', () => {
    expect(deveBloquearSelecionarTudo(tecla('a', { ctrl: true }), alvo('div'))).toBe(true);
    expect(deveBloquearSelecionarTudo(tecla('A', { meta: true }), alvo('div'))).toBe(true);
  });

  it('deixa Ctrl+A dentro de campo e sem modificador', () => {
    expect(deveBloquearSelecionarTudo(tecla('a', { ctrl: true }), alvo('input'))).toBe(false);
    expect(deveBloquearSelecionarTudo(tecla('a'), alvo('div'))).toBe(false);
  });
});

describe('seleção de texto', () => {
  it('bloqueia seleção na interface comum', () => {
    expect(deveBloquearSelecao(alvo('div'))).toBe(true);
    expect(deveBloquearSelecao(alvo('span'))).toBe(true);
  });

  it('libera campos, .selectable e tabelas de dados', () => {
    expect(deveBloquearSelecao(alvo('input'))).toBe(false);
    expect(deveBloquearSelecao(alvo(CONTENTEDITABLE))).toBe(false);
    expect(deveBloquearSelecao(alvo('.selectable'))).toBe(false);
    expect(deveBloquearSelecao(alvo('.wsched'))).toBe(false);
    expect(deveBloquearSelecao(alvo('.layers'))).toBe(false);
    expect(deveBloquearSelecao(alvo('.dialog .hint'))).toBe(false);
    expect(deveBloquearSelecao(alvo('.dialog .error'))).toBe(false);
  });
});
