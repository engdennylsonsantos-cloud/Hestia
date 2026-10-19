import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { createEmptyProject, floorArea, floorTypeThickness, makeFloor, type Floor, type Project } from '@hestia/model';
import { quantifyFloors, resolveFloors } from './index.ts';

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

const SEED = 20260615;
const COUNT = 30;

/**
 * Polígono estrelado em relação a `c`: ângulos crescentes e raios positivos, logo simples. O jitter angular de 0,4
 * deixa cada intervalo entre vértices abaixo de 180°, então `c` fica dentro do polígono (núcleo).
 */
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

/** Distância do ponto ao contorno. Um disco desse raio em torno do ponto fica inteiro dentro do contorno. */
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

/** 30 pisos determinísticos: 3 a 12 vértices, com e sem furo, deslocamentos de -0,5 a 0,5 m e os três tipos padrão. */
function randomFloors(): Array<Omit<Floor, 'order'>> {
  const rand = rng(SEED);
  const types = ['ft_ceram', 'ft_laje12', 'ft_madeira'];
  return Array.from({ length: COUNT }, (_, k) => {
    const c = { x: k * 25, y: (k % 5) * 25 };
    const n = 3 + Math.floor(rand() * 10);
    const outer = starPolygon(rand, c, n, 0.5, 4);
    const withHole = rand() < 0.5;
    return makeFloor({
      id: `pf${k}`,
      typeId: types[k % types.length]!,
      levelId: 'lv_0',
      boundary: outer,
      holes: withHole ? [holeInside(rand, c, outer)] : [],
      heightOffset: rand() - 0.5,
    });
  });
}

function projectOf(floors: Array<Omit<Floor, 'order'>>): Project {
  const base = createEmptyProject();
  const elements = Object.fromEntries(floors.map((f, i) => [f.id, { ...f, order: i + 1 }]));
  return { ...base, elements };
}

describe('G4 · propriedades de piso com contornos aleatórios (semente fixa)', () => {
  const floors = randomFloors();
  const p = projectOf(floors);

  it('gera os 30 contornos, com furo em parte deles', () => {
    expect(floors).toHaveLength(COUNT);
    expect(floors.some((f) => f.holes.length > 0)).toBe(true);
    expect(floors.some((f) => f.holes.length === 0)).toBe(true);
  });

  it('resolveFloors não lança e devolve um piso por contorno válido', () => {
    expect(() => resolveFloors(p, 'lv_0')).not.toThrow();
    expect(resolveFloors(p, 'lv_0')).toHaveLength(COUNT);
  });

  it('área do resolvido == área do modelo, para cada piso', () => {
    for (const r of resolveFloors(p, 'lv_0')) {
      const f = p.elements[r.floorId] as Floor;
      expect(multiArea(r.polygon)).toBeCloseTo(floorArea(f), 9);
      expect(multiArea(r.polygon)).toBeGreaterThan(0);
    }
  });

  it('camadas contíguas: z0 de uma é z1 da seguinte, e vão do topo à face inferior', () => {
    for (const r of resolveFloors(p, 'lv_0')) {
      expect(r.layers[0]!.z1).toBeCloseTo(r.topZ, 12);
      for (let i = 0; i + 1 < r.layers.length; i++) expect(r.layers[i]!.z0).toBeCloseTo(r.layers[i + 1]!.z1, 12);
      expect(r.layers.at(-1)!.z0).toBeCloseTo(r.bottomZ, 12);
    }
  });

  it('volume total == área × espessura total do tipo', () => {
    const q = quantifyFloors(p, 'lv_0');
    for (const f of q.floors) {
      const type = p.floorTypes[f.typeId]!;
      expect(f.volume).toBeCloseTo(f.area * floorTypeThickness(type), 9);
    }
    expect(q.totalVolume).toBeCloseTo(q.floors.reduce((s, f) => s + f.area * floorTypeThickness(p.floorTypes[f.typeId]!), 0), 9);
  });
});
