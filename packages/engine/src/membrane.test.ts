import { describe, expect, it } from 'vitest';
import { multiArea, union } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type WallType } from '@hestia/model';
import { quantifyLevel, resolveLevel } from './index.ts';

/** B5 · membrana de espessura zero: não ocupa área, aparece como linha em planta e como área nos quantitativos. */
describe('B5 · membrana de espessura zero', () => {
  const withMembrane = (): ProjectStore => {
    const s = new ProjectStore(createEmptyProject());
    const base = s.project.wallTypes.wt_alv14!;
    const t: WallType = {
      ...base,
      id: 'wt_mem',
      name: 'Alvenaria com barreira',
      layers: [base.layers[0]!, base.layers[1]!, base.layers[2]!, { function: 'membrane', materialId: 'mat_argamassa', thickness: 0, wraps: false }, base.layers[3]!, base.layers[4]!],
    };
    s.exec({ type: 'upsertWallType', wallType: t });
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_mem', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3 }) });
    return s;
  };

  it('a membrana é uma linha entre as extremidades, na fronteira entre o núcleo e o reboco', () => {
    const r = resolveLevel(withMembrane().project, 'lv_0');
    const m = r.walls.w!.membranes;
    expect(m).toHaveLength(1);
    expect(m[0]!.pts[0]!.x).toBeCloseTo(0);
    expect(m[0]!.pts[1]!.x).toBeCloseTo(4);
    // Entre o núcleo (±0,07) e o reboco: |y| = 0,07 (de um dos lados, conforme a ordem das camadas).
    expect(Math.abs(m[0]!.pts[0]!.y)).toBeCloseTo(0.07, 6);
  });

  it('não muda a área em planta nem o volume; soma a área de face da membrana', () => {
    const s = withMembrane();
    const plain = new ProjectStore(createEmptyProject());
    plain.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3 }) });
    const sil = (st: ProjectStore): number => multiArea(union(...resolveLevel(st.project, 'lv_0').clusters.map((c) => c.silhouette)));
    expect(sil(s)).toBeCloseTo(sil(plain), 9);
    const q = quantifyLevel(s.project, resolveLevel(s.project, 'lv_0'));
    expect(q.faceAreaByMaterial.mat_argamassa).toBeGreaterThanOrEqual(4 * 3 - 1e-9);
    expect(q.walls[0]!.volume).toBeCloseTo(quantifyLevel(plain.project, resolveLevel(plain.project, 'lv_0')).walls[0]!.volume, 9);
  });
});
