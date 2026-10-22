import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, type Wall } from '@hestia/model';
import { resolveLevel } from '@hestia/engine';
import { buildLevelSolids, clearWallLayerCache, wallLayerCacheStats } from './solids.ts';

const wall = (id: string, ax: number, ay: number, bx: number, by: number): Omit<Wall, 'order'> =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: ax, y: ay }, b: { x: bx, y: by } });

/** Duas paredes sem ligação (não se afetam): a edição de uma não muda a geometria da outra. */
function twoWalls(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: wall('a', 0, 0, 4, 0) });
  s.exec({ type: 'addWall', wall: wall('b', 0, 5, 4, 5) });
  return s;
}

const layersOf = (s: ProjectStore, id: string): number => resolveLevel(s.project, 'lv_0').walls[id]!.layers.length;

describe('cache de camadas de parede (desempenho da vista 3D)', () => {
  beforeEach(() => clearWallLayerCache());

  it('refazer o nível sem mudança reaproveita todas as camadas e dá a mesma malha', () => {
    const s = twoWalls();
    const lv = resolveLevel(s.project, 'lv_0');
    const first = buildLevelSolids(lv);
    const n = layersOf(s, 'a') + layersOf(s, 'b');
    expect(wallLayerCacheStats().misses).toBe(n);
    const second = buildLevelSolids(lv);
    expect(wallLayerCacheStats().hits).toBe(n);
    expect(second).toEqual(first);
  });

  it('a malha com cache é igual à malha sem cache', () => {
    const s = twoWalls();
    const lv = resolveLevel(s.project, 'lv_0');
    buildLevelSolids(lv);
    const cached = buildLevelSolids(lv);
    clearWallLayerCache();
    expect(buildLevelSolids(lv)).toEqual(cached);
  });

  it('editar uma parede só extrude de novo as camadas dela', () => {
    const s = twoWalls();
    buildLevelSolids(resolveLevel(s.project, 'lv_0'));
    clearWallLayerCache();
    buildLevelSolids(resolveLevel(s.project, 'lv_0'));
    s.exec({ type: 'setWallEnds', id: 'a', b: { x: 5, y: 0 } });
    const before = wallLayerCacheStats();
    buildLevelSolids(resolveLevel(s.project, 'lv_0'));
    const after = wallLayerCacheStats();
    expect(after.misses - before.misses).toBe(layersOf(s, 'a'));
    expect(after.hits - before.hits).toBe(layersOf(s, 'b'));
  });

  it('os ids das faixas e os índices continuam válidos depois de reaproveitar', () => {
    const s = twoWalls();
    const lv = resolveLevel(s.project, 'lv_0');
    buildLevelSolids(lv);
    const [batch] = buildLevelSolids(lv).batches;
    const vertices = batch!.positions.length / 3;
    expect(batch!.indices.every((i) => i < vertices)).toBe(true);
    const ids = new Set(batch!.ids.map((r) => r.id));
    expect([...ids].sort()).toEqual(['a', 'b']);
    let covered = 0;
    for (const r of batch!.ids) covered += r.count;
    expect(covered).toBe(batch!.indices.length);
  });
});
