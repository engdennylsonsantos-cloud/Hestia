import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { createEmptyProject, makeSlab, slabArea, slabTypeThickness, type Project, type Slab } from '@hestia/model';
import { quantifySlabs, resolveSlabs } from './index.ts';

/** Gerador determinístico (mulberry32): mesma semente, mesmos contornos em qualquer execução. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260701;
const COUNT = 30;

/** Polígono estrelado em relação a `c` (ângulos crescentes, raios positivos): simples, com `c` no núcleo. */
function starPolygon(rand: () => number, c: Vec2, n: number, rMin: number, rMax: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + rand() * 0.4) / n) * 2 * Math.PI;
    const r = rMin + rand() * (rMax - rMin);
    out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return out;
}

/** Distância do ponto ao segmento a–b. */
function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distância do ponto ao contorno: um disco desse raio em torno do ponto fica inteiro dentro do contorno. */
function ringClearance(p: Vec2, ring: Vec2[]): number {
  let best = Infinity;
  ring.forEach((a, i) => {
    best = Math.min(best, segDist(p, a, ring[(i + 1) % ring.length]!));
  });
  return best;
}

/** Furo: polígono regular inscrito num disco de raio 0,3 × folga, centrado no núcleo (fica dentro do contorno). */
function holeInside(rand: () => number, c: Vec2, outer: Vec2[]): Vec2[] {
  const radius = 0.3 * ringClearance(c, outer);
  const n = 3 + Math.floor(rand() * 4);
  const phase = rand() * Math.PI;
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * 2 * Math.PI;
    return { x: c.x + radius * Math.cos(a), y: c.y + radius * Math.sin(a) };
  });
}

/** 30 lajes determinísticas: 3 a 12 vértices, com e sem furo, inclinação aleatória (com e sem) e os três tipos padrão. */
function randomSlabs(): Array<Omit<Slab, 'order'>> {
  const rand = rng(SEED);
  const types = ['ls_mac12', 'ls_mac15', 'ls_cobertura'];
  return Array.from({ length: COUNT }, (_, k) => {
    const c = { x: k * 25, y: (k % 5) * 25 };
    const n = 3 + Math.floor(rand() * 10);
    const outer = starPolygon(rand, c, n, 0.5, 4);
    const withHole = rand() < 0.5;
    const withSlope = rand() < 0.6;
    const angle = rand() * 2 * Math.PI;
    const percent = (rand() * 2 - 1) * 20;
    return makeSlab({
      id: `ps${k}`,
      typeId: types[k % types.length]!,
      levelId: 'lv_0',
      boundary: outer,
      holes: withHole ? [holeInside(rand, c, outer)] : [],
      heightOffset: rand() - 0.5,
      slope: withSlope ? { origin: c, dir: { x: Math.cos(angle), y: Math.sin(angle) }, percent } : null,
    });
  });
}

function projectOf(slabs: Array<Omit<Slab, 'order'>>): Project {
  const base = createEmptyProject();
  const elements = Object.fromEntries(slabs.map((s, i) => [s.id, { ...s, order: i + 1 }]));
  return { ...base, elements };
}

describe('G4 · propriedades de laje com contornos aleatórios (semente fixa)', () => {
  const slabs = randomSlabs();
  const p = projectOf(slabs);

  it('gera os 30 contornos, com furo e com inclinação em parte deles', () => {
    expect(slabs).toHaveLength(COUNT);
    expect(slabs.some((s) => s.holes.length > 0)).toBe(true);
    expect(slabs.some((s) => s.holes.length === 0)).toBe(true);
    expect(slabs.some((s) => s.slope !== null)).toBe(true);
    expect(slabs.some((s) => s.slope === null)).toBe(true);
  });

  it('resolveSlabs não lança e devolve uma laje por contorno válido', () => {
    expect(() => resolveSlabs(p, 'lv_0')).not.toThrow();
    expect(resolveSlabs(p, 'lv_0')).toHaveLength(COUNT);
    expect(() => quantifySlabs(p, 'lv_0')).not.toThrow();
  });

  it('área do resolvido == área do modelo, para cada laje', () => {
    for (const r of resolveSlabs(p, 'lv_0')) {
      const s = p.elements[r.slabId] as Slab;
      expect(multiArea(r.polygon)).toBeCloseTo(slabArea(s), 9);
      expect(multiArea(r.polygon)).toBeGreaterThan(0);
    }
  });

  it('camadas contíguas: a primeira começa no topo e a última termina na face inferior', () => {
    for (const r of resolveSlabs(p, 'lv_0')) {
      expect(r.layers[0]!.z1).toBeCloseTo(r.topZ, 12);
      for (let i = 0; i + 1 < r.layers.length; i++) expect(r.layers[i]!.z0).toBeCloseTo(r.layers[i + 1]!.z1, 12);
      expect(r.layers.at(-1)!.z0).toBeCloseTo(r.bottomZ, 12);
    }
  });

  it('volume total == área em planta × espessura total do tipo; área real ≥ área em planta', () => {
    const q = quantifySlabs(p, 'lv_0');
    for (const s of q.slabs) {
      const type = p.slabTypes[s.typeId]!;
      expect(s.volume).toBeCloseTo(s.planArea * slabTypeThickness(type), 9);
      expect(s.faceArea).toBeGreaterThanOrEqual(s.planArea - 1e-12);
    }
    expect(q.totalVolume).toBeCloseTo(q.slabs.reduce((t, s) => t + s.planArea * slabTypeThickness(p.slabTypes[s.typeId]!), 0), 9);
  });
});
