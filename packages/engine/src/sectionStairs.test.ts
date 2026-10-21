import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import {
  ProjectStore,
  createEmptyProject,
  defaultStairTypeId,
  makeStair,
  type Project,
  type StairCurve,
  type StairLanding,
  type StairRun,
} from '@hestia/model';
import { computeSection, lineIntervals, resolveStairs, type SectionResult } from './index.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

/**
 * Lance reto em +x: espelhos em `xs`, cada um com desvio lateral `slant[k]` (espelho inclinado: x ± s·y). Limites em
 * y = ±0,6 (largura 1,20 m), estendidos `ext0` antes do 1º espelho e `ext1` depois do último.
 */
function runAt(xs: number[], o: { slant?: number[]; ext0?: number; ext1?: number; width?: number } = {}): StairRun {
  const w = o.width ?? 1.2;
  const s = (k: number): number => o.slant?.[k] ?? 0;
  const a = xs[0]! - (o.ext0 ?? 0.3);
  const b = xs[xs.length - 1]! + (o.ext1 ?? 0.3);
  return {
    id: `run${xs[0]}`,
    kind: 'run',
    boundaryLeft: [ln(a, w / 2, b, w / 2)],
    boundaryRight: [ln(a, -w / 2, b, -w / 2)],
    risers: xs.map((x, k) => ln(x - s(k), -1, x + s(k), 1)),
    path: [],
  };
}

/** Patamar retangular x0..x1 × ±0,6 (laço fechado). */
function landingRect(x0: number, x1: number): StairLanding {
  return {
    id: 'landing',
    kind: 'landing',
    boundary: [ln(x0, -0.6, x1, -0.6), ln(x1, -0.6, x1, 0.6), ln(x1, 0.6, x0, 0.6), ln(x0, 0.6, x0, -0.6)],
  };
}

/** Térreo (0 m) e pavimento 2 a 2,80 m; escada `st1` no térreo com topo no pavimento 2. */
function build(components: Array<StairRun | StairLanding>, typeId = defaultStairTypeId): Project {
  const base = createEmptyProject();
  const store = new ProjectStore({ ...base, levels: base.levels.map((l) => (l.id === 'lv_1' ? { ...l, elevation: 2.8 } : l)) });
  store.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId, levelId: 'lv_0', components }) });
  return store.project;
}

/** 16 espelhos a cada 0,28 m a partir de x = 0 (h = 2,80 ÷ 16 = 0,175 m; 15 degraus). */
const SIXTEEN = Array.from({ length: 16 }, (_, k) => k * 0.28);
const H = 0.175;
const CONCRETE = 'mat_concreto';

/** Intervalos de z (cota) em que o corte do material cobre a vertical de abscissa t (t = distância ao longo da linha). */
const zIntervalsAt = (r: SectionResult, materialId: string, t: number): Array<[number, number]> =>
  r.cut
    .filter((c) => c.materialId === materialId)
    .flatMap((c) => c.polygons.flatMap((poly) => lineIntervals(poly, v(t, 0), v(0, 1), v(1, 0))));

const coveredAt = (r: SectionResult, materialId: string, t: number, z: number): boolean =>
  zIntervalsAt(r, materialId, t).some(([z0, z1]) => z >= z0 - 1e-6 && z <= z1 + 1e-6);

/** Linha longitudinal sobre o eixo do lance: a = (−1, 0), b = (6, 0); t = x + 1. */
const LONG = { a: v(-1, 0), b: v(6, 0), depth: 2 };

describe('escada no corte longitudinal (monolítica, 16 espelhos, h 0,175, piso 0,28, estrutural 0,20)', () => {
  const p = build([runAt(SIXTEEN)]);

  it('o motor resolve a escada com 15 degraus e h = 0,175', () => {
    const [r] = resolveStairs(p);
    expect(r!.riserHeight).toBeCloseTo(H, 9);
    expect(r!.steps.filter((s) => s.kind === 'tread')).toHaveLength(15);
  });

  it('perfil superior: cada degrau k tem topo em k·0,175 e ocupa 0,28 m de passo', () => {
    const r = computeSection(p, LONG);
    for (let k = 1; k <= 15; k++) {
      const x0 = (k - 1) * 0.28;
      // amostras perto das duas bordas do degrau e uma já no degrau seguinte
      for (const dx of [0.02, 0.14, 0.26]) {
        const top = Math.max(...zIntervalsAt(r, CONCRETE, x0 + dx + 1).map(([, z1]) => z1));
        expect(top).toBeCloseTo(k * H, 6);
      }
    }
    // a borda entre degraus fica em múltiplos de 0,28: logo depois do espelho, o topo sobe um degrau
    const after = Math.max(...zIntervalsAt(r, CONCRETE, 0.28 + 0.02 + 1).map(([, z1]) => z1));
    expect(after).toBeCloseTo(2 * H, 6);
  });

  it('a hachura (material do corte) cobre a profundidade estrutural de 0,20 m sob cada degrau', () => {
    const r = computeSection(p, LONG);
    for (let k = 1; k <= 15; k++) {
      const t = (k - 1) * 0.28 + 0.14 + 1;
      const hit = zIntervalsAt(r, CONCRETE, t).filter(([, hi]) => Math.abs(hi - k * H) < 1e-6);
      expect(hit).toHaveLength(1);
      const [z0, z1] = hit[0]!;
      expect(z1 - z0).toBeCloseTo(0.2, 6);
      expect(z1).toBeCloseTo(k * H, 6);
    }
  });

  it('o corte não sai do conjunto da escada: nada abaixo de −0,20 m nem acima do último degrau', () => {
    const r = computeSection(p, LONG);
    expect(r.zMin).toBeCloseTo(H - 0.2, 6);
    expect(r.zMax).toBeCloseTo(15 * H, 6);
  });
});

describe('corte transversal', () => {
  it('o retângulo do degrau tem a largura do lance (1,20 m) e a espessura estrutural', () => {
    const p = build([runAt(SIXTEEN)]);
    // degrau 5: x de 1,12 a 1,40; a linha corta o lance no meio, de y = −1 a y = 1 (t = y + 1)
    const xc = 4 * 0.28 + 0.14;
    const r = computeSection(p, { a: v(xc, -1), b: v(xc, 1), depth: 2 });
    const cut = r.cut.filter((c) => c.materialId === CONCRETE);
    expect(cut).toHaveLength(1);
    expect(multiArea(cut[0]!.polygons)).toBeCloseTo(1.2 * 0.2, 6);
    const ts = cut[0]!.polygons.flat(2).map((q) => q.x);
    expect(Math.min(...ts)).toBeCloseTo(0.4, 6);
    expect(Math.max(...ts)).toBeCloseTo(1.6, 6);
    const zs = cut[0]!.polygons.flat(2).map((q) => q.y);
    expect(Math.min(...zs)).toBeCloseTo(5 * H - 0.2, 6);
    expect(Math.max(...zs)).toBeCloseTo(5 * H, 6);
  });
});

describe('elevação', () => {
  it('sem corte: cada degrau aparece além do plano como contorno (15 entradas, depth = 2,40 m)', () => {
    const p = build([runAt(SIXTEEN)]);
    const r = computeSection(p, { a: v(-1, -3), b: v(6, -3), depth: 6 });
    expect(r.cut).toHaveLength(0);
    const beyond = r.beyond.filter((b) => b.stairId === 'st1');
    expect(beyond).toHaveLength(15);
    expect(Math.min(...beyond.map((b) => b.depth))).toBeCloseTo(2.4, 6);
    expect(beyond.every((b) => b.materialId === CONCRETE)).toBe(true);
  });

  it('montado: os espelhos aparecem como lâminas finas (2 cm) além do plano', () => {
    const p = build([runAt(SIXTEEN)], 'stt_piso_espelho');
    const r = computeSection(p, { a: v(-1, -3), b: v(6, -3), depth: 6 });
    const beyond = r.beyond.filter((b) => b.stairId === 'st1');
    // 15 pisos (0,03 m de espessura) e 16 espelhos (0,02 m)
    expect(beyond).toHaveLength(31);
    const widths = beyond.map((b) => {
      const ts = b.polygons.flat(2).map((q) => q.x);
      return Math.max(...ts) - Math.min(...ts);
    });
    expect(widths.filter((w) => Math.abs(w - 0.02) < 1e-6)).toHaveLength(16);
  });
});

describe('espelhos montados no corte longitudinal', () => {
  it('a lâmina do espelho fica atrás da linha de espelho, entre as cotas do próprio espelho', () => {
    const p = build([runAt(SIXTEEN)], 'stt_piso_espelho');
    const r = computeSection(p, LONG);
    // espelho 5 (x = 1,12), entre 0,70 e 0,875; a lâmina ocupa x de 1,10 a 1,12 (t = 2,10 a 2,12)
    expect(coveredAt(r, 'mat_madeira', 2.11, 0.8)).toBe(true);
    expect(coveredAt(r, 'mat_madeira', 2.09, 0.8)).toBe(false);
    // o piso sobre o degrau 4 tem 0,03 m de espessura
    expect(coveredAt(r, 'mat_madeira', 0.98 + 1, 0.7 - 0.02)).toBe(true);
    expect(coveredAt(r, 'mat_madeira', 0.98 + 1, 0.7 - 0.04)).toBe(false);
  });
});

describe('patamar', () => {
  it('o patamar corta de z − 0,15 até z (cota do último espelho do lance anterior)', () => {
    // 8 espelhos em x = 0..1,96; patamar de 2,06 a 2,90; 8 espelhos em x = 3,00..4,96
    const run2 = Array.from({ length: 8 }, (_, k) => 3.0 + k * 0.28);
    const p = build([runAt(SIXTEEN.slice(0, 8), { ext1: 0.1 }), landingRect(2.06, 2.9), runAt(run2, { ext0: 0.1 })]);
    const r = computeSection(p, LONG);
    const z = 8 * H;
    expect(coveredAt(r, CONCRETE, 3.5, z - 0.05)).toBe(true);
    expect(coveredAt(r, CONCRETE, 3.5, z - 0.16)).toBe(false);
    expect(coveredAt(r, CONCRETE, 3.5, z + 0.01)).toBe(false);
  });
});

describe('sem escadas', () => {
  it('a seção de um projeto sem escada não ganha itens de escada', () => {
    const base = createEmptyProject();
    const store = new ProjectStore(base);
    const r = computeSection(store.project, LONG);
    expect(r.beyond.some((b) => b.stairId !== undefined)).toBe(false);
    expect(r.cut.some((c) => c.materialId === CONCRETE)).toBe(false);
  });
});
