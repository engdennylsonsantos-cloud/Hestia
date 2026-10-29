import { describe, expect, it } from 'vitest';
import { add, dist, mid, mul, type Vec2 } from '@hestia/geom';
import { DEFAULT_RAMP_TYPES, makeRamp, type Ramp, type StairLanding, type StairRun } from '@hestia/model';
import { planRamp, rampBasis, type RampPlan } from './rampPlan.ts';

const type = DEFAULT_RAMP_TYPES.find((t) => t.id === 'rmt_nbr9050')!;
const v = (x: number, y: number): Vec2 => ({ x, y });
const plan = (extra: Partial<Parameters<typeof planRamp>[0]>) => planRamp({ start: v(0, 0), dir: v(1, 0), H: 0.8, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12, ...extra });
const ok = (r: ReturnType<typeof planRamp>): RampPlan => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

/** Comprimento horizontal do lance: distância entre os pontos médios dos 2 espelhos. */
const runLength = (run: StairRun): number => dist(mid(run.risers[0]!.a, run.risers[0]!.b), mid(run.risers[1]!.a, run.risers[1]!.b));

describe('planRamp — exemplos da tabela', () => {
  it('1: reta, modo slope, H=0,80, 1/12', () => {
    const p = ok(plan({}));
    expect(p.flights).toBe(1);
    expect(p.flightLengths).toEqual([expect.closeTo(9.6, 6)]);
    expect(p.rises).toEqual([expect.closeTo(0.8, 6)]);
    expect(p.pathLength).toBeCloseTo(9.6, 6);
    expect(p.slope).toBeCloseTo(1 / 12, 6);
  });

  it('2: reta, modo slope, H=1,20, 1/12 → 2 lances', () => {
    const p = ok(plan({ H: 1.2 }));
    expect(p.flights).toBe(2);
    expect(p.flightLengths).toEqual([expect.closeTo(7.2, 6), expect.closeTo(7.2, 6)]);
    expect(p.rises).toEqual([expect.closeTo(0.6, 6), expect.closeTo(0.6, 6)]);
    expect(p.landingDepth).toBeCloseTo(1.2, 6);
    expect(p.pathLength).toBeCloseTo(15.6, 6);
  });

  it('3: reta, modo slope, H=3,00, 5 %', () => {
    const p = ok(plan({ H: 3, slope: 0.05 }));
    expect(p.flights).toBe(2);
    expect(p.flightLengths).toEqual([expect.closeTo(30, 6), expect.closeTo(30, 6)]);
    expect(p.pathLength).toBeCloseTo(61.2, 6);
  });

  it('4: reta, modo length, H=1,20, Dc=16 → 2 lances', () => {
    const p = ok(plan({ H: 1.2, mode: 'length', length: 16 }));
    expect(p.flights).toBe(2);
    expect(p.flightLengths).toEqual([expect.closeTo(7.4, 6), expect.closeTo(7.4, 6)]);
    expect(p.slope).toBeCloseTo(0.08108108, 6);
  });

  it('5: reta, modo length, H=0,80, Dc=8 → 1 lance de 10 %', () => {
    const p = ok(plan({ mode: 'length', length: 8 }));
    expect(p.flights).toBe(1);
    expect(p.flightLengths).toEqual([expect.closeTo(8, 6)]);
    expect(p.slope).toBeCloseTo(0.1, 6);
  });

  it('6: L, modo slope, H=1,20, 1/12, D padrão=1,50', () => {
    const p = ok(plan({ H: 1.2, shape: 'lshape' }));
    expect(p.flights).toBe(2);
    expect(p.flightLengths).toEqual([expect.closeTo(7.2, 6), expect.closeTo(7.2, 6)]);
    expect(p.landingDepth).toBeCloseTo(1.5, 6);
    expect(p.pathLength).toBeCloseTo(15.9, 6);
  });

  it('7: erros de entrada', () => {
    expect(plan({ H: 0 })).toEqual({ error: 'O desnível deve ser positivo: nada a gerar.' });
    expect(plan({ width: 0 })).toEqual({ error: 'A largura da rampa deve ser positiva.' });
    expect(plan({ slope: 0 })).toEqual({ error: 'A inclinação deve ser maior que zero.' });
    expect(plan({ mode: 'length', length: 0 })).toEqual({ error: 'O comprimento deve ser positivo.' });
  });
});

describe('planRamp — casos extras', () => {
  it('reta com 3 lances: H=2,40, 1/12', () => {
    const p = ok(plan({ H: 2.4 }));
    expect(p.flights).toBe(3);
    expect(p.flightLengths.map((x) => +x.toFixed(6))).toEqual([9.6, 9.6, 9.6]);
    expect(p.pathLength).toBeCloseTo(31.2, 6);
  });

  it('L: 3 componentes (lance, patamar, lance) com 2 espelhos e 7,20 m cada', () => {
    const p = ok(plan({ H: 1.2, shape: 'lshape' }));
    expect(p.parts.map((x) => x.kind)).toEqual(['run', 'landing', 'run']);
    const runs = p.parts.filter((x) => x.kind === 'run').map((x) => x.run);
    expect(runs).toHaveLength(2);
    for (const run of runs) {
      expect(run.risers).toHaveLength(2);
      expect(runLength(run)).toBeCloseTo(7.2, 6);
    }
  });

  it('U: 2º lance em sentido oposto', () => {
    const p = ok(plan({ H: 1.2, shape: 'ushape' }));
    expect(p.parts.map((x) => x.kind)).toEqual(['run', 'landing', 'run']);
    const runs = p.parts.filter((x) => x.kind === 'run').map((x) => x.run);
    for (const run of runs) expect(run.risers).toHaveLength(2);
    const dirOf = (run: StairRun): Vec2 => {
      const a = mid(run.risers[0]!.a, run.risers[0]!.b);
      const b = mid(run.risers[1]!.a, run.risers[1]!.b);
      return mul({ x: b.x - a.x, y: b.y - a.y }, 1 / Math.max(1e-12, Math.hypot(b.x - a.x, b.y - a.y)));
    };
    const ax = dirOf(runs[0]!);
    const bx = dirOf(runs[1]!);
    expect(ax.x * bx.x + ax.y * bx.y).toBeCloseTo(-1, 6);
  });

  it('L com patamar menor que a largura dá erro', () => {
    expect(plan({ shape: 'lshape', landingDepth: 1 })).toEqual({ error: 'O patamar da rampa em L deve ter profundidade ≥ largura do lance.' });
  });
});

describe('rampBasis', () => {
  const asRamp = (p: RampPlan): Ramp =>
    makeRamp({
      id: 'rp',
      typeId: type.id,
      levelId: 'lv_0',
      components: p.parts.map((x, idx): StairRun | StairLanding =>
        x.kind === 'run' ? { id: `c${idx}`, kind: 'run', ...x.run } : { id: `c${idx}`, kind: 'landing', ...x.landing },
      ),
    }) as Ramp;

  it('lê início, direção e largura do 1º lance', () => {
    const p = ok(plan({ start: v(2, 3), dir: v(0, 1) }));
    const b = rampBasis(asRamp(p));
    expect(b).not.toBeNull();
    expect(b!.start.x).toBeCloseTo(2, 6);
    expect(b!.start.y).toBeCloseTo(3, 6);
    expect(b!.dir.x).toBeCloseTo(0, 6);
    expect(b!.dir.y).toBeCloseTo(1, 6);
    expect(b!.width).toBeCloseTo(1.5, 6);
  });

  it('null sem lance de 2 espelhos', () => {
    const p = ok(plan({}));
    const ramp = asRamp(p);
    const run = ramp.components[0] as StairRun;
    expect(rampBasis({ ...ramp, components: [{ ...run, risers: [run.risers[0]!] }] })).toBeNull();
  });

  it('a base regenera o mesmo eixo', () => {
    const p = ok(plan({ start: v(5, -2), dir: v(1, 1), H: 1.2 }));
    const b = rampBasis(asRamp(p))!;
    const again = ok(planRamp({ start: b.start, dir: b.dir, H: 1.2, type, shape: 'straight', turn: 'left', width: b.width, mode: 'slope', slope: 1 / 12 }));
    const run = again.parts[0]!.kind === 'run' ? again.parts[0]!.run : null;
    expect(run).not.toBeNull();
    expect(run!.risers).toHaveLength(2);
    const start = mid(run!.risers[0]!.a, run!.risers[0]!.b);
    expect(dist(start, add(b.start, v(0, 0)))).toBeCloseTo(0, 6);
  });
});
