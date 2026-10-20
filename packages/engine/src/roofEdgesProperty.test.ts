import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof, type Project } from '@hestia/model';
import { resolveRoofs, roofTopAt, type ResolvedRoof } from './index.ts';
import { planeHas } from './roofGeom.ts';
import { planeZ } from './roofs.ts';

/**
 * Propriedades do telhado por aresta (A10, G4) com o solver instalado. 30 contornos com semente fixa: os pares são
 * retângulos (convexos e ortogonais) e os ímpares, polígonos convexos aleatórios. Cada aresta define inclinação (5 % a
 * 60 %) ou é empena, ao acaso; ao menos uma define.
 */

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

const SEED = 20261020;
const COUNT = 30;
const EAVE_Z = 2.5;
const EPS = 1e-6;

/** Envoltória convexa (monotone chain), anti-horária, sem vértices colineares. */
function hull(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec2[] = [];
  const upper: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

/** Casos: contorno e inclinação de cada aresta (null = empena). */
function cases(): Array<{ ring: Vec2[]; slopes: Array<number | null> }> {
  const next = rng(SEED);
  const out: Array<{ ring: Vec2[]; slopes: Array<number | null> }> = [];
  while (out.length < COUNT) {
    const i = out.length;
    let ring: Vec2[];
    if (i % 2 === 0) {
      const w = 2 + next() * 10;
      const h = 2 + next() * 10;
      ring = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];
    } else {
      ring = hull(Array.from({ length: 6 + Math.floor(next() * 4) }, () => ({ x: next() * 20, y: next() * 20 })));
      if (ring.length < 3) continue;
    }
    const slopes: Array<number | null> = ring.map(() => (next() < 0.8 ? 5 + next() * 55 : null));
    if (!slopes.some((s) => s !== null)) slopes[0] = 30;
    out.push({ ring, slopes });
  }
  return out;
}

function build(ring: Vec2[], slopes: Array<number | null>): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({
    type: 'addRoof',
    roof: makeRoof({
      id: 'r1',
      typeId: 'rt_ceramica',
      levelId: 'lv_0',
      boundary: ring,
      shape: 'edges',
      edgeSlopes: slopes,
      edgeOverhangs: ring.map(() => 0),
      heightOffset: EAVE_Z,
    }),
  });
  return s.project;
}

const CASES = cases();

describe('G4 · telhado por aresta, 30 contornos convexos com pesos aleatórios', () => {
  it('nenhum caso lança e todos resolvem sem motivo de falha', () => {
    CASES.forEach(({ ring, slopes }, k) => {
      let r: ResolvedRoof | undefined;
      expect(() => {
        r = resolveRoofs(build(ring, slopes), 'lv_0')[0];
      }, `caso ${k}`).not.toThrow();
      expect(r, `caso ${k}`).toBeDefined();
      expect(r!.problem, `caso ${k}`).toBeUndefined();
    });
  });

  it('soma das áreas das águas ≤ área do contorno, e igual quando todas as arestas definem', () => {
    CASES.forEach(({ ring, slopes }, k) => {
      const r = resolveRoofs(build(ring, slopes), 'lv_0')[0]!;
      const area = Math.abs(multiArea([[ring]]));
      const total = r.planes.reduce((s, pl) => s + multiArea(pl.polygon), 0);
      expect(total, `caso ${k}`).toBeLessThanOrEqual(area + EPS);
      if (slopes.every((s) => s !== null)) expect(Math.abs(total - area), `caso ${k}`).toBeLessThan(EPS);
    });
  });

  it('a cota é contínua nas divisas: em cada ponto de cumeeira, espigão ou rincão, as águas que tocam dão a mesma cota', () => {
    CASES.forEach(({ ring, slopes }, k) => {
      const r = resolveRoofs(build(ring, slopes), 'lv_0')[0]!;
      for (const l of r.lines) {
        if (l.kind === 'eave' || l.kind === 'gable') continue;
        for (const f of [0.2, 0.5, 0.8]) {
          const q = { x: l.a.x + (l.b.x - l.a.x) * f, y: l.a.y + (l.b.y - l.a.y) * f };
          const zs = r.planes.filter((pl) => planeHas(pl.polygon, q)).map((pl) => planeZ(pl, q));
          if (zs.length < 2) continue;
          expect(Math.max(...zs) - Math.min(...zs), `caso ${k}`).toBeLessThan(EPS);
        }
      }
    });
  });

  it('o beiral (aresta que define) está na cota do beiral', () => {
    CASES.forEach(({ ring, slopes }, k) => {
      const r = resolveRoofs(build(ring, slopes), 'lv_0')[0]!;
      const eaves = r.lines.filter((l) => l.kind === 'eave');
      expect(eaves.length, `caso ${k}`).toBeGreaterThan(0);
      for (const l of eaves) {
        const q = { x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2 };
        expect(roofTopAt(r, q), `caso ${k}`).toBeCloseTo(EAVE_Z, 6);
      }
    });
  });
});
