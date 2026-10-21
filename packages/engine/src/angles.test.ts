import { describe, expect, it } from 'vitest';
import { boxOf, multiArea, union } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type JoinKind } from '@hestia/model';
import { resolveLevel } from './index.ts';

/**
 * C10 · ângulos agudos e obtusos extremos: duas paredes de 4 m que partem do mesmo ponto formando 5° a 175°,
 * em cada tipo de junção e com tipos de espessura diferente. Sem exceção, sem área negativa, sem "espinhos"
 * (a silhueta cabe na caixa das paredes com folga de uma espessura) e sem dupla contagem entre camadas.
 */
const ANGLES = [5, 10, 20, 35, 60, 90, 120, 150, 170, 175];
const KINDS: JoinKind[] = ['butt', 'miter'];
const TYPES: Array<[string, string]> = [['wt_alv14', 'wt_alv14'], ['wt_alv14', 'wt_alv9'], ['wt_ext19', 'wt_dry']];

describe.each(TYPES)('C10 · ângulos, tipos %s + %s', (t1, t2) => {
  for (const kind of KINDS) {
    it(`${kind}: 5° a 175° sem artefato`, () => {
      for (const deg of ANGLES) {
        const rad = (deg * Math.PI) / 180;
        const s = new ProjectStore(createEmptyProject());
        const cfg = { kind, flip: false };
        s.exec({ type: 'addWall', wall: makeWall({ id: 'a', typeId: t1, levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 0, y: 0 }, joinEnd: cfg }) });
        s.exec({ type: 'addWall', wall: makeWall({ id: 'b', typeId: t2, levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4 * Math.cos(rad), y: 4 * Math.sin(rad) }, joinStart: cfg }) });
        const r = resolveLevel(s.project, 'lv_0', new Map());
        const where = `${kind} ${deg}°`;
        const areas = Object.values(r.walls).flatMap((w) => w.layers.map((l) => multiArea(l.cut)));
        expect(areas.every((a) => Number.isFinite(a) && a >= 0), where).toBe(true);
        const sil = union(...r.clusters.map((c) => c.silhouette));
        const total = multiArea(sil);
        expect(total, where).toBeGreaterThan(0);
        expect(Math.abs(areas.reduce((x, y) => x + y, 0) - total), `${where}: dupla contagem`).toBeLessThanOrEqual(5e-4);
        const box = boxOf(sil.flatMap((p) => p[0] ?? []));
        const pad = 0.5;
        expect(box.maxX, where).toBeLessThanOrEqual(4 + pad);
        expect(box.minX, where).toBeGreaterThanOrEqual(-4 - pad);
        expect(box.maxY, where).toBeLessThanOrEqual(4 + pad);
        expect(box.minY, where).toBeGreaterThanOrEqual(-4 - pad);
      }
    });
  }
});
