import { describe, expect, it } from 'vitest';
import type { ResolvedRoof, ResolvedRoofPlane } from '@hestia/engine';
import { emendaDaAgua } from './roofEmendas3d.ts';

const P = (x: number, y: number) => ({ x, y });
const EAVE = 2.8;

/** Duas águas de 4 × 6 lado a lado (x de 0 a 4 e de 4 a 8), com a mesma inclinação; a segunda sobe `dz` a mais. */
function duas(dz: number): ResolvedRoof {
  const a: ResolvedRoofPlane = { polygon: [[[P(0, 0), P(4, 0), P(4, 6), P(0, 6)]]], origin: P(0, 0), up: P(1, 0), percent: 30, z0: EAVE };
  const b: ResolvedRoofPlane = { polygon: [[[P(4, 0), P(8, 0), P(8, 6), P(4, 6)]]], origin: P(8, 0), up: P(-1, 0), percent: 30, z0: EAVE + dz };
  return { roofId: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', planes: [a, b], lines: [], layers: [], eaveZ: EAVE, joinedArea: 0 };
}

describe('emendas entre águas na malha 3D', () => {
  it('aresta comum de duas águas na mesma cota é emenda (sem parede); a da borda externa não é', () => {
    const r = duas(0);
    const emendaA = emendaDaAgua(r, 0);
    expect(emendaA(P(4, 0), P(4, 6))).toBe(true);
    expect(emendaA(P(0, 0), P(0, 6))).toBe(false);
    expect(emendaA(P(0, 0), P(4, 0))).toBe(false);
  });

  it('degrau de cota entre as águas mantém a parede da aresta comum', () => {
    const r = duas(0.5);
    expect(emendaDaAgua(r, 0)(P(4, 0), P(4, 6))).toBe(false);
    expect(emendaDaAgua(r, 1)(P(4, 6), P(4, 0))).toBe(false);
  });
});
