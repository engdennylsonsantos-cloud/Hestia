import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, type Floor, type Project } from '@hestia/model';
import { quantifyFloors } from './index.ts';

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

/** Projeto com os pisos adicionados pelo comando addFloor (como na aplicação). */
function build(floors: Array<Partial<Floor> & Pick<Floor, 'id' | 'boundary'>>, extra?: (p: Project) => void): Project {
  const base = createEmptyProject();
  extra?.(base);
  const s = new ProjectStore(base);
  for (const f of floors) s.exec({ type: 'addFloor', floor: makeFloor({ typeId: 'ft_ceram', levelId: 'lv_0', ...f }) });
  return s.project;
}

const T = 0.19; // espessura do ft_ceram: 0,01 + 0,02 + 0,04 + 0,12

describe('quantitativo de pisos', () => {
  it('retângulo 4 x 3 com ft_ceram: área 12, perímetro 14, espessura 0,19 e volume 2,28', () => {
    const q = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3) }]), 'lv_0');
    expect(q.floors).toHaveLength(1);
    const f = q.floors[0]!;
    expect(f.area).toBeCloseTo(12, 9);
    expect(f.perimeter).toBeCloseTo(14, 9);
    expect(f.holesPerimeter).toBe(0);
    expect(f.thickness).toBeCloseTo(T, 9);
    expect(f.volume).toBeCloseTo(12 * T, 9);
  });

  it('volume por camada = área × espessura, e a soma das camadas é o volume do piso', () => {
    const f = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3) }]), 'lv_0').floors[0]!;
    expect(f.layers.map((l) => l.thickness)).toEqual([0.01, 0.02, 0.04, 0.12].map((x) => expect.closeTo(x, 9)));
    for (const l of f.layers) expect(l.volume).toBeCloseTo(12 * l.thickness, 9);
    expect(f.layers.reduce((s, l) => s + l.volume, 0)).toBeCloseTo(f.volume, 9);
  });

  it('agregado por material: volume em m³ e área de face superior em m²', () => {
    const q = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3) }]), 'lv_0');
    // Argamassa tem duas camadas (2 cm e 4 cm), cada uma com face de 12 m².
    expect(q.volumeByMaterial.mat_argamassa).toBeCloseTo(12 * 0.06, 9);
    expect(q.faceAreaByMaterial.mat_argamassa).toBeCloseTo(24, 9);
    expect(q.volumeByMaterial.mat_concreto).toBeCloseTo(12 * 0.12, 9);
    expect(q.faceAreaByMaterial.mat_concreto).toBeCloseTo(12, 9);
    expect(q.volumeByMaterial.mat_ceramica).toBeCloseTo(12 * 0.01, 9);
    const sum = Object.values(q.volumeByMaterial).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(q.totalVolume, 9);
  });

  it('piso em L: área 6 e perímetro 14', () => {
    const f = quantifyFloors(build([{ id: 'f1', boundary: L }]), 'lv_0').floors[0]!;
    expect(f.area).toBeCloseTo(6, 9);
    expect(f.perimeter).toBeCloseTo(14, 9);
  });

  it('furo 1 x 1 em retângulo 4 x 3: área 11, perímetro do furo 4 e volumes proporcionais', () => {
    const q = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3), holes: [rect(1, 1, 2, 2)] }]), 'lv_0');
    const f = q.floors[0]!;
    expect(f.area).toBeCloseTo(11, 9);
    expect(f.perimeter).toBeCloseTo(14, 9);
    expect(f.holesPerimeter).toBeCloseTo(4, 9);
    expect(f.volume).toBeCloseTo(11 * T, 9);
    for (const l of f.layers) expect(l.volume).toBeCloseTo(11 * l.thickness, 9);
  });

  it('o furo não muda a espessura nem o deslocamento do piso', () => {
    const f = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3), holes: [rect(1, 1, 2, 2)], heightOffset: 0.05 }]), 'lv_0').floors[0]!;
    expect(f.thickness).toBeCloseTo(T, 9);
  });

  it('camadas de espessura zero não entram nos volumes nem nas listas', () => {
    const q = quantifyFloors(
      build([{ id: 'f1', boundary: rect(0, 0, 4, 3), typeId: 'ft_zero' }], (p) => {
        p.floorTypes.ft_zero = {
          id: 'ft_zero',
          name: 'Teste',
          code: 'T-0',
          description: '',
          cost: 0,
          layers: [
            { function: 'membrane', materialId: 'mat_tinta', thickness: 0, wraps: false },
            { function: 'structure', materialId: 'mat_concreto', thickness: 0.1, wraps: false },
          ],
        };
      }),
      'lv_0',
    );
    expect(q.layers).toHaveLength(1);
    expect(q.floors[0]!.volume).toBeCloseTo(1.2, 9);
    expect(q.volumeByMaterial.mat_tinta).toBeUndefined();
  });

  it('nível com dois pisos: totais são a soma dos pisos', () => {
    const q = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3) }, { id: 'f2', boundary: rect(5, 0, 6, 2) }]), 'lv_0');
    expect(q.floors).toHaveLength(2);
    expect(q.totalArea).toBeCloseTo(14, 9);
    expect(q.totalVolume).toBeCloseTo(14 * T, 9);
  });

  it('pisos de outro nível não entram', () => {
    const q = quantifyFloors(build([{ id: 'f1', boundary: rect(0, 0, 4, 3), levelId: 'lv_1' }]), 'lv_0');
    expect(q.floors).toEqual([]);
    expect(q.totalArea).toBe(0);
    expect(q.totalVolume).toBe(0);
  });
});
