import { describe, expect, it } from 'vitest';
import { CASING, EX1, EX2, EX3, EX5, comp, cenaComposicao, leafC } from './openingModelFixture.ts';
import type { OpeningModel } from './openingModelTypes.ts';

/* Fumaça do alizar do conjunto (spec F1 §4 e §1). */

const P1 = { nominalRef: 'leaf' as const, width: 0.9, height: 2.1 };
const perto = (v: number[]) => v.map((x) => expect.closeTo(x, 6));
const face = (m: OpeningModel, g: string) => m.parts.filter((q) => q.role === 'casing' && q.group === g);
const quad = (q: { box: { t0: number; t1: number; z0: number; z1: number } }) => [q.box.t0, q.box.t1, q.box.z0, q.box.z1];

describe('alizar do conjunto', () => {
  it('Ex. 1: porta com 3 barras por face; interno = luz, externo = luz + 0,07', () => {
    const m = cenaComposicao('ot_p90', EX1, P1).m;
    for (const g of ['casing-exterior', 'casing-interior']) {
      const bs = face(m, g).map(quad).sort((a, b) => a[0]! - b[0]! || a[2]! - b[2]!);
      expect(bs).toHaveLength(3);
      expect(bs[0]).toEqual(perto([-0.51, -0.44, 0, 2.1]));
      expect(bs[1]).toEqual(perto([-0.51, 0.51, 2.1, 2.17]));
      expect(bs[2]).toEqual(perto([0.44, 0.51, 0, 2.1]));
    }
  });

  it('Ex. 2: sobe até o topo da bandeira e não há barra na travessa interna', () => {
    const m = cenaComposicao('ot_p90', EX2, P1).m;
    const barras = face(m, 'casing-exterior');
    expect(Math.max(...barras.map((q) => q.box.z1))).toBeCloseTo(2.62, 6);
    expect(barras.filter((q) => q.box.z1 - q.box.z0 < 0.2).map(quad)).toEqual([perto([-0.51, 0.51, 2.55, 2.62])]);
  });

  it('Ex. 3: nenhuma barra dentro de |t| < 0,89 (sem alizar nos montantes)', () => {
    const m = cenaComposicao('ot_p90', EX3, P1).m;
    for (const q of m.parts.filter((x) => x.role === 'casing')) expect(Math.min(Math.abs(q.box.t0), Math.abs(q.box.t1))).toBeGreaterThanOrEqual(0.89 - 1e-6);
  });

  it('Ex. 5: janela tem 4 barras por face, a inferior em z [-0,02; 0,05]', () => {
    const bs = face(cenaComposicao('ot_j120', EX5).m, 'casing-exterior');
    expect(bs).toHaveLength(4);
    expect(quad(bs.find((q) => q.box.z1 <= 0.05 + 1e-9)!)).toEqual(perto([-0.82, 0.82, -0.02, 0.05]));
  });

  it('setback 0,01 afasta a aresta interna; faces "exterior" gera uma face só', () => {
    const a = cenaComposicao('ot_p90', comp(leafC('folha'), { casing: { ...CASING, setback: 0.01 } }), P1).m;
    const lat = face(a, 'casing-exterior').find((q) => q.box.z1 - q.box.z0 > 1)!;
    expect(lat.box.t0).toBeCloseTo(-0.52, 6);
    expect(lat.box.t1).toBeCloseTo(-0.45, 6);
    const b = cenaComposicao('ot_p90', comp(leafC('folha'), { casing: { ...CASING, faces: 'exterior' } }), P1).m;
    expect(new Set(b.parts.filter((q) => q.role === 'casing').map((q) => q.group))).toEqual(new Set(['casing-exterior']));
  });
});
