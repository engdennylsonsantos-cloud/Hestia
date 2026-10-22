import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import {
  ProjectStore,
  createEmptyProject,
  defaultStairTypeId,
  makeStair,
  makeWall,
  type Project,
  type StairCurve,
  type StairRun,
} from '@hestia/model';
import { resolveStairs } from './stairs.ts';
import { stairIssueList, stairValidationIssues } from './stairChecks.ts';
import { STAIR_WALL_OVERLAP_MIN, stairWallOverlapIssues } from './stairWallOverlap.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

/** Lance reto em +x: 16 espelhos a cada 0,28 m; largura 1,20 m; degraus de x = 0 a 4,20 m, em y = ±0,60. */
const run: StairRun = {
  id: 'run',
  kind: 'run',
  boundaryLeft: [ln(-0.5, 0.6, 4.7, 0.6)],
  boundaryRight: [ln(-0.5, -0.6, 4.7, -0.6)],
  risers: Array.from({ length: 16 }, (_, k) => ln(k * 0.28, -1, k * 0.28, 1)),
  path: [],
};

/**
 * Projeto com a escada `st1` no térreo (topo em 2,80 m). As paredes `wTop` e `wBottom` são de alvenaria 9 (0,124 m de
 * espessura total, meia espessura 0,062) e correm em +x no nível dado.
 */
function build(o: { topY?: number; bottomY?: number; topLevelId?: string; extra?: boolean } = {}): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({
    type: 'addStair',
    stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', topOffset: -0.2, components: [run] }),
  });
  const wall = (id: string, y: number, levelId = 'lv_0'): void => {
    s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv9', levelId, a: v(-0.5, y), b: v(4.5, y) }) });
  };
  if (o.topY !== undefined) wall('wTop', o.topY, o.topLevelId);
  if (o.bottomY !== undefined) wall('wBottom', o.bottomY);
  return s.project;
}

const overlaps = (p: Project) => stairWallOverlapIssues(p).filter((i) => i.code === 'stair-wall-overlap');

describe('escada x parede (stair-wall-overlap)', () => {
  it('lance entre duas paredes com 5 cm de folga entre faces: sem aviso', () => {
    // Face da parede em 0,60 + 0,05 = 0,65 → eixo em 0,65 + 0,062 = 0,712.
    const p = build({ topY: 0.712, bottomY: -0.712 });
    expect(overlaps(p)).toEqual([]);
    expect(stairValidationIssues(p).filter((i) => i.code === 'stair-wall-overlap')).toEqual([]);
  });

  it('parede com invasão de 0,10 m ao longo do lance: aviso com a parede e área de 0,42 m²', () => {
    // Face da parede em 0,60 − 0,10 = 0,50 → eixo em 0,50 + 0,062 = 0,562.
    const p = build({ topY: 0.562, bottomY: -0.712 });
    const list = overlaps(p);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ severity: 'warning', stairId: 'st1', ids: ['st1', 'wTop'] });
    expect(list[0]!.message).toContain('"wTop"');
    expect(list[0]!.message).toContain('0,42 m²');
    // 0,10 m de invasão × 4,20 m de lance = 0,42 m².
    expect(list[0]!.message).toMatch(/0,42 m²/);
    expect(STAIR_WALL_OVERLAP_MIN).toBe(0.005);
  });

  it('invasão abaixo do limite de 0,005 m² não gera aviso', () => {
    // 1 cm de invasão × 4,20 m = 0,042 m² (acima); 1 mm × 4,20 m = 0,0042 m² (abaixo).
    expect(overlaps(build({ topY: 0.6 + 0.062 - 0.01 }))).toHaveLength(1);
    expect(overlaps(build({ topY: 0.6 + 0.062 - 0.001 }))).toEqual([]);
  });

  it('parede do nível de topo, acima do topo da escada, não conta mesmo sobre a projeção', () => {
    // Mesma planta da parede que invade, mas no lv_1 (base 3,00 m > topo da escada 2,80 m).
    const p = build({ topY: 0.562, topLevelId: 'lv_1' });
    expect(overlaps(p)).toEqual([]);
  });

  it('o aviso entra na lista da escada e no painel com o id da escada', () => {
    const p = build({ topY: 0.562 });
    expect(resolveStairs(p)).toHaveLength(1);
    expect(stairIssueList(p).map((i) => i.code)).toContain('stair-wall-overlap');
    expect(stairValidationIssues(p).find((i) => i.code === 'stair-wall-overlap')).toMatchObject({
      severity: 'warning',
      elementId: 'st1',
      ids: ['st1', 'wTop'],
    });
  });
});
