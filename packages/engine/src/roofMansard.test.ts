import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof, validateProject, type Project, type Roof } from '@hestia/model';
import { quantifyRoofs, resolveRoofs, roofTopAt, type ResolvedRoof } from './index.ts';

/** Esqueleto real (sem stub): o contorno em L precisa do tratamento de vértice reentrante. */
const rect = (w: number, h: number): Vec2[] => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
/** L 10 x 10 com o canto superior direito retirado (5 x 5): vértice reentrante em (5, 5). */
const L: Vec2[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 10 }, { x: 0, y: 10 }];
const MANSARD = { lowerPercent: 100, upperPercent: 30, run: 2 };

function build(extra: Partial<Roof> & { boundary: Vec2[] }): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', slopePercent: 30, shape: 'hip', ...extra }) });
  return s.project;
}
const one = (extra: Partial<Roof> & { boundary: Vec2[] }): ResolvedRoof => resolveRoofs(build(extra), 'lv_0')[0]!;
const sf = (p: number): number => Math.sqrt(1 + (p / 100) ** 2);

describe('mansarda automática', () => {
  it('retângulo 10 x 8: alturas h(d) = 1,0·d até 2 m e 2 + 0,3·(d − 2) depois; cumeeira em 2,6', () => {
    const r = one({ boundary: rect(10, 8), mansard: MANSARD });
    expect(r.problem).toBeUndefined();
    const z = (x: number, y: number): number => roofTopAt(r, { x, y })!;
    expect(z(5, 0.5)).toBeCloseTo(0.5, 9);
    expect(z(5, 1.9)).toBeCloseTo(1.9, 9);
    expect(z(5, 3)).toBeCloseTo(2.3, 9);
    expect(z(0.5, 4)).toBeCloseTo(0.5, 9);
    expect(z(2.5, 4)).toBeCloseTo(2.15, 9);
    expect(z(5, 4)).toBeCloseTo(2.6, 9);
  });

  it('duas faces por água e linhas de desnível; a área real soma faixa íngreme e suave', () => {
    const p = build({ boundary: rect(10, 8), mansard: MANSARD });
    const r = resolveRoofs(p, 'lv_0')[0]!;
    expect(r.planes).toHaveLength(8);
    expect(r.lines.filter((l) => l.kind === 'break').length).toBeGreaterThanOrEqual(4);
    expect(r.lines.filter((l) => l.kind === 'ridge').length).toBeGreaterThan(0);
    const lowerArea = 80 - 6 * 4;
    const upperArea = 6 * 4;
    const q = quantifyRoofs(p, 'lv_0').roofs[0]!;
    expect(q.planArea).toBeCloseTo(80, 6);
    expect(q.faceArea).toBeCloseTo(lowerArea * sf(100) + upperArea * sf(30), 5);
  });

  it('contorno em L (côncavo): contínuo no vértice reentrante e nas faixas, sem problema', () => {
    const r = one({ boundary: L, mansard: MANSARD });
    expect(r.problem).toBeUndefined();
    expect(r.planes.length).toBeGreaterThanOrEqual(8);
    const area = r.planes.reduce((s, pl) => s + multiArea(pl.polygon), 0);
    expect(area).toBeCloseTo(75, 5);
    expect(roofTopAt(r, { x: 5, y: 0.5 })).toBeCloseTo(0.5, 6);
    expect(roofTopAt(r, { x: 0.5, y: 2 })).toBeCloseTo(0.5, 6);
    // d < run: 1,5 m do beiral da direita; d > run: a 2,5 m dos dois beirais (2 + 0,3 · 0,5).
    expect(roofTopAt(r, { x: 8.5, y: 2.5 })).toBeCloseTo(1.5, 6);
    expect(roofTopAt(r, { x: 2.5, y: 2.5 })).toBeCloseTo(2.15, 6);
  });

  it('sem mansarda nada muda (campo opcional)', () => {
    const r = one({ boundary: rect(10, 8) });
    expect(r.planes).toHaveLength(4);
    expect(r.lines.some((l) => l.kind === 'break')).toBe(false);
  });

  it('run que chega ao centro do esqueleto é recusado pelo motor', () => {
    const r = one({ boundary: rect(10, 8), mansard: { ...MANSARD, run: 4 } });
    expect(r.planes).toHaveLength(0);
    expect(r.problem).toMatch(/não cabe/);
  });

  it('convive com o arco real (edgeSag)', () => {
    const r = one({ boundary: rect(10, 8), edgeSag: [0.5, 0, 0, 0], mansard: MANSARD });
    expect(r.problem).toBeUndefined();
    expect(r.planes.length).toBeGreaterThan(8);
  });
});

describe('validação da mansarda', () => {
  const codes = (extra: Partial<Roof> & { boundary: Vec2[] }): string[] => validateProject(build(extra)).map((i) => i.code);

  it('aceita uma mansarda válida', () => {
    expect(codes({ boundary: rect(10, 8), mansard: MANSARD }).filter((c) => c.startsWith('roof-mansard'))).toEqual([]);
  });
  it('recusa run <= 0', () => {
    expect(codes({ boundary: rect(10, 8), mansard: { ...MANSARD, run: 0 } })).toContain('roof-mansard-run');
  });
  it('recusa inclinação fora de (0, 300]', () => {
    expect(codes({ boundary: rect(10, 8), mansard: { ...MANSARD, lowerPercent: 0 } })).toContain('roof-mansard-slope');
    expect(codes({ boundary: rect(10, 8), mansard: { ...MANSARD, upperPercent: 301 } })).toContain('roof-mansard-slope');
  });
  it('recusa run que chega ao centro (retângulo 10 x 8: limite 4 m; L: limite 2,5 m)', () => {
    const msgs = validateProject(build({ boundary: rect(10, 8), mansard: { ...MANSARD, run: 4 } })).filter((i) => i.code === 'roof-mansard-run');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.message).toMatch(/chega ao centro/);
    expect(codes({ boundary: L, mansard: { ...MANSARD, run: 3 } })).toContain('roof-mansard-run');
    expect(codes({ boundary: L, mansard: { ...MANSARD, run: 2 } })).not.toContain('roof-mansard-run');
  });
  it('recusa mansarda em águas livres', () => {
    expect(codes({ boundary: rect(10, 8), shape: 'free', mansard: MANSARD })).toContain('roof-mansard-shape');
  });
});
