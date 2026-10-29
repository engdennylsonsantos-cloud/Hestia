import { describe, expect, it } from 'vitest';
import { applyTransform, type Transform, type Vec2 } from '@hestia/geom';
import { defaultUnits, ProjectStore, createEmptyProject, makeRoof, type Project, type Roof } from '@hestia/model';
import { quantifyRoofs, roofScheduleToCsv, buildRoofSchedule, filterRoofRows, type RoofLayerQuantity } from './index.ts';

const R86: Vec2[] = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 6 },
  { x: 0, y: 6 },
];
const SLOPE = Math.sqrt(1.09); // 1 / cos(atan(0,3))

function build(extra: Partial<Roof>[], levelIds: string[] = []): Project {
  const s = new ProjectStore(createEmptyProject());
  extra.forEach((e, i) => s.exec({ type: 'addRoof', roof: makeRoof({ id: `r${i + 1}`, typeId: 'rt_ceramica', levelId: levelIds[i] ?? 'lv_0', boundary: R86, slopePercent: 30, ...e }) }));
  return s.project;
}

describe('quantitativos de telhado: casos à mão, 8 x 6 a 30 %', () => {
  it('quatro águas: planta 48, real 48 × 1,0440 = 50,1135; volume 48 × 0,095 = 4,56 m³', () => {
    const q = quantifyRoofs(build([{ shape: 'hip' }]), 'lv_0').roofs[0]!;
    expect(q.planArea).toBeCloseTo(48, 9);
    expect(q.faceArea).toBeCloseTo(48 * SLOPE, 6);
    expect(q.faceArea).toBeCloseTo(50.1135, 4);
    expect(q.volume).toBeCloseTo(4.56, 9);
    expect(q.thickness).toBeCloseTo(0.095, 9);
  });

  it('quatro águas: cumeeira 2 m; quatro espigões de √18,81 = 4,3370 m (3D); beiral 28 m; cota máxima 0,90 m', () => {
    const q = quantifyRoofs(build([{ shape: 'hip' }]), 'lv_0').roofs[0]!;
    expect(q.ridgeLength).toBeCloseTo(2, 9);
    expect(q.hipLength).toBeCloseTo(4 * Math.sqrt(18.81), 6);
    expect(q.hipLength).toBeCloseTo(17.3482, 4);
    expect(q.eaveLength).toBeCloseTo(28, 9);
    expect(q.ridgeHeight).toBeCloseTo(0.9, 9);
    expect(q.maxHeight).toBeCloseTo(0.9, 9);
    expect(q.perimeter).toBeCloseTo(28, 9);
  });

  it('duas águas com cumeeira em x: cumeeira 8 m a 0,90 m; áreas reais iguais de 24 × 1,0440', () => {
    const q = quantifyRoofs(build([{ shape: 'gable', dir: { x: 1, y: 0 } }]), 'lv_0').roofs[0]!;
    expect(q.ridgeLength).toBeCloseTo(8, 9);
    expect(q.ridgeHeight).toBeCloseTo(0.9, 9);
    expect(q.planes.map((x) => x.faceArea)).toEqual([24 * SLOPE, 24 * SLOPE].map((v) => expect.closeTo(v, 6)));
    // Beiral: as duas arestas longas de 8 m, em z 0. As empenas (6 m, perpendiculares à cumeeira) não são beiral.
    expect(q.eaveLength).toBeCloseTo(16, 9);
    expect(q.gableLength).toBeCloseTo(12, 9);
  });

  it('uma água com dir (0,1): sem cumeeira (o lado alto é empena a 1,80 m); beiral de 8 m; empenas de 20 m em planta', () => {
    const q = quantifyRoofs(build([{ shape: 'shed', dir: { x: 0, y: 1 } }]), 'lv_0').roofs[0]!;
    expect(q.planes).toHaveLength(1);
    expect(q.ridgeLength).toBeCloseTo(0, 9);
    expect(q.ridgeHeight).toBeNull();
    expect(q.maxHeight).toBeCloseTo(1.8, 9);
    expect(q.eaveLength).toBeCloseTo(8, 9);
    expect(q.gableLength).toBeCloseTo(20, 9);
  });

  it('volume por camada e por material: telha 48 × 0,015 = 0,72 m³; madeira 48 × 0,08 = 3,84 m³', () => {
    const q = quantifyRoofs(build([{ shape: 'hip' }]), 'lv_0');
    const layers: RoofLayerQuantity[] = q.roofs[0]!.layers;
    expect(layers.map((l) => l.volume)).toEqual([0.72, 1.44, 2.4].map((v) => expect.closeTo(v, 9)));
    expect(q.volumeByMaterial).toEqual({ mat_telha_ceramica: expect.closeTo(0.72, 9), mat_madeira: expect.closeTo(3.84, 9) });
    expect(q.totalVolume).toBeCloseTo(4.56, 9);
  });

  it('furo de 1 m² reduz a área em planta para 47 e o perímetro dos furos entra à parte', () => {
    const hole: Vec2[] = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ];
    const q = quantifyRoofs(build([{ shape: 'gable', dir: { x: 1, y: 0 }, holes: [hole] }]), 'lv_0').roofs[0]!;
    expect(q.planArea).toBeCloseTo(47, 9);
    expect(q.holesPerimeter).toBeCloseTo(4, 9);
    expect(q.perimeter).toBeCloseTo(28, 9);
  });
});

describe('telhado por extrusão: extremidades são empenas, não beirais (repro da auditoria)', () => {
  // Retângulo 12 x 6 com o eixo em x: o perfil (duas águas a 50 %, cumeeira em t = 3) sobe da transversal, e as duas
  // extremidades (x = 0 e x = 12) são as seções onde o perfil termina.
  const R12x6: Vec2[] = [
    { x: 0, y: 0 },
    { x: 12, y: 0 },
    { x: 12, y: 6 },
    { x: 0, y: 6 },
  ];
  const q = quantifyRoofs(
    build([{ shape: 'extrusion', boundary: R12x6, dir: { x: 1, y: 0 }, profile: [{ t: 0, z: 0 }, { t: 3, z: 1.5 }, { t: 6, z: 0 }] }]),
    'lv_0',
  ).roofs[0]!;

  it('beiral: só as duas arestas paralelas ao eixo, 2 × 12 m = 24 m (antes 37,416 m, com as extremidades somadas)', () => {
    expect(q.eaveLength).toBeCloseTo(24, 9);
  });

  it('empena: as duas extremidades, 2 × 6 m em planta; frontão = triângulo de 6 m × 1,5 m / 2 = 4,5 m² cada', () => {
    // Convenção das empenas (roofs.ts, como nos telhados por arestas): comprimento em planta. Em 3D seria 13,416 m.
    expect(q.gableLength).toBeCloseTo(12, 9);
    expect(q.gableArea).toBeCloseTo(9, 9);
  });

  it('cumeeira, áreas e volume não mudam: cumeeira 12 m, planta 72 m², real 72 × √1,25 m², volume 72 × 0,095 m³', () => {
    expect(q.ridgeLength).toBeCloseTo(12, 9);
    expect(q.planArea).toBeCloseTo(72, 9);
    expect(q.faceArea).toBeCloseTo(72 * Math.sqrt(1.25), 9);
    expect(q.volume).toBeCloseTo(6.84, 9);
  });
});

describe('quantitativos sob transformação e tabela', () => {
  it('girar e espelhar preservam área real, volume e cumeeira', () => {
    const base = build([{ shape: 'gable', dir: { x: 1, y: 0 } }]);
    const before = quantifyRoofs(base, 'lv_0').roofs[0]!;
    const s = new ProjectStore(base);
    const steps: Transform[] = [
      { kind: 'rotate', about: { x: 0, y: 0 }, angle: Math.PI / 4 },
      { kind: 'mirror', a: { x: 0, y: 0 }, b: { x: 1, y: 2 } },
    ];
    for (const transform of steps) {
      s.exec({ type: 'transform', ids: ['r1'], transform });
      const after = quantifyRoofs(s.project, 'lv_0').roofs[0]!;
      expect(after.planArea).toBeCloseTo(before.planArea, 5);
      // Recortes booleanos arredondam em 0,1 µm: 5 casas bastam.
      expect(after.faceArea).toBeCloseTo(before.faceArea, 5);
      expect(after.volume).toBeCloseTo(before.volume, 9);
      expect(after.ridgeLength).toBeCloseTo(before.ridgeLength, 5);
      expect(after.ridgeHeight).toBeCloseTo(before.ridgeHeight ?? 0, 5);
    }
    expect(applyTransform(steps[0]!, { x: 1, y: 0 }).x).toBeCloseTo(Math.SQRT1_2, 9);
  });

  it('tabela: uma linha por telhado, filtros, totais e CSV com ";" e decimal com vírgula', () => {
    const p = build([{ shape: 'hip' }, { shape: 'gable', dir: { x: 1, y: 0 }, levelId: 'lv_1' }], ['lv_0', 'lv_1']);
    const sch = buildRoofSchedule(p);
    expect(sch.rows.map((r) => r.shapeLabel)).toEqual(['Quatro águas', 'Duas águas']);
    expect(sch.totals.count).toBe(2);
    expect(sch.totals.planArea).toBeCloseTo(96, 9);
    expect(sch.totals.volume).toBeCloseTo(9.12, 9);
    expect(filterRoofRows(sch.rows, { levelId: 'lv_1' })).toHaveLength(1);
    expect(filterRoofRows(sch.rows, { shape: 'hip' }).map((r) => r.roofId)).toEqual(['r1']);
    const csv = roofScheduleToCsv(sch.rows, sch.totals, defaultUnits());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Marca;Tipo;Código;Nível;Forma;Inclinação (%);');
    expect(csv).toContain('Quatro águas;30,00;48,00;50,11;');
    expect(csv.trimEnd().split('\n').at(-1)).toMatch(/^Total;/);
  });
});
