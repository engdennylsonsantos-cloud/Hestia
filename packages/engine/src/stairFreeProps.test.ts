import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { DEFAULT_STAIR_TYPES } from '@hestia/model';
import { findSelfOverlap } from './freePathGeom.ts';
import { planStairFree } from './stairFree.ts';
import { stairLiveParams } from './stairLive.ts';
import { stairLandingPolygon } from './stairSketch.ts';
import type { StairComponentSketch } from './stairGenerators.ts';

const mono = DEFAULT_STAIR_TYPES.find((t) => t.id === 'stt_monolitica')!;

/** Gerador pseudo-aleatório determinístico. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TRAJETOS = 400;
const SEMENTE = 20260601;

/** Trajeto aleatório de 2 a 12 vértices: trechos de 0,2 a 4 m, giros de 0 a 180° (sinal sorteado). */
function randomPath(rnd: () => number): Vec2[] {
  const n = 2 + Math.floor(rnd() * 11);
  let heading = rnd() * Math.PI * 2;
  const pts: Vec2[] = [{ x: 0, y: 0 }];
  for (let i = 1; i < n; i++) {
    if (i > 1) heading += (rnd() < 0.5 ? -1 : 1) * rnd() * Math.PI;
    const len = 0.2 + rnd() * 3.8;
    const q = pts[i - 1]!;
    pts.push({ x: q.x + Math.cos(heading) * len, y: q.y + Math.sin(heading) * len });
  }
  return pts;
}

const cross = (a: Vec2, b: Vec2, c: Vec2): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function selfIntersects(r: Vec2[]): boolean {
  const n = r.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const a = r[i]!;
      const b = r[(i + 1) % n]!;
      const c = r[j]!;
      const d = r[(j + 1) % n]!;
      if (cross(a, b, c) * cross(a, b, d) < -1e-12 && cross(c, d, a) * cross(c, d, b) < -1e-12) return true;
    }
  }
  return false;
}
const ringArea = (r: Vec2[]): number => r.reduce((s, p, i) => s + (p.x * r[(i + 1) % r.length]!.y - r[(i + 1) % r.length]!.x * p.y), 0) / 2;
const center = (r: { a: Vec2; b: Vec2 }): Vec2 => ({ x: (r.a.x + r.b.x) / 2, y: (r.a.y + r.b.y) / 2 });

/** Pontos de todos os componentes, para comparar dois planos. */
function flat(parts: StairComponentSketch[]): number[] {
  return parts.flatMap((c) =>
    c.kind === 'run' ? c.run.risers.flatMap((r) => [r.a.x, r.a.y, r.b.x, r.b.y]) : c.landing.boundary.flatMap((e) => [e.a.x, e.a.y]),
  );
}

describe('planStairFree: propriedades em trajetos aleatórios', () => {
  it(`${TRAJETOS} trajetos: nunca lança; erro em pt-BR ou plano consistente`, () => {
    const rnd = mulberry32(SEMENTE);
    let planos = 0;
    let erros = 0;
    for (let t = 0; t < TRAJETOS; t++) {
      const path = randomPath(rnd);
      const width = 0.8 + rnd() * 0.7;
      const H = 1 + rnd() * 3;
      const ctx = `semente ${SEMENTE}, trajeto ${t}: ${JSON.stringify(path)} w=${width} H=${H}`;
      let r: ReturnType<typeof planStairFree>;
      try {
        r = planStairFree(path, H, mono, { width });
      } catch (e) {
        throw new Error(`lançou (${ctx}): ${String(e)}`);
      }
      if ('error' in r) {
        erros++;
        expect(r.error, ctx).toMatch(/^[A-ZÁÉÍÓÚ].*[.]$/);
        continue;
      }
      planos++;
      const params = stairLiveParams(H, mono, { width });
      if ('error' in params) throw new Error(ctx);
      // N exato, h = H ÷ N, soma das elevações = H.
      expect(r.risers, ctx).toBe(params.risers);
      expect(r.riserHeight, ctx).toBeCloseTo(H / r.risers, 12);
      expect(r.riserHeight * r.risers, ctx).toBeCloseTo(H, 9);
      const runs = r.parts.flatMap((c) => (c.kind === 'run' ? [c.run] : []));
      expect(runs.reduce((s, x) => s + x.risers.length, 0), ctx).toBe(r.risers);
      expect(r.runs, ctx).toBe(runs.length);
      expect(r.landings, ctx).toBe(r.parts.length - runs.length);
      for (const run of runs) {
        expect(run.risers.length, ctx).toBeGreaterThanOrEqual(2);
        expect(run.risers.length, ctx).toBeLessThanOrEqual(params.maxPerFlight);
        for (let k = 1; k < run.risers.length; k++) {
          const a = center(run.risers[k - 1]!);
          const b = center(run.risers[k]!);
          expect(Math.hypot(b.x - a.x, b.y - a.y), ctx).toBeCloseTo(r.tread, 9);
        }
      }
      // Patamares: área > 0 e anel sem autointerseção.
      for (const c of r.parts) {
        if (c.kind !== 'landing') continue;
        const poly = stairLandingPolygon(c.landing);
        expect(poly.issues, ctx).toEqual([]);
        expect(Math.abs(ringArea(poly.polygon!)), ctx).toBeGreaterThan(1e-6);
        expect(selfIntersects(poly.polygon!), ctx).toBe(false);
      }
      // Sem sobreposição entre componentes não consecutivos (cada componente conta como um trecho).
      expect(findSelfOverlap(r.parts, r.parts.map((_, i) => i)), ctx).toBeNull();
      // O último ponto do trajeto normalizado é o centro do último espelho.
      const lastRun = runs[runs.length - 1]!;
      const lc = center(lastRun.risers[lastRun.risers.length - 1]!);
      const lp = r.path[r.path.length - 1]!;
      expect(Math.hypot(lp.x - lc.x, lp.y - lc.y), ctx).toBeLessThan(1e-9);
      // Idempotência: planejar o trajeto normalizado dá os mesmos componentes.
      const again = planStairFree(r.path, H, mono, { width });
      if ('error' in again) throw new Error(`replanejar falhou (${ctx}): ${again.error}`);
      const a = flat(r.parts);
      const b = flat(again.parts);
      expect(b.length, ctx).toBe(a.length);
      a.forEach((x, i) => expect(Math.abs(x - b[i]!), ctx).toBeLessThan(1e-6));
      expect(again.extended, ctx).toBeLessThan(1e-6);
    }
    // O gerador precisa produzir os dois lados: planos válidos e recusas.
    expect(planos).toBeGreaterThan(TRAJETOS * 0.2);
    expect(erros).toBeGreaterThan(0);
  });
});
