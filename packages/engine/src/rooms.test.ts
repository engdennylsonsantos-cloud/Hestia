import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoom, makeWall, type Project } from '@hestia/model';
import { resolveRooms, roomValidationIssues } from './index.ts';

/**
 * As paredes usam `locationLine: 'finishInterior'`: a face interna coincide com o anel dado, então a área do ambiente
 * é exatamente a do polígono. O anel do contorno é horário (interior à direita) e o do pilar anti-horário (o corpo da
 * parede aponta para o centro, formando um bloco maciço que vira furo).
 */
const ring = (pts: Array<[number, number]>): Vec2[] => pts.map(([x, y]) => ({ x, y }));
const rectRing = (x0: number, y0: number, x1: number, y1: number): Vec2[] => ring([[x0, y0], [x0, y1], [x1, y1], [x1, y0]]);
const pillarRing = (cx: number, cy: number, s: number): Vec2[] => ring([[cx - s / 2, cy - s / 2], [cx + s / 2, cy - s / 2], [cx + s / 2, cy + s / 2], [cx - s / 2, cy + s / 2]]);

function addRing(s: ProjectStore, pts: Vec2[], prefix: string): void {
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `${prefix}_${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior' }) });
  });
}

/** Poligonal ABERTA (o último ponto não liga ao primeiro): para montar circuitos abertos. */
function addOpen(s: ProjectStore, pts: Vec2[], prefix: string): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `${prefix}_${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior' }) });
  }
}

function build(rings: Vec2[][], point: Vec2): Project {
  const s = new ProjectStore(createEmptyProject());
  rings.forEach((r, i) => addRing(s, r, `w${i}`));
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r', levelId: 'lv_0', name: 'Sala', number: '101', point }) });
  return s.project;
}

describe('resolveRooms · casos dourados', () => {
  it('retângulo 4 × 5: área 20 m² e perímetro 18 m', () => {
    const p = build([rectRing(0, 0, 4, 5)], { x: 2, y: 2.5 });
    const [r] = resolveRooms(p, 'lv_0');
    expect(r!.problem).toBeNull();
    expect(r!.area).toBeCloseTo(20, 6);
    expect(r!.perimeter).toBeCloseTo(18, 6);
    expect(r!.polygon).toHaveLength(1);
  });

  it('pilar interno vira furo: área = 20 − 0,09 e o polígono tem um furo', () => {
    const p = build([rectRing(0, 0, 4, 5), pillarRing(2, 2.5, 0.3)], { x: 1, y: 1 });
    const [r] = resolveRooms(p, 'lv_0');
    expect(r!.problem).toBeNull();
    expect(r!.polygon).toHaveLength(2);
    expect(r!.area).toBeCloseTo(20 - 0.3 * 0.3, 6);
    expect(r!.perimeter).toBeCloseTo(18, 6);
  });

  it('ambiente em L: área 6 m²', () => {
    const l = ring([[0, 0], [0, 3], [1, 3], [1, 1], [4, 1], [4, 0]]);
    const p = build([l], { x: 0.5, y: 0.5 });
    const [r] = resolveRooms(p, 'lv_0');
    expect(r!.problem).toBeNull();
    expect(r!.area).toBeCloseTo(6, 6);
  });

  it('circuito aberto (U sem uma parede): problem "aberto" e área zero', () => {
    const s = new ProjectStore(createEmptyProject());
    addOpen(s, ring([[0, 0], [0, 5], [4, 5], [4, 0]]), 'w0');
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 } }) });
    const [r] = resolveRooms(s.project, 'lv_0');
    expect(r!.problem).toBe('aberto');
    expect(r!.polygon).toBeNull();
    expect(r!.area).toBe(0);
    expect(r!.volume).toBe(0);
  });

  it('nível sem paredes: problem "fora"', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2 } }) });
    const [r] = resolveRooms(s.project, 'lv_0');
    expect(r!.problem).toBe('fora');
    expect(r!.area).toBe(0);
  });

  it('volume = área × pé-direito (padrão 2,8 m e campo próprio)', () => {
    const p = build([rectRing(0, 0, 4, 5)], { x: 2, y: 2.5 });
    const [r] = resolveRooms(p, 'lv_0');
    expect(r!.ceilingHeight).toBe(2.8);
    expect(r!.volume).toBeCloseTo(20 * 2.8, 6);

    const s = new ProjectStore(createEmptyProject());
    addRing(s, rectRing(0, 0, 4, 5), 'w0');
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 }, ceilingHeight: 3 }) });
    const [r2] = resolveRooms(s.project, 'lv_0');
    expect(r2!.ceilingHeight).toBe(3);
    expect(r2!.volume).toBeCloseTo(60, 6);
  });
});

describe('resolveRooms · ambiente duplicado', () => {
  it('dois pontos no mesmo circuito: o segundo marca duplicateOf do primeiro', () => {
    const s = new ProjectStore(createEmptyProject());
    addRing(s, rectRing(0, 0, 4, 5), 'w0');
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'a', levelId: 'lv_0', name: 'A', number: '1', point: { x: 1, y: 1 } }) });
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'b', levelId: 'lv_0', name: 'B', number: '2', point: { x: 3, y: 4 } }) });
    const [a, b] = resolveRooms(s.project, 'lv_0');
    expect(a!.duplicateOf).toBeUndefined();
    expect(b!.duplicateOf).toBe('a');
  });
});

describe('roomValidationIssues', () => {
  it('ponto fora de circuito vira erro com código room-point-*', () => {
    const p = build([rectRing(0, 0, 4, 5)], { x: 100, y: 100 });
    const issues = roomValidationIssues(p);
    expect(issues.some((i) => i.code === 'room-point-outside' && i.severity === 'error')).toBe(true);
  });

  it('circuito aberto vira erro room-point-open', () => {
    const s = new ProjectStore(createEmptyProject());
    addOpen(s, ring([[0, 0], [0, 5], [4, 5], [4, 0]]), 'w0');
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 } }) });
    expect(roomValidationIssues(s.project).some((i) => i.code === 'room-point-open')).toBe(true);
  });

  it('duplicado no mesmo circuito vira warning room-duplicate', () => {
    const s = new ProjectStore(createEmptyProject());
    addRing(s, rectRing(0, 0, 4, 5), 'w0');
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'a', levelId: 'lv_0', name: 'A', number: '1', point: { x: 1, y: 1 } }) });
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'b', levelId: 'lv_0', name: 'B', number: '2', point: { x: 3, y: 4 } }) });
    const issues = roomValidationIssues(s.project);
    expect(issues.some((i) => i.code === 'room-duplicate' && i.severity === 'warning' && i.elementId === 'b')).toBe(true);
  });
});

/** Gerador determinístico (mulberry32): mesma semente, mesmos retângulos em qualquer execução. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('G4 · propriedade: ponto em 30 retângulos aleatórios (semente fixa)', () => {
  const rand = rng(20260615);
  const rects = Array.from({ length: 30 }, (_, k) => {
    const w = 1 + rand() * 8;
    const h = 1 + rand() * 8;
    const x0 = k * 25;
    const y0 = 0;
    return { x0, y0, w, h, point: { x: x0 + w / 2, y: y0 + h / 2 } };
  });
  const s = new ProjectStore(createEmptyProject());
  rects.forEach((r, k) => {
    addRing(s, rectRing(r.x0, r.y0, r.x0 + r.w, r.y0 + r.h), `w${k}`);
    s.exec({ type: 'addRoom', room: makeRoom({ id: `r${k}`, levelId: 'lv_0', name: `R${k}`, number: `${k}`, point: r.point }) });
  });
  const resolved = resolveRooms(s.project, 'lv_0');

  it('resolve os 30 ambientes sem exceção, todos sem problema', () => {
    expect(resolved).toHaveLength(30);
    for (const r of resolved) expect(r.problem).toBeNull();
  });

  it('área e perímetro de cada ambiente batem com o retângulo', () => {
    resolved.forEach((r, k) => {
      const { w, h } = rects[k]!;
      expect(r.area).toBeCloseTo(w * h, 4);
      expect(r.perimeter).toBeCloseTo(2 * (w + h), 4);
    });
  });
});
