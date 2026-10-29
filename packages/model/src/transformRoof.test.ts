import { describe, expect, it } from 'vitest';
import { applyTransform, type Transform, type Vec2 } from '@hestia/geom';
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

/** Meio do arco da aresta p→q com flecha s (positiva à esquerda de p→q), como `Wall.sag`. */
function arcMid(p: Vec2, q: Vec2, sag: number): Vec2 {
  const l = Math.hypot(q.x - p.x, q.y - p.y);
  return { x: (p.x + q.x) / 2 - ((q.y - p.y) / l) * sag, y: (p.y + q.y) / 2 + ((q.x - p.x) / l) * sag };
}

describe('telhado: a flecha do arco (edgeSag) acompanha a aresta', () => {
  const sags = [0, 0.4, 0, -0.3];
  const withSag = (): Roof => ({ ...roof(), edgeSag: sags });
  const mids = (r: Roof): Vec2[] => r.boundary.map((p, i) => arcMid(p, r.boundary[(i + 1) % r.boundary.length]!, r.edgeSag![i]!));

  it('espelhar leva o meio de cada arco para o espelho do meio antigo', () => {
    const mirror: Transform = { kind: 'mirror', a: { x: 0, y: 0 }, b: { x: 0, y: 1 } };
    const before = mids(withSag()).map((m) => applyTransform(mirror, m));
    const after = mids(transformRoof(withSag(), mirror));
    // As arestas trocam de posição no espelho: compara como conjunto.
    for (const m of before) expect(after.some((a) => Math.hypot(a.x - m.x, a.y - m.y) < 1e-9)).toBe(true);
  });

  it('girar e mover mantêm a flecha e o meio do arco acompanha o contorno', () => {
    for (const t of [{ kind: 'rotate', about: { x: 1, y: 1 }, angle: 0.7 }, { kind: 'translate', d: { x: 3, y: -2 } }] as Transform[]) {
      const r = transformRoof(withSag(), t);
      expect(r.edgeSag).toEqual(sags);
      const before = mids(withSag()).map((m) => applyTransform(t, m));
      mids(r).forEach((m, i) => expect(Math.hypot(m.x - before[i]!.x, m.y - before[i]!.y)).toBeLessThan(1e-9));
    }
  });

  it('telhado sem flecha continua sem o campo', () => {
    expect('edgeSag' in transformRoof(roof(), { kind: 'translate', d: { x: 1, y: 0 } })).toBe(false);
  });
});
