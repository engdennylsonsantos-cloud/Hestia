import { describe, expect, it } from 'vitest';
import { multiArea, ringArea, type Vec2 } from '@hestia/geom';
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
import { resolveStairs, resolveStairsOnLevel, type ResolvedStair } from './stairs.ts';
import { stairIssueList } from './stairChecks.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

/** Lance reto no sentido +x: n espelhos verticais a cada `spacing` a partir de x0; limites em y = ±w/2. */
function straight(n: number, spacing: number, width = 1.2, x0 = 0, ext0 = 0.5, ext1 = 0.5): StairRun {
  const xs = Array.from({ length: n }, (_, k) => x0 + k * spacing);
  const a = x0 - ext0;
  const b = x0 + (n - 1) * spacing + ext1;
  return {
    id: 'run',
    kind: 'run',
    boundaryLeft: [ln(a, width / 2, b, width / 2)],
    boundaryRight: [ln(a, -width / 2, b, -width / 2)],
    risers: xs.map((x) => ln(x, -1, x, 1)),
    path: [],
  };
}

/** Patamar retangular de x0 a x1 e largura w (laço fechado). */
function rect(x0: number, x1: number, w: number): StairLanding {
  const h = w / 2;
  return {
    id: 'landing',
    kind: 'landing',
    boundary: [ln(x0, -h, x1, -h), ln(x1, -h, x1, h), ln(x1, h, x0, h), ln(x0, h, x0, -h)],
  };
}

interface Opts {
  levelId?: string;
  topOffset?: number;
  height?: number;
}

/** Projeto com a escada `st1` criada pelo comando addStair. Padrão: térreo (0 m) com o pavimento 2 (3 m) acima e H = 2,80 m. */
function projectWith(components: Array<StairRun | StairLanding>, o: Opts = {}): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({
    type: 'addStair',
    stair: makeStair({
      id: 'st1',
      typeId: defaultStairTypeId,
      levelId: o.levelId ?? 'lv_0',
      topOffset: o.topOffset ?? -0.2,
      height: o.height ?? 2.8,
      components,
    }),
  });
  return s.project;
}

const only = (p: Project): ResolvedStair => {
  const list = resolveStairs(p);
  expect(list).toHaveLength(1);
  return list[0]!;
};

const treads = (rs: ResolvedStair): ResolvedStair['steps'] => rs.steps.filter((s) => s.kind === 'tread');
const area = (ring: Vec2[]): number => Math.abs(ringArea(ring));

describe('escada reta de referência', () => {
  // 16 espelhos a cada 0,28 m, H = 2,80 m: h = 0,175 m; ceil(2,8 / 0,18) = 16, então sem aviso de contagem.
  const rs = only(projectWith([straight(16, 0.28)]));

  it('N = 16, h = H ÷ N = 0,175 m, cotas base 0 e topo 2,80 m', () => {
    expect(rs.riserCount).toBe(16);
    expect(rs.riserHeight).toBeCloseTo(0.175, 12);
    expect(rs.baseZ).toBe(0);
    expect(rs.topZ).toBeCloseTo(2.8, 12);
    expect(rs.riserHeight * rs.riserCount).toBeCloseTo(rs.topZ - rs.baseZ, 12);
  });

  it('15 degraus (N−1) com topo em base + k·h, cada um de 0,28 × 1,20 m', () => {
    const t = treads(rs);
    expect(t).toHaveLength(15);
    t.forEach((s, i) => {
      expect(s.index).toBe(i + 1);
      expect(s.componentIndex).toBe(0);
      expect(s.z).toBeCloseTo((i + 1) * 0.175, 9);
      expect(area(s.polygon)).toBeCloseTo(0.28 * 1.2, 9);
    });
    expect(multiArea(rs.footprint)).toBeCloseTo(15 * 0.28 * 1.2, 6);
  });

  it('16 espelhos na ordem de subida, cada um de z0 = (k−1)·h a z1 = k·h', () => {
    expect(rs.risers.map((r) => r.index)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    rs.risers.forEach((r, i) => {
      expect(r.z0).toBeCloseTo(i * 0.175, 9);
      expect(r.z1).toBeCloseTo((i + 1) * 0.175, 9);
    });
  });

  it('sem avisos: todas as normas são atendidas', () => {
    expect(rs.issues).toEqual([]);
  });
});

describe('cotas, patamar e níveis', () => {
  it('lance, patamar e lance: patamar à cota base + 8h e segundo lance começa ali', () => {
    // Lance 1: 8 espelhos em x = 0..1,96; patamar de 2,46 a 3,66 m; lance 2: 8 espelhos a partir de 3,66 m.
    const rs = only(
      projectWith([straight(8, 0.28, 1.2, 0, 0.5, 0.5), rect(2.46, 3.66, 1.2), straight(8, 0.28, 1.2, 3.66, 0.5, 0.5)]),
    );
    expect(rs.riserCount).toBe(16);
    const landing = rs.steps.find((s) => s.kind === 'landing')!;
    expect(landing).toMatchObject({ componentIndex: 1, index: 1 });
    expect(landing.z).toBeCloseTo(8 * 0.175, 9);
    expect(area(landing.polygon)).toBeCloseTo(1.44, 9);
    const second = rs.risers.filter((r) => r.componentIndex === 2);
    expect(second[0]!.z0).toBeCloseTo(1.4, 9);
    expect(second[second.length - 1]!.z1).toBeCloseTo(2.8, 9);
    const treadsSecond = treads(rs).filter((s) => s.componentIndex === 2);
    expect(treadsSecond).toHaveLength(7);
    expect(treadsSecond[0]!.z).toBeCloseTo(1.4 + 0.175, 9);
    expect(rs.issues).toEqual([]);
  });

  it('topo no nível de cima (3 m) quando a escada está no térreo', () => {
    const rs = only(projectWith([straight(17, 0.28)], { topOffset: 0 }));
    expect(rs.topZ).toBeCloseTo(3, 12);
    expect(rs.topLevelId).toBe('lv_1');
    expect(rs.riserHeight).toBeCloseTo(3 / 17, 12);
  });

  it('sem nível acima usa height: base 3 m e topo 3 m + 2,80 m', () => {
    const rs = only(projectWith([straight(16, 0.28)], { levelId: 'lv_1' }));
    expect(rs.topLevelId).toBeNull();
    expect(rs.baseZ).toBe(3);
    expect(rs.topZ).toBeCloseTo(5.8, 12);
    expect(treads(rs)[0]!.z).toBeCloseTo(3 + 0.175, 9);
  });

  it('nível de topo explícito (topLevelId) vale sobre o nível imediatamente acima', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'upsertLevel', level: { id: 'lv_2', name: 'Cobertura', elevation: 6 } });
    s.exec({
      type: 'addStair',
      stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', topLevelId: 'lv_2', topOffset: 0, components: [straight(34, 0.28)] }),
    });
    const rs = only(s.project);
    expect(rs.topLevelId).toBe('lv_2');
    expect(rs.topZ).toBeCloseTo(6, 12);
    expect(rs.riserHeight).toBeCloseTo(6 / 34, 12);
  });

  it('resolveStairsOnLevel devolve só as escadas do nível dado', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({
      type: 'addStair',
      stair: makeStair({ id: 'a', typeId: defaultStairTypeId, levelId: 'lv_0', topOffset: -0.2, components: [straight(16, 0.28)] }),
    });
    s.exec({
      type: 'addStair',
      stair: makeStair({ id: 'b', typeId: defaultStairTypeId, levelId: 'lv_1', components: [straight(16, 0.28)] }),
    });
    expect(resolveStairsOnLevel(s.project, 'lv_0').map((r) => r.id)).toEqual(['a']);
    expect(resolveStairsOnLevel(s.project, 'lv_1').map((r) => r.id)).toEqual(['b']);
    expect(resolveStairs(s.project).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('erros de croqui e de geometria', () => {
  it('sem espelhos: erro stair-empty e nenhum degrau', () => {
    const rs = only(projectWith([{ id: 'r', kind: 'run', boundaryLeft: [ln(0, 0.6, 2, 0.6)], boundaryRight: [ln(0, -0.6, 2, -0.6)], risers: [], path: [] }]));
    expect(rs.riserCount).toBe(0);
    expect(rs.riserHeight).toBe(0);
    expect(rs.steps).toEqual([]);
    expect(rs.footprint).toEqual([]);
    expect(rs.issues.map((i) => [i.code, i.severity])).toEqual([['stair-empty', 'error']]);
  });

  it('erro de croqui num lance não gera os degraus dele; os demais componentes continuam', () => {
    // Lance 0: 8 espelhos e um nono que não liga os limites (erro). Lance 2: 7 espelhos. N = 16, h = 0,175 m.
    const bad: StairRun = {
      ...straight(8, 0.28),
      risers: [...straight(8, 0.28).risers, ln(0.5, 0, 0.6, 0)],
    };
    const rs = only(projectWith([bad, rect(2.46, 3.66, 1.2), straight(7, 0.28, 1.2, 3.66, 0.5, 0.5)]));
    expect(rs.riserCount).toBe(16);
    expect(rs.issues.find((i) => i.code === 'stair-riser-not-spanning')).toMatchObject({ severity: 'error', componentIndex: 0 });
    expect(rs.steps.filter((s) => s.componentIndex === 0)).toEqual([]);
    expect(rs.risers.filter((r) => r.componentIndex === 0)).toEqual([]);
    const landing = rs.steps.find((s) => s.kind === 'landing')!;
    expect(landing.z).toBeCloseTo(9 * 0.175, 9);
    expect(treads(rs).filter((s) => s.componentIndex === 2)).toHaveLength(6);
  });

  it('patamar com contorno aberto: erro stair-landing-open e sem polígono', () => {
    const open: StairLanding = { id: 'l', kind: 'landing', boundary: [ln(2.46, -0.6, 3.66, -0.6), ln(3.66, -0.6, 3.66, 0.6), ln(3.66, 0.6, 2.46, 0.6)] };
    const rs = only(projectWith([straight(16, 0.28), open]));
    expect(rs.steps.some((s) => s.kind === 'landing')).toBe(false);
    expect(rs.issues).toContainEqual(expect.objectContaining({ code: 'stair-landing-open', severity: 'error', componentIndex: 1 }));
  });

  it('escada sem tipo no projeto não é resolvida (o validador do modelo aponta)', () => {
    const p = projectWith([straight(16, 0.28)]);
    const broken: Project = { ...p, stairTypes: {} };
    expect(resolveStairs(broken)).toEqual([]);
    expect(stairIssueList(broken)).toEqual([]);
  });
});

describe('propriedades de escadas retas (casos determinísticos)', () => {
  /** Gerador determinístico (mulberry32): mesma semente, mesmos casos. */
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

  it('100 escadas aleatórias: N−1 degraus, cotas em passo h, H = N·h e área de degrau = passo × largura', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = rng(seed);
      const n = 2 + Math.floor(r() * 19);
      const spacing = 0.22 + r() * 0.12;
      const width = 0.7 + r() * 0.8;
      const H = 0.5 + r() * 3.5;
      const rs = only(projectWith([straight(n, spacing, width)], { topOffset: H - 3 }));
      const h = H / n;
      expect(rs.riserCount).toBe(n);
      expect(rs.riserHeight).toBeCloseTo(h, 12);
      expect(rs.riserHeight * rs.riserCount).toBeCloseTo(rs.topZ - rs.baseZ, 9);
      const t = treads(rs);
      expect(t).toHaveLength(n - 1);
      t.forEach((s, k) => {
        expect(s.index).toBe(k + 1);
        expect(s.z).toBeCloseTo((k + 1) * h, 9);
        expect(area(s.polygon)).toBeCloseTo(spacing * width, 9);
      });
      expect(rs.risers).toHaveLength(n);
      rs.risers.forEach((rr, k) => {
        expect(rr.z1 - rr.z0).toBeCloseTo(h, 9);
        expect(rr.z0).toBeCloseTo(k * h, 9);
      });
      expect(multiArea(rs.footprint)).toBeCloseTo((n - 1) * spacing * width, 6);
    }
  });
});
