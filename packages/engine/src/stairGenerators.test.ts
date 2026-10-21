import { describe, expect, it } from 'vitest';
import { closestOnSegment, dist, multiArea, ringArea, type Vec2 } from '@hestia/geom';
import { polyDist } from './stairSketchGeom.ts';
import {
  sampleChain,
  stairLandingPolygon,
  stairRunSteps,
  type StairLandingSketch,
  type StairRunSketch,
} from './stairSketch.ts';
import {
  generateFanRun,
  generateLShape,
  generateStraightRun,
  generateUShape,
  generateWinderL,
  riserCountFor,
  treadFor,
  type StairComponentSketch,
} from './stairGenerators.ts';

const H = 0.175;
const v = (x: number, y: number): Vec2 => ({ x, y });
const areaOf = (ring: Vec2[]): number => Math.abs(ringArea(ring));
const PI = Math.PI;

/** Gerador determinístico (mulberry32): mesma semente, mesmos casos em qualquer execução. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Passa o lance pelo gerador de degraus e exige croqui válido: N−1 degraus, sem erro. */
function clean(run: StairRunSketch, baseZ = 0) {
  const r = stairRunSteps(run, { baseZ, riserHeight: H });
  expect(r.issues).toEqual([]);
  expect(r.treads).toHaveLength(run.risers.length - 1);
  expect(r.risers).toHaveLength(run.risers.length);
  return r;
}

/** Soma das áreas dos degraus = área da união: degraus disjuntos (a menos de erro numérico). */
function expectDisjoint(treads: Array<{ polygon: Vec2[] }>, footprintArea: number): void {
  const sum = treads.reduce((s, t) => s + areaOf(t.polygon), 0);
  expect(footprintArea).toBeCloseTo(sum, 6);
}

function distToRing(p: Vec2, ring: Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    best = Math.min(best, dist(p, closestOnSegment(p, a, b)));
  }
  return best;
}

/** Componentes separados em lances e patamares, na ordem. */
function parts(comps: StairComponentSketch[]): { runs: StairRunSketch[]; landings: StairLandingSketch[] } {
  const runs: StairRunSketch[] = [];
  const landings: StairLandingSketch[] = [];
  for (const c of comps) {
    if (c.kind === 'run') runs.push(c.run);
    else landings.push(c.landing);
  }
  return { runs, landings };
}

const ringOf = (landing: StairLandingSketch): Vec2[] => {
  const res = stairLandingPolygon(landing);
  expect(res.issues).toEqual([]);
  expect(res.polygon).not.toBeNull();
  return res.polygon!;
};

describe('riserCountFor e treadFor', () => {
  it('nº de espelhos é o teto de H ÷ espelho máximo, com borda exata e mínimo 1', () => {
    expect(riserCountFor(2.8, 0.18)).toBe(16);
    expect(riserCountFor(3.0, 0.18)).toBe(17);
    expect(riserCountFor(0.36, 0.18)).toBe(2);
    expect(riserCountFor(1.1, 0.1)).toBe(11);
    expect(riserCountFor(0, 0.18)).toBe(1);
    expect(riserCountFor(0.05, 0.18)).toBe(1);
  });

  it('piso calculado 0,63 − 2h, limitado entre o piso mínimo e 0,32', () => {
    expect(treadFor(0.175, 0.28)).toBeCloseTo(0.28, 12);
    expect(treadFor(0.15, 0.28)).toBeCloseTo(0.32, 12);
    expect(treadFor(0.165, 0.28)).toBeCloseTo(0.30, 12);
    expect(treadFor(0.2, 0.28)).toBeCloseTo(0.28, 12);
  });

  it('valores inválidos são recusados', () => {
    expect(() => riserCountFor(2.8, 0)).toThrow(RangeError);
    expect(() => riserCountFor(-1, 0.18)).toThrow(RangeError);
  });
});

describe('lance reto', () => {
  it('N espelhos dão N−1 degraus, z = h·k, áreas = largura × piso e degraus disjuntos', () => {
    const run = generateStraightRun({ start: v(0, 0), dir: v(1, 0), width: 1.0, risers: 8, tread: 0.28 });
    const r = clean(run);
    r.treads.forEach((t, k) => {
      expect(t.z).toBeCloseTo(H * (k + 1), 12);
      expect(areaOf(t.polygon)).toBeCloseTo(1.0 * 0.28, 12);
    });
    expectDisjoint(r.treads, multiArea(r.footprint));
    expect(multiArea(r.footprint)).toBeCloseTo(7 * 0.28, 9);
  });

  it('justify center põe o ponto médio do 1º espelho em start', () => {
    const run = generateStraightRun({ start: v(2, 3), dir: v(0, 1), width: 1.2, risers: 4, tread: 0.3 });
    const r = clean(run);
    const a = r.risers[0]!;
    expect((a.a.x + a.b.x) / 2).toBeCloseTo(2, 9);
    expect((a.a.y + a.b.y) / 2).toBeCloseTo(3, 9);
  });

  it('justify left e right põem o extremo do 1º espelho em start, na borda certa', () => {
    const left = clean(generateStraightRun({ start: v(0, 0), dir: v(1, 0), width: 1, risers: 3, tread: 0.3, justify: 'left' }));
    const right = clean(generateStraightRun({ start: v(0, 0), dir: v(1, 0), width: 1, risers: 3, tread: 0.3, justify: 'right' }));
    const near = (r: ReturnType<typeof clean>, p: Vec2): number =>
      Math.min(...r.risers[0]!.points.map((q) => dist(q, p)));
    // Esquerda de quem sobe (+y para dir = +x) é o limite em y = w; o extremo esquerdo fica em start.
    expect(near(left, v(0, 0))).toBeLessThan(1e-9);
    expect(near(left, v(0, 1))).toBeCloseTo(1, 9);
    expect(near(right, v(0, 0))).toBeLessThan(1e-9);
    expect(near(right, v(0, -1))).toBeCloseTo(1, 9);
  });

  it('caminhada vazia e espelhos ordenados do 1º ao último', () => {
    const run = generateStraightRun({ start: v(0, 0), dir: v(1, 0), width: 1, risers: 5, tread: 0.25 });
    expect(run.path).toEqual([]);
    const r = clean(run);
    expect(r.risers.map((x) => x.index)).toEqual([1, 2, 3, 4, 5]);
    const mids = r.risers.map((x) => (x.a.x + x.b.x) / 2);
    mids.forEach((m, k) => expect(m).toBeCloseTo(k * 0.25, 9));
  });

  it('recusa largura, piso ou nº de espelhos inválidos', () => {
    expect(() => generateStraightRun({ start: v(0, 0), dir: v(1, 0), width: 0, risers: 3, tread: 0.3 })).toThrow(RangeError);
    expect(() => generateStraightRun({ start: v(0, 0), dir: v(1, 0), width: 1, risers: 1, tread: 0.3 })).toThrow(RangeError);
    expect(() => generateStraightRun({ start: v(0, 0), dir: v(1, 0), width: 1, risers: 3, tread: 0 })).toThrow(RangeError);
  });
});

describe('escada em L', () => {
  for (const turn of ['left', 'right'] as const) {
    for (const dir of [v(1, 0), v(0, -1)]) {
      it(`giro ${turn} com dir (${dir.x}, ${dir.y}): patamar encosta nos dois lances e é fechado`, () => {
        const w = 1.0;
        const comps = generateLShape({ start: v(0, 0), dir, width: w, risersFirst: 8, risersSecond: 6, tread: 0.28, turn });
        expect(comps.map((c) => c.kind)).toEqual(['run', 'landing', 'run']);
        const { runs, landings } = parts(comps);
        const [r1, r2] = runs as [StairRunSketch, StairRunSketch];
        const ring = ringOf(landings[0]!);
        expect(areaOf(ring)).toBeCloseTo(w * w, 9);

        const s1 = clean(r1, 0);
        const s2 = clean(r2, 8 * H);
        expect(s2.treads[0]!.z).toBeCloseTo(9 * H, 12);
        expectDisjoint(s1.treads, multiArea(s1.footprint));
        expectDisjoint(s2.treads, multiArea(s2.footprint));

        const last1 = s1.risers[s1.risers.length - 1]!;
        const first2 = s2.risers[0]!;
        for (const p of [last1.a, last1.b]) expect(distToRing(p, ring)).toBeLessThan(1e-9);
        for (const p of [first2.a, first2.b]) expect(distToRing(p, ring)).toBeLessThan(1e-9);
      });
    }
  }

  it('patamar com profundidade maior que a largura: área w × D e o 2º lance continua encostado', () => {
    const comps = generateLShape({ start: v(0, 0), dir: v(1, 0), width: 1.0, risersFirst: 4, risersSecond: 4, tread: 0.28, turn: 'left', landingDepth: 1.5 });
    const { runs, landings } = parts(comps);
    expect(areaOf(ringOf(landings[0]!))).toBeCloseTo(1.5, 9);
    const s2 = clean(runs[1]!, 4 * H);
    const ring = ringOf(landings[0]!);
    for (const p of [s2.risers[0]!.a, s2.risers[0]!.b]) expect(distToRing(p, ring)).toBeLessThan(1e-9);
  });

  it('patamar menor que a largura é recusado', () => {
    expect(() =>
      generateLShape({ start: v(0, 0), dir: v(1, 0), width: 1.0, risersFirst: 4, risersSecond: 4, tread: 0.28, turn: 'left', landingDepth: 0.8 }),
    ).toThrow(RangeError);
  });
});

describe('escada em U', () => {
  for (const turn of ['left', 'right'] as const) {
    it(`giro ${turn}: vão de 0,10 m entre os lances, patamar 2·w + vão e encostado`, () => {
      const w = 1.0;
      const gap = 0.1;
      const comps = generateUShape({ start: v(0, 0), dir: v(1, 0), width: w, risersFirst: 7, risersSecond: 7, tread: 0.28, turn });
      const { runs, landings } = parts(comps);
      const [r1, r2] = runs as [StairRunSketch, StairRunSketch];
      const ring = ringOf(landings[0]!);
      expect(areaOf(ring)).toBeCloseTo((2 * w + gap) * w, 9);

      const s1 = clean(r1, 0);
      const s2 = clean(r2, 7 * H);
      expect(s2.treads[0]!.z).toBeCloseTo(8 * H, 12);
      for (const p of [s1.risers[6]!.a, s1.risers[6]!.b, s2.risers[0]!.a, s2.risers[0]!.b]) {
        expect(distToRing(p, ring)).toBeLessThan(1e-9);
      }

      // Distância mínima entre os limites dos dois lances é o vão.
      const sides1 = [r1.boundaryLeft, r1.boundaryRight].map(sampleChain);
      const sides2 = [r2.boundaryLeft, r2.boundaryRight].map(sampleChain);
      const between = Math.min(...sides1.flatMap((a) => sides2.map((b) => polyDist(a, b))));
      expect(between).toBeCloseTo(gap, 9);
    });
  }
});

describe('leque (escada curva e winder)', () => {
  it('área de cada degrau = ½·Δθ_degrau·(r2² − r1²) e soma = setor anular', () => {
    const r1 = 1.0;
    const r2 = 2.0;
    const N = 4;
    const run = generateFanRun({ center: v(0, 0), innerRadius: r1, outerRadius: r2, startAngle: 0, endAngle: PI / 2, risers: N });
    const r = clean(run);
    const perTread = 0.5 * (PI / 2 / (N - 1)) * (r2 * r2 - r1 * r1);
    for (const t of r.treads) expect(Math.abs(areaOf(t.polygon) - perTread) / perTread).toBeLessThan(1e-3);
    const sector = 0.5 * (PI / 2) * (r2 * r2 - r1 * r1);
    expect(Math.abs(multiArea(r.footprint) - sector) / sector).toBeLessThan(1e-3);
    expectDisjoint(r.treads, multiArea(r.footprint));
  });

  it('o 1º espelho é o do ângulo inicial, e o sentido horário também sai certo', () => {
    const ccw = clean(generateFanRun({ center: v(0, 0), innerRadius: 1, outerRadius: 2, startAngle: 0, endAngle: PI / 2, risers: 3 }));
    const m0 = ccw.risers[0]!;
    expect((m0.a.x + m0.b.x) / 2).toBeCloseTo(1.5, 6);
    expect((m0.a.y + m0.b.y) / 2).toBeCloseTo(0, 6);

    const cw = clean(generateFanRun({ center: v(0, 0), innerRadius: 1, outerRadius: 2, startAngle: 0, endAngle: -PI / 2, risers: 3 }));
    const sum = cw.treads.reduce((s, t) => s + areaOf(t.polygon), 0);
    expect(sum / (0.5 * (PI / 2) * 3)).toBeCloseTo(1, 3);
    const first = cw.risers[0]!;
    expect((first.a.x + first.b.x) / 2).toBeCloseTo(1.5, 6);
    expect((first.a.y + first.b.y) / 2).toBeCloseTo(0, 6);
  });

  it('arco acima de 90° é dividido em trechos e continua válido', () => {
    const run = generateFanRun({ center: v(0, 0), innerRadius: 1, outerRadius: 2, startAngle: 0, endAngle: 1.5 * PI, risers: 6 });
    const r = clean(run);
    const sector = 0.5 * 1.5 * PI * 3;
    expect(Math.abs(multiArea(r.footprint) - sector) / sector).toBeLessThan(1e-3);
  });

  it('raios e ângulos inválidos são recusados', () => {
    expect(() => generateFanRun({ center: v(0, 0), innerRadius: 2, outerRadius: 1, startAngle: 0, endAngle: 1, risers: 3 })).toThrow(RangeError);
    expect(() => generateFanRun({ center: v(0, 0), innerRadius: 1, outerRadius: 2, startAngle: 0, endAngle: 0, risers: 3 })).toThrow(RangeError);
  });
});

describe('winder de 90°', () => {
  for (const turn of ['left', 'right'] as const) {
    it(`giro ${turn}: três componentes sem patamar; espelhos de emenda coincidem e cotas batem`, () => {
      const w = 1.0;
      const tread = 0.28;
      const comps = generateWinderL({ start: v(0, 0), dir: v(1, 0), width: w, risersFirst: 5, risersSecond: 4, tread, turn });
      expect(comps.map((c) => c.kind)).toEqual(['run', 'run', 'run']);
      const [r1, fan, r2] = parts(comps).runs as [StairRunSketch, StairRunSketch, StairRunSketch];

      const s1 = clean(r1, 0);
      const sf = clean(fan, 4 * H);
      const s2 = clean(r2, (5 + 3 - 2) * H);
      expect(sf.treads).toHaveLength(2);
      expect(s2.treads[0]!.z).toBeCloseTo((5 + 3 - 1) * H, 12);

      // Último espelho do 1º lance = 1º espelho do leque; último do leque = 1º do 2º lance.
      const samePair = (p: { a: Vec2; b: Vec2 }, q: { a: Vec2; b: Vec2 }): boolean =>
        (dist(p.a, q.a) < 1e-9 && dist(p.b, q.b) < 1e-9) || (dist(p.a, q.b) < 1e-9 && dist(p.b, q.a) < 1e-9);
      expect(samePair(s1.risers[s1.risers.length - 1]!, sf.risers[0]!)).toBe(true);
      expect(samePair(sf.risers[sf.risers.length - 1]!, s2.risers[0]!)).toBe(true);

      // Leque: piso na borda interna = tread, setor de 90°.
      const r1Inner = (tread * 2) / (PI / 2);
      const r2Outer = r1Inner + w;
      const sector = 0.5 * (PI / 2) * (r2Outer * r2Outer - r1Inner * r1Inner);
      expect(Math.abs(multiArea(sf.footprint) - sector) / sector).toBeLessThan(1e-3);
    });
  }
});

describe('propriedades (mulberry32, 200 casos)', () => {
  it('lances retos: sempre válidos, áreas = largura × piso, disjuntos', () => {
    const rnd = mulberry32(20261021);
    const justifies = ['center', 'left', 'right'] as const;
    for (let k = 0; k < 200; k++) {
      const ang = rnd() * 2 * PI;
      const width = 0.8 + rnd() * 0.7;
      const tread = 0.25 + rnd() * 0.07;
      const risers = 2 + Math.floor(rnd() * 14);
      const run = generateStraightRun({
        start: v(rnd() * 10 - 5, rnd() * 10 - 5),
        dir: v(Math.cos(ang), Math.sin(ang)),
        width,
        risers,
        tread,
        justify: justifies[Math.floor(rnd() * 3)]!,
      });
      const r = clean(run);
      for (const t of r.treads) expect(areaOf(t.polygon)).toBeCloseTo(width * tread, 9);
      expectDisjoint(r.treads, multiArea(r.footprint));
    }
  });

  it('leques: sempre válidos, áreas batem com ½·Δθ·(r2² − r1²) e disjuntos', () => {
    const rnd = mulberry32(7);
    for (let k = 0; k < 200; k++) {
      const r1 = 0.5 + rnd() * 1.0;
      const width = 0.8 + rnd() * 0.5;
      const r2 = r1 + width;
      const risers = 2 + Math.floor(rnd() * 7);
      const sweep = (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd() * 2.2);
      const a0 = rnd() * 2 * PI;
      const run = generateFanRun({
        center: v(rnd() * 4 - 2, rnd() * 4 - 2),
        innerRadius: r1,
        outerRadius: r2,
        startAngle: a0,
        endAngle: a0 + sweep,
        risers,
      });
      const r = clean(run);
      const perTread = 0.5 * (Math.abs(sweep) / (risers - 1)) * (r2 * r2 - r1 * r1);
      for (const t of r.treads) expect(Math.abs(areaOf(t.polygon) - perTread) / perTread).toBeLessThan(2e-3);
      const sector = 0.5 * Math.abs(sweep) * (r2 * r2 - r1 * r1);
      expect(Math.abs(multiArea(r.footprint) - sector) / sector).toBeLessThan(2e-3);
    }
  });
});
