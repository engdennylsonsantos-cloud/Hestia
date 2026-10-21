import { describe, expect, it } from 'vitest';
import { asMulti, intersection, multiArea, pointInRing, ringArea, type Vec2 } from '@hestia/geom';
import { DEFAULT_STAIR_TYPES, ProjectStore, createEmptyProject, makeStair, stairs, type Project, type Stair, type StairRun, type StairType } from '@hestia/model';
import { pieceBottomZ, pieceVolume, stairBody, type ResolvedStair, type StairBodyPiece } from './stairBody.ts';
import { stairQuantities } from './stairQuantities.ts';
import { stairOpeningRegion } from './stairOpenings.ts';
import { sectionOfStairs } from './sectionStairs.ts';
import type { SectionLine } from './sectionGeom.ts';
import { generateSpiralRun } from './stairSpiral.ts';
import { resolveStairs } from './stairs.ts';

/**
 * Caracol (decisão 0014): corpo monolítico por volta (270°, 540°, 720°), estilo poste (360°), quantitativos por material,
 * furo 'full' = disco e corte longitudinal. Referência: pé-direito de 2,80 m (h = 0,175 m); raios 0,10 e 1,00 m; caminhada
 * no raio médio 0,55 m; profundidade estrutural 0,15 m (tipo caracol monolítico).
 */

const H = 0.175;
const ORIGIN: Vec2 = { x: 0, y: 0 };
const START = 0.3;
const R_IN = 0.1;
const R_OUT = 1;
const RM = (R_IN + R_OUT) / 2;
const SD = 0.15;
const MONO = 'stt_caracol_monolitica';
const POST = 'stt_caracol_poste';
const TWO_PI = 2 * Math.PI;

const deg = (d: number): number => (d * Math.PI) / 180;
const v = (x: number, y: number): Vec2 => ({ x, y });

interface SpiralOpts {
  sweepDeg: number;
  risers: number;
  typeId?: string;
  /** Campos do tipo que sobrescrevem o tipo de `typeId` (cria o tipo `stt_teste`). */
  typeExtra?: Partial<StairType>;
  stairExtra?: Partial<Stair>;
}

/** Projeto com um caracol (um lance) de `risers` espelhos, altura risers·h, topo no pavimento de 3,00 m menos 3,00 m. */
function spiralProject(o: SpiralOpts): Project {
  const store = new ProjectStore(createEmptyProject());
  const base = o.typeId ?? MONO;
  let typeId = base;
  if (o.typeExtra) {
    typeId = 'stt_teste';
    const t = DEFAULT_STAIR_TYPES.find((x) => x.id === base)!;
    store.exec({ type: 'upsertStairType', stairType: { ...t, id: typeId, ...o.typeExtra } as StairType });
  }
  const run = generateSpiralRun({ center: ORIGIN, rInner: R_IN, rOuter: R_OUT, startAngle: START, sweep: deg(o.sweepDeg), risers: o.risers });
  const total = o.risers * H;
  store.exec({
    type: 'addStair',
    stair: makeStair({
      id: 'st1',
      typeId,
      levelId: 'lv_0',
      topOffset: total - 3,
      height: total,
      components: [{ id: 'run', kind: 'run', ...run } as StairRun],
      openingMargin: 0,
      ...o.stairExtra,
    }),
  });
  return store.project;
}

function spiralStair(o: SpiralOpts): ResolvedStair {
  const list = resolveStairs(spiralProject(o));
  expect(list).toHaveLength(1);
  const [rs] = list;
  expect(rs!.issues.filter((i) => i.severity === 'error')).toEqual([]);
  return rs!;
}

/** Ponto médio do espelho de nº `k` (1-based). */
function riserMid(st: ResolvedStair, k: number): Vec2 {
  const r = st.risers.find((x) => x.index === k)!;
  return v((r.a.x + r.b.x) / 2, (r.a.y + r.b.y) / 2);
}

/** Volta (0, 1, …) do degrau `k` (1-based) pelo ângulo do primeiro espelho: cada volta tem n = 2π/Δ degraus. */
const turnOf = (k: number, step: number): number => Math.floor(((k - 1) * Math.abs(step)) / TWO_PI + 1e-9);

/** Vértices de uma interseção em planta (todos os anéis). */
const verticesOf = (poly: Array<Array<Array<Vec2>>>): Vec2[] => poly.flat(2);

/** Área de interseção (m²) de dois polígonos de peça. */
const overlapArea = (a: Vec2[], b: Vec2[]): number => multiArea(intersection(asMulti(a), asMulti(b)));

/**
 * Parâmetros do caracol medidos no lance resolvido: a corda entre espelhos consecutivos (no raio da caminhada) e
 * T = profundidade ÷ cosθ com essa corda (decisão 0012 §2). A aparagem dos espelhos usa a polilinha amostrada do limite,
 * então a corda medida difere da exata 2·rm·sen(Δ/2) em ~0,1 mm (tolerância de amostragem); o teste usa a medida.
 */
function reference(st: ResolvedStair, sweepDeg: number, risers: number, sd = SD) {
  const step = deg(sweepDeg) / (risers - 1);
  const chord = Math.hypot(riserMid(st, 2).x - riserMid(st, 1).x, riserMid(st, 2).y - riserMid(st, 1).y);
  const exact = 2 * RM * Math.sin(Math.abs(step) / 2);
  const T = (sd * Math.hypot(chord, H)) / chord;
  return { step, chord, exact, T, n: Math.round(TWO_PI / Math.abs(step)) };
}

/** T do degrau k (decisão 0012 §2) com a corda entre os espelhos k e k+1 medida no raio da caminhada. */
function treadT(st: ResolvedStair, k: number, sd = SD): number {
  const m = riserMid(st, k);
  const f = riserMid(st, k + 1);
  const c = Math.hypot(f.x - m.x, f.y - m.y);
  return (sd * Math.hypot(c, H)) / c;
}

/** Ponto logo dentro do degrau k, junto ao espelho de trás (o ponto médio está na aresta). */
function justInside(st: ResolvedStair, k: number): Vec2 {
  const m = riserMid(st, k);
  const f = riserMid(st, k + 1);
  const d = Math.hypot(f.x - m.x, f.y - m.y);
  return v(m.x + ((f.x - m.x) / d) * 1e-6, m.y + ((f.y - m.y) / d) * 1e-6);
}

/** Menor folga entre duas peças com sobreposição em planta: cota de fundo do de cima menos o topo do de baixo, nos vértices da interseção. */
function minGapOf(a: StairBodyPiece, b: StairBodyPiece): number {
  const [lo, hi] = a.zTop <= b.zTop ? [a, b] : [b, a];
  const verts = verticesOf(intersection(asMulti(a.polygon), asMulti(b.polygon)));
  return Math.min(...verts.map((q) => pieceBottomZ(hi, q.x, q.y) - lo.zTop));
}

/** Degrau de volta diferente: duas peças de degrau cujas voltas (pelo índice) não são a mesma. */
const sameTurn = (a: StairBodyPiece, b: StairBodyPiece, step: number): boolean =>
  a.kind === 'tread' && b.kind === 'tread' && turnOf(a.index, step) === turnOf(b.index, step);

const CASES: Array<{ sweepDeg: number; risers: number }> = [
  { sweepDeg: 270, risers: 16 },
  { sweepDeg: 540, risers: 16 },
  { sweepDeg: 720, risers: 17 },
];

/** Tolerância da corda medida contra a exata (m): amostragem do limite (ver `reference`). */
const CHORD_TOL = 5e-4;
/** Tolerância de área (m²) para a sobreposição de cunhas vizinhas da mesma volta: ruído da amostragem do limite. */
const SAME_TURN_TOL = 1e-7;

describe.each(CASES)('caracol monolítico de $sweepDeg° ($risers espelhos)', ({ sweepDeg, risers }) => {
  const st = spiralStair({ sweepDeg, risers });
  const ref = reference(st, sweepDeg, risers);
  const { pieces } = stairBody(st);
  const treads = pieces.filter((p) => p.kind === 'tread');

  it('N−1 degraus em cotas k·h; espelhos no raio da caminhada (rm) com corda igual à exata 2·rm·sen(Δ/2) a menos de 0,5 mm', () => {
    expect(st.riserCount).toBe(risers);
    expect(st.riserHeight).toBeCloseTo(H, 12);
    expect([...new Set(treads.map((p) => p.index))].sort((a, b) => a - b)).toEqual(Array.from({ length: risers - 1 }, (_, k) => k + 1));
    for (let k = 1; k <= risers; k++) expect(Math.abs(Math.hypot(riserMid(st, k).x, riserMid(st, k).y) - RM)).toBeLessThan(CHORD_TOL);
    expect(Math.abs(ref.chord - ref.exact)).toBeLessThan(CHORD_TOL);
  });

  it('T medido no raio da caminhada: fundo no espelho de trás = k·h − h − T (degrau k, dentro do piso base)', () => {
    let checked = 0;
    for (let k = 1; k < risers; k++) {
      const z0 = k * H - H - treadT(st, k);
      if (z0 < 0) continue;
      const q = justInside(st, k);
      const cand = treads.filter((p) => p.index === k && pointInRing(q, p.polygon));
      expect(cand.length).toBeGreaterThan(0);
      for (const p of cand) expect(pieceBottomZ(p, q.x, q.y)).toBeCloseTo(z0, 5);
      checked++;
    }
    expect(checked).toBeGreaterThan(risers - 4);
  });

  it('volume de cada degrau inteiro (sem corte pelo piso base) = área × (h/2 + T)', () => {
    let checked = 0;
    for (const p of treads) {
      const fullStep = st.steps.find((s) => s.kind === 'tread' && s.index === p.index)!;
      const whole = Math.abs(multiArea([[p.polygon]]) - multiArea([[fullStep.polygon]])) < 1e-9;
      const above = Math.min(...p.polygon.map((q) => pieceBottomZ(p, q.x, q.y))) >= 0;
      if (!whole || !above) continue;
      // Tolerância relativa de 1e-3: o centróide da cunha sai alguns décimos de mm do meio da corda pela amostragem do limite (no 270°, a corda é menor e o erro relativo sobe a ~5e-4).
      const expected = multiArea([[p.polygon]]) * (H / 2 + treadT(st, p.index));
      expect(Math.abs(pieceVolume(p) / expected - 1)).toBeLessThan(1e-3);
      checked++;
    }
    expect(checked).toBeGreaterThan(risers - 4);
  });

  it('nenhum vértice abaixo do piso base (a escada apoia no nível de base)', () => {
    for (const p of pieces) for (const q of p.polygon) expect(pieceBottomZ(p, q.x, q.y)).toBeGreaterThanOrEqual(-1e-6);
  });

  it('degraus da mesma volta são disjuntos em planta (só a amostragem do limite, < 1e-7 m²)', () => {
    for (let i = 0; i < treads.length; i++) {
      for (let j = i + 1; j < treads.length; j++) {
        const a = treads[i]!;
        const b = treads[j]!;
        if (!sameTurn(a, b, ref.step)) continue;
        expect(overlapArea(a.polygon, b.polygon)).toBeLessThan(SAME_TURN_TOL);
      }
    }
  });

  it('voltas diferentes que se cruzam em planta (só acima de 360°): a peça de cima fica acima da de baixo em todos os vértices da interseção', () => {
    let pairs = 0;
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const a = pieces[i]!;
        const b = pieces[j]!;
        if (sameTurn(a, b, ref.step) || overlapArea(a.polygon, b.polygon) <= 1e-9) continue;
        pairs++;
        expect(minGapOf(a, b)).toBeGreaterThanOrEqual(-1e-9);
      }
    }
    if (sweepDeg > 360) expect(pairs).toBeGreaterThan(0);
  });

  it('chegada: uma peça, no topo da laje padrão (topo − 0,15 m)', () => {
    const arrivals = pieces.filter((p) => p.kind === 'arrival');
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0]!.zTop).toBeCloseTo(st.topZ - 0.15, 9);
  });
});

describe('caracol monolítico: folga entre voltas (540° e 720°, tipo com profundidade 0,15 m)', () => {
  // Folga entre degraus de voltas vizinhas: no espelho de trás do degrau de baixo, (n−1)·h − T; no espelho da frente, n·h − T
  // (decisão 0014 §7). O fundo é o plano pelos pontos médios, então a quina do espelho de trás fica um pouco abaixo do ponto
  // médio: a folga mínima medida é (n−1)·h − T menos até ~0,1 m. A fórmula da decisão (n·h − T) fica na quina da frente.
  for (const [sweepDeg, risers] of [
    [540, 16],
    [720, 17],
  ] as const) {
    it(`${sweepDeg}°: a folga mínima entre degraus de voltas diferentes está entre (n−1)·h − T − 0,1 e n·h − T, e é positiva`, () => {
      const st = spiralStair({ sweepDeg, risers });
      const ref = reference(st, sweepDeg, risers);
      const treads = stairBody(st).pieces.filter((p) => p.kind === 'tread');
      let min = Infinity;
      for (let i = 0; i < treads.length; i++)
        for (let j = i + 1; j < treads.length; j++) {
          const a = treads[i]!;
          const b = treads[j]!;
          if (sameTurn(a, b, ref.step) || overlapArea(a.polygon, b.polygon) <= 1e-9) continue;
          min = Math.min(min, minGapOf(a, b));
        }
      expect(min).toBeGreaterThan(0);
      expect(min).toBeGreaterThan((ref.n - 1) * H - ref.T - 0.1);
      expect(min).toBeLessThan(ref.n * H - ref.T);
    });
  }
});

describe('caracol de estilo poste (360°, 16 espelhos, degrau 0,05 m, sobreposição 0,025 m, poste de aço)', () => {
  const st = spiralStair({ sweepDeg: 360, risers: 16, typeId: POST });
  const { pieces } = stairBody(st);
  const treads = pieces.filter((p) => p.kind === 'tread');
  const posts = pieces.filter((p) => p.kind === 'post');
  const t = DEFAULT_STAIR_TYPES.find((x) => x.id === POST)!.treadThickness;
  const ov = DEFAULT_STAIR_TYPES.find((x) => x.id === POST)!.treadOverlap;
  const stepArea = (k: number): number => multiArea([[st.steps.find((s) => s.kind === 'tread' && s.index === k)!.polygon]]);

  it('N−1 degraus e um poste: 15 + 1 peças, sem chegada nem patamar', () => {
    expect(treads).toHaveLength(15);
    expect(posts).toHaveLength(1);
    expect(pieces.filter((p) => p.kind === 'arrival' || p.kind === 'landing')).toHaveLength(0);
  });

  it('degrau k: topo em k·h, fundo plano em k·h − t (sem espelho), e nenhum vértice abaixo do piso base', () => {
    for (const p of treads) {
      expect(p.zTop).toBeCloseTo(p.index * H, 12);
      expect(p.bottom.a).toBe(0);
      expect(p.bottom.b).toBe(0);
      expect(p.bottom.c).toBeCloseTo(p.index * H - t, 12);
    }
    for (const p of pieces) for (const q of p.polygon) expect(pieceBottomZ(p, q.x, q.y)).toBeGreaterThanOrEqual(-1e-9);
  });

  it('a área de cada degrau é a do setor mais a faixa da sobreposição (até o próximo degrau); o último não estende', () => {
    for (const p of treads) {
      const base = stepArea(p.index);
      const area = multiArea([[p.polygon]]);
      if (p.index === 15) {
        expect(area).toBeCloseTo(base, 9);
      } else {
        // Faixa de largura ov ao longo do espelho (r_outer − r_inner): área ≈ ov·(r2 − r1), a menos de 1%.
        expect(area - base).toBeGreaterThan(0);
        expect(Math.abs((area - base) / (ov * (R_OUT - R_IN)) - 1)).toBeLessThan(0.01);
      }
    }
  });

  it('volume do degrau = área (com sobreposição) × espessura; soma = Σ pieceVolume', () => {
    for (const p of treads) expect(pieceVolume(p)).toBeCloseTo(multiArea([[p.polygon]]) * t, 9);
  });

  it('poste: 24 lados inscritos no raio interno, centro na origem, do piso base até o topo do último degrau', () => {
    const post = posts[0]!;
    expect(post.polygon).toHaveLength(24);
    for (const q of post.polygon) expect(Math.hypot(q.x, q.y)).toBeCloseTo(R_IN, 12);
    expect(post.zTop).toBeCloseTo(15 * H, 12);
    expect(post.bottom).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('volume do poste = área do polígono de 24 lados × altura; difere de π·r²·h em menos de 1,2% (24 lados inscritos)', () => {
    const post = posts[0]!;
    const H_POST = 15 * H;
    const polyArea = (12 * Math.sin(Math.PI / 12)) * R_IN * R_IN;
    expect(pieceVolume(post)).toBeCloseTo(polyArea * H_POST, 9);
    expect(Math.abs(pieceVolume(post) / (Math.PI * R_IN * R_IN * H_POST) - 1)).toBeLessThan(0.012);
    expect(ringArea(post.polygon)).toBeCloseTo(polyArea, 9);
  });

  it('degraus do poste não têm sobreposição em planta dentro do mesmo degrau, e os de cotas vizinhas se sobrepõem só por ov', () => {
    for (let k = 1; k < 15; k++) {
      const a = treads.find((p) => p.index === k)!;
      const b = treads.find((p) => p.index === k + 1)!;
      // O degrau k invade o k+1 só na faixa de ov, nunca o espelho inteiro: a área comum fica ≤ área da faixa.
      expect(overlapArea(a.polygon, b.polygon)).toBeLessThan(ov * (R_OUT - R_IN) * 1.01);
      expect(overlapArea(a.polygon, b.polygon)).toBeGreaterThan(0);
    }
  });
});

describe('quantitativos do caracol poste: volume por material (degrau = material do tipo; poste = postMaterialId)', () => {
  const st = spiralStair({ sweepDeg: 360, risers: 16, typeId: POST, typeExtra: { postMaterialId: 'mat_concreto' } });
  const q = stairQuantities(st);
  const pieces = stairBody(st).pieces;
  const treadVolume = pieces.filter((p) => p.kind === 'tread').reduce((s, p) => s + pieceVolume(p), 0);
  const postVolume = pieces.filter((p) => p.kind === 'post').reduce((s, p) => s + pieceVolume(p), 0);

  it('volumeRun = degraus, volumePost = poste, volume = soma; a chegada não existe nesse estilo', () => {
    expect(q.volumeRun).toBeCloseTo(treadVolume, 9);
    expect(q.volumePost).toBeCloseTo(postVolume, 9);
    expect(q.volume).toBeCloseTo(treadVolume + postVolume, 9);
  });

  it('volumeByMaterial separa degrau (mat_aco, do tipo) e poste (mat_concreto)', () => {
    expect(q.volumeByMaterial['mat_aco']).toBeCloseTo(treadVolume, 9);
    expect(q.volumeByMaterial['mat_concreto']).toBeCloseTo(postVolume, 9);
    const sum = Object.values(q.volumeByMaterial).reduce((s, x) => s + x, 0);
    expect(sum).toBeCloseTo(q.volume, 9);
  });

  it('área em planta do poste (π·r² aproximado pelo polígono) e área em planta dos degraus sem a sobreposição', () => {
    expect(q.postPlanArea).toBeCloseTo(12 * Math.sin(Math.PI / 12) * R_IN * R_IN, 9);
    const steps = st.steps.filter((s) => s.kind === 'tread').reduce((s, x) => s + multiArea([[x.polygon]]), 0);
    expect(q.treadArea).toBeCloseTo(steps, 9);
  });

  it('o estilo monolítico não tem poste: volumePost 0 e volumeByMaterial só com o material do tipo', () => {
    const m = stairQuantities(spiralStair({ sweepDeg: 540, risers: 16 }));
    expect(m.volumePost).toBe(0);
    expect(m.postPlanArea).toBe(0);
    expect(Object.keys(m.volumeByMaterial)).toEqual(['mat_concreto']);
    expect(m.volumeByMaterial['mat_concreto']).toBeCloseTo(m.volume, 9);
  });
});

describe('furo de caracol no modo full: disco de raio externo (48 lados), com o miolo do poste', () => {
  const polyDisk = (r: number): number => 0.5 * 48 * r * r * Math.sin((2 * Math.PI) / 48);

  it.each([MONO, POST])('%s: a região é um disco de 48 lados de raio 1,00 m centrado na origem', (typeId) => {
    const sweepDeg = typeId === POST ? 360 : 540;
    const list = spiralProject({ sweepDeg, risers: 16, typeId, stairExtra: { openingMode: 'full' } });
    const s = stairs(list)[0]!;
    const st = resolveStairs(list)[0]!;
    const region = stairOpeningRegion(s, st, 2.5);
    expect(region).toHaveLength(1);
    expect(region[0]).toHaveLength(1);
    const ring = region[0]![0]!;
    expect(ring).toHaveLength(48);
    for (const q of ring) expect(Math.hypot(q.x, q.y)).toBeCloseTo(R_OUT, 9);
    expect(Math.abs(multiArea(region) - polyDisk(R_OUT))).toBeLessThan(1e-9);
    // Miolo: o centro (onde fica o poste) está dentro do furo.
    expect(multiArea(region)).toBeGreaterThan(multiArea([[st.footprint[0]?.[0] ?? []]]));
  });

  it('o modo headroom não usa o disco: a região fica menor que o disco externo', () => {
    const list = spiralProject({ sweepDeg: 540, risers: 16, stairExtra: { openingMode: 'headroom' } });
    const st = resolveStairs(list)[0]!;
    const region = stairOpeningRegion(stairs(list)[0]!, st, 2.8 - 0.15);
    expect(multiArea(region)).toBeLessThan(polyDisk(R_OUT));
  });
});

describe('corte longitudinal do caracol poste pelo centro: poste como retângulo e degraus como trapézios', () => {
  const project = spiralProject({ sweepDeg: 360, risers: 16, typeId: POST, typeExtra: { postMaterialId: 'mat_concreto' } });
  const st = resolveStairs(project)[0]!;
  const line: SectionLine = { a: ORIGIN, b: v(1.2, 0), depth: 2.4 };
  const section = sectionOfStairs([st], line, project);

  it('o poste aparece como um retângulo de 0 a r_inner em planta e do piso base ao topo do último degrau', () => {
    const post = section.cut.filter((c) => c.materialId === 'mat_concreto');
    expect(post.length).toBeGreaterThan(0);
    const xs = post.flatMap((c) => c.polygon.flat().map((q) => q.x));
    const zs = post.flatMap((c) => c.polygon.flat().map((q) => q.y));
    expect(Math.min(...xs)).toBeCloseTo(0, 9);
    expect(Math.max(...xs)).toBeCloseTo(R_IN, 9);
    expect(Math.min(...zs)).toBeCloseTo(0, 9);
    expect(Math.max(...zs)).toBeCloseTo(15 * H, 9);
    for (const c of post) expect(c.polygon).toHaveLength(1);
  });

  it('os degraus cortam com o material do tipo, até o topo de cada um, e nenhum degrau tem cota abaixo do piso base', () => {
    const treads = section.cut.filter((c) => c.materialId === 'mat_aco');
    expect(treads.length).toBeGreaterThan(0);
    for (const c of treads) for (const q of c.polygon.flat()) expect(q.y).toBeGreaterThanOrEqual(-1e-9);
    expect(Math.max(...treads.flatMap((c) => c.polygon.flat().map((q) => q.y)))).toBeCloseTo(15 * H, 9);
  });
});

/** Volta do degrau pela regra do teste (⌊(k−1)Δ/2π⌋): 540° com 16 espelhos tem 10 degraus na 1ª volta e 5 na 2ª. */
describe('helpers de volta do caracol', () => {
  it('turnOf: 540° com 16 espelhos (Δ = 36°)', () => {
    const step = deg(540) / 15;
    expect(Array.from({ length: 15 }, (_, i) => turnOf(i + 1, step)).filter((t) => t === 0)).toHaveLength(10);
    expect(Array.from({ length: 15 }, (_, i) => turnOf(i + 1, step)).filter((t) => t === 1)).toHaveLength(5);
  });
});

