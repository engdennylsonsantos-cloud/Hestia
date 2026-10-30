import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { DEFAULT_STAIR_TYPES } from '@hestia/model';
import { fitSegment, optimizeStair, planStairFree, turnRecuo } from './stairFree.ts';
import { layoutStairSegment, liveStairRemaining, stairLiveParams } from './stairLive.ts';

const mono = DEFAULT_STAIR_TYPES.find((t) => t.id === 'stt_monolitica')!;

/** Zigue-zague de `n` vértices com giros alternados de 90°. */
function zigzag(n: number, len: number): Vec2[] {
  const pts: Vec2[] = [{ x: 0, y: 0 }];
  for (let i = 1; i < n; i++) {
    const q = pts[i - 1]!;
    pts.push(i % 2 === 1 ? { x: q.x + len, y: q.y } : { x: q.x, y: q.y + len });
  }
  return pts;
}
/** Espiral aberta de raio crescente, sem sobreposição. */
function spiral(n: number): Vec2[] {
  return Array.from({ length: n }, (_, i) => ({ x: (2 + i * 0.4) * Math.cos(i * 0.5), y: (2 + i * 0.4) * Math.sin(i * 0.5) }));
}
const mediana = (xs: number[]): number => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

describe('desempenho do motor da escada livre', () => {
  it('layout ao vivo de 40 vértices (fit + layout + restante por trecho) em < 2 ms', () => {
    const p = stairLiveParams(10, mono, { width: 1.2 });
    if ('error' in p) throw new Error(p.error);
    const n = 40;
    const recuo = turnRecuo(Math.PI / 2, 1.2, 1.2);
    const ciclo = (): number => {
      let antes = 0;
      let falta = 0;
      for (let k = 0; k + 1 < n; k++) {
        const f = fitSegment(2.4, p.tread, k > 0 ? recuo : null, k + 2 < n ? recuo : null);
        const lay = layoutStairSegment(f.span, p, p.risers - antes);
        antes += lay.risers;
        falta = liveStairRemaining({ params: p, span: f.span, risersBefore: antes }).falta;
      }
      return falta;
    };
    ciclo();
    const t0 = performance.now();
    const reps = 500;
    for (let i = 0; i < reps; i++) ciclo();
    const media = (performance.now() - t0) / reps;
    expect(media).toBeLessThan(2);
  });

  it('planStairFree com 12 vértices e N ≈ 40 em < 50 ms (mediana de 20)', () => {
    const path = zigzag(12, 3);
    const run = (): number => {
      const r = planStairFree(path, 7.1, mono, { width: 1 });
      if ('error' in r) throw new Error(r.error);
      return r.risers;
    };
    expect(run()).toBe(40); // 7,1 ÷ 0,18 → 40
    const ts: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      run();
      ts.push(performance.now() - t0);
    }
    expect(mediana(ts)).toBeLessThan(50);
  });

  it('optimizeStair com 10 vértices em < 400 ms', () => {
    const t0 = performance.now();
    const r = optimizeStair({ path: spiral(10), H: 4.5, type: mono, width: 1 });
    const dt = performance.now() - t0;
    if ('error' in r) throw new Error(r.error);
    expect(dt).toBeLessThan(400);
  });
});
