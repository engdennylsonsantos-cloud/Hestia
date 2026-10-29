import { describe, expect, it } from 'vitest';
import { intersection, ringArea, type Ring, type Vec2 } from '@hestia/geom';
import { DEFAULT_RAMP_TYPES } from '@hestia/model';
import { planRamp, type RampPlan } from './rampPlan.ts';
import { planRampFree } from './rampFree.ts';
import { stairLandingPolygon } from './stairSketch.ts';
import type { StairComponentSketch } from './stairGenerators.ts';

const type = DEFAULT_RAMP_TYPES.find((t) => t.id === 'rmt_nbr9050')!;
const v = (x: number, y: number): Vec2 => ({ x, y });
const S = 1 / 12;
const free = (path: Vec2[], H: number, extra: Partial<Parameters<typeof planRampFree>[3]> = {}) =>
  planRampFree(path, H, type, { width: 1.5, mode: 'slope', slope: S, ...extra });
const ok = (r: ReturnType<typeof planRampFree>): RampPlan => {
  if ('error' in r) throw new Error(r.error);
  return r;
};
const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);

/** Polígono de um componente: lance = retângulo dos 2 espelhos; patamar = contorno. */
function ringOf(p: StairComponentSketch): Ring {
  if (p.kind === 'landing') return stairLandingPolygon(p.landing).polygon!;
  const [r0, r1] = p.run.risers as unknown as [{ a: Vec2; b: Vec2 }, { a: Vec2; b: Vec2 }];
  return [r0.a, r0.b, r1.b, r1.a];
}
const area = (r: Ring): number => Math.abs(ringArea(r));
const overlap = (a: Ring, b: Ring): number =>
  intersection([[a]], [[b]]).reduce((s, poly) => s + poly.reduce((t, ring, i) => t + (i === 0 ? area(ring) : -area(ring)), 0), 0);

/** Autointerseção de um anel (pares de arestas não adjacentes). */
function selfIntersects(r: Ring): boolean {
  const n = r.length;
  const cr = (a: Vec2, b: Vec2, c: Vec2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const a = r[i]!;
      const b = r[(i + 1) % n]!;
      const c = r[j]!;
      const d = r[(j + 1) % n]!;
      if (cr(a, b, c) * cr(a, b, d) < -1e-12 && cr(c, d, a) * cr(c, d, b) < -1e-12) return true;
    }
  }
  return false;
}

describe('planRampFree', () => {
  it('um trecho equivale ao planRamp reto', () => {
    const f = ok(free([v(0, 0), v(12, 0)], 1.2));
    const r = planRamp({ start: v(0, 0), dir: v(1, 0), H: 1.2, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: S });
    if ('error' in r) throw new Error(r.error);
    expect(f.flights).toBe(r.flights);
    expect(f.flightLengths).toEqual(r.flightLengths);
    expect(f.pathLength).toBeCloseTo(r.pathLength, 9);
    expect(f.parts.map((p) => p.kind)).toEqual(r.parts.map((p) => p.kind));
  });

  it('um trecho no modo length usa o comprimento do trecho', () => {
    const f = ok(free([v(0, 0), v(16, 0)], 1.2, { mode: 'length' }));
    expect(f.flights).toBe(2);
    expect(f.slope).toBeCloseTo(1.2 / 14.8, 6);
  });

  it('dois trechos a 90°: lance, patamar de giro, lance', () => {
    const f = ok(free([v(0, 0), v(7, 0), v(7, 7)], 0.8));
    expect(f.parts.map((p) => (p.kind === 'run' ? 'run' : 'landing'))).toEqual(['run', 'landing', 'run']);
    const rings = f.parts.map(ringOf);
    expect(area(rings[1]!)).toBeGreaterThanOrEqual(1.5 * 1.5 - 1e-9);
    expect(overlap(rings[0]!, rings[1]!)).toBeLessThan(1e-6);
    expect(overlap(rings[1]!, rings[2]!)).toBeLessThan(1e-6);
    expect(overlap(rings[0]!, rings[2]!)).toBeLessThan(1e-6);
    expect(sum(f.rises)).toBeCloseTo(0.8, 9);
    expect(f.slope).toBeCloseTo(S, 9);
  });

  it('exemplo 4: 5 m + 6 m, estende 0,10 m o último trecho', () => {
    const f = ok(free([v(0, 0), v(5, 0), v(5, 6)], 0.8));
    expect(f.flightLengths[0]).toBeCloseTo(4.25, 9);
    expect(f.flightLengths[1]).toBeCloseTo(5.35, 9);
    expect(f.note).toContain('estendido em 0,10 m');
    expect(sum(f.rises)).toBeCloseTo(0.8, 9);
  });

  it('trunca quando o desnível fecha antes do fim do trajeto', () => {
    const f = ok(free([v(0, 0), v(5, 0), v(5, 30)], 0.8));
    expect(sum(f.rises)).toBeCloseTo(0.8, 9);
    expect(sum(f.flightLengths)).toBeCloseTo(9.6, 6);
    expect(f.note).toContain('encurtado');
  });

  it('patamar em linha a cada desnível máximo', () => {
    const f = ok(free([v(0, 0), v(12, 0), v(12, 20)], 1.5));
    const kinds = f.parts.map((p) => (p.kind === 'run' ? 'R' : 'L')).join('');
    expect(kinds.startsWith('RL')).toBe(true);
    expect(sum(f.rises)).toBeCloseTo(1.5, 9);
    expect(Math.max(...f.rises)).toBeLessThanOrEqual(0.8 + 1e-9);
  });

  it('modo length em dois trechos: soma das elevações = H', () => {
    const f = ok(free([v(0, 0), v(6, 0), v(6, 6)], 0.8, { mode: 'length' }));
    expect(sum(f.rises)).toBeCloseTo(0.8, 9);
  });

  it('giro agudo demais devolve erro', () => {
    expect('error' in free([v(0, 0), v(8, 0), v(0.5, 0.5)], 0.8)).toBe(true);
  });

  it('trecho curto demais para o patamar devolve erro (nunca polígono ruim)', () => {
    expect('error' in free([v(0, 0), v(5, 0), v(5, 0.5), v(10, 0.5)], 0.8)).toBe(true);
  });

  it('quase colinear (2°) não vira patamar de giro e não quebra', () => {
    const a = (2 * Math.PI) / 180;
    const f = ok(free([v(0, 0), v(5, 0), v(5 + 5 * Math.cos(a), 5 * Math.sin(a))], 0.8));
    expect(f.parts.some((p) => p.kind === 'landing')).toBe(false);
    expect(sum(f.rises)).toBeCloseTo(0.8, 9);
  });

  it('vértice colinear marcado como patamar manual vira patamar', () => {
    const f = ok(free([v(0, 0), v(5, 0), v(10, 0)], 0.8, { manualLandings: [1] }));
    expect(f.parts.some((p) => p.kind === 'landing')).toBe(true);
  });

  it('pontos repetidos são ignorados; entradas inválidas dão erro', () => {
    ok(free([v(0, 0), v(0, 0.001), v(10, 0)], 0.8));
    expect('error' in free([v(0, 0)], 0.8)).toBe(true);
    expect('error' in free([v(0, 0), v(5, 0)], 0)).toBe(true);
    expect('error' in planRampFree([v(0, 0), v(5, 0)], 0.8, type, { width: 0, mode: 'slope' })).toBe(true);
  });

  it('U que volta sobre o primeiro lance é recusado; com afastamento razoável passa', () => {
    const volta = free([v(0, 0), v(10, 0), v(10, 2), v(0, 2), v(0, 0.3)], 2.2);
    expect('error' in volta && /sobrep/.test(volta.error)).toBe(true);
    ok(free([v(0, 0), v(10, 0), v(10, 4), v(0, 4)], 2.2));
  });

  it('propriedade: trajetos aleatórios nunca geram polígono autointerceptante e fecham H', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    let planos = 0;
    for (let it = 0; it < 400; it++) {
      const n = 3 + Math.floor(rnd() * 3);
      let ang = rnd() * Math.PI * 2;
      let p = v(0, 0);
      const path = [p];
      for (let k = 1; k < n; k++) {
        const l = 0.3 + rnd() * 9;
        p = v(p.x + Math.cos(ang) * l, p.y + Math.sin(ang) * l);
        path.push(p);
        const kink = rnd();
        const deg = kink < 0.15 ? 0 : kink < 0.3 ? 120 + rnd() * 55 : 10 + rnd() * 100;
        ang += ((rnd() < 0.5 ? -1 : 1) * (deg * Math.PI)) / 180;
      }
      const H = 0.2 + rnd() * 2.5;
      const r = free(path, H, { mode: rnd() < 0.5 ? 'slope' : 'length', landingDepth: rnd() < 0.5 ? undefined : 1.5 + rnd() });
      if ('error' in r) continue;
      planos++;
      expect(sum(r.rises)).toBeCloseTo(H, 6);
      expect(r.flightLengths.every((l) => l > 0)).toBe(true);
      expect(r.rises.every((x) => x > -1e-9)).toBe(true);
      const rings = r.parts.map(ringOf);
      for (const ring of rings) {
        expect(ring.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
        expect(selfIntersects(ring)).toBe(false);
      }
      r.parts.forEach((part, i) => {
        if (part.kind === 'landing' && i > 0 && i + 1 < rings.length) {
          expect(overlap(rings[i - 1]!, rings[i]!)).toBeLessThan(1e-4);
          expect(overlap(rings[i]!, rings[i + 1]!)).toBeLessThan(1e-4);
        }
      });
    }
    expect(planos).toBeGreaterThan(50);
  });
});
