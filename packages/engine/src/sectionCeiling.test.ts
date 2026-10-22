import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeCeiling, makeFloor } from '@hestia/model';
import { computeSection } from './index.ts';

const RECT = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];

describe('corte e elevação com forros (decisão 0021)', () => {
  it('corte atravessando o forro: silhueta = largura × espessura do tipo, com a origem do forro', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c', typeId: 'ct_gesso', levelId: 'lv_0', boundary: RECT, heightOffset: 2.6 }) });
    const t = s.project.ceilingTypes.ct_gesso!;
    const thick = t.layers.reduce((acc, l) => acc + l.thickness, 0);
    // y = 2 cruza os 6 m do forro, a 2,60 m (acima do corte, então vale a silhueta)
    const r = computeSection(s.project, { a: { x: -1, y: 2 }, b: { x: 7, y: 2 }, depth: 2 });
    expect(multiArea(r.silhouette)).toBeCloseTo(6 * thick, 6);
    expect(r.cut.some((c) => c.sources.some((o) => o.ceilingId === 'c'))).toBe(true);
    expect(r.zMax).toBeCloseTo(2.6, 6);
  });

  it('forro que não é tocado pela linha não entra no corte', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c', typeId: 'ct_gesso', levelId: 'lv_0', boundary: RECT }) });
    const r = computeSection(s.project, { a: { x: -1, y: 10 }, b: { x: 7, y: 10 }, depth: 2 });
    expect(r.cut.length).toBe(0);
  });

  it('forro e piso no mesmo corte aparecem separados pela origem', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_laje12', levelId: 'lv_0', boundary: RECT }) });
    s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c', typeId: 'ct_gesso', levelId: 'lv_0', boundary: RECT }) });
    const r = computeSection(s.project, { a: { x: -1, y: 2 }, b: { x: 7, y: 2 }, depth: 2 });
    const ids = new Set(r.cut.flatMap((c) => c.sources.map((o) => o.floorId ?? o.ceilingId)));
    expect(ids).toEqual(new Set(['f', 'c']));
  });
});
