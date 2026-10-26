import { describe, expect, it } from 'vitest';
import { arcFromSagitta, arcPointAt, dist, type SketchSeg, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall } from '@hestia/model';
import { perimeterFromBox } from './sketchByPerimeter.ts';
import type { SketchCtx } from './sketchPickFaceGeom.ts';

/** Meia espessura da parede alv14 (18,4 cm): a face externa fica a 0,092 m do eixo. */
const D = 0.092;

const wall = (id: string, a: Vec2, b: Vec2, sag = 0) => makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b, sag });

function sceneWith(walls: ReturnType<typeof wall>[], hidden: string[] = []) {
  const store = new ProjectStore(createEmptyProject());
  for (const w of walls) store.exec({ type: 'addWall', wall: w });
  const ctx: SketchCtx = { project: () => store.project, levelId: () => 'lv_0', hiddenInView: () => new Set(hidden) };
  return { store, ctx };
}

/** Área (shoelace) do anel formado pelas pontas das linhas, na ordem do esboço. Só para contorno sem arcos. */
function area(segs: SketchSeg[]): number {
  let s = 0;
  for (const g of segs) s += g.a.x * g.b.y - g.b.x * g.a.y;
  return Math.abs(s) / 2;
}

/** Os segmentos formam um anel: cada ponta encosta na próxima e a última fecha na primeira. */
function closed(segs: SketchSeg[]): boolean {
  return segs.every((g, i) => dist(g.b, segs[(i + 1) % segs.length]!.a) < 1e-6);
}

const BOX = { min: { x: -2, y: -2 }, max: { x: 10, y: 10 } };

describe('contorno externo pela caixa (perimeterFromBox)', () => {
  it('paredes retas em L: o contorno externo tem 6 lados, fecha e segue a face de fora', () => {
    const L: Vec2[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 6 }, { x: 0, y: 6 }];
    const walls = L.map((a, i) => wall(`w${i}`, a, L[(i + 1) % L.length]!));
    const { ctx } = sceneWith(walls);
    const r = perimeterFromBox(ctx, BOX.min, BOX.max);
    expect(r.warnings).toEqual([]);
    expect(r.segs).toHaveLength(6);
    expect(closed(r.segs)).toBe(true);
    // Eixo: L de área 27 m² e perímetro 24 m, cantos: 5 convexos e 1 reflexo. A face de fora soma P·d + (convexos − reflexos)·d².
    expect(area(r.segs)).toBeCloseTo(27 + 24 * D + 4 * D * D, 6);
    expect(r.segs.every((g) => !g.sag)).toBe(true);
  });

  it('retângulo com divisória interna: a divisória é ignorada e o contorno tem 4 lados', () => {
    const R: Vec2[] = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5 }, { x: 0, y: 5 }];
    const walls = [...R.map((a, i) => wall(`e${i}`, a, R[(i + 1) % R.length]!)), wall('div', { x: 4, y: 0 }, { x: 4, y: 5 })];
    const { ctx } = sceneWith(walls);
    const r = perimeterFromBox(ctx, BOX.min, BOX.max);
    expect(r.warnings).toEqual([]);
    expect(r.segs).toHaveLength(4);
    expect(closed(r.segs)).toBe(true);
    expect(area(r.segs)).toBeCloseTo((8 + 2 * D) * (5 + 2 * D), 6);
  });

  it('caixa que só pega parte das paredes: não fecha circuito e avisa contorno aberto', () => {
    const { ctx } = sceneWith([wall('a', { x: 0, y: 0 }, { x: 6, y: 0 }), wall('b', { x: 6, y: 0 }, { x: 6, y: 3 })]);
    const r = perimeterFromBox(ctx, BOX.min, BOX.max);
    expect(r.warnings.some((w) => /contorno aberto/i.test(w))).toBe(true);
    expect(closed(r.segs)).toBe(true);
  });

  it('caixa sem parede: sem linhas e com aviso', () => {
    const { ctx } = sceneWith([wall('a', { x: 0, y: 0 }, { x: 6, y: 0 })]);
    const r = perimeterFromBox(ctx, { x: 20, y: 20 }, { x: 30, y: 30 });
    expect(r.segs).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });

  it('parede curva: o contorno guarda o arco (com flecha), e o arco fica do lado de fora', () => {
    // Retângulo 6 × 4 com o lado esquerdo em arco (0,0)→(0,4), flecha 1 m para fora (à esquerda de a→b).
    const walls = [
      wall('s', { x: 0, y: 0 }, { x: 6, y: 0 }),
      wall('d', { x: 6, y: 0 }, { x: 6, y: 4 }),
      wall('t', { x: 6, y: 4 }, { x: 0, y: 4 }),
      wall('arco', { x: 0, y: 0 }, { x: 0, y: 4 }, 1),
    ];
    const { ctx } = sceneWith(walls);
    const r = perimeterFromBox(ctx, BOX.min, BOX.max);
    expect(r.warnings).toEqual([]);
    expect(r.segs).toHaveLength(4);
    expect(closed(r.segs)).toBe(true);
    const arcs = r.segs.filter((g) => g.sag);
    expect(arcs).toHaveLength(1);
    const g = arcs[0]!;
    const arc = arcFromSagitta(g.a, g.b, g.sag!)!;
    const apex = arcPointAt(arc, arc.length / 2);
    // Eixo do arco: apex em x = −1; face externa a 0,092 m mais para fora.
    expect(apex.x).toBeLessThan(-1.0);
    expect(apex.x).toBeGreaterThan(-1.2);
  });
});
