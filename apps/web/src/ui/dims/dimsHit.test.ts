import { describe, expect, it } from 'vitest';
import { capturesPointer, capturaCota, holdsLastPreview, rectAround, swallowsPointerButton } from './dimsHit.ts';

const grip = rectAround({ x: 100, y: 100 }, 10);

const live = [{ x: 100, y: 100 }];

describe('capturesPointer', () => {
  it('sem prévia (seleção) o elemento sempre captura, mesmo com o cursor em cima', () => {
    expect(capturesPointer(grip, { x: 100, y: 100 }, false, live)).toBe(true);
  });
  it('na prévia, com o cursor sobre a ponta viva, o clique é do canvas', () => {
    expect(capturesPointer(grip, { x: 100, y: 100 }, true, live)).toBe(false);
  });
  it('a folga cobre o cursor ao lado do ponto com imã', () => {
    expect(capturesPointer(grip, { x: 112, y: 100 }, true, live)).toBe(false);
    expect(capturesPointer(grip, { x: 118, y: 100 }, true, live)).toBe(true);
  });
  it('na prévia, com o cursor longe, a alça continua clicável', () => {
    expect(capturesPointer(grip, { x: 300, y: 40 }, true, live)).toBe(true);
  });
  it('sem cursor conhecido captura', () => {
    expect(capturesPointer(grip, null, true, live)).toBe(true);
  });
  it('aceita folga zero: só o retângulo exato', () => {
    expect(capturesPointer(grip, { x: 106, y: 100 }, true, live, 0)).toBe(true);
    expect(capturesPointer(grip, { x: 100, y: 100 }, true, live, 0)).toBe(false);
  });
  it('C05: valor ou "I" sob o cursor, longe de qualquer ponta viva, são da sobreposição (nunca criam geometria)', () => {
    const valor = rectAround({ x: 400, y: 300 }, 22);
    expect(capturesPointer(valor, { x: 400, y: 300 }, true, live)).toBe(true);
    expect(capturesPointer(valor, { x: 400, y: 300 }, true)).toBe(true);
  });
  it('valor que cobre a ponta viva (trecho curto): o clique na ponta é do canvas', () => {
    const valor = rectAround({ x: 110, y: 100 }, 60);
    expect(capturesPointer(valor, { x: 102, y: 101 }, true, live)).toBe(false);
  });
});

describe('capturaCota', () => {
  // Campo do valor (62×22) longe das pontas vivas: o caso do rascunho sobre o meio do traçado.
  const valor = rectAround({ x: 400, y: 300 }, 62);

  it('cota de leitura (rascunho de parede/grade) não captura o ponteiro sobre o centro', () => {
    expect(capturaCota(valor, { x: 400, y: 300 }, true, live, false)).toBe(false);
    expect(capturaCota(valor, { x: 400, y: 300 }, false, live, false)).toBe(false);
  });

  it('cota de leitura sem cursor também não captura', () => {
    expect(capturaCota(valor, null, true, live, false)).toBe(false);
    expect(capturaCota(valor, null, false, live, false)).toBe(false);
  });

  it('cota editável com o cursor sobre o centro captura (C05)', () => {
    expect(capturaCota(valor, { x: 400, y: 300 }, true, live, true)).toBe(true);
    expect(capturaCota(valor, { x: 400, y: 300 }, false, live, true)).toBe(true);
  });

  it('cota editável sem cursor conhecido captura', () => {
    expect(capturaCota(valor, null, true, live, true)).toBe(true);
  });

  it('cota editável que cobre a ponta viva deixa o clique ir ao canvas', () => {
    const naPonta = rectAround({ x: 110, y: 100 }, 62);
    expect(capturaCota(naPonta, { x: 102, y: 101 }, true, live, true)).toBe(false);
  });

  it('a folga da alça continua valendo para cota editável', () => {
    expect(capturaCota(grip, { x: 112, y: 100 }, true, live, true)).toBe(false);
    expect(capturaCota(grip, { x: 118, y: 100 }, true, live, true)).toBe(true);
    expect(capturaCota(grip, { x: 100, y: 100 }, true, live, false)).toBe(false);
  });
});

describe('holdsLastPreview', () => {
  const rects = [rectAround({ x: 300, y: 200 }, 22)];
  it('prévia zerada com o cursor a caminho do "I": mantém a última', () => {
    expect(holdsLastPreview(0, rects, { x: 300, y: 250 })).toBe(true);
  });
  it('com prévia viva, não segura a antiga', () => {
    expect(holdsLastPreview(2, rects, { x: 300, y: 250 })).toBe(false);
  });
  it('cursor longe ou desconhecido: solta', () => {
    expect(holdsLastPreview(0, rects, { x: 600, y: 600 })).toBe(false);
    expect(holdsLastPreview(0, rects, null)).toBe(false);
    expect(holdsLastPreview(0, [], { x: 300, y: 200 })).toBe(false);
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
