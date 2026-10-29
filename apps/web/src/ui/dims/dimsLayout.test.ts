import { describe, expect, it } from 'vitest';
import { CONVERT_SIZE, placeConvertButton, valueRect } from './dimsLayout.ts';

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('valueRect', () => {
  it('centra o campo no texto', () => {
    expect(valueRect({ x: 100, y: 50 })).toEqual({ x: 69, y: 39, w: 62, h: 22 });
  });
});

describe('placeConvertButton', () => {
  it('sem vizinhos, fica à direita do primeiro valor', () => {
    const a = valueRect({ x: 100, y: 100 });
    const r = placeConvertButton(a, [a]);
    expect(r.x).toBe(a.x + a.w + 4);
    expect(r.w).toBe(CONVERT_SIZE);
  });
  it('trecho curto: o campo vizinho à direita empurra o botão para a esquerda', () => {
    const a = valueRect({ x: 100, y: 100 });
    const b = valueRect({ x: 140, y: 100 });
    const r = placeConvertButton(a, [a, b]);
    expect(overlaps(r, a) || overlaps(r, b)).toBe(false);
    expect(r.x).toBeLessThan(a.x);
  });
  it('campos dos dois lados: vai para cima', () => {
    const a = valueRect({ x: 100, y: 100 });
    const l = valueRect({ x: 60, y: 100 });
    const rr = valueRect({ x: 140, y: 100 });
    const r = placeConvertButton(a, [a, l, rr]);
    expect([a, l, rr].some((o) => overlaps(r, o))).toBe(false);
    expect(r.y).toBeLessThan(a.y);
  });
  it('cercado por todos os lados, sobe até achar lugar livre', () => {
    const a = valueRect({ x: 100, y: 100 });
    const around = [valueRect({ x: 60, y: 100 }), valueRect({ x: 140, y: 100 }), valueRect({ x: 100, y: 76 }), valueRect({ x: 100, y: 124 })];
    const r = placeConvertButton(a, [a, ...around]);
    expect([a, ...around].some((o) => overlaps(r, o))).toBe(false);
  });
  it('alça pequena na vizinhança também é evitada', () => {
    const a = valueRect({ x: 100, y: 100 });
    const grip = { x: 165, y: 95, w: 10, h: 10 };
    const r = placeConvertButton(a, [a, grip]);
    expect(overlaps(r, grip)).toBe(false);
  });
});
