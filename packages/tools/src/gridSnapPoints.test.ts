import { describe, expect, it } from 'vitest';
import { dist, v2, type Vec2 } from '@hestia/geom';
import { DEFAULT_GRID_TYPE_ID, type Project } from '@hestia/model';
import { infer, type InferContext } from './infer.ts';
import { DEFAULT_SNAP } from './types.ts';
import { drawWall, makeEnv } from './testEnv.ts';

const MPP = 0.005; // tolerância de 10 px = 0,05 m

function withGrids(grids: Array<{ id: string; name: string; points: Vec2[]; sag?: number }>, walls: Array<[[number, number], [number, number]]> = []) {
  const ctx = makeEnv();
  for (const [a, b] of walls) drawWall(ctx.env, a, b);
  for (const g of grids) {
    ctx.store.exec({ type: 'addGrid', grid: { id: g.id, name: g.name, typeId: DEFAULT_GRID_TYPE_ID, points: g.points, sag: g.sag ?? 0, bubbleStart: true, bubbleEnd: true } });
  }
  return ctx.store.project;
}
const at = (p: Project, x: number, y: number, extra: Partial<InferContext> = {}) =>
  infer({ x, y }, { project: p, levelId: 'lv_0', mpp: MPP, gridStep: 0.1, ...extra });

describe('snap nas grades de eixos', () => {
  it('extremidade da grade', () => {
    const p = withGrids([{ id: 'g1', name: '1', points: [v2(2, 0), v2(2, 10)] }]);
    const r = at(p, 2.02, 10.03);
    expect(r.kind).toBe('endpoint');
    expect(r.point).toEqual({ x: 2, y: 10 });
    expect(r.hostId).toBe('g1');
  });

  it('vértice interno de grade multissegmento', () => {
    const p = withGrids([{ id: 'g1', name: '1', points: [v2(0, 0), v2(4, 0), v2(4, 3)] }]);
    const r = at(p, 4.02, 0.02);
    expect(r.kind).toBe('endpoint');
    expect(r.point).toEqual({ x: 4, y: 0 });
  });

  it('interseção grade × grade', () => {
    const p = withGrids([
      { id: 'g1', name: '1', points: [v2(3, -5), v2(3, 5)] },
      { id: 'g2', name: 'A', points: [v2(-5, 1), v2(5, 1)] },
    ]);
    const r = at(p, 3.03, 1.02);
    expect(r.kind).toBe('intersection');
    expect(dist(r.point, v2(3, 1))).toBeLessThan(1e-9);
  });

  it('interseção grade × eixo de parede', () => {
    const p = withGrids([{ id: 'g1', name: '1', points: [v2(2, -5), v2(2, 5)] }], [[[0, 0], [6, 0]]]);
    const r = at(p, 2.02, 0.02);
    expect(r.kind).toBe('intersection');
    expect(dist(r.point, v2(2, 0))).toBeLessThan(1e-9);
  });

  it('sobre a linha: ponto mais próximo na grade reta', () => {
    const p = withGrids([{ id: 'g1', name: '1', points: [v2(0, 0), v2(10, 0)] }]);
    const r = at(p, 4.37, 0.03);
    expect(r.kind).toBe('nearest');
    expect(r.point.x).toBeCloseTo(4.37, 9);
    expect(r.point.y).toBeCloseTo(0, 9);
  });

  it('grade em arco: sobre a linha fica no arco, e a extremidade vale', () => {
    // Corda de (0,0) a (4,0), flecha 1 à esquerda: o topo do arco fica em (2, 1).
    const p = withGrids([{ id: 'g1', name: 'A', points: [v2(0, 0), v2(4, 0)], sag: 1 }]);
    const top = at(p, 2, 0.98);
    expect(top.kind).toBe('nearest');
    expect(dist(top.point, v2(2, 1))).toBeLessThan(1e-6);
    // O ponto da corda não é captura (o arco está a 1 m dali).
    expect(at(p, 1, 0.01).kind).toBe('none');
    expect(at(p, 0.01, 0.01).kind).toBe('endpoint');
  });

  it('interseção arco × reta (grade em arco com grade reta)', () => {
    const p = withGrids([
      { id: 'g1', name: 'A', points: [v2(0, 0), v2(4, 0)], sag: 1 },
      { id: 'g2', name: '1', points: [v2(2, -2), v2(2, 3)] },
    ]);
    const r = at(p, 2.01, 1.02);
    expect(r.kind).toBe('intersection');
    expect(dist(r.point, v2(2, 1))).toBeLessThan(1e-6);
  });

  it('interseção grade reta × parede em arco', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    const id = Object.keys(ctx.store.project.elements).find((k) => ctx.store.project.elements[k]!.kind === 'wall')!;
    ctx.store.exec({ type: 'addGrid', grid: { id: 'g1', name: '1', typeId: DEFAULT_GRID_TYPE_ID, points: [v2(2, -2), v2(2, 3)], sag: 0, bubbleStart: true, bubbleEnd: true } });
    const w = ctx.store.project.elements[id] as { sag: number };
    const p = { ...ctx.store.project, elements: { ...ctx.store.project.elements, [id]: { ...w, sag: 1 } } } as Project;
    const r = at(p, 2.02, 1.01);
    expect(r.kind).toBe('intersection');
    expect(dist(r.point, v2(2, 1))).toBeLessThan(1e-6);
  });

  it('respeita as chaves do snap e a chave mestre', () => {
    const p = withGrids([
      { id: 'g1', name: '1', points: [v2(3, -5), v2(3, 5)] },
      { id: 'g2', name: 'A', points: [v2(-5, 1), v2(5, 1)] },
    ]);
    const off = (k: object) => at(p, 3.03, 1.02, { snap: { ...DEFAULT_SNAP, ...k } });
    expect(off({ intersections: false }).kind).not.toBe('intersection');
    expect(off({ axis: false, intersections: false }).kind).not.toBe('nearest');
    expect(at(p, 3, 5.01, { snap: { ...DEFAULT_SNAP, endpoint: false, axis: false } }).kind).toBe('none');
    expect(at(p, 3.03, 1.02, { snap: { ...DEFAULT_SNAP, enabled: false } }).kind).toBe('none');
  });

  it('grade em ignore some da captura; só-paredes não captura grade', () => {
    const p = withGrids([{ id: 'g1', name: '1', points: [v2(0, 0), v2(10, 0)] }]);
    expect(at(p, 4, 0.01, { ignore: new Set(['g1']) }).kind).toBe('none');
    expect(at(p, 4, 0.01, { onWallsOnly: true }).kind).toBe('none');
  });

  it('prioridade: a extremidade vence o "sobre a linha" e fora da tolerância nada captura', () => {
    const p = withGrids([{ id: 'g1', name: '1', points: [v2(0, 0), v2(10, 0)] }]);
    expect(at(p, 0.02, 0.01).kind).toBe('endpoint');
    expect(at(p, 4, 0.2).kind).toBe('none');
  });

  it('sem grades, o projeto segue como antes', () => {
    expect(at(withGrids([]), 1, 1).kind).toBe('none');
  });
});
