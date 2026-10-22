import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, floorTypeThickness, makeFloor, makeSlab, makeWall, type FloorType, type Slab, type Wall } from '@hestia/model';
import { resolveFloors, resolveLevel, resolveSlabs } from '@hestia/engine';
import { buildFloorSolids, buildLevelSolids, buildSlabSolids, type SolidBatch } from './solids.ts';

const wall = (id: string, ax: number, ay: number, bx: number, by: number): Omit<Wall, 'order'> =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: ax, y: ay }, b: { x: bx, y: by } });

/** Volume por teorema da divergência sobre a malha: valida que a extrusão é fechada e bem orientada. */
function volume(b: { positions: number[]; indices: number[] }): number {
  let v = 0;
  for (let i = 0; i < b.indices.length; i += 3) {
    const [a, c, d] = [b.indices[i]!, b.indices[i + 1]!, b.indices[i + 2]!];
    const p = (k: number) => [b.positions[k * 3]!, b.positions[k * 3 + 1]!, b.positions[k * 3 + 2]!] as const;
    const [p0, p1, p2] = [p(a), p(c), p(d)];
    v += (p0[0] * (p1[1] * p2[2] - p1[2] * p2[1]) - p0[1] * (p1[0] * p2[2] - p1[2] * p2[0]) + p0[2] * (p1[0] * p2[1] - p1[1] * p2[0])) / 6;
  }
  return v;
}

describe('sólidos 3D', () => {
  it('volume do bloco bate com a área em planta × altura', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: wall('a', 0, 0, 4, 0) });
    s.exec({ type: 'addWall', wall: wall('b', 0, 0, 0, 3) });
    const r = resolveLevel(s.project, 'lv_0');
    const solids = buildLevelSolids(r);
    const bloco = solids.batches.find((b) => b.materialId === 'mat_bloco14')!;
    // Encosto pareado por face (docs/08 §5.4 passo 3): a dominante fica com o canto até a própria face do núcleo e a
    // segunda para nela — antes a dominante ia até a face externa (4,092) e a segunda subia até a linha de centro.
    const core = 0.14 * (4 + 0.07) + 0.14 * (3 - 0.07);
    expect(Math.abs(volume(bloco))).toBeCloseTo(core * 2.8, 5);
  });
  it('porta deixa uma verga acima do vão', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: wall('a', 0, 0, 4, 0) });
    s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'a', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    const solids = buildLevelSolids(resolveLevel(s.project, 'lv_0'));
    const bloco = solids.batches.find((b) => b.materialId === 'mat_bloco14')!;
    const full = 0.14 * 4 * 2.8;
    const hole = 0.14 * 0.8 * 2.1;
    expect(Math.abs(volume(bloco))).toBeCloseTo(full - hole, 5);
  });
});

describe('perfil superior no 3D', () => {
  it('a malha da empena é fechada: volume da malha = volume dos quantitativos, e a cumeeira está na altura do perfil', async () => {
    const { quantifyLevel } = await import('@hestia/engine');
    const s = new ProjectStore(createEmptyProject());
    const w = wall('g', 0, 0, 6, 0);
    s.exec({ type: 'addWall', wall: { ...w, topProfile: [{ t: 0, h: 2.8 }, { t: 3, h: 4.5 }, { t: 6, h: 2.8 }] } });
    const r = resolveLevel(s.project, 'lv_0');
    const solids = buildLevelSolids(r);
    const meshVol = solids.batches.reduce((sum, b) => sum + volume(b), 0);
    expect(meshVol).toBeCloseTo(quantifyLevel(s.project, r).walls[0]!.volume, 3);
    const maxZ = Math.max(...solids.batches.flatMap((b) => b.positions.filter((_, i) => i % 3 === 2)));
    expect(maxZ).toBeCloseTo(4.5, 6);
  });
});

describe('sólidos de piso (D2)', () => {
  const RECT = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
  const HOLE = [{ x: 2, y: 1.5 }, { x: 4, y: 1.5 }, { x: 4, y: 2.5 }, { x: 2, y: 2.5 }];
  const TRES: FloorType = {
    id: 'ft_tres',
    name: 'Três camadas',
    code: 'PS-T',
    description: 'teste',
    cost: 0,
    layers: [
      { function: 'finish1', materialId: 'mat_ceramica', thickness: 0.01, wraps: false },
      { function: 'substrate', materialId: 'mat_argamassa', thickness: 0.03, wraps: false },
      { function: 'structure', materialId: 'mat_concreto', thickness: 0.1, wraps: false },
    ],
  };

  it('volume do piso com furo = área líquida × espessura total', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RECT, holes: [HOLE] }) });
    const batches = buildFloorSolids(resolveFloors(s.project, 'lv_0'));
    const total = batches.reduce((sum, b) => sum + volume(b), 0);
    const net = 6 * 4 - 2 * 1;
    expect(total).toBeCloseTo(net * floorTypeThickness(s.project.floorTypes.ft_ceram!), 6);
  });

  it('três camadas contíguas: uma malha por material, cada uma entre a face de cima e a de baixo da camada', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'upsertFloorType', floorType: TRES });
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_tres', levelId: 'lv_0', boundary: RECT }) });
    const batches = buildFloorSolids(resolveFloors(s.project, 'lv_0'));
    expect(batches.map((b) => b.materialId)).toEqual(['mat_ceramica', 'mat_argamassa', 'mat_concreto']);
    const range = (b: { positions: number[] }) => {
      const zs = b.positions.filter((_, i) => i % 3 === 2);
      return [Math.min(...zs), Math.max(...zs)];
    };
    const [c, a, k] = batches.map(range) as [number[], number[], number[]];
    expect(c[1]).toBeCloseTo(0, 6);
    expect(c[0]).toBeCloseTo(-0.01, 6);
    expect(a[1]).toBeCloseTo(c[0]!, 6);
    expect(a[0]).toBeCloseTo(-0.04, 6);
    expect(k[1]).toBeCloseTo(a[0]!, 6);
    expect(k[0]).toBeCloseTo(-0.14, 6);
    const total = batches.reduce((sum, b) => sum + volume(b), 0);
    expect(total).toBeCloseTo(24 * 0.14, 6);
  });
});

describe('sólidos de laje (D2)', () => {
  const RECT = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
  const HOLE = [{ x: 2, y: 1.5 }, { x: 4, y: 1.5 }, { x: 4, y: 2.5 }, { x: 2, y: 2.5 }];
  /** Inclinação de 10% ao longo de x, origem em x = 0: topo 0 em x = 0 e 0,60 em x = 6. */
  const SLOPE = { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 10 };
  const THICK = 0.17; // ls_mac15

  function slabBatches(extra: Partial<Slab> = {}): SolidBatch[] {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 's', typeId: 'ls_mac15', levelId: 'lv_0', boundary: RECT, ...extra }) });
    return buildSlabSolids(resolveSlabs(s.project, 'lv_0'));
  }

  it('volume da laje inclinada 10% com furo = área líquida × espessura (a espessura vertical é constante)', () => {
    const batches = slabBatches({ holes: [HOLE], slope: SLOPE });
    const total = batches.reduce((sum, b) => sum + volume(b), 0);
    expect(total).toBeCloseTo((6 * 4 - 2 * 1) * THICK, 6);
  });

  it('laje horizontal: o mesmo volume e as cotas planas de -0,17 a 0', () => {
    const batches = slabBatches({ holes: [HOLE] });
    expect(batches.reduce((sum, b) => sum + volume(b), 0)).toBeCloseTo((6 * 4 - 2 * 1) * THICK, 6);
    const zs = batches.flatMap((b) => b.positions.filter((_, i) => i % 3 === 2));
    expect(Math.min(...zs)).toBeCloseTo(-THICK, 6);
    expect(Math.max(...zs)).toBeCloseTo(0, 6);
  });

  it('laje inclinada: topo sobe até 0,60 e a base vai de -0,17 a 0,43; nada fica fora da faixa', () => {
    const batches = slabBatches({ slope: SLOPE });
    const zs = batches.flatMap((b) => b.positions.filter((_, i) => i % 3 === 2));
    expect(Math.max(...zs)).toBeCloseTo(0.6, 6);
    expect(Math.min(...zs)).toBeCloseTo(-THICK, 6);
  });

  it('normais do topo coerentes: a componente z é positiva e o plano tem caimento de 10% em x', () => {
    const batches = slabBatches({ holes: [HOLE], slope: SLOPE });
    const top = batches.flatMap((b) => {
      const out: number[][] = [];
      for (let i = 0; i < b.normals.length; i += 3) {
        const n = [b.normals[i]!, b.normals[i + 1]!, b.normals[i + 2]!];
        if (n[2]! > 0) out.push(n);
      }
      return out;
    });
    expect(top.length).toBeGreaterThan(0);
    for (const [nx, ny, nz] of top) {
      expect(nz).toBeGreaterThan(0);
      expect(ny).toBeCloseTo(0, 9);
      expect(nx! / nz!).toBeCloseTo(-0.1, 9);
    }
  });

  it('sem inclinação, topo e base têm normal vertical (±z) e a malha segue planos horizontais', () => {
    const batches = slabBatches();
    for (const b of batches) {
      for (let i = 0; i < b.normals.length; i += 3) {
        if (Math.abs(b.normals[i + 2]!) < 0.5) continue; // faces laterais
        expect(Math.abs(b.normals[i]!)).toBeLessThan(1e-9);
        expect(Math.abs(b.normals[i + 1]!)).toBeLessThan(1e-9);
      }
    }
  });
});

describe('membrana sem sólido (decisão 0023 §5)', () => {
  it('ls_cobertura: a membrana não gera malha; o volume é só o das camadas com espessura (24 m² × 0,13 m)', () => {
    const boundary = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 's', typeId: 'ls_cobertura', levelId: 'lv_0', boundary }) });
    const batches = buildSlabSolids(resolveSlabs(s.project, 'lv_0'));
    expect(batches.reduce((sum, b) => sum + volume(b), 0)).toBeCloseTo(24 * 0.13, 6);
  });
});
