import { afterEach, describe, expect, it } from 'vitest';
import { DIM_AMOUNT, dimAmount, dimColor, dimPlanOps } from './dim.ts';

const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};

const BG = '#fbfbfa';

afterEach(() => {
  delete (globalThis as unknown as { __hestiaDimAmount?: number }).__hestiaDimAmount;
});

describe('dimPlanOps', () => {
  it('usa 0,65 por padrão: a planta continua legível como referência', () => {
    expect(DIM_AMOUNT).toBe(0.65);
    expect(dimColor('#000000', '#ffffff')).toBe('#a6a6a6');
  });

  it('mistura o cinza com o fundo na proporção pedida', () => {
    expect(dimColor('#000000', '#ffffff', 0.6)).toBe('#999999');
    expect(dimColor('#000000', '#ffffff', 0.65)).toBe('#a6a6a6');
    expect(dimColor('#000000', '#ffffff', 0.7)).toBe('#b3b3b3');
    expect(dimColor('#000000', '#ffffff', 0.88)).toBe('#e0e0e0');
  });

  it('leva qualquer cor a um cinza claro, sem passar do fundo', () => {
    for (const c of ['#000000', '#16181c', '#c2185b', '#1d6fe0', '#b45309']) {
      const d = dimColor(c, BG);
      expect(lum(d)).toBeGreaterThan(160);
      expect(lum(d)).toBeLessThanOrEqual(lum(BG));
    }
  });

  it('lê o valor de comparação do navegador num só ponto', () => {
    (globalThis as unknown as { __hestiaDimAmount?: number }).__hestiaDimAmount = 0.7;
    expect(dimAmount()).toBe(0.7);
    expect(dimColor('#000000', '#ffffff')).toBe('#b3b3b3');
    (globalThis as unknown as { __hestiaDimAmount?: number }).__hestiaDimAmount = 2;
    expect(dimAmount()).toBe(DIM_AMOUNT);
  });

  it('mantém a geometria e só troca as cores, com o valor pedido', () => {
    const o = dimPlanOps(
      { fills: [{ polygons: [[[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]]], color: '#b45309', alpha: 1, hatch: { kind: 'diagonal', color: '#16181c' } }], strokes: [{ pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: false, widthPx: 2, color: '#000000', alpha: 1 }], labels: [] },
      '#ffffff',
      0.6,
    );
    expect(o.strokes[0]!.widthPx).toBe(2);
    expect(o.fills[0]!.polygons).toHaveLength(1);
    expect(o.fills[0]!.color).toBe(dimColor('#b45309', '#ffffff', 0.6));
    expect(o.fills[0]!.color).not.toBe('#b45309');
    expect(o.fills[0]!.hatch!.color).toBe(dimColor('#16181c', '#ffffff', 0.6));
    expect(o.fills[0]!.hatch!.color).not.toBe('#16181c');
  });

  it('deixa passar cores que não são hexadecimais', () => {
    expect(dimColor('rgba(0,0,0,.5)', BG)).toBe('rgba(0,0,0,.5)');
  });
});
