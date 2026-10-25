import { describe, expect, it } from 'vitest';
import { asMulti, intersection, multiArea, ringArea, type Vec2 } from '@hestia/geom';
import { generateFanRun } from './stairGenerators.ts';
import { SAMPLE_TOL } from './stairSketchGeom.ts';
import {
  autoPath,
  distributeRisers,
  orderRisers,
  sampleChain,
  sampleCurve,
  stairLandingPolygon,
  stairRunSteps,
  trimRisers,
  validateRunSketch,
  type StairCurve,
  type StairRunSketch,
} from './stairSketch.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });
const arc = (ax: number, ay: number, bx: number, by: number, sag: number): StairCurve => ({
  a: v(ax, ay),
  b: v(bx, by),
  sag,
});

/** Lance reto horizontal (sentido +x), limites em y = ±w/2 e espelhos verticais em `xs`. */
function straightRun(w: number, xs: number[], x0 = -0.5, x1 = 5): StairRunSketch {
  return {
    boundaryLeft: [ln(x0, w / 2, x1, w / 2)],
    boundaryRight: [ln(x0, -w / 2, x1, -w / 2)],
    risers: xs.map((x) => ln(x, -1, x, 1)),
    path: [],
  };
}

const codes = (issues: Array<{ code: string }>): string[] => issues.map((i) => i.code);

/** Gerador determinístico (mulberry32): mesma semente, mesmos casos em qualquer execução. */
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

const area = (ring: Vec2[]): number => Math.abs(ringArea(ring));

describe('amostragem', () => {
  it('reta vira dois pontos; arco tem extremidades exatas e flecha ≤ 0,3 mm', () => {
    expect(sampleCurve(ln(0, 0, 2, 0))).toEqual([v(0, 0), v(2, 0)]);
    const c = arc(0, 0, 2, 0, 0.2);
    const pts = sampleCurve(c);
    expect(pts[0]).toEqual(v(0, 0));
    expect(pts[pts.length - 1]).toEqual(v(2, 0));
    // Corda de um arco de raio R e meia-corda 1: a flecha de cada corda deve ficar abaixo de 0,3 mm.
    const R = (1 + 0.2 * 0.2) / (2 * 0.2);
    const C = v(1, 0.2 - R);
    for (let i = 0; i + 1 < pts.length; i++) {
      const m = v((pts[i]!.x + pts[i + 1]!.x) / 2, (pts[i]!.y + pts[i + 1]!.y) / 2);
      expect(R - Math.hypot(m.x - C.x, m.y - C.y)).toBeLessThanOrEqual(0.0003 + 1e-9);
    }
  });

  it('cadeia sem pontos repetidos nas emendas', () => {
    expect(sampleChain([ln(0, 0, 1, 0), ln(1, 0, 2, 0)])).toEqual([v(0, 0), v(1, 0), v(2, 0)]);
    expect(sampleChain([ln(0, 0, 1, 0), ln(1, 0, 1, 0), ln(1, 0, 2, 0)])).toHaveLength(3);
  });
});

describe('degraus', () => {
  it('(1) lance reto 1,20 m, 17 espelhos a cada 0,28 m: 16 degraus 1,20×0,28, z = 0,175·k', () => {
    const xs = Array.from({ length: 17 }, (_, k) => k * 0.28);
    const run = straightRun(1.2, xs);
    const r = stairRunSteps(run, { baseZ: 0, riserHeight: 0.175 });
    expect(r.issues).toEqual([]);
    expect(r.treads).toHaveLength(16);
    r.treads.forEach((t, k) => {
      expect(t.index).toBe(k + 1);
      expect(t.z).toBeCloseTo(0.175 * (k + 1), 12);
      expect(area(t.polygon)).toBeCloseTo(1.2 * 0.28, 9);
      expect(ringArea(t.polygon)).toBeGreaterThan(0);
    });
    expect(r.risers).toHaveLength(17);
    expect(r.risers[0]!.z0).toBeCloseTo(0, 12);
    expect(r.risers[16]!.z1).toBeCloseTo(17 * 0.175, 9);
    expect(multiArea(r.footprint)).toBeCloseTo(1.2 * 0.28 * 16, 9);
    for (let i = 0; i < r.treads.length; i++) {
      for (let j = i + 1; j < r.treads.length; j++) {
        const common = intersection(asMulti(r.treads[i]!.polygon), asMulti(r.treads[j]!.polygon));
        expect(multiArea(common)).toBeLessThan(1e-9);
      }
    }
  });

  it('(2) lance em leque (limites retos que divergem de um vértice): áreas, disjunção e união', () => {
    // Vértice em (0,0); limites são os raios ±0,4 rad de r = 0,5 a 6. Espelhos perpendiculares ao eixo em x = 1..3.
    // Entre x = d1 e x = d2 a região tem área tan(0,4)·(d2² − d1²).
    const alpha = 0.4;
    const u = v(Math.cos(alpha), Math.sin(alpha));
    const w = v(Math.cos(alpha), -Math.sin(alpha));
    const run: StairRunSketch = {
      boundaryLeft: [ln(0.5 * u.x, 0.5 * u.y, 6 * u.x, 6 * u.y)],
      boundaryRight: [ln(0.5 * w.x, 0.5 * w.y, 6 * w.x, 6 * w.y)],
      risers: [1, 1.5, 2, 2.5, 3].map((x) => ln(x, -2, x, 2)),
      path: [],
    };
    const r = stairRunSteps(run, { baseZ: 0, riserHeight: 0.2 });
    expect(r.issues).toEqual([]);
    expect(r.treads).toHaveLength(4);
    const t = Math.tan(alpha);
    const xs = [1, 1.5, 2, 2.5, 3];
    r.treads.forEach((tr, k) => {
      expect(area(tr.polygon)).toBeCloseTo(t * (xs[k + 1]! ** 2 - xs[k]! ** 2), 9);
    });
    // A união arredonda vértices a 1e-7 m (snap do polygon-clipping): tolerância de 5e-7 m² na área.
    expect(multiArea(r.footprint)).toBeCloseTo(t * (9 - 1), 6);
    for (let i = 0; i < r.treads.length; i++) {
      for (let j = i + 1; j < r.treads.length; j++) {
        const common = intersection(asMulti(r.treads[i]!.polygon), asMulti(r.treads[j]!.polygon));
        expect(multiArea(common)).toBeLessThan(1e-9);
      }
    }
  });

  it('(3) limites em arco concêntricos (escada curva), espelhos radiais', () => {
    // Centro na origem; ascende em sentido anti-horário de 0 a 90°. Esquerdo = interno (r = 1), direito = externo (r = 2).
    const run: StairRunSketch = {
      boundaryLeft: [arc(1, 0, 0, 1, -(1 - Math.SQRT1_2))],
      boundaryRight: [arc(2, 0, 0, 2, -(2 - Math.SQRT2))],
      risers: [],
      path: [],
    };
    const radii = distributeRisers(run, 5);
    expect(radii).toHaveLength(5);
    const withRisers = { ...run, risers: radii };
    const r = stairRunSteps(withRisers, { baseZ: 0, riserHeight: 0.2 });
    expect(r.issues).toEqual([]);
    expect(r.treads).toHaveLength(4);
    // Setor anular de ângulo π/8 entre r = 1 e r = 2: área = (π/8)/2 · (4 − 1).
    const expected = ((Math.PI / 8) / 2) * 3;
    r.treads.forEach((tr) => expect(Math.abs(area(tr.polygon) - expected)).toBeLessThan(5e-3));
    expect(Math.abs(multiArea(r.footprint) - 4 * expected)).toBeLessThan(5e-3);
    expect(orderRisers(withRisers)).toEqual([0, 1, 2, 3, 4]);
  });

  it('(4) espelhos que passam dos limites são aparados sem erro', () => {
    const run = straightRun(1.2, [1, 2, 3]);
    expect(validateRunSketch(run)).toEqual([]);
    const trimmed = trimRisers(run);
    expect(trimmed[0]!.a.y).toBeCloseTo(0.6, 12);
    expect(trimmed[0]!.b.y).toBeCloseTo(-0.6, 12);
    expect(trimmed[0]!.a.x).toBeCloseTo(1, 12);
    // Espelho em arco que atravessa os dois limites também é aparado.
    const arcRun = straightRun(1.2, []);
    arcRun.risers = [arc(0.8, -1, 1.2, 1, 0.05)];
    expect(validateRunSketch(arcRun)).toEqual([]);
    const ta = trimRisers(arcRun)[0]!;
    expect(Math.abs(ta.a.y - 0.6)).toBeLessThan(1e-3);
    expect(Math.abs(ta.b.y + 0.6)).toBeLessThan(1e-3);
  });

  it('lance com erro de geometria devolve listas vazias e os erros', () => {
    const run = straightRun(1.2, [1, 2]);
    run.risers.push(ln(3, -0.3, 3, 0.3));
    const r = stairRunSteps(run, { baseZ: 0, riserHeight: 0.2 });
    expect(r.treads).toEqual([]);
    expect(r.risers).toEqual([]);
    expect(r.footprint).toEqual([]);
    expect(codes(r.issues)).toEqual(['stair-riser-not-spanning']);
  });
});

describe('leque acima de 180° (ordem dos espelhos e degraus disjuntos)', () => {
  // 16 espelhos radiais entre r = 1,0 e r = 1,8. A região entre o 1º e o último espelho é um setor anular de ângulo θ:
  // área θ·(r2² − r1²)/2. A amostragem por corda (SAMPLE_TOL) subestima cada arco em no máximo (2/3)·tol·comprimento.
  const R1 = 1.0;
  const R2 = 1.8;
  const cases: Array<[string, number]> = [
    ['90°', 90],
    ['180°', 180],
    ['270°', 270],
    ['330° (o gerador recusa 360°)', 330],
    ['270° no sentido horário', -270],
  ];
  for (const [name, deg] of cases) {
    it(`${name}: 15 degraus com áreas > 0, disjuntos; soma = união = setor entre o 1º e o último espelho`, () => {
      const th = (deg * Math.PI) / 180;
      const run = generateFanRun({ center: v(0, 0), innerRadius: R1, outerRadius: R2, startAngle: 0, endAngle: th, risers: 16 });
      const r = stairRunSteps(run, { baseZ: 0, riserHeight: 0.175 });
      expect(r.issues).toEqual([]);
      expect(r.treads).toHaveLength(15);
      r.treads.forEach((t, k) => {
        expect(ringArea(t.polygon)).toBeGreaterThan(0);
        expect(t.z).toBeCloseTo(0.175 * (k + 1), 12);
      });
      const sum = r.treads.reduce((s, t) => s + area(t.polygon), 0);
      expect(sum).toBeCloseTo(multiArea(r.footprint), 6);
      for (let i = 0; i < r.treads.length; i++) {
        for (let j = i + 1; j < r.treads.length; j++) {
          const common = intersection(asMulti(r.treads[i]!.polygon), asMulti(r.treads[j]!.polygon));
          expect(multiArea(common)).toBeLessThan(1e-9);
        }
      }
      const sector = (Math.abs(th) * (R2 * R2 - R1 * R1)) / 2;
      const samplingTol = ((2 / 3) * SAMPLE_TOL * Math.abs(th) * (R1 + R2)) + 1e-9;
      expect(Math.abs(multiArea(r.footprint) - sector)).toBeLessThanOrEqual(samplingTol);
    });
  }
});

describe('códigos de erro (um teste por código, mensagem exata)', () => {
  const expectOnly = (run: StairRunSketch, code: string, message: string, riserIndex?: number): void => {
    const issues = validateRunSketch(run);
    expect(codes(issues)).toEqual([code]);
    expect(issues[0]!.message).toBe(message);
    expect(issues[0]!.severity).toBe('error');
    if (riserIndex !== undefined) expect(issues[0]!.riserIndex).toBe(riserIndex);
  };

  it('stair-boundaries-touch', () => {
    const run: StairRunSketch = {
      boundaryLeft: [ln(0, 0.6, 4, 0.6)],
      boundaryRight: [ln(0, 0.6, 4, -0.6)],
      risers: [ln(1, -1, 1, 1), ln(2, -1, 2, 1), ln(3, -1, 3, 1)],
      path: [],
    };
    expectOnly(run, 'stair-boundaries-touch', 'Os limites esquerdo e direito do lance não podem se tocar.');
  });

  it('stair-boundary-gap', () => {
    const run = straightRun(1.2, [1, 2, 3]);
    run.boundaryLeft = [ln(-0.5, 0.6, 1.5, 0.6), ln(1.8, 0.6, 5, 0.6)];
    expectOnly(run, 'stair-boundary-gap', 'Cada limite deve ser uma cadeia contínua de retas e arcos.');
  });

  it('stair-riser-on-boundary', () => {
    const run = straightRun(1.2, [2, 3]);
    run.risers.unshift(ln(0, 0.6, 1, 0.6));
    expectOnly(run, 'stair-riser-on-boundary', 'Parte do espelho está sobre o limite: não é permitido.', 0);
  });

  it('stair-riser-crossing', () => {
    const run: StairRunSketch = {
      boundaryLeft: [ln(-0.5, 0.6, 5, 0.6)],
      boundaryRight: [ln(-0.5, -0.6, 5, -0.6)],
      risers: [ln(1, -1, 1, 1), ln(0.5, -1, 1.5, 1)],
      path: [],
    };
    expectOnly(run, 'stair-riser-crossing', 'Espelhos nº 1 e nº 2 se cruzam ou se tocam: não são permitidos (distância 0,0 cm).', 0);
  });

  it('stair-riser-boundary-multi', () => {
    // Arco de corda 1,5 m com flecha 0,7 m: sobe acima de y = 0,6 e volta, cruzando o limite esquerdo duas vezes.
    const run = straightRun(1.2, [3]);
    run.risers.unshift(arc(0.5, 0, 2, 0, 0.7));
    expectOnly(run, 'stair-riser-boundary-multi', 'O espelho cruza o mesmo limite mais de uma vez.', 0);
  });

  it('stair-riser-not-spanning', () => {
    const run = straightRun(1.2, [2, 3]);
    run.risers.unshift(ln(1, -0.3, 1, 0.3));
    expectOnly(run, 'stair-riser-not-spanning', 'Espelho nº 1: deve ligar o limite esquerdo ao direito, mas não chega ao limite esquerdo (falta 30,0 cm).', 0);
  });

  it('stair-riser-same-location', () => {
    const run = straightRun(1.2, [1, 2]);
    run.risers.push(ln(1, -1, 1, 1));
    expectOnly(run, 'stair-riser-same-location', 'Espelhos nº 1 e nº 3 ocupam a mesma posição (distância 0,0 cm).', 0);
  });

  it('stair-path-ends (caminhada começa antes do primeiro espelho)', () => {
    const run = straightRun(1.2, [1, 2, 3]);
    run.path = [ln(0.5, 0, 3, 0)];
    expectOnly(run, 'stair-path-ends', 'A caminhada deve ir do primeiro ao último espelho.');
  });

  it('stair-path-misses-riser (caminhada passa por cima do espelho do meio)', () => {
    const run = straightRun(1.2, [1, 2, 3]);
    run.path = [ln(1, 0, 1.5, 0.7), ln(1.5, 0.7, 2.5, 0.7), ln(2.5, 0.7, 3, 0)];
    expectOnly(run, 'stair-path-misses-riser', 'A caminhada não cruza todos os espelhos.', 1);
  });

  it('stair-landing-open (patamar sem o último trecho)', () => {
    const r = stairLandingPolygon({ boundary: [ln(0, 0, 1, 0), ln(1, 0, 1, 1), ln(1, 1, 0, 1)] });
    expect(r.polygon).toBeNull();
    expect(r.issues.map((i) => i.code)).toEqual(['stair-landing-open']);
    expect(r.issues[0]!.message).toBe('O contorno do patamar deve ser um laço fechado.');
    const closed = stairLandingPolygon({ boundary: [ln(0, 0, 1, 0), ln(1, 0, 1, 1), ln(1, 1, 0, 1), ln(0, 1, 0, 0)] });
    expect(closed.issues).toEqual([]);
    expect(area(closed.polygon!)).toBeCloseTo(1, 12);
  });
});

describe('ordem e caminhada', () => {
  it('sem caminhada: ordem pela projeção sobre a direção de subida, qualquer que seja a ordem do vetor', () => {
    const run = straightRun(1.2, [3, 1, 2]);
    expect(orderRisers(run)).toEqual([1, 2, 0]);
    expect(autoPath(run)).toEqual([v(1, 0), v(2, 0), v(3, 0)]);
  });

  it('com caminhada: a ordem segue o cruzamento com a caminhada', () => {
    // O espelho 1 é inclinado e tem o ponto médio um pouco à direita do 0, mas a caminhada o cruza antes.
    const run: StairRunSketch = {
      boundaryLeft: [ln(-0.5, 0.6, 5, 0.6)],
      boundaryRight: [ln(-0.5, -0.6, 5, -0.6)],
      risers: [ln(2, -1, 2, 1), ln(1.5, -1, 2.6, 1)],
      path: [ln(0, -0.5, 5, -0.5)],
    };
    expect(orderRisers(run)).toEqual([1, 0]);
    expect(orderRisers({ ...run, path: [] })).toEqual([0, 1]);
  });
});

describe('distributeRisers', () => {
  it('(7) limites paralelos: espelhos paralelos, igualmente espaçados, do 1º ao último ponto', () => {
    const run = straightRun(1.2, [], 0, 4);
    const risers = distributeRisers(run, 5);
    expect(risers).toHaveLength(5);
    risers.forEach((c, k) => {
      expect(c.a.x).toBeCloseTo(k, 12);
      expect(c.b.x).toBeCloseTo(k, 12);
      expect(Math.abs(c.a.y - c.b.y)).toBeGreaterThan(1);
    });
    const r = stairRunSteps({ ...run, risers }, { baseZ: 0, riserHeight: 0.2 });
    expect(r.issues).toEqual([]);
    expect(multiArea(r.footprint)).toBeCloseTo(1.2 * 4, 9);
  });

  it('(7) arcos concêntricos: espelhos radiais e espaçados em ângulo igual', () => {
    const run: StairRunSketch = {
      boundaryLeft: [arc(1, 0, 0, 1, -(1 - Math.SQRT1_2))],
      boundaryRight: [arc(2, 0, 0, 2, -(2 - Math.SQRT2))],
      risers: [],
      path: [],
    };
    const risers = distributeRisers(run, 5);
    risers.forEach((c, k) => {
      const m = v((c.a.x + c.b.x) / 2, (c.a.y + c.b.y) / 2);
      const ang = (k * Math.PI) / 8;
      expect(Math.hypot(m.x, m.y)).toBeCloseTo(1.5, 9);
      expect(m.x).toBeCloseTo(1.5 * Math.cos(ang), 9);
      expect(m.y).toBeCloseTo(1.5 * Math.sin(ang), 9);
      // Direção radial: o vetor do espelho é paralelo a (cos, sin).
      const dx = c.b.x - c.a.x;
      const dy = c.b.y - c.a.y;
      expect(Math.abs(dx * Math.sin(ang) - dy * Math.cos(ang))).toBeLessThan(1e-9 * Math.hypot(dx, dy));
    });
  });

  it('contagem 0 não gera espelhos; contagem 1 põe um no início da caminhada', () => {
    const run = straightRun(1.2, [], 0, 4);
    expect(distributeRisers(run, 0)).toEqual([]);
    const one = distributeRisers(run, 1);
    expect(one).toHaveLength(1);
    expect(one[0]!.a.x).toBeCloseTo(0, 12);
  });
});

describe('propriedades (200 casos determinísticos)', () => {
  it('lances retos aleatórios mantêm as invariantes', () => {
    const rand = rng(20261021);
    for (let c = 0; c < 200; c++) {
      const w = 0.8 + rand() * 1.4;
      const p = 0.25 + rand() * 0.1;
      const N = 3 + Math.floor(rand() * 10);
      const th = rand() * 2 * Math.PI;
      const ox = rand() * 10 - 5;
      const oy = rand() * 10 - 5;
      const ext = 0.2 + rand() * 0.5;
      const h = 0.15 + rand() * 0.05;
      const baseZ = rand() * 3;
      const u = v(Math.cos(th), Math.sin(th));
      const n = v(-Math.sin(th), Math.cos(th));
      const at = (s: number, t: number): Vec2 => v(ox + u.x * s + n.x * t, oy + u.y * s + n.y * t);
      const sEnd = (N - 1) * p;
      const risers: StairCurve[] = [];
      for (let k = 0; k < N; k++) {
        const s = k * p;
        risers.push({ a: at(s, -w / 2 - ext), b: at(s, w / 2 + ext), sag: 0 });
      }
      // Embaralha a ordem do vetor: a ordenação não pode depender dela.
      for (let i = risers.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [risers[i], risers[j]] = [risers[j]!, risers[i]!];
      }
      const run: StairRunSketch = {
        boundaryLeft: [{ a: at(-0.5, w / 2), b: at(sEnd + 0.5, w / 2), sag: 0 }],
        boundaryRight: [{ a: at(-0.5, -w / 2), b: at(sEnd + 0.5, -w / 2), sag: 0 }],
        risers,
        path: [],
      };
      const r = stairRunSteps(run, { baseZ, riserHeight: h });
      const tag = `caso ${c}`;
      expect(r.issues, tag).toEqual([]);
      expect(r.treads, tag).toHaveLength(N - 1);
      r.treads.forEach((t, k) => {
        expect(t.index, tag).toBe(k + 1);
        expect(t.z, tag).toBeCloseTo(baseZ + (k + 1) * h, 9);
        expect(ringArea(t.polygon), tag).toBeGreaterThan(0);
        expect(area(t.polygon), tag).toBeCloseTo(w * p, 6);
      });
      for (let i = 0; i < r.treads.length; i++) {
        for (let j = i + 1; j < r.treads.length; j++) {
          const common = intersection(asMulti(r.treads[i]!.polygon), asMulti(r.treads[j]!.polygon));
          expect(multiArea(common), tag).toBeLessThan(1e-9);
        }
      }
      const total = r.treads.reduce((s, t) => s + area(t.polygon), 0);
      expect(total, tag).toBeCloseTo(w * sEnd, 6);
      expect(multiArea(r.footprint), tag).toBeCloseTo(w * sEnd, 6);
      r.risers.forEach((rs, k) => {
        expect(rs.z0, tag).toBeCloseTo(baseZ + k * h, 9);
        expect(rs.z1, tag).toBeCloseTo(baseZ + (k + 1) * h, 9);
      });
    }
  });
});

describe('sanidade dos fixtures', () => {
  it('lance reto 1,20 m com espelhos perpendiculares não produz erros', () => {
    expect(validateRunSketch(straightRun(1.2, [1, 2, 3]))).toEqual([]);
  });
});
