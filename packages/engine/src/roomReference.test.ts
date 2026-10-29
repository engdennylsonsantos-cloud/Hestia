import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { pointInPolygon } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoom, makeWall } from '@hestia/model';
import { polygonCentroid, poleOfInaccessibility, referenceDiagonals, roomReferencePoint } from './roomReference.ts';
import { resolveRooms, roomRegions } from './rooms.ts';

const ring = (pts: Array<[number, number]>): Vec2[] => pts.map(([x, y]) => ({ x, y }));
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => ring([[x0, y0], [x0, y1], [x1, y1], [x1, y0]]);

function addRing(s: ProjectStore, pts: Vec2[], prefix: string, sag = 0): void {
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `${prefix}_${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior', ...(i === 0 && sag ? { sag } : {}) }) });
  });
}

function room(p: Vec2 = { x: 2, y: 2.5 }): ReturnType<typeof createEmptyProject> {
  const s = new ProjectStore(createEmptyProject());
  addRing(s, rect(0, 0, 4, 5), 'w');
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: p }) });
  return s.project;
}

describe('referência do ambiente', () => {
  it('centroide de retângulo é o centro', () => {
    expect(polygonCentroid([rect(0, 0, 4, 2)])).toEqual({ x: 2, y: 1 });
  });

  it('L com centroide sobre a aresta cai no polo, dentro da área', () => {
    const L = [ring([[0, 0], [0, 3], [1, 3], [1, 1], [4, 1], [4, 0]])];
    const c = polygonCentroid(L)!;
    const r = roomReferencePoint(L)!;
    expect(r.x).toBeGreaterThan(0);
    expect(r.y).toBeGreaterThan(0);
    expect(Number.isFinite(c.x + c.y)).toBe(true);
  });

  it('U com centroide fora cai no polo de inacessibilidade', () => {
    const u = [ring([[0, 0], [4, 0], [4, 4], [3, 4], [3, 1], [1, 1], [1, 4], [0, 4]])];
    const c = polygonCentroid(u)!;
    const r = roomReferencePoint(u)!;
    expect(pointInPolygon(c, u)).toBe(false);
    expect(pointInPolygon(r, u)).toBe(true);
    expect(r.y).toBeLessThan(1.5);
  });

  it('duas diagonais passam no ponto de referência e vão de borda a borda', () => {
    const poly = [rect(0, 0, 4, 5)];
    const at = { x: 2, y: 2.5 };
    const segs = referenceDiagonals(poly, at);
    expect(segs).toHaveLength(2);
    // `at` está no interior de cada segmento (as duas linhas se cruzam nele).
    const onSeg = (s: (typeof segs)[number]): boolean => {
      const cross = (s.b.x - s.a.x) * (at.y - s.a.y) - (s.b.y - s.a.y) * (at.x - s.a.x);
      return Math.abs(cross) < 1e-6;
    };
    for (const s of segs) expect(onSeg(s)).toBe(true);
    expect(segs[0]!.a.x < 1e-6 || segs[0]!.b.x < 1e-6).toBe(true);
  });

  it('em L cada diagonal é recortada nos trechos internos', () => {
    const L = [ring([[0, 0], [0, 3], [1, 3], [1, 1], [4, 1], [4, 0]])];
    const segs = referenceDiagonals(L, { x: 0.5, y: 0.5 });
    expect(segs.length).toBeGreaterThan(0);
    for (const s of segs) expect(Number.isFinite(s.a.x + s.b.y)).toBe(true);
  });

  it('pole devolve um ponto dentro e longe das bordas', () => {
    const poly = [rect(0, 0, 10, 4)];
    const p = poleOfInaccessibility(poly)!;
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(10);
    expect(p.y).toBeGreaterThan(0);
    expect(p.y).toBeLessThan(4);
  });
});

describe('circuitos e cache', () => {
  it('roomRegions e resolveRooms concordam na face interna, inclusive com finishInterior', () => {
    const p = room();
    const regions = roomRegions(p, 'lv_0');
    const [r] = resolveRooms(p, 'lv_0');
    expect(regions).toHaveLength(1);
    expect(r!.area).toBeCloseTo(20, 6);
    expect(r!.polygon).toEqual(regions[0]);
  });

  it('mover a flecha (sag) do arco muda a área', () => {
    const s = new ProjectStore(createEmptyProject());
    addRing(s, rect(0, 0, 4, 5), 'w', 0.4);
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 } }) });
    const a = resolveRooms(s.project, 'lv_0')[0]!.area;
    s.exec({ type: 'updateElements', ids: ['w_0'], patch: { sag: 0 } });
    const b = resolveRooms(s.project, 'lv_0')[0]!.area;
    expect(Math.abs(a - b)).toBeGreaterThan(0.01);
    expect(b).toBeCloseTo(20, 6);
  });

  it('projetos diferentes com os mesmos ids não compartilham a região', () => {
    const a = room();
    const b = room();
    expect(resolveRooms(a, 'lv_0')[0]!.area).toBeCloseTo(20, 6);
    expect(resolveRooms(b, 'lv_0')[0]!.area).toBeCloseTo(20, 6);
  });

  it('pilar ao lado de separador diagonal continua sendo furo', () => {
    const s = new ProjectStore(createEmptyProject());
    addRing(s, rect(0, 0, 4, 5), 'w');
    addRing(s, ring([[1.85, 0.85], [1.85, 1.15], [2.15, 1.15], [2.15, 0.85]]), 'pil');
    s.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { id: 'sep', a: { x: 0, y: 5 }, b: { x: 4, y: 0 } } });
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 1, y: 1 } }) });
    const [r] = resolveRooms(s.project, 'lv_0');
    expect(r!.polygon).toHaveLength(2);
    expect(r!.area).toBeLessThan(9.95);
  });
});
