import { describe, expect, it } from 'vitest';
import { junctionLevel, resolveFloors } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Project } from '@hestia/model';
import { buildFloorSolids, type SolidBatch } from './solids.ts';

/**
 * 3D do piso único (decisão 0025): cada camada sai com o seu polígono. Piso 10 × 8 m com parede interna de 0,184 m: o
 * acabamento (até a face) perde a pegada; a estrutura (passa) sai inteira.
 */

function volume(b: Pick<SolidBatch, 'positions' | 'indices'>): number {
  let v = 0;
  const P = (k: number) => [b.positions[k * 3]!, b.positions[k * 3 + 1]!, b.positions[k * 3 + 2]!] as const;
  for (let i = 0; i < b.indices.length; i += 3) {
    const [a, c, d] = [P(b.indices[i]!), P(b.indices[i + 1]!), P(b.indices[i + 2]!)];
    v += (a[0] * (c[1] * d[2] - c[2] * d[1]) - a[1] * (c[0] * d[2] - c[2] * d[0]) + a[2] * (c[0] * d[1] - c[1] * d[0])) / 6;
  }
  return Math.abs(v);
}

function pisoUnico(): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'pu', typeId: 'ft_unico', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }] }) });
  s.exec({
    type: 'addWall',
    wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 5, y: -1 }, b: { x: 5, y: 9 }, height: 2.8, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false } }),
  });
  return s.project;
}

describe('3D do piso único: sólido por camada com o término (decisão 0025)', () => {
  it('o volume do acabamento perde a pegada da parede; a estrutura que passa vale a área bruta vezes 0,12 m', () => {
    const p = pisoUnico();
    const batches = buildFloorSolids(resolveFloors(p, 'lv_0'), junctionLevel(p, 'lv_0'));
    const porMaterial = (m: string): number => batches.filter((b) => b.materialId === m).reduce((t, b) => t + volume(b), 0);
    expect(porMaterial('mat_concreto')).toBeCloseTo(80 * 0.12, 6);
    expect(porMaterial('mat_ceramica')).toBeCloseTo((80 - 0.184 * 8) * 0.01, 6);
  });
});
