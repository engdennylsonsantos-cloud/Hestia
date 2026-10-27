import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof, type Project, type Roof } from '@hestia/model';
import { quantifyRoofs, resolveRoofs } from './index.ts';

/** Retângulo 10 x 8, com a aresta 0 (y = 0, de x 0 a 10) em arco. */
const rect = (w: number, h: number): Vec2[] => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
const MANSARD = { lowerPercent: 100, upperPercent: 30, run: 2 };

function build(extra: Partial<Roof>): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', slopePercent: 30, shape: 'hip', boundary: rect(10, 8), ...extra }) });
  return s.project;
}

describe('mansarda com contorno em arco (edgeSag)', () => {
  // Arco convexo (para fora) e côncavo (para dentro), com flecha pequena e grande.
  const casos: Array<[string, number]> = [
    ['convexo leve', 0.5],
    ['convexo forte', 1.5],
    ['côncavo leve', -0.5],
    ['côncavo forte', -1.5],
  ];

  for (const [nome, sag] of casos) {
    it(`${nome} (flecha ${sag} m): não lança, gera águas e a área real é maior que a em planta`, () => {
      const p = build({ edgeSag: [sag, 0, 0, 0], mansard: MANSARD });
      expect(() => resolveRoofs(p, 'lv_0')).not.toThrow();
      const r = resolveRoofs(p, 'lv_0')[0]!;
      expect(r.problem).toBeUndefined();
      expect(r.planes.length).toBeGreaterThan(0);
      const q = quantifyRoofs(p, 'lv_0').roofs[0]!;
      expect(q.faceArea).toBeGreaterThan(q.planArea);
    });
  }
});
