import { describe, expect, it } from 'vitest';
import type { SolidBatch } from './solids.ts';
import { splitTJunctions } from './layerTopology.ts';

const meshWithTJunction = (): SolidBatch => ({
  materialId: 'mat',
  category: 'wall',
  positions: [
    0, 0, 0, 2, 0, 0, 0, 1, 0, // primeira face, com aresta longa A–B
    1, 0, 0, 1, -1, 0, 2, -1, 0, // segunda face introduz o vértice Q no meio de A–B
  ],
  normals: Array.from({ length: 6 }, () => [0, 0, 1]).flat(),
  indices: [0, 1, 2, 3, 4, 5],
  ids: [],
});

describe('divisão de T-junctions na malha 3D', () => {
  it('divide a aresta longa no vértice existente e mantém índices válidos', () => {
    const mesh = meshWithTJunction();

    splitTJunctions(mesh, 0, 0);

    expect(mesh.indices).toHaveLength(9);
    expect(mesh.positions.slice(18, 21)).toEqual([1, 0, 0]);
    expect(mesh.indices.every((index) => index < mesh.positions.length / 3)).toBe(true);
  });

  it('não altera uma malha sem T-junctions', () => {
    const mesh = meshWithTJunction();
    mesh.indices = [3, 4, 5];

    splitTJunctions(mesh, 0, 0);

    expect(mesh.indices).toEqual([3, 4, 5]);
    expect(mesh.positions).toHaveLength(18);
  });
});
