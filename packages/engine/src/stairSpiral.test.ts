import { describe, expect, it } from 'vitest';
import { asMulti, intersection, multiArea, ringArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, defaultStairTypeId, makeStair, type Project, type StairRun } from '@hestia/model';
import { resolveStairs, type ResolvedStair } from './stairs.ts';
import { generateStraightRun } from './stairGenerators.ts';
import { validateRunSketch, stairRunSteps, orderRisers, type StairRunSketch } from './stairSketch.ts';
import { SAMPLE_TOL } from './stairSketchGeom.ts';
import { generateSpiralRun, spiralParamsOf, spiralStepAngle, type SpiralRunSketch } from './stairSpiral.ts';

const PI = Math.PI;
const TWO_PI = 2 * PI;
const H = 0.175;
const ORIGIN: Vec2 = { x: 0, y: 0 };
const START = 0.3;
const v = (x: number, y: number): Vec2 => ({ x, y });
const deg = (d: number): number => (d * PI) / 180;
const area = (ring: Vec2[]): number => Math.abs(ringArea(ring));
/** Ângulo (rad) de um ponto em torno da origem. */
const angOf = (p: Vec2): number => Math.atan2(p.y, p.x);
/** Normaliza um ângulo em (−π, π]. */
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const sameAngle = (a: number, b: number): boolean => Math.abs(wrap(a - b)) < 1e-6;
const centroid = (ring: Vec2[]): Vec2 => {
  const n = ring.length;
  return v(ring.reduce((s, p) => s + p.x, 0) / n, ring.reduce((s, p) => s + p.y, 0) / n);
};
/** Volta (0, 1, …) de um espelho ou degrau cujo ângulo acumulado é `k · step`, como o motor separa as voltas. */
const turnOf = (k: number, step: number): number => Math.floor((k * Math.abs(step)) / TWO_PI + 1e-9);

/** Varredura em graus (sinal = sentido) com `steps` passos entre espelhos. */
function spiral(sweepDeg: number, steps: number, sign = 1, rInner = 0.2, rOuter = 1.0): SpiralRunSketch {
  return generateSpiralRun({
    center: ORIGIN,
    rInner,
    rOuter,
    startAngle: START,
    sweep: sign * deg(sweepDeg),
    risers: steps + 1,
  });
}

/**
 * Confere o croqui gerado em geometria: N−1 degraus, cotas em passo h, espelho k no ângulo θ_k, degrau k com centro no
 * ângulo do meio entre θ_k e θ_{k+1}, áreas disjuntas dentro de cada volta e soma = área da região.
 */
function expectSpiralSteps(run: SpiralRunSketch, sweep: number, rInner: number, rOuter: number): void {
  const N = run.risers.length;
  const step = sweep / (N - 1);
  const r = stairRunSteps(run, { baseZ: 0, riserHeight: H, sweep });
  expect(r.issues).toEqual([]);
  expect(r.treads).toHaveLength(N - 1);
  expect(r.risers).toHaveLength(N);

  r.risers.forEach((rr, k) => {
    const m = v((rr.a.x + rr.b.x) / 2, (rr.a.y + rr.b.y) / 2);
    expect(sameAngle(angOf(m), START + k * step)).toBe(true);
    expect(rr.z0).toBeCloseTo(k * H, 12);
  });
  r.treads.forEach((t, k) => {
    expect(area(t.polygon)).toBeGreaterThan(0);
    expect(t.z).toBeCloseTo((k + 1) * H, 12);
    // O degrau k fica entre os espelhos k e k+1: o centro do anel deve estar no ângulo do meio (checa a volta certa da borda).
    expect(sameAngle(angOf(centroid(t.polygon)), START + (k + 0.5) * step)).toBe(true);
  });

  // Dentro de cada volta, os degraus são disjuntos.
  const turns = new Map<number, typeof r.treads>();
  r.treads.forEach((t, k) => {
    const list = turns.get(turnOf(k, step)) ?? [];
    list.push(t);
    turns.set(turnOf(k, step), list);
  });
  for (const list of turns.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        expect(multiArea(intersection(asMulti(list[i]!.polygon), asMulti(list[j]!.polygon)))).toBeLessThan(1e-9);
      }
    }
  }

  // Soma das áreas = área da região (todas as voltas), com a tolerância de amostragem da corda dos arcos.
  const tol = (2 / 3) * SAMPLE_TOL * Math.abs(sweep) * (rInner + rOuter) + 1e-9;
  const sector = (Math.abs(sweep) * (rOuter * rOuter - rInner * rInner)) / 2;
  const sum = r.treads.reduce((s, t) => s + area(t.polygon), 0);
  expect(Math.abs(sum - sector)).toBeLessThanOrEqual(tol);
  // Pegada (união): a região de uma volta, ou o anel inteiro acima de 360°.
  const oneTurn = Math.min(Math.abs(sweep), TWO_PI);
  const ring = (oneTurn * (rOuter * rOuter - rInner * rInner)) / 2;
  expect(Math.abs(multiArea(r.footprint) - ring)).toBeLessThanOrEqual(tol);
  expect(validateRunSketch(run, { sweep })).toEqual([]);
}

describe('stairSpiral: parâmetros recusados', () => {
  const base = { center: ORIGIN, rInner: 0.2, rOuter: 1.0, startAngle: 0, sweep: deg(270), risers: 10 };
  it('varredura nula, acima de 4π ou NaN', () => {
    expect(() => generateSpiralRun({ ...base, sweep: 0 })).toThrow(RangeError);
    expect(() => generateSpiralRun({ ...base, sweep: 4 * PI + 0.01 })).toThrow(RangeError);
    expect(() => generateSpiralRun({ ...base, sweep: -4 * PI - 0.01 })).toThrow(RangeError);
    expect(() => generateSpiralRun({ ...base, sweep: Number.NaN })).toThrow(RangeError);
  });
  it('raio interno abaixo de 0,05 m', () => {
    expect(() => generateSpiralRun({ ...base, rInner: 0.04 })).toThrow(RangeError);
    expect(() => generateSpiralRun({ ...base, rInner: 0 })).toThrow(RangeError);
  });
  it('raio externo não maior que o interno', () => {
    expect(() => generateSpiralRun({ ...base, rOuter: 0.2 })).toThrow(RangeError);
    expect(() => generateSpiralRun({ ...base, rOuter: 0.1 })).toThrow(RangeError);
  });
  it('menos de 2 espelhos ou nº fracionário', () => {
    expect(() => generateSpiralRun({ ...base, risers: 1 })).toThrow(RangeError);
    expect(() => generateSpiralRun({ ...base, risers: 2.5 })).toThrow(RangeError);
  });
  it('aceita a varredura de 4π exata e raio interno de 0,05 m', () => {
    expect(() => generateSpiralRun({ ...base, rInner: 0.05, sweep: 4 * PI })).not.toThrow();
  });
  it('spiralStepAngle: Δ = varredura ÷ (N−1), com sinal', () => {
    expect(spiralStepAngle(deg(540), 19)).toBeCloseTo(deg(30), 12);
    expect(spiralStepAngle(-deg(360), 13)).toBeCloseTo(-deg(30), 12);
  });
  it('spiralParamsOf devolve os parâmetros do caracol e nada para lance reto', () => {
    const run = spiral(270, 9);
    expect(spiralParamsOf(run)).toEqual({ center: ORIGIN, rInner: 0.2, rOuter: 1.0, startAngle: START, sweep: deg(270) });
    const straight = generateStraightRun({ start: v(0, 0), dir: v(1, 0), width: 1.2, risers: 4, tread: 0.28 });
    expect(spiralParamsOf(straight)).toBeUndefined();
  });
});

describe('stairSpiral: geometria por varredura e sentido (N−1 degraus, cotas, áreas por volta)', () => {
  // Um espelho a cada 30° de varredura: 90° → 3 passos ... 720° → 24 passos.
  const cases: Array<[number, number]> = [
    [90, 3],
    [180, 6],
    [270, 9],
    [360, 12],
    [540, 18],
    [720, 24],
  ];
  for (const [sweepDeg, steps] of cases) {
    for (const sign of [1, -1]) {
      const sentido = sign > 0 ? 'anti-horário' : 'horário';
      it(`${sweepDeg}° ${sentido}: ${steps} degraus, sem erro de croqui, áreas por volta`, () => {
        const run = spiral(sweepDeg, steps, sign);
        expect(run.risers).toHaveLength(steps + 1);
        expect(run.generatedBy).toBe('spiral');
        expectSpiralSteps(run, sign * deg(sweepDeg), 0.2, 1.0);
      });
    }
  }

  it('a ordem do vetor de espelhos não muda a geometria (espelhos invertidos, 720°)', () => {
    const run = spiral(720, 24, 1);
    const reversed: SpiralRunSketch = { ...run, risers: [...run.risers].reverse() };
    expectSpiralSteps(reversed, deg(720), 0.2, 1.0);
  });

  it('sem caminhada explícita (linha média dos limites), 540° e 720° também ordenam e geram degraus', () => {
    for (const [sweepDeg, steps] of [
      [540, 18],
      [720, 24],
    ] as const) {
      const run = spiral(sweepDeg, steps, -1);
      const noPath: SpiralRunSketch = { ...run, path: [] };
      expectSpiralSteps({ ...noPath }, -deg(sweepDeg), 0.2, 1.0);
    }
  });

  it('a caminhada explícita tem o 1º espelho no início e o último no fim', () => {
    const run = spiral(540, 18, 1);
    const order = orderRisers(run);
    expect(order).toHaveLength(19);
    const first = run.risers[order[0]!]!;
    const last = run.risers[order[order.length - 1]!]!;
    const mid = (c: { a: Vec2; b: Vec2 }): number => angOf(v((c.a.x + c.b.x) / 2, (c.a.y + c.b.y) / 2));
    expect(sameAngle(mid(first), START)).toBe(true);
    expect(sameAngle(mid(last), START + deg(540))).toBe(true);
  });
});

describe('stairSpiral: validação do croqui com a volta (cruzamento e mesma posição)', () => {
  for (const sweepDeg of [360, 540, 720]) {
    it(`${sweepDeg}°: croqui livre (sem o metadado spiral nem a varredura) acusa erro; com o metadado, não`, () => {
      const run = spiral(sweepDeg, sweepDeg / 30, 1);
      const free: StairRunSketch = { boundaryLeft: run.boundaryLeft, boundaryRight: run.boundaryRight, risers: run.risers, path: run.path };
      expect(validateRunSketch(free).length).toBeGreaterThan(0);
      expect(validateRunSketch(free, { sweep: deg(sweepDeg) })).toEqual([]);
      // O próprio lance carrega a varredura: os chamadores não precisam passá-la.
      expect(validateRunSketch(run)).toEqual([]);
      expect(stairRunSteps(run, { baseZ: 0, riserHeight: H }).issues).toEqual([]);
    });
  }

  it('croqui livre com cruzamento continua com erro; com varredura, o cruzamento dentro da mesma volta também', () => {
    // Espelhos A (x = 1) e B (diagonal, cruza A em x ≈ 1) são os dois primeiros na subida: mesma volta com 360°.
    const ln = (ax: number, ay: number, bx: number, by: number) => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });
    const run: StairRunSketch = {
      boundaryLeft: [ln(0, 0.6, 4, 0.6)],
      boundaryRight: [ln(0, -0.6, 4, -0.6)],
      risers: [ln(1, -1, 1, 1), ln(0.8, -1, 1.4, 1), ln(2.5, -1, 2.5, 1), ln(3.5, -1, 3.5, 1)],
      path: [],
    };
    expect(validateRunSketch(run).map((i) => i.code)).toContain('stair-riser-crossing');
    expect(validateRunSketch(run, { sweep: TWO_PI }).map((i) => i.code)).toContain('stair-riser-crossing');
  });
});

describe('stairSpiral: lance do caracol no projeto (resolveStairs)', () => {
  /** Lance do gerador como componente do modelo. O cast sai quando o model aceitar `generatedBy: 'spiral'` e `spiral`. */
  const asModelRun = (g: StairRunSketch | SpiralRunSketch, id = 'run'): StairRun => ({ id, kind: 'run', ...g }) as unknown as StairRun;

  /** Projeto com a escada `st1` de um lance, térreo em 0 m e pavimento de cima em 3 m: topo = H. */
  function projectOf(run: StairRunSketch | SpiralRunSketch, totalHeight: number, typeId = defaultStairTypeId): Project {
    const s = new ProjectStore(createEmptyProject());
    s.exec({
      type: 'addStair',
      stair: makeStair({
        id: 'st1',
        typeId,
        levelId: 'lv_0',
        topOffset: totalHeight - 3.0,
        height: totalHeight,
        components: [asModelRun(run)],
      }),
    });
    return s.project;
  }
  const only = (p: Project): ResolvedStair => {
    const list = resolveStairs(p);
    expect(list).toHaveLength(1);
    return list[0]!;
  };
  const codes = (rs: ResolvedStair): string[] => rs.issues.map((i) => i.code);
  const errors = (rs: ResolvedStair): string[] => rs.issues.filter((i) => i.severity === 'error').map((i) => i.code);

  it('540° e 720° em H = 3,0 m: sem erro, degraus com cota em passo h', () => {
    for (const [sweepDeg, steps] of [
      [540, 16],
      [720, 24],
    ] as const) {
      const run = spiral(sweepDeg, steps, 1, 0.2, 1.0);
      const N = steps + 1;
      const rs = only(projectOf(run, 3.0));
      expect(rs.riserCount).toBe(N);
      expect(rs.riserHeight).toBeCloseTo(3.0 / N, 12);
      expect(errors(rs)).toEqual([]);
      expect(rs.steps.filter((s) => s.kind === 'tread').map((s) => s.z)).toEqual(
        Array.from({ length: N - 1 }, (_, k) => (k + 1) * rs.riserHeight).map((z) => expect.closeTo(z, 9)),
      );
    }
  });

  it('a escada de caracol sempre traz o aviso fixo de saída de emergência; o lance reto não', () => {
    const rs = only(projectOf(spiral(270, 9), 1.8));
    expect(codes(rs)).toContain('stair-spiral-exit');
    const message = rs.issues.find((i) => i.code === 'stair-spiral-exit')!.message;
    expect(message).toBe('Escada caracol não serve de saída de emergência (RS: RT 11 5.7.1.2; SP: só mezanino e área privativa).');
    const straight = generateStraightRun({ start: v(0, 0), dir: v(1, 0), width: 1.2, risers: 10, tread: 0.28 });
    expect(codes(only(projectOf(straight, 1.8)))).not.toContain('stair-spiral-exit');
  });
});

/**
 * Família de referência da decisão 0014 §1 item 7: com h = 0,175 m e corda do degrau no raio da caminhada de 0,28 m,
 * T = 0,236 m (monolítico, p = 0,28). Com n espelhos por volta, a folga (decisão 0014 §1 item 7) é (n−1)·h − T:
 * 15 → 2,21 m (ok), 14 → 2,04 m (avisa), 13 → 1,86 m (avisa), 12 → 1,69 m (avisa). O mínimo é 15 espelhos por volta
 * (≈ 24° por degrau) para 2,10 m.
 */
function referenceFamily(nPerTurn: number, turns: number): { run: SpiralRunSketch; H: number } {
  const step = TWO_PI / nPerTurn;
  const rm = 0.28 / (2 * Math.sin(step / 2));
  const steps = nPerTurn * turns;
  const run = generateSpiralRun({
    center: ORIGIN,
    rInner: rm - 0.4,
    rOuter: rm + 0.4,
    startAngle: START,
    sweep: turns * TWO_PI,
    risers: steps + 1,
  });
  return { run, H: (steps + 1) * H };
}

describe('stairSpiral: avisos de norma (formato dos demais, nunca erro)', () => {
  const asModelRun = (g: SpiralRunSketch): StairRun => ({ id: 'run', kind: 'run', ...g }) as unknown as StairRun;
  function resolveOf(run: SpiralRunSketch, totalHeight: number, typeId = defaultStairTypeId): ResolvedStair {
    const s = new ProjectStore(createEmptyProject());
    s.exec({
      type: 'addStair',
      stair: makeStair({ id: 'st1', typeId, levelId: 'lv_0', topOffset: totalHeight - 3.0, height: totalHeight, components: [asModelRun(run)] }),
    });
    const list = resolveStairs(s.project);
    expect(list).toHaveLength(1);
    return list[0]!;
  }
  const warnings = (rs: ResolvedStair, code: string) => rs.issues.filter((i) => i.code === code);

  it('folga entre voltas: 15 espelhos por volta (2,21 m) não avisa; 14 (2,04 m), 13 (1,86 m) e 12 (1,69 m) avisam', () => {
    const ok = referenceFamily(15, 2);
    expect(warnings(resolveOf(ok.run, ok.H), 'stair-spiral-headroom')).toEqual([]);
    const n14 = referenceFamily(14, 2);
    const w14 = warnings(resolveOf(n14.run, n14.H), 'stair-spiral-headroom');
    expect(w14).toHaveLength(1);
    expect(w14[0]!.severity).toBe('warning');
    expect(w14[0]!.message).toBe(
      'A folga entre voltas (2,04 m) é menor que o mínimo (2,10 m): aumente o nº de espelhos por volta, o pé-direito ou a profundidade livre.',
    );
    const n13 = referenceFamily(13, 2);
    expect(warnings(resolveOf(n13.run, n13.H), 'stair-spiral-headroom')[0]!.message).toContain('(1,86 m)');
    const n12 = referenceFamily(12, 2);
    expect(warnings(resolveOf(n12.run, n12.H), 'stair-spiral-headroom')[0]!.message).toContain('(1,69 m)');
  });

  it('a folga usa a espessura do degrau (treadThickness) no estilo montado: 13 espelhos → 12 × 0,175 − 0,03 = 2,07 m', () => {
    const { run, H: total } = referenceFamily(13, 2);
    const w = warnings(resolveOf(run, total, 'stt_piso_espelho'), 'stair-spiral-headroom');
    expect(w).toHaveLength(1);
    expect(w[0]!.message).toContain('(2,07 m)');
  });

  it('sem voltas além de 360° não há folga entre voltas', () => {
    const { run, H: total } = referenceFamily(12, 1);
    expect(warnings(resolveOf(run, total), 'stair-spiral-headroom')).toEqual([]);
  });

  it('piso a 0,55 m da borda interna abaixo de 0,28 m (aviso); com 12 espelhos por volta, não', () => {
    // rInner 0,10 m, 16 espelhos por volta (22,5°): corda a 0,65 m = 0,254 m → aviso.
    const tight = generateSpiralRun({ center: ORIGIN, rInner: 0.1, rOuter: 1.0, startAngle: START, sweep: TWO_PI, risers: 17 });
    const w = warnings(resolveOf(tight, 17 * H), 'stair-spiral-tread');
    expect(w).toHaveLength(1);
    expect(w[0]!.message).toContain('0,55 m da borda interna (0,25 m)');
    // 12 por volta (30°): corda a 0,65 m = 0,336 m → sem aviso.
    const ok = generateSpiralRun({ center: ORIGIN, rInner: 0.1, rOuter: 1.0, startAngle: START, sweep: TWO_PI, risers: 13 });
    expect(warnings(resolveOf(ok, 13 * H), 'stair-spiral-tread')).toEqual([]);
  });

  it('piso na borda estreita abaixo de 0,07 m (informativo); com rInner 0,20 m, não', () => {
    const narrow = generateSpiralRun({ center: ORIGIN, rInner: 0.1, rOuter: 1.0, startAngle: START, sweep: TWO_PI, risers: 13 });
    const w = warnings(resolveOf(narrow, 13 * H), 'stair-spiral-narrow');
    expect(w).toHaveLength(1);
    expect(w[0]!.severity).toBe('warning');
    const wide = generateSpiralRun({ center: ORIGIN, rInner: 0.2, rOuter: 1.0, startAngle: START, sweep: TWO_PI, risers: 13 });
    expect(warnings(resolveOf(wide, 13 * H), 'stair-spiral-narrow')).toEqual([]);
  });
});
