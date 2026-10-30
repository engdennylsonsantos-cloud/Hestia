import { describe, expect, it } from 'vitest';
import { HANDLES, MIN_BOX_MM, boxHas, clampBoxToInner, cursorForHandle, handlePoint, hitBox, hitHandle, resizeBox } from './sheetSelection.ts';

const box = { x: 20, y: 30, w: 200, h: 100 };
const inner = { x0: 10, y0: 10, x1: 410, y1: 287 };

describe('alças de redimensionar', () => {
  it('as oito alças ficam nos cantos, meios dos lados e no centro dos lados', () => {
    expect(HANDLES).toHaveLength(8);
    expect(handlePoint(box, 'nw')).toEqual({ x: 20, y: 130 });
    expect(handlePoint(box, 'ne')).toEqual({ x: 220, y: 130 });
    expect(handlePoint(box, 'se')).toEqual({ x: 220, y: 30 });
    expect(handlePoint(box, 'sw')).toEqual({ x: 20, y: 30 });
    expect(handlePoint(box, 'n')).toEqual({ x: 120, y: 130 });
    expect(handlePoint(box, 'e')).toEqual({ x: 220, y: 80 });
    expect(handlePoint(box, 's')).toEqual({ x: 120, y: 30 });
    expect(handlePoint(box, 'w')).toEqual({ x: 20, y: 80 });
  });

  it('acha a alça com tolerância e devolve null fora dela', () => {
    expect(hitHandle(box, { x: 21, y: 129 }, 3)).toBe('nw');
    expect(hitHandle(box, { x: 121, y: 131 }, 3)).toBe('n');
    expect(hitHandle(box, { x: 120, y: 80 }, 3)).toBeNull();
    expect(hitHandle(box, { x: 24, y: 129 }, 3)).toBeNull();
  });

  it('cada alça tem um cursor próprio', () => {
    expect(cursorForHandle('nw')).toBe('nwse-resize');
    expect(cursorForHandle('ne')).toBe('nesw-resize');
    expect(cursorForHandle('n')).toBe('ns-resize');
    expect(cursorForHandle('w')).toBe('ew-resize');
  });
});

describe('redimensionar a caixa', () => {
  it('arrastar o canto sudeste cresce para a direita e para baixo', () => {
    expect(resizeBox(box, 'se', { x: 40, y: -20 })).toEqual({ x: 20, y: 10, w: 240, h: 120 });
  });

  it('arrastar o canto noroeste move a origem para cima e mantém o canto oposto', () => {
    const r = resizeBox(box, 'nw', { x: 10, y: 15 });
    expect(r.x).toBe(30);
    expect(r.y).toBe(30);
    expect(r.x + r.w).toBe(220);
    expect(r.y + r.h).toBe(145);
  });

  it('arrastar um lado muda só aquele eixo', () => {
    expect(resizeBox(box, 'e', { x: 25, y: 99 })).toEqual({ x: 20, y: 30, w: 225, h: 100 });
    expect(resizeBox(box, 'n', { x: 99, y: 10 })).toEqual({ x: 20, y: 30, w: 200, h: 110 });
  });

  it('não deixa a caixa invertida: respeita o tamanho mínimo', () => {
    const r = resizeBox(box, 'e', { x: -500, y: 0 });
    expect(r.w).toBe(MIN_BOX_MM);
    expect(r.x).toBe(20);
    const r2 = resizeBox(box, 'w', { x: 500, y: 0 });
    expect(r2.w).toBe(MIN_BOX_MM);
    expect(r2.x).toBe(220 - MIN_BOX_MM);
  });

  it('com proporção travada o canto conserva a razão original', () => {
    const r = resizeBox(box, 'se', { x: 200, y: 0 }, true);
    expect(r.w / r.h).toBeCloseTo(box.w / box.h, 9);
    expect(r.x).toBe(20);
    expect(r.y).toBe(30);
  });
});

describe('encaixe na área de desenho', () => {
  it('move para dentro sem mudar o tamanho', () => {
    expect(clampBoxToInner({ x: -50, y: 400, w: 100, h: 50 }, inner)).toEqual({ x: 10, y: 237, w: 100, h: 50 });
  });

  it('encolhe a caixa maior que a área', () => {
    const r = clampBoxToInner({ x: 0, y: 0, w: 900, h: 600 }, inner);
    expect(r.w).toBe(400);
    expect(r.h).toBe(277);
    expect(r.x).toBe(10);
    expect(r.y).toBe(10);
  });
});

describe('acerto de alvo', () => {
  const boxes = [
    { id: 'a', box: { x: 10, y: 10, w: 100, h: 100 } },
    { id: 'b', box: { x: 50, y: 50, w: 100, h: 100 } },
  ];
  it('a última da lista ganha quando as caixas se sobrepõem', () => {
    expect(hitBox(boxes, { x: 60, y: 60 })).toBe('b');
    expect(hitBox(boxes, { x: 20, y: 20 })).toBe('a');
    expect(hitBox(boxes, { x: 300, y: 300 })).toBeNull();
  });
  it('aceita tolerância e testa ponto dentro da caixa', () => {
    expect(hitBox(boxes, { x: 5, y: 60 }, 6)).toBe('a');
    expect(boxHas(boxes[0]!.box, { x: 10, y: 10 })).toBe(true);
    expect(boxHas(boxes[0]!.box, { x: 9.9, y: 10 })).toBe(false);
  });
});
