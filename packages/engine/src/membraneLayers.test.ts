import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, type Project } from '@hestia/model';
import { computeSection, quantifySlabs, resolveFloors, resolveSlabs } from './index.ts';

const RECT: Vec2[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
const LINE = { a: { x: -1, y: 2 }, b: { x: 7, y: 2 }, depth: 2 };

/** Projeto com um piso de tipo com membrana no meio (tinta de 0 m entre o acabamento e o concreto). */
function floorProject(): Project {
  const s = new ProjectStore(createEmptyProject());
  s.project.floorTypes.ft_zero = {
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
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_zero', levelId: 'lv_0', boundary: RECT }) });
  return s.project;
}

function slabProject(typeId: string, slope?: { origin: Vec2; dir: Vec2; percent: number }): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId, levelId: 'lv_0', boundary: RECT, ...(slope ? { slope } : {}) }) });
  return s.project;
}

describe('membrana de piso e laje: resolvedor (decisão 0023 §5)', () => {
  it('piso: a camada de espessura zero fica na lista, marcada como membrana, com z0 = z1 e sem volume', () => {
    const [f] = resolveFloors(floorProject(), 'lv_0');
    expect(f!.layers.map((l) => l.membrane)).toEqual([true, false]);
    const m = f!.layers[0]!;
    expect(m.z0).toBeCloseTo(m.z1, 12);
    expect(m.z1).toBeCloseTo(0, 12);
    expect(f!.bottomZ).toBeCloseTo(-0.1, 12);
  });

  it('ls_cobertura: três camadas resolvidas, a do meio é a membrana com z0 = z1', () => {
    const [r] = resolveSlabs(slabProject('ls_cobertura'), 'lv_0');
    expect(r!.layers.map((l) => l.layerIndex)).toEqual([0, 1, 2]);
    expect(r!.layers.map((l) => l.membrane)).toEqual([false, true, false]);
    expect(r!.layers[1]!.z0).toBeCloseTo(r!.layers[1]!.z1, 12);
  });
});

describe('membrana de piso e laje: quantitativos', () => {
  it('ls_cobertura: a membrana tem área de face igual à do contorno (24 m² no retângulo 6 x 4) e volume 0', () => {
    const q = quantifySlabs(slabProject('ls_cobertura'), 'lv_0');
    const membrane = q.layers.find((l) => l.membrane)!;
    expect(membrane.faceArea).toBeCloseTo(24, 9);
    expect(membrane.volume).toBe(0);
    expect(q.slabs[0]!.volume).toBeCloseTo(24 * 0.13, 9);
    // Acabamento (argamassa) e membrana, ambos de 24 m², somam na área de face do material.
    expect(q.faceAreaByMaterial.mat_argamassa).toBeCloseTo(48, 9);
  });

  it('laje inclinada: a área de face da membrana segue a inclinação, como a das outras camadas', () => {
    const q = quantifySlabs(slabProject('ls_cobertura', { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 10 }), 'lv_0');
    const membrane = q.layers.find((l) => l.membrane)!;
    const concrete = q.layers.find((l) => !l.membrane && l.layerIndex === 2)!;
    expect(membrane.faceArea).toBeCloseTo(concrete.faceArea, 9);
    expect(membrane.faceArea).toBeGreaterThan(membrane.planArea);
  });
});

describe('membrana de piso e laje: corte', () => {
  it('piso: uma linha na cota da face da membrana, no intervalo do piso cortado', () => {
    const r = computeSection(floorProject(), LINE);
    expect(r.membranes).toHaveLength(1);
    const m = r.membranes[0]!;
    expect(m).toMatchObject({ floorId: 'f1', materialId: 'mat_tinta' });
    expect(m.pts[0]!.x).toBeCloseTo(1, 9);
    expect(m.pts[1]!.x).toBeCloseTo(7, 9);
    expect(m.pts[0]!.y).toBeCloseTo(0, 9);
    expect(m.pts[1]!.y).toBeCloseTo(0, 9);
  });

  it('laje inclinada 10%: a linha da membrana acompanha o caimento (0 em x = 0, 0,6 em x = 6)', () => {
    const r = computeSection(slabProject('ls_cobertura', { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 10 }), LINE);
    expect(r.membranes).toHaveLength(1);
    const [a, b] = r.membranes[0]!.pts;
    expect(r.membranes[0]!.slabId).toBe('s1');
    expect(a.y).toBeCloseTo(-0.03, 9);
    expect(b.y).toBeCloseTo(0.57, 9);
  });

  it('laje sem membrana: nenhuma linha no corte', () => {
    expect(computeSection(slabProject('ls_mac15'), LINE).membranes).toHaveLength(0);
  });
});
