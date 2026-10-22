import { describe, expect, it } from 'vitest';
import { resolveLevel } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, totalThickness, type Project, type Wall } from '@hestia/model';
import { buildLevelSolids, type SolidBatch } from './solids.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Parede de 4 m (0,0)–(4,0), 3 m de altura; piso sobre x de 0 a 2 com face superior em +0,05. */
function project(): Project {
  const s = new ProjectStore(createEmptyProject());
  const wall: Wall = { ...makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3, attachBottomToFloor: true }), order: 0 };
  s.exec({ type: 'addWall', wall });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(-1, -1, 2, 1), heightOffset: 0.05 }) });
  return s.project;
}

/** Volume (m³) da malha: soma dos tetraedros com a origem (malha fechada e orientada para fora). */
function volume(b: Pick<SolidBatch, 'positions' | 'indices'>): number {
  let v = 0;
  const P = (k: number) => [b.positions[k * 3]!, b.positions[k * 3 + 1]!, b.positions[k * 3 + 2]!] as const;
  for (let i = 0; i < b.indices.length; i += 3) {
    const [a, c, d] = [P(b.indices[i]!), P(b.indices[i + 1]!), P(b.indices[i + 2]!)];
    v += (a[0] * (c[1] * d[2] - c[2] * d[1]) - a[1] * (c[0] * d[2] - c[2] * d[0]) + a[2] * (c[0] * d[1] - c[1] * d[0])) / 6;
  }
  return Math.abs(v);
}

/** Menor z dos vértices da malha entre x0 e x1 (a faixa de planta da parede; o degrau fica entre os dois lados). */
function minZEntre(b: SolidBatch, x0: number, x1: number): number {
  let z = Infinity;
  for (let k = 0; k < b.positions.length / 3; k++) {
    const x = b.positions[k * 3]!;
    if (x >= x0 && x <= x1) z = Math.min(z, b.positions[k * 3 + 2]!);
  }
  return z;
}

describe('P9 · 3D da parede com a base em degrau (decisão 0023 §6)', () => {
  const p = project();
  const batches = buildLevelSolids(resolveLevel(p, 'lv_0')).batches;
  const wallSolids = batches.filter((b) => b.category === 'wall');

  it('a malha da parede começa em 0,05 m sobre o piso e em 0 m fora dele', () => {
    // Os vértices da malha ficam nas pontas e no degrau (x = 0, 2 e 4): cada lado do degrau tem a sua cota mínima.
    const z = (x0: number, x1: number) => Math.min(...wallSolids.map((b) => minZEntre(b, x0, x1)));
    expect(z(-1, 1.999)).toBeCloseTo(0.05, 6);
    expect(z(2.001, 5)).toBeCloseTo(0, 6);
  });

  it('o volume do 3D é a parede inteira com a base em degrau: espessura × (2 × 2,95 + 2 × 3,00) m²', () => {
    const esperado = totalThickness(p.wallTypes.wt_alv14!) * (2 * 2.95 + 2 * 3);
    expect(wallSolids.reduce((s, b) => s + volume(b), 0)).toBeCloseTo(esperado, 6);
  });
});
