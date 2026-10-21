import { describe, expect, it } from 'vitest';
import { asMulti, intersection, multiArea, type Vec2 } from '@hestia/geom';
import { generateSpiralRun, pieceVolume, resolveStairsOnLevel, stairBody, type ResolvedStair } from '@hestia/engine';
import { DEFAULT_STAIR_TYPES, ProjectStore, createEmptyProject, makeStair, type Project, type StairRun, type StairType } from '@hestia/model';
import { buildStairSolids } from './stairSolids.ts';
import type { SolidBatch } from './solids.ts';

/** Sólidos 3D do caracol (decisão 0014 §10): corpo monolítico por volta e estilo poste (cilindro e degraus). */

const H = 0.175;
const ORIGIN: Vec2 = { x: 0, y: 0 };
const deg = (d: number): number => (d * Math.PI) / 180;

function spiralStair(sweepDeg: number, risers: number, typeId: string, typeExtra?: Partial<StairType>): { st: ResolvedStair; project: Project } {
  const store = new ProjectStore(createEmptyProject());
  let id = typeId;
  if (typeExtra) {
    id = 'stt_teste';
    const base = DEFAULT_STAIR_TYPES.find((t) => t.id === typeId)!;
    store.exec({ type: 'upsertStairType', stairType: { ...base, id, ...typeExtra } as StairType });
  }
  const run = generateSpiralRun({ center: ORIGIN, rInner: 0.1, rOuter: 1, startAngle: 0.3, sweep: deg(sweepDeg), risers });
  const total = risers * H;
  store.exec({
    type: 'addStair',
    stair: makeStair({ id: 'st1', typeId: id, levelId: 'lv_0', topOffset: total - 3, height: total, components: [{ id: 'run', kind: 'run', ...run } as StairRun], openingMargin: 0 }),
  });
  const project = store.project;
  const [st] = resolveStairsOnLevel(project, 'lv_0');
  expect(st).toBeDefined();
  expect(st!.issues.filter((i) => i.severity === 'error')).toEqual([]);
  return { st: st!, project };
}

/** Volume por teorema da divergência (malha fechada e bem orientada), como em stairSolids.test.ts. */
function volume(b: { positions: number[]; indices: number[] }): number {
  let v = 0;
  const p = (k: number) => [b.positions[k * 3]!, b.positions[k * 3 + 1]!, b.positions[k * 3 + 2]!] as const;
  for (let i = 0; i < b.indices.length; i += 3) {
    const [p0, p1, p2] = [p(b.indices[i]!), p(b.indices[i + 1]!), p(b.indices[i + 2]!)];
    v += (p0[0] * (p1[1] * p2[2] - p1[2] * p2[1]) - p0[1] * (p1[0] * p2[2] - p1[2] * p2[0]) + p0[2] * (p1[0] * p2[1] - p1[1] * p2[0])) / 6;
  }
  return v;
}

/** Arestas sem par no sentido oposto (malha aberta ou com emenda), com a tolerância de 1e-4 m do desenho. */
function unmatchedEdges(b: SolidBatch): number {
  const key = (k: number): string => [0, 1, 2].map((c) => Math.round(b.positions[k * 3 + c]! * 1e4)).join(',');
  const count = new Map<string, number>();
  for (let t = 0; t < b.indices.length; t += 3)
    for (let j = 0; j < 3; j++) {
      const a = key(b.indices[t + j]!);
      const c = key(b.indices[t + ((j + 1) % 3)]!);
      if (a !== c) count.set(`${a}|${c}`, (count.get(`${a}|${c}`) ?? 0) + 1);
    }
  let open = 0;
  for (const [k, n] of count) {
    const [a, c] = k.split('|');
    if (count.get(`${c}|${a}`) !== n) open++;
  }
  return open;
}

/** Triângulos horizontais (as três cotas iguais) de todos os lotes, com a cota e o contorno em planta. */
function flatTriangles(batches: SolidBatch[]): Array<{ z: number; tri: Vec2[] }> {
  const out: Array<{ z: number; tri: Vec2[] }> = [];
  for (const b of batches) {
    for (let t = 0; t < b.indices.length; t += 3) {
      const ks = [b.indices[t]!, b.indices[t + 1]!, b.indices[t + 2]!];
      const zs = ks.map((k) => b.positions[k * 3 + 2]!);
      if (Math.max(...zs) - Math.min(...zs) > 1e-9) continue;
      out.push({ z: zs[0]!, tri: ks.map((k) => ({ x: b.positions[k * 3]!, y: b.positions[k * 3 + 1]! })) });
    }
  }
  return out;
}

/** Maior área de sobreposição em planta entre dois triângulos horizontais na mesma cota (z-fighting). */
function worstCoplanarOverlap(batches: SolidBatch[]): number {
  const tris = flatTriangles(batches);
  let worst = 0;
  for (let i = 0; i < tris.length; i++)
    for (let j = i + 1; j < tris.length; j++) {
      if (Math.abs(tris[i]!.z - tris[j]!.z) > 1e-9) continue;
      const a = multiArea(intersection(asMulti(tris[i]!.tri), asMulti(tris[j]!.tri)));
      worst = Math.max(worst, a);
    }
  return worst;
}

describe.each([
  { sweepDeg: 540, risers: 16 },
  { sweepDeg: 720, risers: 17 },
])('caracol monolítico de $sweepDeg° (3D)', ({ sweepDeg, risers }) => {
  const { st } = spiralStair(sweepDeg, risers, 'stt_caracol_monolitica');
  const batches = buildStairSolids([st]);

  it('um lote de material (concreto) e volume da malha = Σ volumes das peças de stairBody', () => {
    expect(batches).toHaveLength(1);
    const expected = stairBody(st, { slabThickness: 0.15 }).pieces.reduce((s, p) => s + pieceVolume(p), 0);
    expect(Math.abs(volume(batches[0]!) - expected)).toBeLessThan(1e-9);
  });

  it('malha fechada: nenhuma aresta sem par, e nenhum vértice abaixo do piso base', () => {
    expect(unmatchedEdges(batches[0]!)).toBe(0);
    expect(Math.min(...batches[0]!.positions.filter((_, i) => i % 3 === 2))).toBeGreaterThanOrEqual(-1e-6);
  });

  it('voltas sobrepostas sem faces horizontais coplanares que se sobrepõem (sem z-fighting)', () => {
    expect(worstCoplanarOverlap(batches)).toBeLessThan(1e-9);
  });
});

describe('caracol de estilo poste (3D): cilindro do poste e degraus soltos, por material', () => {
  const { st } = spiralStair(360, 16, 'stt_caracol_poste', { postMaterialId: 'mat_concreto' });
  const batches = buildStairSolids([st]);
  const byMat = new Map(batches.map((b) => [b.materialId, b] as const));
  const pieces = stairBody(st).pieces;
  const treadVolume = pieces.filter((p) => p.kind === 'tread').reduce((s, p) => s + pieceVolume(p), 0);
  const postVolume = pieces.filter((p) => p.kind === 'post').reduce((s, p) => s + pieceVolume(p), 0);

  it('lote dos degraus no material do tipo e lote do poste no postMaterialId, com volumes de cada peça', () => {
    expect([...byMat.keys()].sort()).toEqual(['mat_aco', 'mat_concreto']);
    expect(Math.abs(volume(byMat.get('mat_aco')!) - treadVolume)).toBeLessThan(1e-9);
    expect(Math.abs(volume(byMat.get('mat_concreto')!) - postVolume)).toBeLessThan(1e-9);
  });

  it('malha fechada em cada lote: nenhuma aresta sem par (degraus soltos, cada um com paredes onde expostas; poste fechado)', () => {
    for (const b of batches) expect(unmatchedEdges(b)).toBe(0);
  });

  it('o poste é um prisma de 24 faces: 24 paredes e 2 tampas (vértices do lote do poste no mesmo raio do centro)', () => {
    const post = byMat.get('mat_concreto')!;
    const radii = new Set<string>();
    for (let k = 0; k < post.positions.length / 3; k++) radii.add(Math.hypot(post.positions[k * 3]!, post.positions[k * 3 + 1]!).toFixed(6));
    expect([...radii]).toEqual([(0.1).toFixed(6)]);
    expect(Math.min(...post.positions.filter((_, i) => i % 3 === 2))).toBeCloseTo(0, 9);
    expect(Math.max(...post.positions.filter((_, i) => i % 3 === 2))).toBeCloseTo(15 * H, 9);
  });

  it('sem z-fighting: a tampa do poste (topo do último degrau) não se sobrepõe em planta à tampa do degrau 15', () => {
    expect(worstCoplanarOverlap(batches)).toBeLessThan(1e-6);
  });

  it('sem degrau abaixo do piso base, e sem espelho (o degrau é só a fatia de espessura t)', () => {
    const zs = batches.flatMap((b) => b.positions.filter((_, i) => i % 3 === 2));
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(-1e-9);
    expect(Math.max(...zs)).toBeCloseTo(15 * H, 9);
  });
});
