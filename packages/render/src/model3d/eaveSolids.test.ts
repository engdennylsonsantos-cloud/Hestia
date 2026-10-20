import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import type { ResolvedRoof, ResolvedRoofLayer } from '@hestia/engine';
import { createEmptyProject, type RoofEave } from '@hestia/model';
import { buildEaveSolids } from './eaveSolids.ts';
import type { SolidBatch } from './solids.ts';

// rt_ceramica: 1,5 cm + 3 cm + 5 cm = 9,5 cm de espessura vertical
const LAYERS: ResolvedRoofLayer[] = [
  { layerIndex: 0, materialId: 'mat_telha_ceramica', thickness: 0.015, below: 0 },
  { layerIndex: 1, materialId: 'mat_madeira', thickness: 0.03, below: 0.015 },
  { layerIndex: 2, materialId: 'mat_madeira', thickness: 0.05, below: 0.045 },
];
const T = 0.095;
const EAVE = 2.8;
const P = (x: number, y: number): Vec2 => ({ x, y });

/**
 * Duas águas 8 × 6 a 30 %, cumeeira em y = 3, beiral em z = 2,80. As arestas longas (y = 0 e y = 6) são de beiral;
 * as pontas (x = 0 e x = 8) são empenas, sem acabamento de beiral.
 */
function roof(eave: Partial<RoofEave> = {}, extra: Partial<ResolvedRoof> = {}): ResolvedRoof {
  return {
    roofId: 'g',
    typeId: 'rt_ceramica',
    levelId: 'lv_0',
    eaveZ: EAVE,
    joinedArea: 0,
    layers: LAYERS,
    planes: [
      { polygon: [[[P(0, 0), P(8, 0), P(8, 3), P(0, 3)]]], origin: P(0, 0), up: P(0, 1), percent: 30, z0: EAVE },
      { polygon: [[[P(0, 3), P(8, 3), P(8, 6), P(0, 6)]]], origin: P(0, 6), up: P(0, -1), percent: 30, z0: EAVE },
    ],
    lines: [
      { kind: 'eave', a: P(0, 0), b: P(8, 0) },
      { kind: 'eave', a: P(0, 6), b: P(8, 6) },
      { kind: 'gable', a: P(8, 0), b: P(8, 6) },
      { kind: 'gable', a: P(0, 6), b: P(0, 0) },
    ],
    eave: { fascia: false, fasciaHeight: 0.2, gutter: false, soffit: false, ...eave },
    eaveOverhang: 0.3,
    ...extra,
  };
}

/** Comprimento total do beiral da casa de teste (duas arestas de 8 m). */
const L = 16;

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

const zsOf = (batches: SolidBatch[]): number[] => batches.flatMap((b) => b.positions.filter((_, i) => i % 3 === 2));

describe('acabamentos do beiral em 3D (C5)', () => {
  it('testeira: volume = comprimento do beiral × altura × espessura (a menos dos cantos, 4 × e² × h)', () => {
    const { batches } = buildEaveSolids(createEmptyProject(), [roof({ fascia: true, fasciaHeight: 0.2 })]);
    const h = 0.2;
    const e = 0.025;
    const v = volumeOf(batches);
    expect(v).toBeGreaterThan(0);
    expect(Math.abs(v - L * e * h)).toBeLessThanOrEqual(4 * e * e * h + 1e-9);
  });

  it('testeira: topo na face inferior da água (2,80 − 0,095 no beiral) e base a fasciaHeight abaixo', () => {
    const { batches } = buildEaveSolids(createEmptyProject(), [roof({ fascia: true, fasciaHeight: 0.2 })]);
    const zs = zsOf(batches);
    expect(Math.min(...zs)).toBeCloseTo(EAVE - T - 0.2, 6);
    // (a folga de 10 µm para dentro da aresta desloca a cota máxima em 3 µm)
    expect(Math.max(...zs)).toBeCloseTo(EAVE - T + 0.3 * 0.025, 4);
  });

  it('testeira: no material da camada estrutural (madeira) escurecido; sem testeira nada novo', () => {
    const p = createEmptyProject();
    const { batches, materials } = buildEaveSolids(p, [roof({ fascia: true })]);
    expect(batches.map((b) => b.materialId)).toEqual(['mat_madeira#testeira']);
    const m = materials['mat_madeira#testeira']!;
    expect(m.color).not.toBe(p.materials['mat_madeira']!.color);
    expect(m.id).toBe('mat_madeira#testeira');
    expect(buildEaveSolids(p, [roof({ fascia: false })])).toEqual({ batches: [], materials: {} });
    expect(buildEaveSolids(p, [roof({}, { eave: undefined })])).toEqual({ batches: [], materials: {} });
  });

  it('calha: U de 10 × 8 cm em alumínio, volume ≈ seção (24 cm²) × comprimento do beiral', () => {
    const { batches } = buildEaveSolids(createEmptyProject(), [roof({ gutter: true })]);
    expect(batches.map((b) => b.materialId)).toEqual(['mat_aluminio']);
    const section = 0.08 * 0.01 + 2 * 0.01 * 0.08;
    expect(Math.abs(volumeOf(batches) - section * L) / (section * L)).toBeLessThan(0.1);
    // a calha fica colada à testeira por fora: nada acima da face inferior da água
    expect(Math.max(...zsOf(batches))).toBeLessThanOrEqual(EAVE - T + 1e-9);
  });

  it('forro: placa de 1 cm com largura = balanço médio − espessura do telhado, na cota do beiral menos a espessura', () => {
    const { batches } = buildEaveSolids(createEmptyProject(), [roof({ soffit: true })]);
    expect(batches.map((b) => b.materialId)).toEqual(['mat_gesso']);
    const w = 0.3 - T;
    expect(Math.abs(volumeOf(batches) - 2 * 8 * w * 0.01) / (2 * 8 * w * 0.01)).toBeLessThan(0.1);
    expect(Math.max(...zsOf(batches))).toBeCloseTo(EAVE - T, 6);
    // balanço menor que a espessura: não há forro
    expect(buildEaveSolids(createEmptyProject(), [roof({ soffit: true }, { eaveOverhang: 0.05 })]).batches).toEqual([]);
  });
});
