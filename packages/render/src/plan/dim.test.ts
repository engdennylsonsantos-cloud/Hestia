import { describe, expect, it } from 'vitest';
import { dimColor, dimPlanOps } from './dim.ts';

const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};

describe('dimPlanOps', () => {
  it('leva qualquer cor a um cinza bem claro, perto do fundo', () => {
    for (const c of ['#000000', '#16181c', '#c2185b', '#1d6fe0', '#b45309']) {
      const d = dimColor(c, '#fbfbfa');
      expect(lum(d)).toBeGreaterThan(215);
      expect(lum(d)).toBeLessThanOrEqual(lum('#fbfbfa'));
    }
  });

  it('mantém a geometria e só troca as cores', () => {
    const o = dimPlanOps(
      { fills: [{ polygons: [[[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]]], color: '#b45309', alpha: 1, hatch: { kind: 'diag', color: '#16181c' } }], strokes: [{ pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: false, widthPx: 2, color: '#000000', alpha: 1 }], labels: [] },
      '#fbfbfa',
    );
    expect(o.strokes[0]!.widthPx).toBe(2);
    expect(o.fills[0]!.polygons).toHaveLength(1);
    expect(o.fills[0]!.color).not.toBe('#b45309');
    expect(o.fills[0]!.hatch!.color).not.toBe('#16181c');
  });

  it('deixa passar cores que não são hexadecimais', () => {
    expect(dimColor('rgba(0,0,0,.5)', '#fbfbfa')).toBe('rgba(0,0,0,.5)');
  });
});
