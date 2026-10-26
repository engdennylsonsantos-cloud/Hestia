import { describe, expect, it } from 'vitest';
import { DEFAULT_DOCK, DOCK_LIMITS, dockPanels, dockWidths, normalizeDock } from './dockLayout.ts';

describe('disposição dos painéis (dockLayout)', () => {
  it('padrão: Propriedades e Navegador à esquerda, Propriedades em cima', () => {
    expect(normalizeDock(null)).toEqual(DEFAULT_DOCK);
    expect(DEFAULT_DOCK.sides).toEqual({ props: 'left', browser: 'left' });
    expect(DEFAULT_DOCK.first).toBe('props');
  });

  it('migra o formato antigo (browserSide, propriedades sempre à esquerda)', () => {
    const d = normalizeDock({ browserSide: 'right', leftW: 300, rightW: 280, split: 0.4 });
    expect(d).toEqual({ sides: { props: 'left', browser: 'right' }, first: 'props', leftW: 300, rightW: 280, split: 0.4 });
    expect(normalizeDock({ browserSide: 'left' }).sides).toEqual({ props: 'left', browser: 'left' });
  });

  it('rejeita lixo e volta cada campo ao padrão', () => {
    expect(normalizeDock('x')).toEqual(DEFAULT_DOCK);
    expect(normalizeDock(42)).toEqual(DEFAULT_DOCK);
    const d = normalizeDock({ sides: { props: 'top', browser: 7 }, first: 'zzz', leftW: 'abc', rightW: NaN, split: Infinity });
    expect(d.sides).toEqual({ props: 'left', browser: 'left' });
    expect(d.first).toBe('props');
    expect(d.leftW).toBe(DEFAULT_DOCK.leftW);
    expect(d.rightW).toBe(DEFAULT_DOCK.rightW);
    expect(d.split).toBe(DEFAULT_DOCK.split);
  });

  it('respeita os limites de largura e de divisória', () => {
    const d = normalizeDock({ leftW: 9999, rightW: 10, split: 2 });
    expect(d.leftW).toBe(DOCK_LIMITS.maxW);
    expect(d.rightW).toBe(DOCK_LIMITS.minW);
    expect(d.split).toBe(DOCK_LIMITS.maxSplit);
    expect(normalizeDock({ split: -1 }).split).toBe(DOCK_LIMITS.minSplit);
  });

  it('ida e volta pelo navegador (JSON) não muda nada', () => {
    const d = normalizeDock({ sides: { props: 'right', browser: 'right' }, first: 'browser', leftW: 333, rightW: 401, split: 0.3 });
    expect(normalizeDock(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it('dockPanels respeita o painel de cima e o que está aberto', () => {
    const both = { props: true, browser: true };
    expect(dockPanels(DEFAULT_DOCK, 'left', both)).toEqual(['props', 'browser']);
    const invertido = { ...DEFAULT_DOCK, first: 'browser' as const };
    expect(dockPanels(invertido, 'left', both)).toEqual(['browser', 'props']);
    expect(dockPanels(DEFAULT_DOCK, 'left', { props: false, browser: true })).toEqual(['browser']);
    expect(dockPanels(DEFAULT_DOCK, 'right', both)).toEqual([]);
  });

  it('largura do dock é 0 sem painel aberto e vira a largura guardada quando tem', () => {
    const d = normalizeDock({ sides: { props: 'left', browser: 'right' }, leftW: 300, rightW: 280 });
    expect(dockWidths(false, false, d)).toEqual({ left: 0, right: 0 });
    expect(dockWidths(true, false, d)).toEqual({ left: 300, right: 0 });
    expect(dockWidths(true, true, d)).toEqual({ left: 300, right: 280 });
    expect(dockWidths(false, true, d)).toEqual({ left: 0, right: 280 });
  });
});
