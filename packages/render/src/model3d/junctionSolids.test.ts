import { describe, expect, it } from 'vitest';
import { junctionLevel, quantifyFloors, quantifySlabs, resolveFloors, resolveSlabs } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, type Layer, type Project } from '@hestia/model';
import { buildFloorSolids, buildSlabSolids, type SolidBatch } from './solids.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Volume (m³) de uma malha: soma dos tetraedros com a origem (malha fechada e orientada para fora). */
function volume(b: Pick<SolidBatch, 'positions' | 'indices'>): number {
  let v = 0;
  const P = (k: number) => [b.positions[k * 3]!, b.positions[k * 3 + 1]!, b.positions[k * 3 + 2]!] as const;
  for (let i = 0; i < b.indices.length; i += 3) {
    const [a, c, d] = [P(b.indices[i]!), P(b.indices[i + 1]!), P(b.indices[i + 2]!)];
    v += (a[0] * (c[1] * d[2] - c[2] * d[1]) - a[1] * (c[0] * d[2] - c[2] * d[0]) + a[2] * (c[0] * d[1] - c[1] * d[0])) / 6;
  }
  return Math.abs(v);
}
const total = (bs: SolidBatch[]): number => bs.reduce((s, b) => s + volume(b), 0);

/** Piso e laje de uma camada estrutural de 0,10 m, a laje cobre 3 a 9 m e o piso vai de 0 a 6 m (sobreposição de 3 m). */
function project(): Project {
  const base = createEmptyProject();
  const one: Layer[] = [{ function: 'structure', materialId: 'mat_bloco14', thickness: 0.1 } as Layer];
  base.floorTypes.ft_t = { ...base.floorTypes.ft_ceram!, id: 'ft_t', name: 'Teste piso', code: 'PT', layers: one };
  base.slabTypes.ls_t = { ...base.slabTypes.ls_mac12!, id: 'ls_t', name: 'Teste laje', code: 'LT', layers: one };
  const s = new ProjectStore(base);
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_t', levelId: 'lv_0', boundary: rect(0, 0, 6, 4) }) });
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 's', typeId: 'ls_t', levelId: 'lv_0', boundary: rect(3, 0, 9, 4) }) });
  return s.project;
}

describe('3D: sólidos de piso e laje pela junção resolvida (decisão 0023 §3, P7b)', () => {
  it('o volume dos sólidos é o líquido dos quantitativos (junctionNet): piso 12 × 0,10 m³, laje sem corte 24 × 0,10 m³', () => {
    const p = project();
    const jl = junctionLevel(p, 'lv_0');
    const floors = buildFloorSolids(resolveFloors(p, 'lv_0'), jl);
    const slabs = buildSlabSolids(resolveSlabs(p, 'lv_0'), jl);
    expect(total(floors)).toBeCloseTo(quantifyFloors(p, 'lv_0').floors[0]!.volume, 6);
    expect(total(floors)).toBeCloseTo(1.2, 6);
    expect(total(slabs)).toBeCloseTo(quantifySlabs(p, 'lv_0').slabs[0]!.volume, 6);
    expect(total(slabs)).toBeCloseTo(2.4, 6);
  });

  it('sem junção, o sólido do piso é o contorno inteiro (24 × 0,10 m³), como antes', () => {
    const p = project();
    expect(total(buildFloorSolids(resolveFloors(p, 'lv_0')))).toBeCloseTo(2.4, 6);
  });
});
