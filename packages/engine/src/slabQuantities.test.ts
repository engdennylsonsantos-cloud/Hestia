import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeSlab, type Project, type Slab } from '@hestia/model';
import { quantifySlabs } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function build(slabs: Array<Partial<Slab> & Pick<Slab, 'id' | 'boundary'>>): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const x of slabs) s.exec({ type: 'addSlab', slab: makeSlab({ typeId: 'ls_mac15', levelId: 'lv_0', ...x }) });
  return s.project;
}

describe('E1 · quantitativos de laje', () => {
  it('sem inclinação, área real igual à de planta e volume = área × espessura', () => {
    const q = quantifySlabs(build([{ id: 's1', boundary: rect(0, 0, 4, 3) }]), 'lv_0').slabs[0]!;
    expect(q.planArea).toBeCloseTo(12, 9);
    expect(q.faceArea).toBeCloseTo(12, 9);
    expect(q.thickness).toBeCloseTo(0.17, 9);
    expect(q.volume).toBeCloseTo(12 * 0.17, 9);
    expect(q.slopePercent).toBe(0);
    expect(q.perimeter).toBeCloseTo(14, 9);
  });

  it('com inclinação, só a área real muda: área / cos(atan(p/100))', () => {
    const flat = quantifySlabs(build([{ id: 's1', boundary: rect(0, 0, 4, 3) }]), 'lv_0').slabs[0]!;
    const sloped = quantifySlabs(
      build([{ id: 's1', boundary: rect(0, 0, 4, 3), slope: { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 5 } }]),
      'lv_0',
    ).slabs[0]!;
    expect(sloped.faceArea).toBeCloseTo(12 / Math.cos(Math.atan(0.05)), 9);
    expect(sloped.faceArea).toBeCloseTo(12.015, 3);
    expect(sloped.planArea).toBe(flat.planArea);
    expect(sloped.volume).toBe(flat.volume);
    expect(sloped.perimeter).toBe(flat.perimeter);
    expect(sloped.slopePercent).toBe(5);
  });

  it('a inclinação não depende da direção: mesma área real para qualquer dir unitária', () => {
    const areaAt = (dir: { x: number; y: number }) =>
      quantifySlabs(build([{ id: 's1', boundary: rect(0, 0, 4, 3), slope: { origin: { x: 0, y: 0 }, dir, percent: 20 } }]), 'lv_0').slabs[0]!.faceArea;
    const a = areaAt({ x: 1, y: 0 });
    expect(areaAt({ x: 0, y: 1 })).toBeCloseTo(a, 9);
    expect(areaAt({ x: -Math.SQRT1_2, y: Math.SQRT1_2 })).toBeCloseTo(a, 9);
  });

  it('volume por camada e por material; a área real das camadas vai por material', () => {
    const q = quantifySlabs(build([{ id: 's1', boundary: rect(0, 0, 4, 3) }]), 'lv_0');
    expect(q.layers.map((l) => [l.materialId, l.thickness])).toEqual([
      ['mat_argamassa', 0.02],
      ['mat_concreto', 0.15],
    ]);
    expect(q.layers[0]!.volume).toBeCloseTo(0.24, 9);
    expect(q.layers[1]!.volume).toBeCloseTo(1.8, 9);
    expect(q.volumeByMaterial.mat_argamassa).toBeCloseTo(0.24, 9);
    expect(q.volumeByMaterial.mat_concreto).toBeCloseTo(1.8, 9);
    expect(q.totalVolume).toBeCloseTo(2.04, 9);
  });

  it('totais do nível somam as lajes; a área real total acompanha a inclinação', () => {
    const q = quantifySlabs(
      build([
        { id: 's1', boundary: rect(0, 0, 4, 3) },
        { id: 's2', boundary: rect(10, 0, 12, 2), slope: { origin: { x: 10, y: 0 }, dir: { x: 0, y: 1 }, percent: 10 } },
      ]),
      'lv_0',
    );
    expect(q.totalPlanArea).toBeCloseTo(12 + 4, 9);
    expect(q.totalFaceArea).toBeCloseTo(12 + 4 * Math.sqrt(1.01), 9);
    expect(q.totalVolume).toBeCloseTo((12 + 4) * 0.17, 9);
    expect(q.faceAreaByMaterial.mat_concreto).toBeCloseTo(q.totalFaceArea, 9);
  });

  it('furo sai da área em planta e entra no perímetro dos furos', () => {
    const q = quantifySlabs(build([{ id: 's1', boundary: rect(0, 0, 4, 3), holes: [rect(1, 1, 2, 2)] }]), 'lv_0').slabs[0]!;
    expect(q.planArea).toBeCloseTo(11, 9);
    expect(q.holesPerimeter).toBeCloseTo(4, 9);
    expect(q.perimeter).toBeCloseTo(14, 9);
  });

  it('nível sem lajes devolve tudo zerado', () => {
    const q = quantifySlabs(build([{ id: 's1', boundary: rect(0, 0, 4, 3) }]), 'lv_1');
    expect(q).toMatchObject({ slabs: [], layers: [], totalPlanArea: 0, totalFaceArea: 0, totalVolume: 0 });
  });
});
