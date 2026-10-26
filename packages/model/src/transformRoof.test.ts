import { describe, expect, it } from 'vitest';
import type { Transform, Vec2 } from '@hestia/geom';
import { makeRoof } from './roof.ts';
import { transformRoof } from './transformPlanar.ts';
import type { Roof } from './types.ts';

/** Trapézio anti-horário com quatro arestas distintas (inclinação e balanço identificam cada uma). */
const RING: Vec2[] = [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
  { x: 3, y: 2 },
  { x: 0, y: 2 },
];

function roof(): Roof {
  return { ...makeRoof({ id: 't', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: RING, footprint: RING, edgeSlopes: [10, 20, null, 40], edgeOverhangs: [0.1, 0.2, 0.3, 0.4] }), order: 0 };
}

describe('telhado: mover e espelhar mantém as listas por aresta na mesma aresta', () => {
  it('espelhar inverte o contorno e troca a ordem das inclinações e dos balanços; a pegada acompanha', () => {
    const mirror: Transform = { kind: 'mirror', a: { x: 0, y: 0 }, b: { x: 0, y: 1 } };
    const r = transformRoof(roof(), mirror);
    // Novo contorno: (0,2), (-3,2), (-5,0), (0,0). A aresta nova 0 (topo) é a antiga 2; a 1 é a 1; a 2 é a 0; a 3 é a 3.
    expect(r.boundary[0]!.x).toBeCloseTo(0, 9);
    expect(r.boundary[0]!.y).toBeCloseTo(2, 9);
    expect(r.boundary[1]!.x).toBeCloseTo(-3, 9);
    expect(r.edgeSlopes).toEqual([null, 20, 10, 40]);
    expect(r.edgeOverhangs).toEqual([0.3, 0.2, 0.1, 0.4]);
    expect(r.footprint).toHaveLength(4);
    expect(r.footprint![1]!.x).toBeCloseTo(-3, 9);
  });

  it('mover (translação) não mexe nas listas por aresta e desloca a pegada junto', () => {
    const r = transformRoof(roof(), { kind: 'translate', d: { x: 10, y: 0 } });
    expect(r.edgeSlopes).toEqual([10, 20, null, 40]);
    expect(r.edgeOverhangs).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(r.footprint![0]!.x).toBeCloseTo(10, 9);
  });

  it('telhado sem pegada continua sem pegada', () => {
    const { footprint: _omit, ...rest } = roof();
    const r = transformRoof({ ...rest, order: 0 } as Roof, { kind: 'translate', d: { x: 1, y: 0 } });
    expect(r.footprint).toBeUndefined();
  });
});
