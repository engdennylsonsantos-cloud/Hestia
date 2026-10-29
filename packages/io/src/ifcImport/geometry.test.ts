import { describe, expect, it } from 'vitest';
import { rectangleAxis } from './geometry.ts';

describe('eixo de parede a partir do contorno', () => {
  it('usa o lado maior como comprimento, mesmo quando o contorno começa pela ponta curta', () => {
    // Fachada 20 × 0,20 m; o anel começa pela aresta curta (0,0)→(0,0,2), que antes virava "comprimento".
    const loop = [
      { x: 0, y: 0 },
      { x: 0, y: 0.2 },
      { x: 20, y: 0.2 },
      { x: 20, y: 0 },
    ];
    const rect = rectangleAxis(loop);
    expect(rect).not.toBeNull();
    expect(rect!.length).toBeCloseTo(20, 6);
    expect(rect!.thickness).toBeCloseTo(0.2, 6);
    expect(Math.hypot(rect!.a.x - rect!.b.x, rect!.a.y - rect!.b.y)).toBeCloseTo(20, 6);
    expect(rect!.a.y).toBeCloseTo(0.1, 6);
    expect(rect!.b.y).toBeCloseTo(0.1, 6);
  });

  it('recusa forma em L e aceita retângulo com pequeno chanfro', () => {
    const L = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(rectangleAxis(L)).toBeNull();
    const chamfrado = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 0.3 },
      { x: 0.1, y: 0.3 },
      { x: 0, y: 0.2 },
    ];
    expect(rectangleAxis(chamfrado)?.length).toBeCloseTo(3, 6);
  });
});
