import { describe, expect, it } from 'vitest';
import { intersection, multiArea, type MultiPolygon } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeSlab, makeWall, type Project, type Wall } from '@hestia/model';
import { quantifyLevel } from './quantities.ts';
import { quantifySlabs } from './slabQuantities.ts';
import { resolveLevel } from './resolve.ts';
import { resolveSlabs } from './slabs.ts';
import { winsOver } from './junctionPlanar.ts';
import { junctionLevel } from './junctionLevel.ts';

/**
 * Parede que atravessa o nível (decisão 0023 §3, F1b). A parede do térreo sobe até o pavimento de cima, e a laje dele
 * (lv_1, cota 3,00 m, estrutura de 2,88 a 3,00 m) corta a parede onde as duas se encontram. O corte e o volume valem
 * para o quantitativo da parede e para a laje, com a mesma regra par a par de prioridade (`winsOver`).
 */

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

type W = Omit<Wall, 'order'>;

/** Projeto com parede no térreo (altura `height`) e, opcionalmente, laje no pavimento de cima cobrindo a parede. */
function project(height: number, withSlab: boolean): Project {
  const s = new ProjectStore(createEmptyProject());
  const w: W = makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height });
  s.exec({ type: 'addWall', wall: w });
  if (withSlab) s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_mac12', levelId: 'lv_1', boundary: rect(-1, -1, 5, 1) }) });
  return s.project;
}

const wallVolume = (p: Project): number =>
  quantifyLevel(p, resolveLevel(p, 'lv_0')).layers.filter((l) => l.wallId === 'w1').reduce((s, l) => s + l.volume, 0);

describe('F1b · parede que atravessa o nível é cortada pela laje do pavimento de cima', () => {
  it('parede de 6 m: o volume dela no térreo cai pela parte que a laje do pavimento de cima ocupa', () => {
    const before = wallVolume(project(6, false));
    const after = wallVolume(project(6, true));
    expect(after).toBeLessThan(before - 1e-9);
  });

  it('a perda é exatamente a soma, par a par, das camadas que a laje vence × área comum × altura comum', () => {
    const p = project(6, true);
    const rw = resolveLevel(p, 'lv_0').walls['w1']!;
    const slab = resolveSlabs(p, 'lv_1')[0]!;
    let expected = 0;
    for (const wl of rw.layers) {
      for (const band of wl.bands) {
        for (const sl of slab.layers) {
          const sm = { kind: 'slab' as const, priority: sl.priority, core: sl.core };
          const wm = { kind: 'wall' as const, priority: wl.priority, core: wl.core };
          if (winsOver(sm, wm) !== true) continue;
          const z0 = Math.max(sl.z0, rw.baseZ + band.z0);
          const z1 = Math.min(sl.z1, rw.baseZ + band.z1);
          if (z1 - z0 <= 1e-9) continue;
          expected += multiArea(intersection(band.poly, sl.polygon) as MultiPolygon) * (z1 - z0);
        }
      }
    }
    const removed = wallVolume(project(6, false)) - wallVolume(p);
    expect(removed).toBeGreaterThan(0);
    expect(removed).toBeCloseTo(expected, 6);
  });

  it('a laje do pavimento de cima não perde volume para a parede que ela vence (regra par a par)', () => {
    const slabVolume = (p: Project): number => quantifySlabs(p, 'lv_1').layers.reduce((s, l) => s + l.volume, 0);
    expect(slabVolume(project(6, true))).toBeCloseTo(slabVolume(project(2.8, true)), 9);
  });

  it('parede que termina abaixo da laje (2,80 m): nada muda no térreo', () => {
    expect(wallVolume(project(2.8, true))).toBeCloseTo(wallVolume(project(2.8, false)), 9);
  });

  it('a junção do térreo marca a parede como recortada (é o que o corte e o 3D leem)', () => {
    expect(junctionLevel(project(6, true), 'lv_0').walls.get('w1')?.cut).toBe(true);
    expect(junctionLevel(project(2.8, true), 'lv_0').walls.get('w1')?.cut ?? false).toBe(false);
  });
});
