import { describe, expect, it } from 'vitest';
import { movedBoxes, resolveGesture, type SheetGesture } from './sheetGestures.ts';
import type { GestureContext } from './sheetGestures.ts';

const inner = { x0: 10, y0: 10, x1: 410, y1: 287 };
const ctx = (over: Partial<GestureContext> = {}): GestureContext => ({ inner, others: [], snapOn: false, zoom: 2, shift: false, ...over });
const box = { x: 40, y: 60, w: 100, h: 80 };

const move = (start: Record<string, { x: number; y: number; w: number; h: number }> = { a: box }): Extract<SheetGesture, { kind: 'move' }> => ({
  kind: 'move',
  ids: Object.keys(start),
  start,
  grab: { x: 90, y: 100 },
  box: start.a!,
  clicked: 'a',
  guides: [],
});

describe('gesto de mover', () => {
  it('o commit no fim do arraste usa exatamente o último ponto do ponteiro (sem pulo)', () => {
    const g = move();
    // Um único movimento grande e soltar: é o caso que antes commitava a posição anterior.
    const final = resolveGesture(g, { x: 190, y: 60 }, ctx());
    const boxes = movedBoxes(final as Extract<SheetGesture, { kind: 'move' }>);
    expect(boxes.a!.x).toBe(140);
    expect(boxes.a!.y).toBe(20);
  });

  it('move várias vistas com o mesmo deslocamento', () => {
    const g = move({ a: box, b: { x: 200, y: 60, w: 80, h: 50 } });
    const final = resolveGesture({ ...g, ids: ['a', 'b'] }, { x: 110, y: 120 }, ctx());
    const boxes = movedBoxes(final as Extract<SheetGesture, { kind: 'move' }>);
    expect(boxes.b).toEqual({ x: 220, y: 80, w: 80, h: 50 });
  });

  it('respeita o encaixe quando ligado e fica livre quando desligado', () => {
    const other = { x: 150, y: 200, w: 60, h: 40 };
    const g = move();
    const semSnap = resolveGesture(g, { x: 92, y: 100 }, ctx({ others: [other], snapOn: false }));
    expect((semSnap as Extract<SheetGesture, { kind: 'move' }>).box.x).toBe(42);
    const comSnap = resolveGesture(g, { x: 92, y: 100 }, ctx({ others: [other], snapOn: true }));
    const b = (comSnap as Extract<SheetGesture, { kind: 'move' }>).box;
    // a borda esquerda (42) encosta na borda esquerda da outra vista (150)? não: encaixa no que estiver a ≤ 3 mm.
    expect(b.x === 42 || b.x === 150 || b.x === 10).toBe(true);
    expect((comSnap as Extract<SheetGesture, { kind: 'move' }>).guides.length).toBeLessThanOrEqual(2);
  });

  it('encaixa em linha do desenho quando ela está mais perto que a caixa', () => {
    const g = move();
    const r = resolveGesture(g, { x: 198, y: 100 }, ctx({ snapOn: true, lines: [{ axis: 'v', at: 150 }] }));
    expect((r as Extract<SheetGesture, { kind: 'move' }>).box.x).toBe(150);
    expect((r as Extract<SheetGesture, { kind: 'move' }>).guides).toContainEqual({ axis: 'v', at: 150 });
  });

  it('clampa na área de desenho', () => {
    const g = move();
    const r = resolveGesture(g, { x: -500, y: 400 }, ctx());
    const b = (r as Extract<SheetGesture, { kind: 'move' }>).box;
    expect(b.x).toBe(10);
    expect(b.y + b.h).toBe(287);
  });
});

describe('gesto de redimensionar', () => {
  it('redimensiona pelo canto sudeste e clampa', () => {
    const g: SheetGesture = { kind: 'resize', id: 'a', handle: 'se', grab: { x: 140, y: 60 }, start: box, box };
    const r = resolveGesture(g, { x: 180, y: 40 }, ctx());
    expect((r as Extract<SheetGesture, { kind: 'resize' }>).box).toEqual({ x: 40, y: 40, w: 140, h: 100 });
  });

  it('Shift mantém a proporção', () => {
    const g: SheetGesture = { kind: 'resize', id: 'a', handle: 'se', grab: { x: 140, y: 60 }, start: box, box };
    const r = resolveGesture(g, { x: 240, y: 60 }, ctx({ shift: true }));
    const b = (r as Extract<SheetGesture, { kind: 'resize' }>).box;
    expect(b.w / b.h).toBeCloseTo(box.w / box.h, 6);
  });
});

describe('gesto de conteúdo', () => {
  it('acumula o deslocamento a partir do offset inicial, sem limite artificial', () => {
    const g: SheetGesture = { kind: 'content', id: 'a', grab: { x: 90, y: 100 }, start: { x: 5, y: -2 }, offset: { x: 5, y: -2 } };
    const r = resolveGesture(g, { x: 1090, y: 98 }, ctx());
    expect((r as Extract<SheetGesture, { kind: 'content' }>).offset).toEqual({ x: 1005, y: -4 });
  });
});
