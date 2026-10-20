import { describe, expect, it } from 'vitest';
import { resolveRoofs, type ResolvedRoof, type ResolvedRoofLayer } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeRoof } from '@hestia/model';
import { buildRoofSolids, type SolidBatch } from './solids.ts';

// rt_ceramica: 1,5 cm + 3 cm + 5 cm = 9,5 cm de espessura vertical
const LAYERS: ResolvedRoofLayer[] = [
  { layerIndex: 0, materialId: 'mat_telha_ceramica', thickness: 0.015, below: 0 },
  { layerIndex: 1, materialId: 'mat_madeira', thickness: 0.03, below: 0.015 },
  { layerIndex: 2, materialId: 'mat_madeira', thickness: 0.05, below: 0.045 },
];
const TOTAL = 0.095;
const G = 0.3;
const EAVE = 2.8;
const NZ = 1 / Math.sqrt(1 + G * G);

const P = (x: number, y: number) => ({ x, y });

/** Quatro águas sobre 8 × 6 (cumeeira de x = 3 a 5 em y = 3), 30 %, beiral em z = 2,80. */
function hip(): ResolvedRoof {
  return {
    roofId: 'h',
    typeId: 'rt_ceramica',
    levelId: 'lv_0',
    eaveZ: EAVE,
    layers: LAYERS,
    planes: [
      { polygon: [[[P(0, 0), P(8, 0), P(5, 3), P(3, 3)]]], origin: P(0, 0), up: P(0, 1), percent: 30, z0: EAVE },
      { polygon: [[[P(0, 6), P(8, 6), P(5, 3), P(3, 3)]]], origin: P(0, 6), up: P(0, -1), percent: 30, z0: EAVE },
      { polygon: [[[P(0, 0), P(0, 6), P(3, 3)]]], origin: P(0, 0), up: P(1, 0), percent: 30, z0: EAVE },
      { polygon: [[[P(8, 0), P(8, 6), P(5, 3)]]], origin: P(8, 0), up: P(-1, 0), percent: 30, z0: EAVE },
    ],
    lines: [],
  };
}

/** Duas águas 8 × 6, cumeeira em y = 3. */
function gable(): ResolvedRoof {
  return {
    roofId: 'g',
    typeId: 'rt_ceramica',
    levelId: 'lv_0',
    eaveZ: EAVE,
    layers: LAYERS,
    planes: [
      { polygon: [[[P(0, 0), P(8, 0), P(8, 3), P(0, 3)]]], origin: P(0, 0), up: P(0, 1), percent: 30, z0: EAVE },
      { polygon: [[[P(0, 3), P(8, 3), P(8, 6), P(0, 6)]]], origin: P(0, 6), up: P(0, -1), percent: 30, z0: EAVE },
    ],
    lines: [],
  };
}

/** Volume assinado da malha (soma dos tetraedros com a origem): positivo para sólido fechado com normais para fora. */
function volumeOf(batches: SolidBatch[]): number {
  let v = 0;
  for (const b of batches) {
    const pos = b.positions;
    for (let i = 0; i < b.indices.length; i += 3) {
      const [a, c, d] = [b.indices[i]!, b.indices[i + 1]!, b.indices[i + 2]!].map((k) => [pos[3 * k]!, pos[3 * k + 1]!, pos[3 * k + 2]!]) as [number[], number[], number[]];
      v += (a[0]! * (c[1]! * d[2]! - c[2]! * d[1]!) - a[1]! * (c[0]! * d[2]! - c[2]! * d[0]!) + a[2]! * (c[0]! * d[1]! - c[1]! * d[0]!)) / 6;
    }
  }
  return v;
}

const zRange = (batches: SolidBatch[]): [number, number] => {
  const zs = batches.flatMap((b) => b.positions.filter((_, i) => i % 3 === 2));
  return [Math.min(...zs), Math.max(...zs)];
};

describe('sólidos dos telhados (D2)', () => {
  it('telhado de quatro águas: volume = área em planta × espessura vertical total (1e-6 relativo)', () => {
    const batches = buildRoofSolids([hip()]);
    expect(Math.abs(volumeOf(batches) - 48 * TOTAL) / (48 * TOTAL)).toBeLessThan(1e-6);
  });

  it('cota máxima do mesh = beiral + altura da cumeeira (0,90 m); a mínima é a base da camada de baixo', () => {
    const [zMin, zMax] = zRange(buildRoofSolids([hip()]));
    expect(zMax).toBeCloseTo(EAVE + G * 3, 9);
    expect(zMin).toBeCloseTo(EAVE - TOTAL, 9);
  });

  it('normais do topo com nz > 0 (inclinação 30 %: nz = 1/√1,09); base com nz < 0; faces verticais na horizontal', () => {
    const batches = buildRoofSolids([hip()]);
    const nz = batches.flatMap((b) => b.normals.filter((_, i) => i % 3 === 2));
    const up = nz.filter((n) => n > 0.5);
    expect(up.length).toBeGreaterThan(0);
    for (const n of up) expect(n).toBeCloseTo(NZ, 9);
    expect(nz.filter((n) => n < -0.5).every((n) => Math.abs(n + NZ) < 1e-9)).toBe(true);
    expect(nz.filter((n) => Math.abs(n) <= 0.5).every((n) => Math.abs(n) < 1e-9)).toBe(true);
  });

  it('duas águas: o topo da água de baixo sobe de 2,80 no beiral (y = 0) a 3,70 na cumeeira (y = 3)', () => {
    const batches = buildRoofSolids([gable()]);
    expect(Math.abs(volumeOf(batches) - 48 * TOTAL) / (48 * TOTAL)).toBeLessThan(1e-6);
    const tops = batches.flatMap((b) => {
      const out: Array<[number, number, number]> = [];
      for (let i = 0; i < b.positions.length; i += 3) if (b.normals[i + 2]! > 0.5) out.push([b.positions[i]!, b.positions[i + 1]!, b.positions[i + 2]!]);
      return out;
    });
    const atY = (y: number) => tops.filter(([, py]) => Math.abs(py - y) < 1e-9).map(([, , z]) => z);
    // o topo da camada de cima é o maior z em cada linha (as de baixo, com normal para cima, ficam abaixo)
    expect(Math.max(...atY(0))).toBeCloseTo(EAVE, 9);
    expect(Math.max(...atY(3))).toBeCloseTo(EAVE + 0.9, 9);
  });

  it('camadas de um mesmo material vão para o mesmo lote, e materiais diferentes para lotes separados', () => {
    const batches = buildRoofSolids([hip()]);
    expect(batches.map((b) => b.materialId).sort()).toEqual(['mat_madeira', 'mat_telha_ceramica']);
  });

  it('sem águas, nada; camada de espessura zero não gera sólido', () => {
    expect(buildRoofSolids([])).toEqual([]);
    const r = gable();
    r.layers = [{ layerIndex: 0, materialId: 'mat_telha_ceramica', thickness: 0, below: 0 }];
    expect(buildRoofSolids([r])).toEqual([]);
  });

  it('integração: telhado de duas águas criado por addRoof e resolvido pelo motor tem o volume da planta × espessura', () => {
    const st = new ProjectStore(createEmptyProject());
    st.exec({
      type: 'addRoof',
      roof: makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: [P(0, 0), P(8, 0), P(8, 6), P(0, 6)], heightOffset: 2.8, shape: 'gable', slopePercent: 30, dir: P(1, 0) }),
    });
    const batches = buildRoofSolids(resolveRoofs(st.project, 'lv_0'));
    expect(Math.abs(volumeOf(batches) - 48 * TOTAL) / (48 * TOTAL)).toBeLessThan(1e-6);
  });
});
