import { describe, expect, it } from 'vitest';
import { DEFAULT_DOCK, type DockLayout } from '../editor/dockLayout.ts';
import { applyDrop, dropZoneAt, previewRect, type Rect } from './dockDrag.ts';

const ws: Rect = { left: 0, top: 0, width: 1000, height: 800 };
/** Painel de propriedades acoplado à esquerda, ocupando a faixa de 250 px. */
const painelEsq: Rect = { left: 0, top: 0, width: 250, height: 400 };

describe('dropZoneAt', () => {
  it('faixas da esquerda e da direita do workspace (25%)', () => {
    expect(dropZoneAt({ x: 100, y: 400 }, ws, null)).toBe('left');
    expect(dropZoneAt({ x: 249, y: 400 }, ws, null)).toBe('left');
    expect(dropZoneAt({ x: 900, y: 400 }, ws, null)).toBe('right');
    expect(dropZoneAt({ x: 999, y: 400 }, ws, null)).toBe('right');
  });

  it('meio do workspace e fora dele não têm zona', () => {
    expect(dropZoneAt({ x: 500, y: 400 }, ws, null)).toBeNull();
    expect(dropZoneAt({ x: -5, y: 100 }, ws, null)).toBeNull();
    expect(dropZoneAt({ x: 100, y: 900 }, ws, null)).toBeNull();
    expect(dropZoneAt({ x: 100, y: 100 }, { ...ws, width: 0 }, null)).toBeNull();
  });

  it('sobre o outro painel vale a metade de cima ou de baixo dele', () => {
    expect(dropZoneAt({ x: 100, y: 100 }, ws, painelEsq)).toBe('above-other');
    expect(dropZoneAt({ x: 100, y: 300 }, ws, painelEsq)).toBe('below-other');
    // Sem o outro painel aberto, a mesma posição cai na faixa esquerda.
    expect(dropZoneAt({ x: 100, y: 100 }, ws, null)).toBe('left');
  });
});

describe('applyDrop', () => {
  const DEF = DEFAULT_DOCK;

  it('soltar no mesmo lugar não muda nada', () => {
    expect(applyDrop(DEF, 'props', 'left')).toEqual(DEF);
    expect(applyDrop(DEF, 'browser', 'left')).toEqual(DEF);
    expect(applyDrop(DEF, 'browser', 'below-other')).toEqual(DEF);
    expect(applyDrop(DEF, 'props', 'above-other')).toEqual(DEF);
  });

  it('mover o navegador para a direita deixa cada dock com um painel', () => {
    const d = applyDrop(DEF, 'browser', 'right');
    expect(d.sides).toEqual({ props: 'left', browser: 'right' });
    expect(d.leftW).toBe(DEF.leftW);
    expect(d.rightW).toBe(DEF.rightW);
  });

  it('entrar num dock que já tem o outro painel põe o arrastado em cima', () => {
    const solto: DockLayout = applyDrop(applyDrop(DEF, 'browser', 'right'), 'props', 'right');
    expect(solto.sides).toEqual({ props: 'right', browser: 'right' });
    expect(solto.first).toBe('props');
    // Já estando no dock, soltar de novo nele não mexe na ordem.
    expect(applyDrop({ ...solto, first: 'browser' }, 'props', 'right').first).toBe('browser');
  });

  it('empilhar acima e abaixo do outro painel usa o dock dele', () => {
    const d = applyDrop(applyDrop(DEF, 'browser', 'right'), 'props', 'above-other');
    expect(d.sides).toEqual({ props: 'right', browser: 'right' });
    expect(d.first).toBe('props');
    const abaixo = applyDrop(DEF, 'browser', 'above-other');
    expect(abaixo.first).toBe('browser');
    expect(applyDrop(abaixo, 'props', 'below-other').first).toBe('browser');
  });

  it('não altera o layout de entrada', () => {
    const antes = JSON.stringify(DEF);
    applyDrop(DEF, 'browser', 'right');
    expect(JSON.stringify(DEF)).toBe(antes);
  });
});

describe('previewRect (a prévia é a área real do painel)', () => {
  const open = { props: true, browser: true };
  const w: Rect = { left: 0, top: 50, width: 1000, height: 800 };

  it('painel sozinho no dock da direita: largura do dock, altura toda, colado à borda', () => {
    const d: DockLayout = { ...DEFAULT_DOCK, rightW: 300 };
    expect(previewRect(d, 'browser', 'right', open, w)).toEqual({ left: 700, top: 50, width: 300, height: 800 });
  });

  it('entrando num dock que já tem o outro painel, divide pela fração: o que chega fica em cima', () => {
    const d: DockLayout = { ...DEFAULT_DOCK, sides: { props: 'right', browser: 'left' }, first: 'browser', rightW: 280, split: 0.5 };
    expect(previewRect(d, 'browser', 'right', open, w)).toEqual({ left: 720, top: 50, width: 280, height: 400 });
  });

  it('abaixo do outro painel: metade de baixo do dock dele', () => {
    const d: DockLayout = { ...DEFAULT_DOCK, sides: { props: 'right', browser: 'left' }, rightW: 280, split: 0.25 };
    expect(previewRect(d, 'browser', 'below-other', open, w)).toEqual({ left: 720, top: 250, width: 280, height: 600 });
  });

  it('o outro painel fechado não divide o dock', () => {
    expect(previewRect(DEFAULT_DOCK, 'props', 'left', { props: true, browser: false }, w)).toEqual({ left: 0, top: 50, width: 292, height: 800 });
  });
});
