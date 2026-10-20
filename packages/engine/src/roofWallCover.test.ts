import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeRoof, makeWall, type Project, type ProfilePoint, type Wall } from '@hestia/model';
import { roofWallIssues, wallZRange } from './index.ts';
import { resolveAllRoofs } from './roofs.ts';
import { setWeightedSkeleton } from './roofSkeleton.ts';
import { stubSkeleton } from './roofSkeletonStub.helper.ts';
import { roofAxisReport } from './roofWall.ts';

/**
 * C2 · parede e telhado. Telhado 8 x 6 (x 0..8, y 0..6) de duas águas em x, beiral em 3 m: cumeeira em y = 3, a 3,90 m;
 * face inferior 3,90 − 0,095 = 3,805 m. Parede com base em 0 m e 3 m de altura (altura normal).
 */
beforeAll(() => setWeightedSkeleton(stubSkeleton));
afterAll(() => setWeightedSkeleton(null));

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const BOTTOM = 3.9 - 0.095;

function build(walls: Array<Omit<Wall, 'order'>>): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({
    type: 'addRoof',
    roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect(0, 0, 8, 6), shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 }, heightOffset: 3 }),
  });
  for (const w of walls) s.exec({ type: 'addWall', wall: w });
  return s.project;
}

const wall = (id: string, extra: Partial<Wall>): Omit<Wall, 'order'> =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, height: 3, attachTopToRoof: true, ...extra });

const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;
const hasPoint = (pr: ProfilePoint[], t: number, h: number): boolean => pr.some((p) => close(p.t, t) && close(p.h, h));

describe('C2 · topo ajustado só no trecho coberto', () => {
  // Eixo de (−2; 3) a (4; 3): x −2..0 fora do telhado, x 0..4 sob ele.
  const partial = wall('w1', { a: { x: -2, y: 3 }, b: { x: 4, y: 3 } });

  it('o trecho fora do telhado fica na altura normal (3 m); o trecho coberto segue a face inferior (3,805 m)', () => {
    const p = build([partial]);
    const z = wallZRange(p, p.elements.w1 as Wall);
    expect(z.profile).toBeDefined();
    expect(hasPoint(z.profile!, 0, 3)).toBe(true);
    expect(hasPoint(z.profile!, 1, 3)).toBe(true);
    expect(hasPoint(z.profile!, 2, 3)).toBe(true);
    expect(hasPoint(z.profile!, 2, BOTTOM)).toBe(true);
    expect(hasPoint(z.profile!, 6, BOTTOM)).toBe(true);
    expect(z.height).toBeCloseTo(BOTTOM, 6);
  });

  it('parede totalmente fora do telhado não tem perfil: altura normal', () => {
    const p = build([wall('w2', { a: { x: 0, y: 10 }, b: { x: 8, y: 10 } })]);
    const z = wallZRange(p, p.elements.w2 as Wall);
    expect(z.profile).toBeUndefined();
    expect(z).toEqual({ z0: 0, height: 3 });
  });

  it('parede totalmente sob o telhado segue a face inferior em todo o eixo, sem degrau', () => {
    const p = build([wall('w3', { a: { x: 1, y: 3 }, b: { x: 7, y: 3 } })]);
    const z = wallZRange(p, p.elements.w3 as Wall);
    expect(z.profile!.every((pt) => close(pt.h, BOTTOM))).toBe(true);
  });

  it('relatório de cobertura: 2 m do eixo de 6 m fora do telhado; menor face inferior sobre o trecho coberto', () => {
    const p = build([partial]);
    const rep = roofAxisReport(p.elements.w1 as Wall, resolveAllRoofs(p));
    expect(rep!.length).toBeCloseTo(6, 9);
    expect(rep!.uncovered).toBeCloseTo(2, 9);
    expect(rep!.minBottom).toBeCloseTo(BOTTOM, 9);
  });
});

describe('C2 · avisos entre paredes e telhados', () => {
  it('parede anexada com trecho fora do telhado: aviso wall-roof-uncovered', () => {
    const p = build([wall('w1', { a: { x: -2, y: 3 }, b: { x: 4, y: 3 } })]);
    const issues = roofWallIssues(p);
    expect(issues.map((i) => i.code)).toEqual(['wall-roof-uncovered']);
    expect(issues[0]!.message).toContain('2,00 m');
  });

  it('parede anexada totalmente fora do telhado: também avisa, com a frase de eixo fora', () => {
    const p = build([wall('w2', { a: { x: 0, y: 10 }, b: { x: 8, y: 10 } })]);
    const issues = roofWallIssues(p);
    expect(issues.map((i) => i.code)).toEqual(['wall-roof-uncovered']);
    expect(issues[0]!.message).toContain('nenhum');
  });

  it('parede sem anexo que sobe além da face inferior do telhado: aviso wall-roof-pierce', () => {
    // Eixo perpendicular à cumeeira em x = 2: a face inferior menor é 3,3 − 0,095 = 3,205 m, e a parede vai a 4 m.
    const p = build([wall('w3', { a: { x: 2, y: 1 }, b: { x: 2, y: 5 }, height: 4, attachTopToRoof: false })]);
    expect(roofWallIssues(p).map((i) => i.code)).toEqual(['wall-roof-pierce']);
  });

  it('parede sem anexo abaixo da face inferior não avisa', () => {
    const p = build([wall('w4', { a: { x: 2, y: 1 }, b: { x: 2, y: 5 }, height: 3, attachTopToRoof: false })]);
    expect(roofWallIssues(p)).toEqual([]);
  });

  it('parede anexada totalmente coberta não avisa', () => {
    const p = build([wall('w5', { a: { x: 1, y: 3 }, b: { x: 7, y: 3 } })]);
    expect(roofWallIssues(p)).toEqual([]);
  });
});
