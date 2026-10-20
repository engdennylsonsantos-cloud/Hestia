import { describe, expect, it } from 'vitest';
import { intersection, multiArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof, type Project } from '@hestia/model';
import { quantifyRoofs, resolveRoofs, roofTopAt, type ResolvedRoof, type RoofLine } from './index.ts';
import { setWeightedSkeleton } from './roofSkeleton.ts';
import { stubSkeleton } from './roofSkeletonStub.helper.ts';

/**
 * Junção de telhados (C4, Join Roof). Corpo 10 x 6 com cumeeira em x (duas águas, 30 %, beiral em 0 m); ala 4 x 4 em
 * x 7..11 e y 1..5, cumeeira em x = 9 (duas águas, 30 %): a cumeeira da ala fica em 0,60 m, abaixo dos 0,90 m do corpo.
 * Sobreposição em planta: x 7..10 e y 1..5, 3 x 4 = 12 m². Planta unida: 60 + 16 − 12 = 64 m².
 * Cotas no corpo (sem junção): S = 0,30 y e N = 0,30 (6 − y). Cotas na ala: W = 0,30 (x − 7) e E = 0,30 (11 − x).
 */
// As constantes abaixo já resolvem os telhados ao carregar o arquivo: o esqueleto de teste precisa estar instalado antes.
setWeightedSkeleton(stubSkeleton);

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function build(joinOthers: boolean): Project {
  const s = new ProjectStore(createEmptyProject());
  const body = makeRoof({ id: 'corpo', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect(0, 0, 10, 6), shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 }, joinOthers });
  const ala = makeRoof({ id: 'ala', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect(7, 1, 11, 5), shape: 'gable', slopePercent: 30, dir: { x: 0, y: 1 }, joinOthers });
  s.exec({ type: 'addRoof', roof: body });
  s.exec({ type: 'addRoof', roof: ala });
  return s.project;
}

const joined = (): ResolvedRoof[] => resolveRoofs(build(true), 'lv_0');
const separate = (): ResolvedRoof[] => resolveRoofs(build(false), 'lv_0');
const [corpoJ, alaJ] = [joined()[0]!, joined()[1]!];
const [corpoS, alaS] = [separate()[0]!, separate()[1]!];

/** Pontos de amostra dentro da sobreposição, fora das divisas (deslocados para não cair na grade do corte). */
const grid: Vec2[] = [];
// Passos irracionais: nenhum ponto cai exatamente sobre uma divisa do corte (que tem inclinação de 45° ou 26,6°).
for (let x = 7.1137; x < 10; x += 0.3713) for (let y = 1.1291; y < 5; y += 0.4117) grid.push({ x, y });

const topOf = (r: ResolvedRoof, p: Vec2): number | null => roofTopAt(r, p);

describe('junção: a superfície é a maior cota', () => {
  it('em cada ponto da sobreposição, só uma água fica e a cota é o máximo das duas sem junção', () => {
    for (const p of grid) {
      const bodyJ = topOf(corpoJ, p);
      const alaJ2 = topOf(alaJ, p);
      const alone = [bodyJ, alaJ2].filter((z): z is number => z !== null);
      expect(alone).toHaveLength(1);
      const expected = Math.max(topOf(corpoS, p)!, topOf(alaS, p)!);
      expect(alone[0]).toBeCloseTo(expected, 9);
    }
  });

  it('cota em um ponto da ala dentro do corpo: (9; 1,2) fica com a ala (0,60); (8,5; 2) fica com o corpo (0,60)', () => {
    expect(topOf(alaJ, { x: 9, y: 1.2 })).toBeCloseTo(0.6, 9);
    expect(topOf(corpoJ, { x: 9, y: 1.2 })).toBeNull();
    expect(topOf(corpoJ, { x: 8.5, y: 2 })).toBeCloseTo(0.6, 9);
    expect(topOf(alaJ, { x: 8.5, y: 2 })).toBeNull();
  });

  it('sem junção (joinOthers desligado nos dois), cada telhado mantém a sua cota na sobreposição', () => {
    expect(topOf(corpoS, { x: 9, y: 1.2 })).toBeCloseTo(0.36, 9);
    expect(topOf(alaS, { x: 9, y: 1.2 })).toBeCloseTo(0.6, 9);
  });

  it('as águas unidas não se sobrepõem entre telhados', () => {
    for (const a of corpoJ.planes) {
      for (const b of alaJ.planes) {
        expect(multiArea(intersection(a.polygon, b.polygon))).toBeLessThan(1e-9);
      }
    }
  });
});

describe('junção: área em planta e volume', () => {
  it('a área cortada soma a sobreposição (12 m²); a planta unida é 64 m²', () => {
    expect(corpoJ.joinedArea + alaJ.joinedArea).toBeCloseTo(12, 9);
    const q = quantifyRoofs(build(true), 'lv_0');
    expect(q.totalPlanArea).toBeCloseTo(64, 9);
    expect(q.roofs.reduce((s, r) => s + r.volume, 0)).toBeCloseTo(64 * 0.095, 9);
  });

  it('cada telhado mantém a espessura da sua camada (0,095 m)', () => {
    expect(corpoJ.layers.reduce((s, l) => s + l.thickness, 0)).toBeCloseTo(0.095, 9);
    expect(alaJ.layers.reduce((s, l) => s + l.thickness, 0)).toBeCloseTo(0.095, 9);
  });
});

describe('junção: divisas entre telhados', () => {
  const valleys = (rs: ResolvedRoof[]): RoofLine[] => rs.flatMap((r) => r.lines.filter((l) => l.kind === 'valley'));
  const mid = (l: RoofLine): Vec2 => ({ x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2 });

  it('as divisas entre a ala e o corpo entram como rincão (valley), dentro da sobreposição', () => {
    const vs = valleys(joined());
    expect(vs.length).toBeGreaterThanOrEqual(1);
    for (const l of vs) {
      const m = mid(l);
      expect(m.x).toBeGreaterThan(7 - 1e-6);
      expect(m.x).toBeLessThan(10 + 1e-6);
      expect(m.y).toBeGreaterThan(1 - 1e-6);
      expect(m.y).toBeLessThan(5 + 1e-6);
    }
  });

  it('sem junção não há rincão entre os telhados', () => {
    expect(valleys(separate())).toEqual([]);
  });

  it('a divisa do corte está na cota comum: nos dois lados da linha a superfície é contínua', () => {
    const vs = valleys(joined());
    for (const l of vs) {
      const m = mid(l);
      // Deslocamento perpendicular à divisa, para cair dos dois lados dela.
      const len = Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y);
      const n = { x: (-(l.b.y - l.a.y) / len) * 1e-4, y: ((l.b.x - l.a.x) / len) * 1e-4 };
      const at = (s: number): number | null => topOf(corpoJ, { x: m.x + s * n.x, y: m.y + s * n.y }) ?? topOf(alaJ, { x: m.x + s * n.x, y: m.y + s * n.y });
      const zA = at(1);
      const zB = at(-1);
      expect(zA).not.toBeNull();
      expect(zB).not.toBeNull();
      expect(Math.abs(zA! - zB!)).toBeLessThan(1e-3);
    }
  });
});
