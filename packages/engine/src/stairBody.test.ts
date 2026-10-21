import { describe, expect, it } from 'vitest';
import { add, asMulti, mid, mul, multiArea, norm, pointInRing, sub, union, type Vec2 } from '@hestia/geom';
import { DEFAULT_STAIR_TYPES, ProjectStore, createEmptyProject, makeStair, type StairCurve, type StairLanding, type StairRun, type StairType } from '@hestia/model';
import {
  generateFanRun,
  generateLShape,
  generateUShape,
  generateWinderL,
  pieceBottomZ,
  pieceVolume,
  resolveStairs,
  stairBody,
  type ResolvedStair,
  type StairBodyPiece,
  type StairComponentSketch,
} from './index.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

/** Referência da decisão 0012 §4: w = 1,20; p = 0,28; h = 0,175 (H = 2,80 m); N = 16 espelhos. */
const W = 1.2;
const P = 0.28;
const H = 0.175;
const N = 16;
const MONO = 'stt_monolitica';
const ASSEMBLED = 'stt_piso_espelho';
/** Deslocamento de 1 µm para ficar dentro de uma peça ao lado de um espelho. */
const EPS_PT = 1e-6;

/** Espessura vertical equivalente T = profundidade estrutural ÷ cosθ, cosθ = p / √(p² + h²) (decisão 0012 §2, item 2). */
const tFor = (sd: number, p = P, h = H): number => (sd * Math.hypot(p, h)) / p;

/** Lance reto em +x: N espelhos a cada `spacing`, limites em y = ±w/2 (espelhos aparados). */
function straight(n: number, spacing: number, width = W, x0 = 0): StairRun {
  const b = x0 + (n - 1) * spacing + 0.5;
  return {
    id: 'run',
    kind: 'run',
    boundaryLeft: [ln(x0 - 0.5, width / 2, b, width / 2)],
    boundaryRight: [ln(x0 - 0.5, -width / 2, b, -width / 2)],
    risers: Array.from({ length: n }, (_, k) => ln(x0 + k * spacing, -1, x0 + k * spacing, 1)),
    path: [],
  };
}

/** Patamar retangular de x0 a x1, largura w, centrado em y = 0. */
function rect(x0: number, x1: number, w: number): StairLanding {
  const h = w / 2;
  return { id: 'landing', kind: 'landing', boundary: [ln(x0, -h, x1, -h), ln(x1, -h, x1, h), ln(x1, h, x0, h), ln(x0, h, x0, -h)] };
}

/** Converte o croqui dos geradores (sem id) em componentes da escada. */
function fromSketch(list: StairComponentSketch[]): Array<StairRun | StairLanding> {
  return list.map((c, i) =>
    c.kind === 'run'
      ? { id: `run${i}`, kind: 'run' as const, ...c.run }
      : { id: `land${i}`, kind: 'landing' as const, boundary: c.landing.boundary },
  );
}

/** Escada resolvida em projeto próprio, topo em 2,80 m (pavimento de 3,00 m com topOffset −0,20 m). */
function resolveStair(
  components: Array<StairRun | StairLanding>,
  typeId = MONO,
  typeExtra?: Partial<StairType> & { undersideStyle?: 'smooth' | 'stepped' },
): ResolvedStair {
  const s = new ProjectStore(createEmptyProject());
  let id = typeId;
  if (typeExtra) {
    id = 'stt_teste';
    const base = DEFAULT_STAIR_TYPES.find((t) => t.id === typeId)!;
    s.exec({ type: 'upsertStairType', stairType: { ...base, id, ...typeExtra } as StairType });
  }
  s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: id, levelId: 'lv_0', components, topOffset: -0.2 }) });
  const list = resolveStairs(s.project);
  expect(list).toHaveLength(1);
  return list[0]!;
}

/** Ponto médio do espelho `index` (1-based) do lance `ci`. */
function riserMid(st: ResolvedStair, ci: number, index: number): Vec2 {
  const r = st.risers.find((x) => x.componentIndex === ci && x.index === index)!;
  return mid(r.a, r.b);
}

/** Direção de subida de um lance: do espelho 1 ao 2. */
function ascent(st: ResolvedStair, ci: number): Vec2 {
  return norm(sub(riserMid(st, ci, 2), riserMid(st, ci, 1)));
}

/** Intervalos [fundo, topo] das peças que contêm `q`, com o fundo avaliado no ponto de contato `m`. */
function spans(pieces: StairBodyPiece[], q: Vec2, m: Vec2): Array<[number, number]> {
  return pieces.filter((p) => pointInRing(q, p.polygon)).map((p) => [pieceBottomZ(p, m.x, m.y), p.zTop]);
}

/** Sem fresta vertical no espelho compartilhado `m`: os intervalos das duas peças vizinhas se sobrepõem. */
function expectSealed(pieces: StairBodyPiece[], m: Vec2, dir: Vec2): void {
  const before = spans(pieces, sub(m, mul(dir, EPS_PT)), m);
  const after = spans(pieces, add(m, mul(dir, EPS_PT)), m);
  expect(before.length).toBeGreaterThan(0);
  expect(after.length).toBeGreaterThan(0);
  for (const [b0, b1] of before) {
    for (const [a0, a1] of after) expect(Math.max(b0, a0)).toBeLessThanOrEqual(Math.min(b1, a1) + 1e-9);
  }
}

/** Integração de Simpson de `fn` em [a, b]. Referência independente do código das peças. */
function simpson(fn: (x: number) => number, a: number, b: number, n = 2000): number {
  const step = (b - a) / n;
  let s = fn(a) + fn(b);
  for (let i = 1; i < n; i++) s += fn(a + i * step) * (i % 2 ? 4 : 2);
  return (s * step) / 3;
}

/**
 * Volume de degraus retos (largura W) com topos em `tops`, acima do piso base: ∫ (topo − max(base, fundo)) em x.
 * Liso: fundo rampa de `tops[k] − H − T` até `+H` em P. Escalonado: fundo plano em `tops[k] − H − T`.
 */
function runVolume(tops: number[], T: number, stepped: boolean, baseZ = 0): number {
  return tops.reduce((acc, top) => {
    const bottom = (x: number): number => top - H - T + (stepped ? 0 : (H / P) * x);
    return acc + W * simpson((x) => top - Math.max(baseZ, bottom(x)), 0, P);
  }, 0);
}

const TOPS = Array.from({ length: N - 1 }, (_, k) => (k + 1) * H);

describe('monolítica reta de referência (w 1,20; p 0,28; h 0,175; N 16; profundidade 0,15 m)', () => {
  const SD = 0.15;
  const T = tFor(SD);
  const smooth = resolveStair([straight(N, P)], MONO, { structuralDepth: SD, undersideStyle: 'smooth' });
  const stepped = resolveStair([straight(N, P)], MONO, { structuralDepth: SD, undersideStyle: 'stepped' });

  it('15 degraus; o 2º degrau (fundo liso) cruza o piso base e vira duas peças; uma chegada', () => {
    const { pieces } = stairBody(smooth);
    const treads = pieces.filter((p) => p.kind === 'tread');
    // O 1º degrau fica inteiro abaixo de baseZ (T > h), e o 2º é dividido pela cota do piso base: 16 peças de degrau.
    expect(treads.map((p) => p.index)).toEqual([1, 2, 2, ...Array.from({ length: 13 }, (_, k) => k + 3)]);
    expect(pieces.filter((p) => p.kind === 'arrival')).toHaveLength(1);
    expect(treads.reduce((s, p) => s + multiArea([[p.polygon]]), 0)).toBeCloseTo(15 * W * P, 9);
  });

  it('o piso base não é cortado no escalonado: 15 peças, uma por degrau; áreas somam 15·w·p', () => {
    const { pieces } = stairBody(stepped);
    const treads = pieces.filter((p) => p.kind === 'tread');
    expect(treads).toHaveLength(15);
    expect(treads.reduce((s, p) => s + multiArea([[p.polygon]]), 0)).toBeCloseTo(15 * W * P, 9);
  });

  it('nenhum fundo abaixo de baseZ (vértices de todas as peças, inclusive a chegada; tolerância de 1 µm do corte booleano)', () => {
    for (const st of [smooth, stepped]) {
      for (const p of stairBody(st).pieces) {
        for (const q of p.polygon) expect(pieceBottomZ(p, q.x, q.y)).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });

  it('liso: degraus acima do piso base = w·p·(h/2 + T); volume total = referência por integração', () => {
    const { pieces } = stairBody(smooth);
    for (const p of pieces.filter((x) => x.kind === 'tread' && x.index >= 3)) {
      expect(pieceVolume(p)).toBeCloseTo(W * P * (H / 2 + T), 9);
    }
    const total = pieces.filter((p) => p.kind === 'tread').reduce((s, p) => s + pieceVolume(p), 0);
    expect(total).toBeCloseTo(runVolume(TOPS, T, false), 6);
  });

  it('escalonado: degraus acima do piso base = w·p·(h + T); total = w·p·(16h + 13T) (degraus 1 e 2 cortados)', () => {
    const { pieces } = stairBody(stepped);
    for (const p of pieces.filter((x) => x.kind === 'tread' && x.index >= 3)) {
      expect(pieceVolume(p)).toBeCloseTo(W * P * (H + T), 9);
    }
    // Degrau 1: inteiro abaixo de baseZ, volume w·p·h. Degrau 2: fundo cortado no piso base, volume w·p·2h.
    const total = stairBody(stepped).pieces.reduce((s, p) => (p.kind === 'tread' ? s + pieceVolume(p) : s), 0);
    expect(total).toBeCloseTo(W * P * (16 * H + 13 * T), 9);
    expect(total).toBeCloseTo(runVolume(TOPS, T, true), 6);
  });

  it('T do degrau 3 no espelho de trás: fundo = 2h − T (decisão 0012 §2)', () => {
    const tread3 = stairBody(smooth).pieces.find((p) => p.kind === 'tread' && p.index === 3)!;
    const m = riserMid(smooth, 0, 3);
    expect(pieceBottomZ(tread3, m.x, m.y)).toBeCloseTo(2 * H - T, 9);
    expect(tread3.zTop).toBeCloseTo(3 * H, 9);
  });

  it('chegada: comprimento min(p, 0,30) = 0,28 m, largura w, topo na laje de cima (2,80 − 0,15); slabThickness muda o topo', () => {
    const arrival = stairBody(smooth).pieces.find((p) => p.kind === 'arrival')!;
    expect(multiArea([[arrival.polygon]])).toBeCloseTo(W * P, 9);
    expect(arrival.zTop).toBeCloseTo(2.8 - 0.15, 9);
    expect(stairBody(smooth, { slabThickness: 0.2 }).pieces.find((p) => p.kind === 'arrival')!.zTop).toBeCloseTo(2.6, 9);
  });

  it('estanqueidade (liso): o corte longitudinal não tem fresta em nenhum espelho, do 2º ao da chegada', () => {
    const { pieces } = stairBody(smooth);
    for (let j = 2; j <= N; j++) expectSealed(pieces, riserMid(smooth, 0, j), v(1, 0));
  });

  it('estanqueidade (escalonado): sem fresta em nenhum espelho, do 2º ao da chegada', () => {
    const { pieces } = stairBody(stepped);
    for (let j = 2; j <= N; j++) expectSealed(pieces, riserMid(stepped, 0, j), v(1, 0));
  });
});

describe('patamar e chegada com lances', () => {
  // Dois lances de 8 espelhos (7 degraus cada) e patamar: cota do patamar = 8h = 1,40 m. Tipo padrão (profundidade 0,20 m).
  const SD = 0.2;
  const T = tFor(SD);
  const TURN = { start: v(0, 0), dir: v(1, 0), width: W, risersFirst: 8, risersSecond: 8, tread: P, turn: 'left' as const };
  const L = resolveStair(fromSketch(generateLShape(TURN)));
  const U = resolveStair(fromSketch(generateUShape(TURN)));

  it('L: patamar à cota 8h, espessura h + T (fundo plano), área 1,44 m²', () => {
    const { pieces } = stairBody(L);
    const landing = pieces.find((p) => p.kind === 'landing')!;
    expect(landing.zTop).toBeCloseTo(8 * H, 9);
    expect(landing.bottom).toEqual({ a: 0, b: 0, c: 8 * H - H - T });
    expect(multiArea([[landing.polygon]])).toBeCloseTo(1.44, 9);
    expect(pieceVolume(landing)).toBeCloseTo(1.44 * (H + T), 9);
  });

  it('L: sem fresta entre o último degrau do 1º lance e o patamar, e entre o patamar e o 1º degrau do 2º lance', () => {
    const { pieces } = stairBody(L);
    expectSealed(pieces, riserMid(L, 0, 8), ascent(L, 0));
    expectSealed(pieces, riserMid(L, 2, 1), ascent(L, 2));
    expect(L.risers.find((r) => r.componentIndex === 2 && r.index === 1)!.z0).toBeCloseTo(8 * H, 9);
  });

  it('U: patamar à cota 8h, espessura h + T, e sem fresta nas duas junções', () => {
    const { pieces } = stairBody(U);
    const landing = pieces.find((p) => p.kind === 'landing')!;
    expect(landing.zTop).toBeCloseTo(8 * H, 9);
    expect(landing.bottom).toEqual({ a: 0, b: 0, c: 8 * H - H - T });
    expectSealed(pieces, riserMid(U, 0, 8), ascent(U, 0));
    expectSealed(pieces, riserMid(U, 2, 1), ascent(U, 2));
  });

  it('escada que termina em patamar não tem chegada', () => {
    const st = resolveStair([straight(8, P), rect(2.46, 3.66, W)]);
    expect(stairBody(st).pieces.some((p) => p.kind === 'arrival')).toBe(false);
  });
});

describe('leque e arco: peças disjuntas, fundos planos, sem peça abaixo de baseZ', () => {
  const cases: Array<[string, ReturnType<typeof generateFanRun>, number]> = [
    // 16 espelhos em 2,80 m: h = 0,175 m, abaixo do espelho máximo de 0,18 m (com menos espelhos há erro de norma).
    ['leque de 90°', generateFanRun({ center: v(0, 0), innerRadius: 1.0, outerRadius: 2.2, startAngle: 0, endAngle: Math.PI / 2, risers: N }), N - 1],
    ['arco de 180°', generateFanRun({ center: v(0, 0), innerRadius: 1.0, outerRadius: 1.8, startAngle: 0, endAngle: Math.PI, risers: N }), N - 1],
    // Acima de 180°: três trechos de arco por limite (decisão 0011 §4: ordem dos espelhos pela linha média).
    ['arco de 270°', generateFanRun({ center: v(0, 0), innerRadius: 1.0, outerRadius: 1.8, startAngle: 0, endAngle: (3 * Math.PI) / 2, risers: N }), N - 1],
  ];
  for (const [name, run, treads] of cases) {
    it(`${name}: ${treads} degraus com áreas > 0, sem sobreposição em planta e sem fundo abaixo de baseZ`, () => {
      const st = resolveStair([{ id: 'curva', kind: 'run', ...run }]);
      expect(st.issues.filter((i) => i.severity === 'error')).toEqual([]);
      const { pieces } = stairBody(st);
      // Cada degrau k (1..N−1) aparece em pelo menos uma peça; o corte pelo piso base pode dividir um degrau em duas.
      const indices = new Set(pieces.filter((p) => p.kind === 'tread').map((p) => p.index));
      expect([...indices].sort((a, b) => a - b)).toEqual(Array.from({ length: treads }, (_, k) => k + 1));
      let sum = 0;
      for (const p of pieces) {
        const area = multiArea([[p.polygon]]);
        expect(area).toBeGreaterThan(0);
        sum += area;
        for (const q of p.polygon) expect(pieceBottomZ(p, q.x, q.y)).toBeGreaterThanOrEqual(-1e-9);
      }
      expect(multiArea(union(...pieces.map((p) => asMulti(p.polygon))))).toBeCloseTo(sum, 6);
    });
  }
});

describe('piso e espelho: peças como antes', () => {
  const TURN = { start: v(0, 0), dir: v(1, 0), width: W, risersFirst: 8, risersSecond: 8, tread: P, turn: 'left' as const };
  const st = resolveStair(fromSketch(generateLShape(TURN)), ASSEMBLED);
  const { pieces } = stairBody(st);

  it('degraus com fundo plano zTop − espessura do piso; patamar zTop − espessura do patamar; sem chegada', () => {
    expect(pieces).toHaveLength(st.steps.length);
    expect(pieces.some((p) => p.kind === 'arrival')).toBe(false);
    for (const p of pieces) {
      expect(p.bottom.a).toBe(0);
      expect(p.bottom.b).toBe(0);
      expect(p.bottom.c).toBeCloseTo(p.zTop - (p.kind === 'tread' ? 0.03 : 0.15), 9);
    }
  });
});

describe('winder sem patamar (espelho de emenda conta uma vez): volume e estanqueidade na junção', () => {
  // Lance 1: 8 espelhos (7 degraus); leque de 3 espelhos (2 degraus); lance 2: 7 espelhos (6 degraus).
  // N = 8 + 3 + 7 − 2 = 16 linhas distintas; H = 2,80 m ⇒ h = 0,175 m. Degraus retos com profundidade p = 0,28 m.
  const SD = 0.15;
  const T = tFor(SD);
  const comps = generateWinderL({ start: v(0, 0), dir: v(1, 0), width: W, risersFirst: 8, risersSecond: 7, tread: P, turn: 'left' });
  const WIN = resolveStair(fromSketch(comps), MONO, { structuralDepth: SD, undersideStyle: 'smooth' });
  const { pieces } = stairBody(WIN);

  /** Ponto médio do espelho de nº global `n` (1..N). */
  const midOfNumber = (n: number): Vec2 => {
    const r = WIN.risers.find((x) => Math.round((x.z0 - WIN.baseZ) / WIN.riserHeight) + 1 === n)!;
    return mid(r.a, r.b);
  };

  it('N = 16 linhas distintas (a emenda não conta duas vezes) e altura real = H ÷ N = 0,175 m', () => {
    expect(WIN.riserCount).toBe(16);
    expect(WIN.riserHeight).toBeCloseTo(2.8 / 16, 12);
    expect(WIN.risers.map((r) => Math.round((r.z0 - WIN.baseZ) / WIN.riserHeight) + 1)).toEqual(Array.from({ length: 16 }, (_, k) => k + 1));
    expect(WIN.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('volume dos degraus retos de cada lance = integral de referência (lance 1 cortado pelo piso base; lance 2 com a cota 9h)', () => {
    const tops1 = Array.from({ length: 7 }, (_, k) => (k + 1) * H);
    const tops2 = Array.from({ length: 6 }, (_, k) => (9 + k + 1) * H);
    const volume = (ci: number): number => pieces.filter((p) => p.kind === 'tread' && p.componentIndex === ci).reduce((s, p) => s + pieceVolume(p), 0);
    expect(volume(0)).toBeCloseTo(runVolume(tops1, T, false), 6);
    expect(volume(2)).toBeCloseTo(runVolume(tops2, T, false), 6);
    // O leque tem volume positivo (aproximação com fundo plano).
    expect(volume(1)).toBeGreaterThan(0);
  });

  it('estanqueidade do corte longitudinal em todos os espelhos, inclusive as duas emendas (2º ao 16º, e a chegada)', () => {
    for (let j = 2; j <= 16; j++) expectSealed(pieces, midOfNumber(j), norm(sub(midOfNumber(j), midOfNumber(j - 1))));
  });

  it('sem sobreposição em planta entre peças, e nenhum fundo abaixo de baseZ', () => {
    let sum = 0;
    for (const p of pieces) {
      sum += multiArea([[p.polygon]]);
      for (const q of p.polygon) expect(pieceBottomZ(p, q.x, q.y)).toBeGreaterThanOrEqual(-1e-6);
    }
    expect(multiArea(union(...pieces.map((p) => asMulti(p.polygon))))).toBeCloseTo(sum, 6);
  });
});

describe('escada com erro de croqui', () => {
  it('sem componentes: erro stair-empty e nenhuma peça', () => {
    const st = resolveStair([]);
    expect(st.issues.some((i) => i.code === 'stair-empty' && i.severity === 'error')).toBe(true);
    expect(stairBody(st)).toEqual({ pieces: [] });
  });
});
