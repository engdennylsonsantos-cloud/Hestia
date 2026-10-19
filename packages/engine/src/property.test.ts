import { describe, expect, it } from 'vitest';
import { add, dist, multiArea, union, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type JoinKind, type LocationLine, type Opening, type Project, type Wall } from '@hestia/model';
import { resolveLevel, type ResolvedLevel } from './index.ts';

/**
 * Testes de propriedade: paredes aleatórias, mas reprodutíveis (mulberry32 com semente fixa).
 * Se um invariante falhar numa semente, ela vai para KNOWN_FAILURES: o caso vira `it.fails` e o
 * motivo fica anotado. O motor não é alterado por estes testes.
 */

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const GRID = 0.5;
const CELLS = 24; // 12 m / 0,5 m
const TOL = 1e-6;
const SHIFT: Vec2 = { x: 3.7, y: -2.1 };
const LOCATIONS: LocationLine[] = ['wallCenter', 'coreCenter', 'finishExterior', 'finishInterior', 'coreExterior', 'coreInterior'];
const JOINS: JoinKind[] = ['butt', 'miter', 'square'];
const BASE = createEmptyProject();
const WALL_TYPE_IDS = Object.keys(BASE.wallTypes);
const OPENING_TYPES = Object.values(BASE.openingTypes);

/** Chave `semente:invariante` -> motivo da falha conhecida. Vazio enquanto todos os invariantes passam. */
const KNOWN_FAILURES = new Map<string, string>([]);

interface Scenario {
  walls: Array<Omit<Wall, 'order'>>;
  openings: Opening[];
}

/** Gerador pseudoaleatório determinístico (mulberry32): mesma semente, mesmo projeto. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rnd: () => number, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const int = (rnd: () => number, lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));

function scenario(seed: number): Scenario {
  const rnd = mulberry32(seed);
  const n = int(rnd, 25, 40);
  const gridPoint = (): Vec2 => ({ x: int(rnd, 0, CELLS) * GRID, y: int(rnd, 0, CELLS) * GRID });
  const walls: Array<Omit<Wall, 'order'>> = [];
  while (walls.length < n) {
    const a = gridPoint();
    const b = gridPoint();
    if (dist(a, b) < GRID) continue;
    const typeId = pick(rnd, WALL_TYPE_IDS);
    const locationLine = pick(rnd, LOCATIONS);
    const flipped = rnd() < 0.5;
    const joinStart = { kind: pick(rnd, JOINS), flip: rnd() < 0.5 };
    const joinEnd = { kind: pick(rnd, JOINS), flip: rnd() < 0.5 };
    walls.push(makeWall({ id: `w${walls.length}`, typeId, levelId: 'lv_0', a, b, locationLine, flipped, joinStart, joinEnd }));
  }
  // 0 a 6 aberturas que cabem na parede e não se cruzam entre si.
  const openings: Opening[] = [];
  const spans: Array<{ host: string; lo: number; hi: number }> = [];
  const want = int(rnd, 0, 6);
  for (let tries = 0; openings.length < want && tries < 200; tries++) {
    const host = pick(rnd, walls);
    const t = pick(rnd, OPENING_TYPES);
    const L = dist(host.a, host.b);
    const half = t.width / 2;
    if (L < 2 * half) continue;
    const offset = half + rnd() * (L - 2 * half);
    const lo = offset - half;
    const hi = offset + half;
    if (spans.some((s) => s.host === host.id && s.lo < hi && lo < s.hi)) continue;
    spans.push({ host: host.id, lo, hi });
    openings.push({
      id: `o${openings.length}`,
      kind: t.kind,
      typeId: t.id,
      hostId: host.id,
      offset,
      flipHand: rnd() < 0.5,
      flipFacing: rnd() < 0.5,
      sillOverride: null,
      mark: '',
    });
  }
  return { walls, openings };
}

/** Constrói o projeto só com comandos, como a aplicação. `d` desloca todas as paredes. */
function build(sc: Scenario, d: Vec2 = { x: 0, y: 0 }): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const w of sc.walls) s.exec({ type: 'addWall', wall: { ...w, a: add(w.a, d), b: add(w.b, d) } });
  for (const o of sc.openings) s.exec({ type: 'addOpening', opening: o });
  return s.project;
}

const silhouettes = (r: ResolvedLevel) => union(...r.clusters.map((c) => c.silhouette));
const totalArea = (r: ResolvedLevel): number => multiArea(silhouettes(r));
const layerCutAreas = (r: ResolvedLevel): number[] => Object.values(r.walls).flatMap((w) => w.layers.map((l) => multiArea(l.cut)));
const sumCut = (r: ResolvedLevel): number => layerCutAreas(r).reduce((s, a) => s + a, 0);

/** Todas as áreas que o motor devolve, para checar finitude e não negatividade. */
function allAreas(r: ResolvedLevel): number[] {
  const perWall = Object.values(r.walls).flatMap((w) => [
    ...w.layers.flatMap((l) => [multiArea(l.cut), multiArea(l.fragment)]),
    ...w.layers.flatMap((l) => l.bands.map((b) => multiArea(b.poly))),
  ]);
  const perCluster = r.clusters.flatMap((c) => [multiArea(c.silhouette), ...c.regions.map((g) => multiArea(g.polygons))]);
  return [...perWall, ...perCluster];
}

const lazy = <T>(f: () => T): (() => T) => {
  let box: { value: T } | null = null;
  return () => (box ??= { value: f() }).value;
};

interface Case {
  /** Resolução com cache novo. Lança aqui se o motor lançar. */
  r: () => ResolvedLevel;
  /** Segunda resolução, em cache separado, para checar determinismo. */
  again: () => ResolvedLevel;
  /** Mesmo projeto deslocado por SHIFT. */
  shifted: () => ResolvedLevel;
}

const cases = new Map<number, Case>();
function caseOf(seed: number): Case {
  const hit = cases.get(seed);
  if (hit) return hit;
  const sc = scenario(seed);
  const p = lazy(() => build(sc));
  const q = lazy(() => build(sc, SHIFT));
  const c: Case = {
    r: lazy(() => resolveLevel(p(), 'lv_0', new Map())),
    again: lazy(() => resolveLevel(p(), 'lv_0', new Map())),
    shifted: lazy(() => resolveLevel(q(), 'lv_0', new Map())),
  };
  cases.set(seed, c);
  return c;
}

describe('gerador', () => {
  it('cada semente gera 25 a 40 paredes dentro de 12 × 12 m, com 0 a 6 aberturas', () => {
    for (const seed of SEEDS) {
      const sc = scenario(seed);
      expect(sc.walls.length, `semente ${seed}`).toBeGreaterThanOrEqual(25);
      expect(sc.walls.length, `semente ${seed}`).toBeLessThanOrEqual(40);
      expect(sc.openings.length, `semente ${seed}`).toBeLessThanOrEqual(6);
      for (const w of sc.walls) {
        for (const p of [w.a, w.b]) {
          expect(p.x, `semente ${seed}`).toBeGreaterThanOrEqual(0);
          expect(p.x, `semente ${seed}`).toBeLessThanOrEqual(12);
          expect(p.y, `semente ${seed}`).toBeGreaterThanOrEqual(0);
          expect(p.y, `semente ${seed}`).toBeLessThanOrEqual(12);
        }
      }
    }
  });

  it('mesma semente, mesmo cenário', () => {
    expect(scenario(7)).toEqual(scenario(7));
    expect(scenario(7)).not.toEqual(scenario(8));
  });
});

describe.each(SEEDS)('propriedades, semente %i', (seed) => {
  const check = (inv: string, fn: () => void): void => {
    const run = KNOWN_FAILURES.has(`${seed}:${inv}`) ? it.fails : it;
    run(inv, fn);
  };

  check('(a) resolveLevel não lança', () => {
    expect(() => caseOf(seed).r()).not.toThrow();
  });

  check('(b) todas as áreas são finitas e ≥ 0', () => {
    const bad = allAreas(caseOf(seed).r()).filter((a) => !(Number.isFinite(a) && a >= 0));
    expect(bad, `semente ${seed}`).toEqual([]);
  });

  check('(c) soma das áreas de corte = área da união das silhuetas (sem dupla contagem)', () => {
    const r = caseOf(seed).r();
    const sum = sumCut(r);
    const total = totalArea(r);
    // Tolerância de 1e-4 m²: as silhuetas passam pelo fechamento de frestas (closeGaps), que altera até ~2e-5 m².
    expect(Math.abs(sum - total), `semente ${seed}: soma dos cortes ${sum} ≠ união ${total}`).toBeLessThanOrEqual(1e-4);
  });

  check('(d) duas resoluções dão as mesmas áreas', () => {
    const snap = (r: ResolvedLevel) => ({ layers: layerCutAreas(r), total: totalArea(r) });
    expect(snap(caseOf(seed).again()), `semente ${seed}`).toEqual(snap(caseOf(seed).r()));
  });

  check('(e) transladar o projeto não muda a área total', () => {
    const t0 = totalArea(caseOf(seed).r());
    const t1 = totalArea(caseOf(seed).shifted());
    expect(Math.abs(t1 - t0), `semente ${seed}: ${t0} → ${t1}`).toBeLessThanOrEqual(TOL);
  });
});
