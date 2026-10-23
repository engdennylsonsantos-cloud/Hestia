import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeLevel, makeSlab, makeWall, type Floor, type Layer, type Project, type Slab, type WallType } from '@hestia/model';
import { quantifyLevel, quantifySlabs, resolveLevel } from './index.ts';
import { junctionLevel, layerPartsOf, wallBandPartsOf } from './junctionLevel.ts';
import { adjacentLevelIds } from './junctionNet.ts';

type Pt = { x: number; y: number };
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

interface Opts {
  /** Parede do térreo: eixo de x0 a x0 + len, espessura 0,23 m, 2,80 m de altura (z de 0 a 2,80). `false` não cria. */
  wall?: { x0?: number; len?: number } | false;
  /** Laje do pavimento 2 (lv_1, cota 3 m; topo = 3 m + offset, espessura 0,20 m). `false` não cria. */
  slab?: Partial<Slab> | false;
  /** Laje do térreo (lv_0), para a parede do pavimento 2 apoiada nela. */
  lowerSlab?: Partial<Slab>;
  /** Parede do pavimento 2 (z de 3 a 5,80 m). */
  upperWall?: boolean;
  /** Piso do térreo (lv_0), para testar que piso × laje entre níveis não se cortam. */
  floor?: Partial<Floor>;
  /** Nível acima do pavimento 2 (6 m), para testar que só o adjacente conta. */
  extraLevel?: boolean;
}

/** Térreo (lv_0, 0 m) e pavimento 2 (lv_1, 3 m); parede de 0,23 m e lajes/pisos de 0,20 m. */
function build(o: Opts = {}): Project {
  const base = createEmptyProject();
  const one: Layer[] = [{ function: 'structure', materialId: 'mat_bloco14', thickness: 0.2 } as Layer];
  base.slabTypes.ls_t = { ...base.slabTypes.ls_mac12!, id: 'ls_t', name: 'Teste laje', code: 'LT', layers: one };
  base.floorTypes.ft_t = { ...base.floorTypes.ft_ceram!, id: 'ft_t', name: 'Teste piso', code: 'PT', layers: one };
  const wt: WallType = { ...base.wallTypes.wt_alv14!, id: 'wt_t', name: 'Teste', code: 'T', layers: [{ function: 'structure', materialId: 'mat_bloco14', thickness: 0.23, wraps: false }] };
  base.wallTypes.wt_t = wt;
  if (o.extraLevel) base.levels.push(makeLevel({ id: 'lv_2', name: 'Cobertura', elevation: 6 }));
  const s = new ProjectStore(base);
  if (o.wall !== false) {
    const x0 = o.wall?.x0 ?? 0;
    const len = o.wall?.len ?? 1;
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_t', levelId: 'lv_0', a: { x: x0, y: 0 }, b: { x: x0 + len, y: 0 }, height: 2.8 }) });
  }
  if (o.upperWall) s.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_t', levelId: 'lv_1', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, height: 2.8 }) });
  if (o.slab !== false) {
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_t', levelId: 'lv_1', boundary: rect(-1, -1, 2, 1), heightOffset: -0.1, ...o.slab }) });
  }
  if (o.lowerSlab) s.exec({ type: 'addSlab', slab: makeSlab({ id: 's0', typeId: 'ls_t', levelId: 'lv_0', boundary: rect(-1, -1, 2, 1), ...o.lowerSlab }) });
  if (o.floor) s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f0', typeId: 'ft_t', levelId: 'lv_0', boundary: rect(0, 0, 6, 4), ...o.floor }) });
  return s.project;
}

/** Volume bruto e líquido (m³) de uma parede, pela tabela de quantitativos do nível. */
const wallVol = (p: Project, levelId: string, id: string) => {
  const w = quantifyLevel(p, resolveLevel(p, levelId)).walls.find((x) => x.wallId === id)!;
  return { net: w.volume, gross: w.grossVolume };
};
const slabVolume = (p: Project) => quantifySlabs(p, 'lv_1').slabs[0]!.volume;
const volumeOf = (parts: ReturnType<typeof layerPartsOf>) => parts.reduce((s, x) => s + multiArea(x.poly) * (x.z1 - x.z0), 0);

describe('junção entre níveis (decisão 0023 §10, P7c)', () => {
  it('adjacentLevelIds: só o nível imediatamente acima e o imediatamente abaixo', () => {
    const p = build({ extraLevel: true });
    expect(adjacentLevelIds(p, 'lv_0')).toEqual(['lv_1']);
    expect(adjacentLevelIds(p, 'lv_1')).toEqual(['lv_2', 'lv_0']);
    expect(adjacentLevelIds(p, 'nao_existe')).toEqual([]);
  });

  it('laje do pavimento 2 atravessa a parede do térreo 0,10 m: a parede perde 0,23 × 1,00 × 0,10 m³ uma vez; a laje fica inteira', () => {
    // Topo da laje em 2,90 m, base em 2,70 m; a parede vai até 2,80 m. Mesma prioridade: a laje (tipo de maior hierarquia) vence.
    const p = build({});
    const w = wallVol(p, 'lv_0', 'w1');
    expect(w.gross).toBeCloseTo(0.644, 9);
    expect(w.net).toBeCloseTo(0.644 - 0.023, 9);
    expect(slabVolume(p)).toBeCloseTo(1.2, 9);
    const jl = junctionLevel(p, 'lv_0');
    const j = jl.walls.get('w1')!;
    expect(j.cut).toBe(true);
    const rw = resolveLevel(p, 'lv_0').walls.w1!;
    const layer0 = rw.layers[0]!.bands.flatMap((b, i) => wallBandPartsOf(jl, 'w1', 0, i, [{ poly: b.poly, z0: rw.baseZ + b.z0, z1: rw.baseZ + b.z1 }]));
    expect(volumeOf(layer0)).toBeCloseTo(0.621, 9);
    expect(junctionLevel(p, 'lv_1').elements.get('s1')?.cut ?? false).toBe(false);
    // Soma sem dobro: o total é o bruto menos a interseção, uma vez.
    expect(w.net + slabVolume(p)).toBeCloseTo(w.gross + 1.2 - 0.023, 9);
  });

  it('sem interseção (a laje encosta na cota 2,80 m): nada muda e a parede segue inteira', () => {
    const p = build({ slab: { heightOffset: 0 } });
    expect(wallVol(p, 'lv_0', 'w1').net).toBeCloseTo(0.644, 9);
    expect(junctionLevel(p, 'lv_0').elements.get('w1')?.cut ?? false).toBe(false);
  });

  it('parede do pavimento 2 com base sobre a laje do térreo: perde os 0,10 m que entram na laje; a laje do térreo fica', () => {
    // Laje do térreo com topo em 3,10 m (faixa de 2,90 a 3,10); a parede do pav. 2 começa em 3,00 m.
    const p = build({ wall: false, upperWall: true, slab: false, lowerSlab: { heightOffset: 3.1 } });
    expect(wallVol(p, 'lv_1', 'w2').net).toBeCloseTo(0.644 - 0.023, 9);
    expect(junctionLevel(p, 'lv_0').elements.get('s0')?.cut ?? false).toBe(false);
  });

  it('piso do térreo e laje do pavimento 2 que se cruzam na cota não se cortam (a junção entre níveis é só de parede)', () => {
    const p = build({ wall: false, floor: { heightOffset: 2.85 } });
    expect(junctionLevel(p, 'lv_1').elements.get('s1')?.cut ?? false).toBe(false);
    expect(junctionLevel(p, 'lv_0').elements.get('f0')?.cut ?? false).toBe(false);
  });

  it('cache por nível: mudar só a laje do pavimento 2 recalcula o térreo (a assinatura inclui o vizinho que cruza)', () => {
    expect(junctionLevel(build({}), 'lv_0').walls.get('w1')?.cut).toBe(true);
    expect(junctionLevel(build({ slab: { heightOffset: 0 } }), 'lv_0').walls.get('w1')?.cut ?? false).toBe(false);
  });
});

/** Gerador determinístico (mulberry32): cada semente dá sempre o mesmo caso. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('propriedade entre níveis: soma líquida sem dobro (10 sementes)', () => {
  for (let seed = 1; seed <= 10; seed++) {
    it(`semente ${seed}: parede do térreo × laje do pavimento 2 são descontadas uma só vez, e sem interseção o líquido é o bruto`, () => {
      const r = rng(seed);
      const x0 = -0.3 + r() * 0.6;
      const len = 0.6 + r() * 1.6;
      const sx0 = x0 - 0.6 + r() * (len + 0.6);
      const sx1 = sx0 + 0.2 + r() * 2.5;
      const off = -0.35 + r() * 0.5;
      const p = build({ wall: { x0, len }, slab: { heightOffset: off, boundary: rect(sx0, -1, sx1, 1) } });
      // Laje de 0,20 m com topo em 3 m + off: a faixa de cota é [2,8 + off, 3 + off] ∩ [0, 2,80] na parede.
      const zOv = Math.max(0, Math.min(2.8, 3 + off) - Math.max(0, 2.8 + off));
      const ox = Math.max(0, Math.min(x0 + len, sx1) - Math.max(x0, sx0));
      const loss = ox * 0.23 * zOv;
      const w = wallVol(p, 'lv_0', 'w1');
      // A laje ganha da parede (tipo de maior hierarquia): fica inteira, (sx1 - sx0) × 2 m × 0,20 m.
      const slabGross = (sx1 - sx0) * 2 * 0.2;
      expect(w.net).toBeLessThanOrEqual(w.gross + 1e-12);
      expect(w.net).toBeCloseTo(w.gross - loss, 7);
      expect(slabVolume(p)).toBeCloseTo(slabGross, 7);
      expect(w.net + slabVolume(p)).toBeCloseTo(w.gross + slabGross - loss, 7);
      if (zOv <= 0) expect(w.net).toBeCloseTo(w.gross, 7);
    });
  }
});
