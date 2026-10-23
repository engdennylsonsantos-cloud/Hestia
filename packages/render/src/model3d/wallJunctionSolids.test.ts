import { describe, expect, it } from 'vitest';
import { multiArea, type MultiPolygon } from '@hestia/geom';
import { junctionLevel, resolveLevel, wallBandCut } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Project } from '@hestia/model';
import { buildLevelSolids, type SolidBatch } from './solids.ts';

/**
 * Sólido 3D da parede com a junção de piso (decisão 0023 §3, F4): a faixa recortada é extrudada só nas partes que sobram.
 * O volume do sólido é conferido por divergência (soma de tetraedros), então não depende de como a malha é montada.
 */

/** Parte de faixa de parede: região em planta e cota absoluta (mesma forma de `ResolvedPrism`, que o engine não exporta). */
interface Prism {
  poly: MultiPolygon;
  z0: number;
  z1: number;
}

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function project(baseOffset: number): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3, baseOffset }) });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3) }) });
  return s.project;
}

/** Volume assinado de um lote: soma dos tetraedros (origem, a, b, c) de cada triângulo. */
function volumeOf(b: SolidBatch): number {
  const at = (k: number): [number, number, number] => [b.positions[3 * k]!, b.positions[3 * k + 1]!, b.positions[3 * k + 2]!];
  let v = 0;
  for (let i = 0; i < b.indices.length; i += 3) {
    const [ax, ay, az] = at(b.indices[i]!);
    const [bx, by, bz] = at(b.indices[i + 1]!);
    const [cx, cy, cz] = at(b.indices[i + 2]!);
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return Math.abs(v);
}

const wallVolume = (batches: SolidBatch[]): number => batches.filter((b) => b.category === 'wall').reduce((s, b) => s + volumeOf(b), 0);

describe('F4 · sólido 3D da parede com a junção de piso', () => {
  it('parede que desce até o piso: o volume 3D cai pela parte recortada', () => {
    const p = project(-0.2);
    const r = resolveLevel(p, 'lv_0');
    const without = wallVolume(buildLevelSolids(r).batches);
    const jl = junctionLevel(p, 'lv_0');
    const withJ = wallVolume(buildLevelSolids(r, jl).batches);
    expect(withJ).toBeLessThan(without);
    expect(withJ).toBeGreaterThan(0);
  });

  it('o volume 3D com junção é a soma das partes resolvidas de cada faixa', () => {
    const p = project(-0.2);
    const r = resolveLevel(p, 'lv_0');
    const jl = junctionLevel(p, 'lv_0');
    const rw = r.walls['w1']!;
    let expected = 0;
    rw.layers.forEach((l) =>
      l.bands.forEach((b, bandIndex) => {
        const parts: Prism[] | undefined = wallBandCut(jl, 'w1', l.layerIndex, bandIndex);
        const pieces: Prism[] = parts ?? [{ poly: b.poly, z0: rw.baseZ + b.z0, z1: rw.baseZ + b.z1 }];
        for (const x of pieces) expected += multiArea(x.poly as MultiPolygon) * (x.z1 - x.z0);
      }),
    );
    expect(wallVolume(buildLevelSolids(r, jl).batches)).toBeCloseTo(expected, 6);
  });

  it('parede acima do piso: sem recorte, o sólido é o mesmo com ou sem junção', () => {
    const p = project(0);
    const r = resolveLevel(p, 'lv_0');
    const jl = junctionLevel(p, 'lv_0');
    expect(wallVolume(buildLevelSolids(r, jl).batches)).toBeCloseTo(wallVolume(buildLevelSolids(r).batches), 9);
  });
});
