import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, type Floor, type Project, type Slab, type Wall, type WallType } from '@hestia/model';
import { buildFloorSchedule, buildWallSchedule, floorScheduleToCsv, quantifyFloors, quantifyLevel, quantifySlabs, resolveLevel, scheduleToCsv } from './index.ts';

type Pt = { x: number; y: number };
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Projeto no térreo com um tipo de parede de espessura `t` (uma camada estrutural) e os elementos dados. */
function build(t: number, els: { walls?: Array<Partial<Wall>>; floors?: Array<Partial<Floor>>; slabs?: Array<Partial<Slab>> }): Project {
  const base = createEmptyProject();
  const wt: WallType = { ...base.wallTypes.wt_alv14!, id: 'wt_t', name: 'Teste', code: 'T', layers: [{ function: 'structure', materialId: 'mat_bloco14', thickness: t, wraps: false }] };
  base.wallTypes.wt_t = wt;
  const s = new ProjectStore(base);
  for (const w of els.walls ?? []) s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_t', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, height: 2.8, ...w }) });
  for (const f of els.floors ?? []) s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(-1, -1, 2, 1), ...f }) });
  for (const x of els.slabs ?? []) s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(-1, -1, 2, 1), ...x }) });
  return s.project;
}

const wallsOf = (p: Project) => quantifyLevel(p, resolveLevel(p, 'lv_0')).walls;
const floorOf = (p: Project) => quantifyFloors(p, 'lv_0').floors[0]!;
const slabOf = (p: Project) => quantifySlabs(p, 'lv_0').slabs[0]!;

describe('quantitativos líquidos (decisão 0023 §4)', () => {
  it('parede embutida em piso: a interseção (0,0368 m³) sai uma vez, dividida pela prioridade de camada (0023 §1, P7)', () => {
    // Parede 0,23 m × 1,00 m × 2,80 m; o piso de 0,16 m de topo cobre a base dela até essa cota.
    // Estrutura do piso (1) e núcleo da parede (1): empate, o piso corta a parede (0,23 × 0,09 = 0,0207 m³ saem da parede).
    // Substrato (2) e acabamento (4) do piso são cortados pelo núcleo da parede (1): 0,23 × 0,07 = 0,0161 m³ saem do piso.
    const p = build(0.23, { walls: [{}], floors: [{ heightOffset: 0.16 }] });
    const w = wallsOf(p)[0]!;
    expect(w.grossVolume).toBeCloseTo(0.644, 9);
    expect(w.volume).toBeCloseTo(0.644 - 0.23 * 0.09, 9);
    expect(floorOf(p).volume).toBeCloseTo(6 * 0.19 - 0.23 * 0.07, 9);
    expect(floorOf(p).grossVolume).toBeCloseTo(6 * 0.19, 9);
    // O total é a soma sem dobro: o volume de interseção sai uma vez só.
    expect(w.volume + floorOf(p).volume).toBeCloseTo(0.644 + 6 * 0.19 - 0.0368, 9);
  });

  it('trocar o nome e o material das camadas não muda o líquido (a regra usa atributo de camada, P-6)', () => {
    const p = build(0.23, { walls: [{}], floors: [{ heightOffset: 0.16 }], slabs: [{ heightOffset: 0.5 }] });
    const q = structuredClone(p);
    for (const t of [...Object.values(q.wallTypes), ...Object.values(q.floorTypes), ...Object.values(q.slabTypes)]) {
      for (const l of t.layers) l.materialId = `zz_${l.materialId}`;
    }
    expect(wallsOf(q)[0]!.volume).toBeCloseTo(wallsOf(p)[0]!.volume, 12);
    expect(floorOf(q).volume).toBeCloseTo(floorOf(p).volume, 12);
    expect(slabOf(q).volume).toBeCloseTo(slabOf(p).volume, 12);
  });

  it('laje atravessando parede: os 12 cm de laje na parede saem da parede, uma vez; a laje fica inteira', () => {
    // Laje de 12 cm com topo em 1,00 m: corta a parede entre 0,88 e 1,00 m, na área de 0,23 m² (1,00 × 0,23).
    const p = build(0.23, { walls: [{}], slabs: [{ heightOffset: 1 }] });
    const w = wallsOf(p)[0]!;
    expect(w.volume).toBeCloseTo(0.644 - 0.23 * 0.12, 9);
    expect(slabOf(p).volume).toBeCloseTo(6 * 0.12, 9);
    expect(w.volume + slabOf(p).volume).toBeCloseTo(0.644 + 6 * 0.12 - 0.0276, 9);
  });

  it('piso por perímetro externo: a faixa de 1,3215 m² sob a parede é dividida pela prioridade (estrutura do piso sai da parede; o resto, do piso)', () => {
    // Parede de 8,81 m × 0,15 m, de 2,80 m; o piso (topo em 0,12) tem a faixa sob ela. Só a estrutura (cota de 0 a 0,05)
    // é do piso por empate; substrato e acabamento (prioridades 2 e 4) cedem ao núcleo da parede (1).
    const p = build(0.15, {
      walls: [{ b: { x: 8.81, y: 0 } }],
      floors: [{ boundary: rect(-1, -1, 10, 1), heightOffset: 0.12 }],
    });
    const w = wallsOf(p)[0]!;
    expect((w.grossVolume - w.volume) / 0.05).toBeCloseTo(8.81 * 0.15, 6);
    expect(floorOf(p).area).toBeCloseTo(22, 9);
    expect(floorOf(p).volume).toBeCloseTo(22 * 0.19 - 8.81 * 0.15 * 0.07, 6);
  });

  it('laje cortando piso: o piso perde a parte dentro da laje e a laje não perde nada', () => {
    // Laje com topo em 0,50 e piso de topo em 0,50, ambos sobre 4 × 3 m. Sobreposição de 0,12 m (12 m²).
    const p = build(0.23, { walls: [], floors: [{ boundary: rect(0, 0, 4, 3), heightOffset: 0.5 }], slabs: [{ boundary: rect(0, 0, 4, 3), heightOffset: 0.5 }] });
    const f = floorOf(p);
    expect(f.grossVolume).toBeCloseTo(12 * 0.19, 9);
    expect(f.volume).toBeCloseTo(12 * 0.19 - 12 * 0.12, 9);
    // A face superior (acabamento) está inteira dentro da laje: área líquida zero.
    expect(f.netArea).toBeCloseTo(0, 9);
    expect(slabOf(p).volume).toBeCloseTo(12 * 0.12, 9);
  });

  it('piso de acabamento (ft_acab) encostado na face superior da laje não perde volume', () => {
    const p = build(0.23, { walls: [], floors: [{ typeId: 'ft_acab', boundary: rect(0, 0, 4, 3), heightOffset: 0.04 }], slabs: [{ boundary: rect(0, 0, 4, 3) }] });
    expect(floorOf(p).volume).toBeCloseTo(12 * 0.04, 9);
    expect(floorOf(p).volume).toBeCloseTo(floorOf(p).grossVolume, 12);
  });
});

/** Gerador determinístico (mulberry32): mesma sequência a cada execução. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('propriedade: soma líquida sem dobro (10 sementes)', () => {
  for (let seed = 1; seed <= 10; seed++) {
    it(`semente ${seed}: piso e laje aleatórios, líquido ≤ bruto e igual à união quando se cruzam`, () => {
      const r = rng(seed);
      const x0 = r() * 3;
      const y0 = r() * 3;
      const fr = rect(x0, y0, x0 + 1 + r() * 4, y0 + 1 + r() * 4);
      const sx0 = r() * 3;
      const sy0 = r() * 3;
      const sr = rect(sx0, sy0, sx0 + 1 + r() * 4, sy0 + 1 + r() * 4);
      const fOff = -0.2 + r() * 0.8;
      const sOff = -0.2 + r() * 0.8;
      const ftType = r() < 0.5 ? 'ft_ceram' : 'ft_acab';
      const p = build(0.23, { walls: [], floors: [{ typeId: ftType, boundary: fr, heightOffset: fOff }], slabs: [{ boundary: sr, heightOffset: sOff }] });
      const f = floorOf(p);
      const s = slabOf(p);
      const gross = f.grossVolume + s.volume;
      const net = f.volume + s.volume;
      expect(net).toBeLessThanOrEqual(gross + 1e-9);
      expect(net).toBeGreaterThanOrEqual(-1e-12);
      // Sobreposição analítica: retângulos em planta e cotas que se cruzam (piso inteiro contra laje inteira).
      const ix = Math.max(0, Math.min(fr[2]!.x, sr[2]!.x) - Math.max(fr[0]!.x, sr[0]!.x));
      const iy = Math.max(0, Math.min(fr[2]!.y, sr[2]!.y) - Math.max(fr[0]!.y, sr[0]!.y));
      const fTop = fOff;
      const fBot = fOff - f.thickness;
      const sTop = sOff;
      const sBot = sOff - 0.12;
      const zOverlap = Math.max(0, Math.min(fTop, sTop) - Math.max(fBot, sBot));
      expect(net).toBeCloseTo(gross - ix * iy * zOverlap, 9);
    });
  }

  it('sem interseção em cota, o líquido é igual ao bruto', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const r = rng(seed);
      const p = build(0.23, {
        walls: [{ height: 2 + r() }],
        floors: [{ boundary: rect(-1, -1, 2, 1), heightOffset: -0.25 - r() * 0.2 }],
        slabs: [{ boundary: rect(-1, -1, 2, 1), heightOffset: 3 + r() }],
      });
      const w = wallsOf(p)[0]!;
      expect(w.volume).toBeCloseTo(w.grossVolume, 12);
      expect(floorOf(p).volume).toBeCloseTo(floorOf(p).grossVolume, 12);
    }
  });
});

/** Linhas do CSV (o separador de linha é CRLF). */
const linesOf = (csv: string): string[] => csv.split('\n').map((l) => l.replace(/\r$/, ''));

describe('tabelas: bruto e líquido só aparecem quando diferem', () => {
  it('tabela de pisos sem corte mantém o CSV de antes (sem colunas extras)', () => {
    const p = build(0.23, { walls: [], floors: [{ boundary: rect(0, 0, 4, 3) }] });
    const sch = buildFloorSchedule(p);
    const csv = floorScheduleToCsv(sch.rows, sch.totals);
    expect(linesOf(csv)[0]).toMatch(/Deslocamento \(m\)$/);
    expect(csv).not.toContain('Volume bruto');
    expect(csv).not.toContain('Área líquida');
  });

  it('tabela de pisos com corte ganha no fim as colunas de área líquida e de volume bruto', () => {
    const p = build(0.23, { walls: [], floors: [{ boundary: rect(0, 0, 4, 3), heightOffset: 0.5 }], slabs: [{ boundary: rect(0, 0, 4, 3), heightOffset: 0.5 }] });
    const sch = buildFloorSchedule(p);
    const lines = linesOf(floorScheduleToCsv(sch.rows, sch.totals));
    expect(lines[0]).toMatch(/Deslocamento \(m\);Área líquida \(m²\);Volume bruto \(m³\)$/);
    expect(lines[1]).toMatch(/;0,00;2,280$/);
    expect(lines[2]).toBe('Total;;;;12,00;14,00;;0,840;;0,00;2,280');
    expect(sch.totals.grossVolume).toBeCloseTo(2.28, 9);
    expect(sch.totals.volume).toBeCloseTo(0.84, 9);
  });

  it('tabela de paredes com parede embutida em piso ganha a coluna de volume bruto', () => {
    const p = build(0.23, { walls: [{}], floors: [{ heightOffset: 0.16 }] });
    const sch = buildWallSchedule(p);
    const lines = linesOf(scheduleToCsv(sch.rows, sch.totals));
    expect(lines[0]).toMatch(/Camadas \(cm\);Volume bruto \(m³\)$/);
    expect(lines[1]).toContain(';0,623;');
    expect(lines[1]).toMatch(/;0,644$/);
    expect(sch.totals.grossVolume).toBeCloseTo(0.644, 9);
  });
});
