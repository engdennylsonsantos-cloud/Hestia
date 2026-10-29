import { describe, expect, it } from 'vitest';
import { capturesPointer, rectAround, swallowsPointerButton } from './dimsHit.ts';

const grip = rectAround({ x: 100, y: 100 }, 10);

describe('capturesPointer', () => {
  it('sem prévia (seleção) o elemento sempre captura, mesmo com o cursor em cima', () => {
    expect(capturesPointer(grip, { x: 100, y: 100 }, false)).toBe(true);
  });
  it('na prévia, com o cursor sobre a alça, o clique é do canvas', () => {
    expect(capturesPointer(grip, { x: 100, y: 100 }, true)).toBe(false);
  });
  it('a folga cobre o cursor ao lado do ponto com imã', () => {
    expect(capturesPointer(grip, { x: 112, y: 100 }, true)).toBe(false);
    expect(capturesPointer(grip, { x: 118, y: 100 }, true)).toBe(true);
  });
  it('na prévia, com o cursor longe, a alça continua clicável', () => {
    expect(capturesPointer(grip, { x: 300, y: 40 }, true)).toBe(true);
  });
  it('sem cursor conhecido captura', () => {
    expect(capturesPointer(grip, null, true)).toBe(true);
  });
  it('aceita folga zero: só o retângulo exato', () => {
    expect(capturesPointer(grip, { x: 106, y: 100 }, true, 0)).toBe(true);
    expect(capturesPointer(grip, { x: 105, y: 100 }, true, 0)).toBe(false);
  });
});

describe('rectAround', () => {
  it('centra o quadrado no ponto', () => {
    expect(rectAround({ x: 10, y: 20 }, 6)).toEqual({ x: 7, y: 17, w: 6, h: 6 });
  });
});

describe('swallowsPointerButton', () => {
  it('só o botão principal é engolido', () => {
    expect(swallowsPointerButton(0)).toBe(true);
    expect(swallowsPointerButton(1)).toBe(false);
    expect(swallowsPointerButton(2)).toBe(false);
  });
});
