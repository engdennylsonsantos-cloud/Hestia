import { describe, expect, it } from 'vitest';
import { applyTransform, multiArea, type Transform, type Vec2 } from '@hestia/geom';
import { DEFAULT_SLAB_TYPES, ProjectStore, SCHEMA_VERSION, createEmptyProject, makeSlab, migrateProject, type Project, type Slab } from '@hestia/model';
import { quantifySlabs, resolveSlabs, slabRiseAt } from './index.ts';

/**
 * Casos dourados de laje (G3), valores derivados à mão. ls_mac15 tem regularização de 2 cm (argamassa) sobre 15 cm de
 * concreto: total de 17 cm. ls_mac12 tem 12 cm de concreto. ls_cobertura: acabamento de 3 cm, membrana de espessura
 * zero e 10 cm de concreto (13 cm no total).
 * Retângulo 4 x 3 m: área 12 m². Com ls_mac15: 0,24 m³ de regularização e 1,80 m³ de concreto, 2,04 m³ no total.
 */
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const L: Vec2[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 3 },
  { x: 0, y: 3 },
];

function build(slabs: Array<Partial<Slab> & Pick<Slab, 'id' | 'boundary'>>): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const x of slabs) s.exec({ type: 'addSlab', slab: makeSlab({ typeId: 'ls_mac15', levelId: 'lv_0', ...x }) });
  return s.project;
}

const area = (p: Project, id: string): number => multiArea(resolveSlabs(p, 'lv_0').find((r) => r.slabId === id)!.polygon);

describe('G3 · laje: área e volume', () => {
  it('retângulo 4 x 3 com ls_mac15: área 12 e volumes 0,24 (regularização) e 1,80 (concreto)', () => {
    const p = build([{ id: 's1', boundary: rect(0, 0, 4, 3) }]);
    expect(area(p, 's1')).toBeCloseTo(12, 9);
    const q = quantifySlabs(p, 'lv_0');
    expect(q.layers.map((l) => l.volume)).toEqual([0.24, 1.8].map((v) => expect.closeTo(v, 9)));
    expect(q.totalVolume).toBeCloseTo(2.04, 9);
    expect(q.volumeByMaterial).toEqual({ mat_argamassa: expect.closeTo(0.24, 9), mat_concreto: expect.closeTo(1.8, 9) });
  });

  it('retângulo 4 x 3: camadas de cima para baixo, de 0 a -0,17 m', () => {
    const [r] = resolveSlabs(build([{ id: 's1', boundary: rect(0, 0, 4, 3) }]), 'lv_0');
    expect(r!.topZ).toBe(0);
    expect(r!.bottomZ).toBeCloseTo(-0.17, 9);
    expect(r!.layers.map((l) => [l.z0, l.z1].map((z) => Math.round(z * 1e6) / 1e6))).toEqual([
      [-0.02, 0],
      [-0.17, -0.02],
    ]);
  });

  it('piso em L: área 6 e volume 6 × 0,17', () => {
    const p = build([{ id: 's1', boundary: L }]);
    expect(area(p, 's1')).toBeCloseTo(6, 9);
    expect(quantifySlabs(p, 'lv_0').totalVolume).toBeCloseTo(6 * 0.17, 9);
  });

  it('retângulo 4 x 3 com furo 1 x 1: área 11 e volume 11 × 0,17', () => {
    const p = build([{ id: 's1', boundary: rect(0, 0, 4, 3), holes: [rect(1, 1, 2, 2)] }]);
    expect(area(p, 's1')).toBeCloseTo(11, 9);
    const q = quantifySlabs(p, 'lv_0').slabs[0]!;
    expect(q.volume).toBeCloseTo(11 * 0.17, 9);
    expect(q.layers.map((l) => l.volume)).toEqual([0.22, 1.65].map((v) => expect.closeTo(v, 9)));
  });
});

describe('G3 · deslocamento de altura', () => {
  it('heightOffset 0,05: topo em 0,05, camadas contíguas e volume igual ao de topo 0', () => {
    const p = build([{ id: 's1', boundary: rect(0, 0, 4, 3), heightOffset: 0.05 }]);
    const [r] = resolveSlabs(p, 'lv_0');
    expect(r!.topZ).toBeCloseTo(0.05, 9);
    expect(r!.bottomZ).toBeCloseTo(0.05 - 0.17, 9);
    for (let i = 0; i + 1 < r!.layers.length; i++) expect(r!.layers[i]!.z0).toBeCloseTo(r!.layers[i + 1]!.z1, 12);
    expect(r!.layers.at(-1)!.z0).toBeCloseTo(r!.bottomZ, 12);
    expect(quantifySlabs(p, 'lv_0').totalVolume).toBeCloseTo(2.04, 9);
  });
});

describe('G3 · inclinação', () => {
  it('inclinação de 5 %: área real 12 / cos(atan(0,05)) ≈ 12,0150; área em planta e volume não mudam', () => {
    const flat = build([{ id: 's1', boundary: rect(0, 0, 4, 3) }]);
    const sloped = build([{ id: 's1', boundary: rect(0, 0, 4, 3), slope: { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 5 } }]);
    const q = quantifySlabs(sloped, 'lv_0').slabs[0]!;
    expect(q.faceArea).toBeCloseTo(12 / Math.cos(Math.atan(0.05)), 9);
    expect(q.faceArea).toBeCloseTo(12.015, 3);
    expect(q.planArea).toBeCloseTo(12, 9);
    expect(q.volume).toBeCloseTo(quantifySlabs(flat, 'lv_0').totalVolume, 9);
  });

  it('a cota sobe 0,05 por metro na direção da inclinação, e as camadas sobem juntas', () => {
    const p = build([{ id: 's1', boundary: rect(0, 0, 4, 3), slope: { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 5 } }]);
    const [r] = resolveSlabs(p, 'lv_0');
    expect(slabRiseAt(r!.slope, { x: 2, y: 0 })).toBeCloseTo(0.1, 9);
    // a espessura vertical continua a mesma em qualquer ponto: topo e base sobem o mesmo tanto
    const at = (q: Vec2) => slabRiseAt(r!.slope, q);
    expect(at({ x: 4, y: 3 }) - at({ x: 0, y: 0 })).toBeCloseTo(0.2, 9);
  });
});

describe('G3 · mover, girar e espelhar preservam área e volume, e a inclinação segue a laje', () => {
  const steps: Transform[] = [
    { kind: 'translate', d: { x: 10, y: -4 } },
    { kind: 'rotate', about: { x: 0, y: 0 }, angle: Math.PI / 3 },
    { kind: 'mirror', a: { x: 0, y: 0 }, b: { x: 1, y: 2 } },
  ];

  it('área, perímetro e volume iguais depois de cada passo e da sequência', () => {
    const base = build([{ id: 's1', boundary: L, holes: [rect(0.2, 0.2, 0.6, 0.6)], slope: { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 3 } }]);
    const before = quantifySlabs(base, 'lv_0').slabs[0]!;
    const store = new ProjectStore(base);
    for (const transform of steps) {
      store.exec({ type: 'transform', ids: ['s1'], transform });
      const after = quantifySlabs(store.project, 'lv_0').slabs[0]!;
      expect(after.planArea).toBeCloseTo(before.planArea, 9);
      expect(after.faceArea).toBeCloseTo(before.faceArea, 9);
      expect(after.perimeter).toBeCloseTo(before.perimeter, 9);
      expect(after.volume).toBeCloseTo(before.volume, 9);
    }
    expect(quantifySlabs(store.project, 'lv_0').slabs[0]!.planArea).toBeCloseTo(5.84, 9);
  });

  it('cada passo leva a cota do ponto junto: a altura de cada ponto relativa à laje não muda', () => {
    const slope = { origin: { x: 0.5, y: 0.5 }, dir: { x: Math.SQRT1_2, y: Math.SQRT1_2 }, percent: 4 };
    const pts: Vec2[] = [
      { x: 0.5, y: 0.5 },
      { x: 3, y: 1 },
      { x: 2, y: 2.5 },
    ];
    for (const transform of steps) {
      const store = new ProjectStore(build([{ id: 's1', boundary: rect(0, 0, 4, 3), slope }]));
      const old = (store.project.elements.s1 as Slab).slope!;
      store.exec({ type: 'transform', ids: ['s1'], transform });
      const now = (store.project.elements.s1 as Slab).slope!;
      for (const q of pts) {
        expect(slabRiseAt(now, applyTransform(transform, q))).toBeCloseTo(slabRiseAt(old, q), 9);
      }
      expect(Math.hypot(now.dir.x, now.dir.y)).toBeCloseTo(1, 9);
    }
  });

  it('espelhar inverte a direção correspondente: dir (1, 0) vira (-1, 0) no espelho do eixo y', () => {
    const store = new ProjectStore(build([{ id: 's1', boundary: rect(0, 0, 4, 3), slope: { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 5 } }]));
    store.exec({ type: 'transform', ids: ['s1'], transform: { kind: 'mirror', a: { x: 0, y: 0 }, b: { x: 0, y: 1 } } });
    const s = (store.project.elements.s1 as Slab).slope!;
    expect(s.dir.x).toBeCloseTo(-1, 9);
    expect(s.dir.y).toBeCloseTo(0, 9);
    expect(s.percent).toBe(5);
  });
});

describe('G5 · arquivo', () => {
  it('ida e volta em JSON preserva as lajes, a inclinação e os tipos', () => {
    const p = build([
      { id: 's1', boundary: L, holes: [rect(0.2, 0.2, 0.6, 0.6)], mark: 'LJ-01', heightOffset: 0.05, slope: { origin: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, percent: 2 } },
      { id: 's2', boundary: rect(5, 0, 7, 2), typeId: 'ls_cobertura' },
    ]);
    const back = migrateProject(JSON.parse(JSON.stringify(p)));
    expect(back.elements).toEqual(p.elements);
    expect(back.slabTypes).toEqual(p.slabTypes);
    expect(quantifySlabs(back, 'lv_0')).toEqual(quantifySlabs(p, 'lv_0'));
  });

  it('projeto v7 sem slabTypes ganha os tipos padrão', () => {
    const legacy = JSON.parse(JSON.stringify({ ...createEmptyProject(), schemaVersion: 7 })) as Record<string, unknown>;
    delete legacy.slabTypes;
    const m = migrateProject(legacy);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(Object.keys(m.slabTypes).sort()).toEqual(DEFAULT_SLAB_TYPES.map((t) => t.id).sort());
    expect(m.slabTypes.ls_cobertura!.layers).toHaveLength(3);
  });
});

describe('G3 · membrana de espessura zero', () => {
  it('ls_cobertura: a membrana não gera camada nem volume; ficam acabamento e concreto', () => {
    const p = build([{ id: 's1', boundary: rect(0, 0, 4, 3), typeId: 'ls_cobertura' }]);
    const [r] = resolveSlabs(p, 'lv_0');
    expect(r!.layers.map((l) => l.layerIndex)).toEqual([0, 2]);
    const q = quantifySlabs(p, 'lv_0');
    expect(q.layers.map((l) => l.thickness)).toEqual([0.03, 0.1].map((v) => expect.closeTo(v, 9)));
    expect(q.totalVolume).toBeCloseTo(12 * 0.13, 9);
    expect(q.slabs[0]!.thickness).toBeCloseTo(0.13, 9);
    expect(q.volumeByMaterial.mat_argamassa).toBeCloseTo(0.36, 9);
    expect(q.volumeByMaterial.mat_concreto).toBeCloseTo(1.2, 9);
  });
});
