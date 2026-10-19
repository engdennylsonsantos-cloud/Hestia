import { describe, expect, it } from 'vitest';
import { multiArea, type Transform } from '@hestia/geom';
import { DEFAULT_FLOOR_TYPES, ProjectStore, createEmptyProject, makeFloor, migrateProject, type Floor, type Project } from '@hestia/model';
import { quantifyFloors, resolveFloors } from './index.ts';

/**
 * Casos dourados de piso (G3): valores derivados à mão. ft_ceram tem 1 + 2 + 4 + 12 cm, total de 19 cm.
 * Retângulo 4 x 3 m: área 12 m², volume 2,28 m³. Cada camada: 0,12 / 0,24 / 0,48 / 1,44 m³.
 */
const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const L = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 3 },
  { x: 0, y: 3 },
];
const T = 0.19;

function build(floors: Array<Partial<Floor> & Pick<Floor, 'id' | 'boundary'>>): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const f of floors) s.exec({ type: 'addFloor', floor: makeFloor({ typeId: 'ft_ceram', levelId: 'lv_0', ...f }) });
  return s.project;
}

const area = (p: Project, id: string): number => multiArea(resolveFloors(p, 'lv_0').find((r) => r.floorId === id)!.polygon);

describe('G3 · piso: área e volume', () => {
  it('retângulo 4 x 3 com ft_ceram: área 12 e volume por camada', () => {
    const p = build([{ id: 'f1', boundary: rect(0, 0, 4, 3) }]);
    expect(area(p, 'f1')).toBeCloseTo(12, 9);
    const q = quantifyFloors(p, 'lv_0');
    expect(q.floors[0]!.layers.map((l) => l.volume)).toEqual([0.12, 0.24, 0.48, 1.44].map((v) => expect.closeTo(v, 9)));
    expect(q.totalVolume).toBeCloseTo(2.28, 9);
  });

  it('retângulo 4 x 3: camadas de cima para baixo, de 0 a -0,19 m', () => {
    const [r] = resolveFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3) }]), 'lv_0');
    expect(r!.topZ).toBe(0);
    expect(r!.bottomZ).toBeCloseTo(-T, 9);
    expect(r!.layers.map((l) => [l.z0, l.z1].map((z) => Math.round(z * 1e6) / 1e6))).toEqual([
      [-0.01, 0],
      [-0.03, -0.01],
      [-0.07, -0.03],
      [-0.19, -0.07],
    ]);
  });

  it('piso em L: área 6', () => {
    expect(area(build([{ id: 'f1', boundary: L }]), 'f1')).toBeCloseTo(6, 9);
  });

  it('retângulo 4 x 3 com furo 1 x 1: área 11 e volumes proporcionais às camadas', () => {
    const p = build([{ id: 'f1', boundary: rect(0, 0, 4, 3), holes: [rect(1, 1, 2, 2)] }]);
    expect(area(p, 'f1')).toBeCloseTo(11, 9);
    const q = quantifyFloors(p, 'lv_0').floors[0]!;
    expect(q.volume).toBeCloseTo(11 * T, 9);
    expect(q.layers.map((l) => l.volume)).toEqual([0.11, 0.22, 0.44, 1.32].map((v) => expect.closeTo(v, 9)));
  });
});

describe('G3 · deslocamento de altura', () => {
  it('heightOffset 0,05: topo em 0,05 e camadas contíguas (z0 de uma = z1 da seguinte)', () => {
    const [r] = resolveFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3), heightOffset: 0.05 }]), 'lv_0');
    expect(r!.topZ).toBeCloseTo(0.05, 9);
    expect(r!.bottomZ).toBeCloseTo(0.05 - T, 9);
    for (let i = 0; i + 1 < r!.layers.length; i++) expect(r!.layers[i]!.z0).toBeCloseTo(r!.layers[i + 1]!.z1, 12);
    expect(r!.layers.at(-1)!.z0).toBeCloseTo(r!.bottomZ, 12);
  });
});

describe('G3 · transformações preservam área e volume', () => {
  it('mover, girar e espelhar pelo comando transform mantêm área e volume do L', () => {
    const base = build([{ id: 'f1', boundary: L, holes: [rect(0.2, 0.2, 0.6, 0.6)] }]);
    const before = quantifyFloors(base, 'lv_0');
    const steps: Transform[] = [
      { kind: 'translate', d: { x: 10, y: -4 } },
      { kind: 'rotate', about: { x: 0, y: 0 }, angle: Math.PI / 3 },
      { kind: 'mirror', a: { x: 0, y: 0 }, b: { x: 1, y: 2 } },
    ];
    const store = new ProjectStore(base);
    for (const transform of steps) store.exec({ type: 'transform', ids: ['f1'], transform });
    const after = quantifyFloors(store.project, 'lv_0');
    expect(after.floors[0]!.area).toBeCloseTo(before.floors[0]!.area, 9);
    expect(after.floors[0]!.perimeter).toBeCloseTo(before.floors[0]!.perimeter, 9);
    expect(after.totalVolume).toBeCloseTo(before.totalVolume, 9);
    expect(after.floors[0]!.area).toBeCloseTo(5.84, 9);
  });
});

describe('G5 · arquivo', () => {
  it('ida e volta em JSON preserva os pisos e os tipos', () => {
    const p = build([
      { id: 'f1', boundary: L, holes: [rect(0.2, 0.2, 0.6, 0.6)], mark: 'P-01', heightOffset: 0.05 },
      { id: 'f2', boundary: rect(5, 0, 7, 2), typeId: 'ft_madeira' },
    ]);
    const back = migrateProject(JSON.parse(JSON.stringify(p)));
    expect(back.elements).toEqual(p.elements);
    expect(back.floorTypes).toEqual(p.floorTypes);
    expect(quantifyFloors(back, 'lv_0')).toEqual(quantifyFloors(p, 'lv_0'));
  });

  it('projeto v6 sem floorTypes ganha os tipos padrão e as paredes ficam com anexos desligados', () => {
    const p = createEmptyProject();
    const legacy = JSON.parse(JSON.stringify({ ...p, schemaVersion: 6, elements: {} })) as Record<string, unknown>;
    delete legacy.floorTypes;
    const m = migrateProject(legacy);
    expect(m.schemaVersion).toBe(8);
    expect(Object.keys(m.floorTypes).sort()).toEqual(DEFAULT_FLOOR_TYPES.map((t) => t.id).sort());
    expect(m.floorTypes.ft_ceram!.layers).toHaveLength(4);
  });

  it('projeto v6 com parede: a migração acrescenta os anexos desligados', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: { id: 'w1', kind: 'wall', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, baseOffset: 0, topLevelId: null, height: 2.8, topOffset: 0, locationLine: 'wallCenter', flipped: false, noJoinStart: false, noJoinEnd: false, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false }, sag: 0, topProfile: null, mark: '', comments: '' } });
    const legacy = JSON.parse(JSON.stringify({ ...s.project, schemaVersion: 6 })) as { elements: Record<string, Record<string, unknown>> };
    for (const e of Object.values(legacy.elements)) {
      delete e.attachBottomToFloor;
      delete e.attachTopToFloor;
    }
    const m = migrateProject(legacy);
    expect(m.elements.w1).toMatchObject({ attachBottomToFloor: false, attachTopToFloor: false });
  });
});
