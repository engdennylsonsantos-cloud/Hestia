import { describe, expect, it } from 'vitest';
import { multiArea, type Transform, type Vec2 } from '@hestia/geom';
import { ProjectStore, SCHEMA_VERSION, createEmptyProject, makeRoof, migrateProject, type Project, type Roof } from '@hestia/model';
import { quantifyRoofs, resolveRoofs, roofTopAt, type ResolvedRoof } from './index.ts';

/**
 * Casos dourados de telhado (G3), valores derivados à mão. Retângulo 8 x 6 m (x 0..8, y 0..6), inclinação de 30 %,
 * beiral em 0 m. 30 % é 0,30 de subida por metro; cos(atan(0,3)) = 1/√1,09, então a área real é planta × √1,09 = 1,0440 ×.
 * Quatro águas: altura = 0,30 × distância à aresta mais próxima; máximo 0,30 × 3 = 0,90 m; cumeeira de 8 − 6 = 2 m.
 * Duas águas: cumeeira em y = 3, 0,90 m; cumeeira de 8 m quando dir = (1,0).
 * Uma água: 0,30 × 6 = 1,80 m no lado alto quando dir = (0,1).
 */
const R86: Vec2[] = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 6 },
  { x: 0, y: 6 },
];
const SLOPE = Math.sqrt(1.09);

function build(extra: Partial<Roof>, levelId = 'lv_0'): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId, boundary: R86, slopePercent: 30, ...extra }) });
  return s.project;
}
const resolved = (p: Project, levelId = 'lv_0'): ResolvedRoof => resolveRoofs(p, levelId)[0]!;
const sumPlanArea = (r: ResolvedRoof): number => r.planes.reduce((s, pl) => s + multiArea(pl.polygon), 0);

describe('G3 · telhado: quatro águas 8 x 6 a 30 %', () => {
  it('quatro águas; áreas em planta 15, 15, 9, 9; área real total 48 × √1,09 = 50,1135 m²', () => {
    const r = resolved(build({ shape: 'hip' }));
    expect(r.planes).toHaveLength(4);
    const planar = r.planes.map((pl) => multiArea(pl.polygon)).sort((a, b) => a - b);
    expect(planar[0]).toBeCloseTo(9, 9);
    expect(planar[3]).toBeCloseTo(15, 9);
    const real = quantifyRoofs(build({ shape: 'hip' }), 'lv_0').roofs[0]!.faceArea;
    expect(real).toBeCloseTo(48 * SLOPE, 6);
    expect(real).toBeCloseTo(50.1135, 4);
  });

  it('altura máxima 0,90 m e cumeeira de 2 m; em (1; 3) a altura é 0,30 m', () => {
    const q = quantifyRoofs(build({ shape: 'hip' }), 'lv_0').roofs[0]!;
    expect(q.maxHeight).toBeCloseTo(0.9, 9);
    expect(q.ridgeLength).toBeCloseTo(2, 9);
    expect(roofTopAt(resolved(build({ shape: 'hip' })), { x: 1, y: 3 })).toBeCloseTo(0.3, 9);
  });
});

describe('G3 · telhado: duas águas', () => {
  it('cumeeira ao longo de x: 8 m, altura 0,90 m, duas águas de área real iguais (24 × √1,09)', () => {
    const p = build({ shape: 'gable', dir: { x: 1, y: 0 } });
    const q = quantifyRoofs(p, 'lv_0').roofs[0]!;
    expect(q.ridgeLength).toBeCloseTo(8, 9);
    expect(q.ridgeHeight).toBeCloseTo(0.9, 9);
    expect(q.maxHeight).toBeCloseTo(0.9, 9);
    expect(q.planes).toHaveLength(2);
    expect(q.planes[0]!.faceArea).toBeCloseTo(24 * SLOPE, 6);
    expect(q.planes[1]!.faceArea).toBeCloseTo(24 * SLOPE, 6);
  });
});

describe('G3 · telhado: uma água', () => {
  it('dir (0,1): sobe 6 m em y, altura máxima 1,80 m no lado alto; área real 48 × √1,09', () => {
    const p = build({ shape: 'shed', dir: { x: 0, y: 1 } });
    const q = quantifyRoofs(p, 'lv_0').roofs[0]!;
    expect(q.planes).toHaveLength(1);
    expect(q.maxHeight).toBeCloseTo(1.8, 9);
    expect(roofTopAt(resolved(p), { x: 4, y: 6 })).toBeCloseTo(1.8, 9);
    expect(q.faceArea).toBeCloseTo(48 * SLOPE, 6);
  });
});

describe('G3 · telhado: pirâmide (quadrado em quatro águas)', () => {
  it('quadrado 6 x 6: cumeeira de comprimento 0 e altura no topo 0,30 × 6/2 = 0,90 m', () => {
    const sq: Vec2[] = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 6 },
      { x: 0, y: 6 },
    ];
    const p = build({ shape: 'hip', boundary: sq });
    const q = quantifyRoofs(p, 'lv_0').roofs[0]!;
    expect(q.ridgeLength).toBe(0);
    expect(q.ridgeHeight).toBeNull();
    expect(q.hipLength).toBeGreaterThan(0);
    expect(q.maxHeight).toBeCloseTo(0.9, 9);
    expect(roofTopAt(resolved(p), { x: 3, y: 3 })).toBeCloseTo(0.9, 9);
  });
});

describe('G3 · telhado: furo, deslocamento, transformações e arquivo', () => {
  it('furo de 1 m² no centro-baixo: área em planta 47 m²; a cota dentro do furo não existe', () => {
    const hole: Vec2[] = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ];
    const p = build({ shape: 'gable', dir: { x: 1, y: 0 }, holes: [hole] });
    expect(sumPlanArea(resolved(p))).toBeCloseTo(47, 9);
    expect(roofTopAt(resolved(p), { x: 1.5, y: 1.5 })).toBeNull();
  });

  it('deslocamento do beiral de +0,50 m sobe toda a cobertura e a cumeeira (0,90 → 1,40 m)', () => {
    const q = quantifyRoofs(build({ shape: 'hip', heightOffset: 0.5 }), 'lv_0').roofs[0]!;
    expect(q.maxHeight).toBeCloseTo(1.4, 9);
    expect(resolved(build({ shape: 'hip', heightOffset: 0.5 })).eaveZ).toBeCloseTo(0.5, 9);
  });

  it('mover, girar e espelhar preservam área real, área em planta e cumeeira (quatro águas)', () => {
    const base = build({ shape: 'hip' });
    const before = quantifyRoofs(base, 'lv_0').roofs[0]!;
    const s = new ProjectStore(base);
    const steps: Transform[] = [
      { kind: 'translate', d: { x: 10, y: -4 } },
      { kind: 'rotate', about: { x: 0, y: 0 }, angle: Math.PI / 3 },
      { kind: 'mirror', a: { x: 0, y: 0 }, b: { x: 1, y: 2 } },
    ];
    for (const transform of steps) {
      s.exec({ type: 'transform', ids: ['r1'], transform });
      const after = quantifyRoofs(s.project, 'lv_0').roofs[0]!;
      expect(after.planArea).toBeCloseTo(before.planArea, 5);
      expect(after.faceArea).toBeCloseTo(before.faceArea, 5);
      expect(after.ridgeLength).toBeCloseTo(before.ridgeLength, 5);
      expect(after.maxHeight).toBeCloseTo(before.maxHeight, 5);
    }
  });

  it('ida e volta JSON: o projeto e as águas resolvidas são iguais', () => {
    const p = build({ shape: 'gable', dir: { x: 1, y: 0 }, holes: [[{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }]] });
    const back = JSON.parse(JSON.stringify(p)) as Project;
    expect(back).toEqual(p);
    expect(resolveRoofs(migrateProject(back), 'lv_0')).toEqual(resolveRoofs(p, 'lv_0'));
  });

  it('migração de v8 sem roofTypes: ganha os três tipos padrão e o telhado continua resolvendo', () => {
    const p = build({ shape: 'hip' });
    const raw = JSON.parse(JSON.stringify(p));
    raw.schemaVersion = 8;
    delete raw.roofTypes;
    const m = migrateProject(raw);
    expect(Object.keys(m.roofTypes).sort()).toEqual(['rt_ceramica', 'rt_fibro', 'rt_metalica']);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(quantifyRoofs(m, 'lv_0').roofs[0]!.maxHeight).toBeCloseTo(0.9, 9);
  });
});
