import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import {
  DEFAULT_STAIR_TYPES,
  ProjectStore,
  createEmptyProject,
  makeStair,
  type Project,
  type StairLanding,
  type StairRun,
  type StairType,
} from '@hestia/model';
import { fitSegment, optimizeStair, planStairFree, turnRecuo, type StairFreePlan } from './stairFree.ts';
import { layoutStairSegment, stairLiveParams } from './stairLive.ts';
import { riserCountFor, treadFor, treadRuleOf, type StairComponentSketch } from './stairGenerators.ts';
import { resolveStairOne } from './stairs.ts';
import { stairLandingPolygon } from './stairSketch.ts';

const mono = DEFAULT_STAIR_TYPES.find((t) => t.id === 'stt_monolitica')!;
const v = (x: number, y: number): Vec2 => ({ x, y });
const plan = (path: Vec2[], H: number, width: number, extra: Partial<Parameters<typeof planStairFree>[3]> = {}, type: StairType = mono): StairFreePlan => {
  const r = planStairFree(path, H, type, { width, ...extra });
  if ('error' in r) throw new Error(r.error);
  return r;
};
const err = (path: Vec2[], H: number, width: number, extra: Partial<Parameters<typeof planStairFree>[3]> = {}): string => {
  const r = planStairFree(path, H, mono, { width, ...extra });
  if (!('error' in r)) throw new Error('esperava erro');
  return r.error;
};
const runs = (p: StairFreePlan) => p.parts.flatMap((c) => (c.kind === 'run' ? [c.run] : []));
const risersOf = (p: StairFreePlan): number[] => runs(p).map((r) => r.risers.length);
const kinds = (p: StairFreePlan): string[] => p.parts.map((c) => (c.kind === 'run' ? `run${c.run.risers.length}` : 'landing'));
const ringOf = (c: StairComponentSketch): Vec2[] => (c.kind === 'landing' ? stairLandingPolygon(c.landing).polygon! : []);
const center = (r: { a: Vec2; b: Vec2 }): Vec2 => v((r.a.x + r.b.x) / 2, (r.a.y + r.b.y) / 2);
const near = (a: Vec2, b: Vec2, tol = 1e-9): void => {
  expect(a.x).toBeCloseTo(b.x, -Math.log10(tol));
  expect(a.y).toBeCloseTo(b.y, -Math.log10(tol));
};

describe('turnRecuo e fitSegment', () => {
  it('θ = 90°, w = 1,2, D = w: tMin = tPref = 0,6', () => {
    const r = turnRecuo(Math.PI / 2, 1.2, 1.2);
    expect(r.tMin).toBeCloseTo(0.6, 12);
    expect(r.tPref).toBeCloseTo(0.6, 12);
  });
  it('θ = 60°: tMin = 0,5·tan30° e tPref = D²/(2w) quando maior', () => {
    const r = turnRecuo(Math.PI / 3, 1, 1);
    expect(r.tMin).toBeCloseTo(0.5 * Math.tan(Math.PI / 6), 12);
    expect(r.tPref).toBeCloseTo(0.5, 12);
  });
  const tin = { tMin: 0.4, tPref: 0.6 };
  const tout = { tMin: 0.3, tPref: 0.5 };
  it('pref: cabe com os recuos preferidos', () => {
    expect(fitSegment(3, 0.28, tin, tout)).toEqual({ kind: 'run', bIn: 0.6, aOut: 0.5, span: 1.9 });
  });
  it('min: não cabe com os preferidos, cabe com os mínimos', () => {
    const f = fitSegment(1, 0.28, tin, tout);
    expect(f.kind).toBe('run');
    expect(f.bIn).toBe(0.4);
    expect(f.aOut).toBe(0.3);
    expect(f.span).toBeCloseTo(0.3, 12);
  });
  it('pass: entre duas curvas, sem espaço para um lance; usa tPref se o vão não é negativo, senão tMin', () => {
    // Giros de 90°: tMin = tPref, então sobra o retângulo de 0,1 m entre os dois recuos de 0,6 m.
    const r = { tMin: 0.6, tPref: 0.6 };
    const f = fitSegment(1.3, 0.28, r, r);
    expect(f.kind).toBe('pass');
    expect(f.bIn).toBe(0.6);
    expect(f.aOut).toBe(0.6);
    expect(f.span).toBeCloseTo(0.1, 12);
    const g = fitSegment(0.9, 0.28, tin, tout);
    expect(g.kind).toBe('pass');
    expect(g.bIn).toBe(0.4);
    expect(g.aOut).toBe(0.3);
    expect(g.span).toBeCloseTo(0.2, 12);
  });
  it('short: menor que a soma dos recuos mínimos', () => {
    expect(fitSegment(0.6, 0.28, tin, tout).kind).toBe('short');
  });
  it('ponta de trajeto: sem curva num lado nunca é pass', () => {
    expect(fitSegment(0.9, 0.28, null, tout)).toMatchObject({ kind: 'run', bIn: 0, aOut: 0.5 });
    expect(fitSegment(0.7, 0.28, null, tout)).toMatchObject({ kind: 'run', aOut: 0.3 });
    expect(fitSegment(0.5, 0.28, null, tout).kind).toBe('short');
    expect(fitSegment(0.4, 0.28, tin, null).kind).toBe('short');
    expect(fitSegment(2, 0.28, null, null)).toEqual({ kind: 'run', bIn: 0, aOut: 0, span: 2 });
  });
});

describe('planStairFree: exemplos do contrato', () => {
  it('Exemplo 1: reta de 5 m, H = 2,80: 1 lance de 16 espelhos, termina em 4,20', () => {
    const p = plan([v(0, 0), v(5, 0)], 2.8, 1.2);
    expect(p.risers).toBe(16);
    expect(p.riserHeight).toBeCloseTo(0.175, 12);
    expect(p.tread).toBeCloseTo(0.28, 12);
    expect(kinds(p)).toEqual(['run16']);
    expect(p.runs).toBe(1);
    expect(p.landings).toBe(0);
    expect(p.path).toHaveLength(2);
    near(p.path[0]!, v(0, 0));
    near(p.path[1]!, v(4.2, 0));
    expect(p.slack).toBeCloseTo(0.8, 9);
    expect(p.extended).toBe(0);
    expect(p.truncated).toBe(false);
    expect(p.note).toBe('A escada termina 0,80 m antes do último ponto.');
  });

  it('Exemplo 1b: H = 3,60 e 7 m: lances de 17 e 3 espelhos e 1 patamar em linha', () => {
    const p = plan([v(0, 0), v(7, 0)], 3.6, 1.2);
    expect(p.risers).toBe(20);
    expect(kinds(p)).toEqual(['run17', 'landing', 'run3']);
    expect(p.landings).toBe(1);
    expect(p.runs).toBe(2);
    near(p.path[1]!, v(6.24, 0));
    expect(p.slack).toBeCloseTo(0.76, 9);
  });

  it('Exemplo 2: L de 3 + 2 m, w = 1,00: lance(9), giro, lance(7); trajeto estendido em 0,18', () => {
    const p = plan([v(0, 0), v(3, 0), v(3, 2)], 2.8, 1.0);
    expect(kinds(p)).toEqual(['run9', 'landing', 'run7']);
    expect(p.runs).toBe(2);
    expect(p.landings).toBe(1);
    expect(p.path).toHaveLength(3);
    near(p.path[2]!, v(3, 2.18));
    expect(p.extended).toBeCloseTo(0.18, 9);
    expect(p.slack).toBe(0);
    expect(p.note).toBe('Trajeto estendido em 0,18 m para completar 16 espelhos.');
    // 1º lance: último espelho em x = 2,24.
    const r1 = runs(p)[0]!;
    near(center(r1.risers[8]!), v(2.24, 0));
    near(center(r1.risers[0]!), v(0, 0));
    // Anel compactado de 5 pontos.
    const ring = ringOf(p.parts[1]!);
    expect(ring).toHaveLength(5);
    const want = [v(2.24, 0.5), v(2.5, 0.5), v(3.5, 0.5), v(3.5, -0.5), v(2.24, -0.5)];
    want.forEach((w, i) => near(ring[i]!, w));
    // 2º lance: 1º espelho em y = 0,5, último em 0,5 + 6 × 0,28 = 2,18.
    const r2 = runs(p)[1]!;
    near(center(r2.risers[0]!), v(3, 0.5));
    near(center(r2.risers[6]!), v(3, 2.18));
  });

  it('Exemplo 3: U com 3 trechos, w = 1,20: lance(9), giro, passagem, giro, lance(7)', () => {
    const p = plan([v(0, 0), v(3, 0), v(3, 1.3), v(0, 1.3)], 2.8, 1.2);
    expect(p.parts).toHaveLength(5);
    expect(kinds(p)).toEqual(['run9', 'landing', 'landing', 'landing', 'run7']);
    expect(p.runs).toBe(2);
    expect(p.landings).toBe(3);
    near(p.path[3]!, v(0.72, 1.3));
    expect(p.slack).toBeCloseTo(0.72, 9);
    expect(p.note).toBe('A escada termina 0,72 m antes do último ponto.');
    // Passagem: retângulo de 0,1 m (y de 0,6 a 0,7) × 1,2.
    const pass = ringOf(p.parts[2]!);
    const ys = pass.map((q) => q.y);
    expect(Math.min(...ys)).toBeCloseTo(0.6, 9);
    expect(Math.max(...ys)).toBeCloseTo(0.7, 9);
    // Os dois lances não se tocam (vão de 0,10 m, como generateUShape).
    const r1 = runs(p)[0]!;
    const r3 = runs(p)[1]!;
    expect(Math.max(...[r1.risers[0]!.a.y, r1.risers[0]!.b.y])).toBeCloseTo(0.6, 9);
    expect(Math.min(...[r3.risers[0]!.a.y, r3.risers[0]!.b.y])).toBeCloseTo(0.7, 9);
    near(center(r3.risers[0]!), v(2.4, 1.3));
    near(center(r3.risers[6]!), v(0.72, 1.3));
  });
});

describe('planStairFree: tabela de bordas', () => {
  it('menos de 2 pontos distintos', () => {
    expect(err([v(0, 0)], 2.8, 1.2)).toBe('O trajeto precisa de ao menos dois pontos distintos.');
    expect(err([], 2.8, 1.2)).toBe('O trajeto precisa de ao menos dois pontos distintos.');
    expect(err([v(1, 1), v(1, 1.005)], 2.8, 1.2)).toBe('O trajeto precisa de ao menos dois pontos distintos.');
  });
  it('um trecho só: mesmo N, h e T da escada reta', () => {
    const p = plan([v(0, 0), v(6, 0)], 2.8, 1.2);
    const N = riserCountFor(2.8, mono.maxRiser);
    expect(p.risers).toBe(N);
    expect(p.riserHeight).toBeCloseTo(2.8 / N, 12);
    expect(p.tread).toBeCloseTo(treadFor(2.8 / N, treadRuleOf(mono)), 12);
    expect(kinds(p)).toEqual([`run${N}`]);
  });
  it('trecho curto demais entre curvas', () => {
    // Trecho do meio de 0,5 m entre dois giros de 90° com w = 1,2 (tMin 0,6 + 0,6).
    expect(err([v(0, 0), v(3, 0), v(3, 0.5), v(0, 0.5)], 2.8, 1.2)).toBe('O trecho 2 é curto demais para o patamar de giro.');
  });
  it('1º trecho não comporta 2 espelhos', () => {
    expect(err([v(0, 0), v(0.7, 0), v(0.7, 3)], 2.8, 1.2)).toBe('O 1º trecho é curto demais para um lance (mínimo 2 espelhos).');
  });
  it('último trecho curto é estendido sem erro', () => {
    const p = plan([v(0, 0), v(3, 0), v(3, 0.3)], 2.8, 1.0);
    expect(p.extended).toBeGreaterThan(1);
    expect(risersOf(p).reduce((a, b) => a + b, 0)).toBe(16);
    expect(p.note).toMatch(/^Trajeto estendido em \d,\d\d m para completar 16 espelhos\.$/);
  });
  it('retorno agudo (θ = 170°)', () => {
    const a = (170 * Math.PI) / 180;
    expect(err([v(0, 0), v(3, 0), v(3 + 3 * Math.cos(a), 3 * Math.sin(a))], 2.8, 1.2)).toBe('Retorno agudo demais no vértice 2: use dois giros menores.');
  });
  it('vértice quase colinear (θ = 2°) dissolvido; com manualLandings vira patamar retangular', () => {
    const a = (2 * Math.PI) / 180;
    const path = [v(0, 0), v(4, 0), v(4 + 4 * Math.cos(a), 4 * Math.sin(a))];
    const p = plan(path, 2.8, 1.2);
    expect(kinds(p)).toEqual(['run16']);
    // Preserva o vértice no início do trajeto; fecha no centro do último espelho.
    expect(p.path).toHaveLength(2);
    const q = plan(path, 2.8, 1.2, { manualLandings: [1] });
    expect(q.parts.map((c) => c.kind)).toEqual(['run', 'landing', 'run']);
    const ring = ringOf(q.parts[1]!);
    expect(ring.length).toBeGreaterThanOrEqual(5); // θ = 2° não é exatamente colinear: anel de mitra
    expect(risersOf(q).reduce((a, b) => a + b, 0)).toBe(16);
  });
  it('manualLandings em vértice exatamente colinear: patamar retangular de θ = 0', () => {
    const q = plan([v(0, 0), v(3, 0), v(6, 0)], 2.8, 1.0, { manualLandings: [1] });
    expect(kinds(q)).toEqual(['run9', 'landing', 'run7']);
    const ring = ringOf(q.parts[1]!);
    expect(ring).toHaveLength(4);
    const xs = ring.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(1 - 1e-9);
    expect(Math.max(...ring.map((p) => p.y))).toBeCloseTo(0.5, 9);
  });
  it('trajeto que passa do desnível: fecha no espelho N e descarta os vértices depois', () => {
    const p = plan([v(0, 0), v(6, 0), v(6, 5), v(0, 5)], 2.8, 1.2);
    expect(p.truncated).toBe(true);
    expect(kinds(p)).toEqual(['run16']);
    expect(p.path).toHaveLength(2);
    near(p.path[1]!, v(4.2, 0));
    expect(p.slack).toBeCloseTo(1.8 + 5 + 6, 9);
    expect(p.note).toBe('Trajeto encurtado: a escada fecha no espelho 16, antes do último ponto.');
  });
  it('trajeto curto estende o último trecho', () => {
    const p = plan([v(0, 0), v(2, 0)], 2.8, 1.2);
    expect(p.extended).toBeCloseTo(4.2 - 2, 9);
    near(p.path[1]!, v(4.2, 0));
    expect(p.note).toBe('Trajeto estendido em 2,20 m para completar 16 espelhos.');
  });
  it('trechos não adjacentes que se sobrepõem', () => {
    // Espiral quadrada que fecha sobre si: o 4º trecho cruza o 1º.
    const path = [v(0, 0), v(8, 0), v(8, 6), v(2, 6), v(2, -2), v(6, -2)];
    expect(err(path, 16, 1.0)).toMatch(/^O trajeto se sobrepõe ao trecho \d: afaste o ponto\.$/);
  });
  it('N pequeno demais para o patamar de giro', () => {
    // H = 0,5: N = 3, o 1º trecho só comporta 2 espelhos e sobraria 1.
    const e = err([v(0, 0), v(0.81, 0), v(0.81, 3)], 0.5, 1.0);
    expect(e).toBe('Poucos espelhos (3) para o patamar de giro no vértice 2: alongue o trecho 1 ou use uma escada reta.');
  });
  it('N < 2: altura menor que um espelho', () => {
    expect(err([v(0, 0), v(3, 0)], 0.1, 1.2)).toBe('A altura é menor que um espelho: nada a gerar.');
  });
  it('N = 2 num L de trechos curtos fecha no 1º lance', () => {
    const p = plan([v(0, 0), v(1.5, 0), v(1.5, 1.5)], 0.35, 1.0);
    expect(p.risers).toBe(2);
    expect(kinds(p)).toEqual(['run2']);
    expect(p.truncated).toBe(true);
  });
  it('lance excede M: patamar em linha só quando sobra espaço para P + T', () => {
    const p = plan([v(0, 0), v(7, 0)], 3.6, 1.2);
    expect(kinds(p)).toEqual(['run17', 'landing', 'run3']);
    // Em 5 m só cabe o lance de 17 (sem P + T para o patamar): o plano estende o trajeto até o fim do layout.
    const curto = plan([v(0, 0), v(5, 0)], 3.6, 1.2);
    expect(kinds(curto)).toEqual(['run17', 'landing', 'run3']);
    expect(curto.extended).toBeCloseTo(6.24 - 5, 9);
  });
  it('H, largura <= 0 e tipo inválido', () => {
    expect(err([v(0, 0), v(3, 0)], 0, 1.2)).toBe('A altura deve ser positiva: nada a gerar.');
    expect(err([v(0, 0), v(3, 0)], 2.8, 0)).toBe('A largura do lance deve ser positiva.');
    const r = planStairFree([v(0, 0), v(3, 0)], 2.8, undefined as never, { width: 1.2 });
    expect('error' in r).toBe(true);
  });
  it('fixed troca N e T; erro de gerador vira { error }', () => {
    const p = plan([v(0, 0), v(5, 0)], 2.8, 1.2, { fixed: { risers: 17, tread: 0.3125 } });
    expect(p.risers).toBe(17);
    expect(p.tread).toBe(0.3125);
    expect(p.riserHeight).toBeCloseTo(2.8 / 17, 12);
    near(p.path[1]!, v(5, 0), 1e-9);
    const bad = planStairFree([v(0, 0), v(5, 0)], 2.8, mono, { width: 1.2, fixed: { risers: 17, tread: -1 } });
    expect('error' in bad).toBe(true);
  });
  it('índices de vértice dos erros usam o trajeto original (com ponto repetido)', () => {
    const a = (170 * Math.PI) / 180;
    const e = err([v(0, 0), v(0, 0.001), v(3, 0), v(3 + 3 * Math.cos(a), 3 * Math.sin(a))], 2.8, 1.2);
    expect(e).toBe('Retorno agudo demais no vértice 3: use dois giros menores.');
  });
});

describe('planStairFree: giro em ângulo qualquer', () => {
  it('giro de 60° à esquerda: anel de 6 pontos simples, área > 0, tIn ≥ tMin', () => {
    const a = Math.PI / 3;
    const p = plan([v(0, 0), v(4, 0), v(4 + 4 * Math.cos(a), 4 * Math.sin(a))], 2.8, 1.0);
    expect(p.parts[1]!.kind).toBe('landing');
    const ring = ringOf(p.parts[1]!);
    expect(ring.length).toBeGreaterThanOrEqual(5);
    // Cálculo manual: dA = (1,0), dB = (cos60, sin60); tMin = 0,5·tan30° = 0,2887; tPref = max(0,5; tMin) = 0,5.
    // Trecho 0: prefSpan = 4 − 0,5 = 3,5 → n = floor(3,5/0,28)+1 = 13, último em u = 3,36 → a = 0,64.
    expect(risersOf(p)[0]).toBe(13);
    const aIn = ring[0]!;
    near(aIn, v(4 - 0.64, 0.5));
    // bOut = v + dB·0,5 − nB·0,5 com nB = (−sin60, cos60).
    const nB = v(-Math.sin(a), Math.cos(a));
    const bOut = v(4 + Math.cos(a) * 0.5 - nB.x * 0.5, Math.sin(a) * 0.5 - nB.y * 0.5);
    expect(ring.some((q) => Math.hypot(q.x - bOut.x, q.y - bOut.y) < 1e-9)).toBe(true);
  });
  it('giro à direita espelha o sinal do anel', () => {
    const L = plan([v(0, 0), v(3, 0), v(3, 2)], 2.8, 1.0);
    const R = plan([v(0, 0), v(3, 0), v(3, -2)], 2.8, 1.0);
    const rl = ringOf(L.parts[1]!);
    const rr = ringOf(R.parts[1]!);
    expect(rr).toHaveLength(rl.length);
    rl.forEach((q, i) => {
      near(rr[i]!, v(q.x, -q.y));
    });
  });
});

describe('planStairFree: integração com o modelo', () => {
  const toComponent = (c: StairComponentSketch, id: string): StairRun | StairLanding =>
    c.kind === 'run' ? { id, kind: 'run', ...c.run, generatedBy: 'free' } : { id, kind: 'landing', ...c.landing };
  const projectOf = (p: StairFreePlan, H = 2.8): Project => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({
      type: 'addStair',
      stair: makeStair({
        id: 'st1',
        typeId: 'stt_monolitica',
        levelId: 'lv_0',
        topOffset: H - 3,
        height: 3,
        freePath: p.path,
        components: p.parts.map((c, i) => toComponent(c, `c${i}`)),
      }),
    });
    return s.project;
  };

  for (const [nome, path, H, w] of [
    ['reta', [v(0, 0), v(5, 0)], 2.8, 1.2],
    ['L', [v(0, 0), v(3, 0), v(3, 2)], 2.8, 1.0],
    ['U', [v(0, 0), v(3, 0), v(3, 1.3), v(0, 1.3)], 2.8, 1.2],
    ['patamar em linha', [v(0, 0), v(7, 0)], 3.6, 1.2],
  ] as Array<[string, Vec2[], number, number]>) {
    it(`${nome}: resolve com N espelhos, h ≈ H ÷ N, sem erro e sem stair-blondel`, () => {
      const pl = plan(path, H, w);
      const proj = projectOf(pl, H);
      const rs = resolveStairOne(proj, proj.elements['st1'] as never);
      expect(rs).not.toBeNull();
      expect(rs!.riserCount).toBe(pl.risers);
      expect(rs!.riserHeight).toBeCloseTo(H / pl.risers, 9);
      expect(rs!.issues.filter((i) => i.severity === 'error')).toEqual([]);
      expect(rs!.issues.map((i) => i.code)).not.toContain('stair-blondel');
      for (const c of pl.parts) if (c.kind === 'landing') expect(stairLandingPolygon(c.landing).issues).toEqual([]);
    });
  }
});

describe('optimizeStair', () => {
  const opt = (path: Vec2[], H: number, width: number, type: StairType = mono) => {
    const r = optimizeStair({ path, H, type, width });
    if ('error' in r) throw new Error(r.error);
    return r;
  };
  it('Exemplo 1 de Ajustar: 5 m reto, H = 2,80 → N = 17, T = 0,3125, gap 0', () => {
    const r = opt([v(0, 0), v(5, 0)], 2.8, 1.2);
    expect(r.fixed.risers).toBe(17);
    expect(r.fixed.tread).toBeCloseTo(0.3125, 6);
    expect(Math.abs(r.gap)).toBeLessThan(1e-6);
    expect(r.violation).toBe(0);
    expect(r.messages).toEqual([]);
    expect(r.note).toBe('Ajustado: 17 espelhos de 16,5 cm, piso 31,3 cm, trajeto mantido.');
    expect(r.riserHeight).toBeCloseTo(2.8 / 17, 12);
    expect(r.plan.risers).toBe(17);
    near(r.path[1]!, v(5, 0), 1e-6);
  });
  it('trajeto reto de 4,0 m: N não desce do mínimo, a norma vale e o trajeto estende 0,20 m', () => {
    const r = opt([v(0, 0), v(4, 0)], 2.8, 1.2);
    const h = 2.8 / r.fixed.risers;
    expect(r.violation).toBe(0);
    expect(h).toBeGreaterThanOrEqual(0.16 - 1e-9);
    expect(h).toBeLessThanOrEqual(0.18 + 1e-9);
    const blondel = 2 * h + r.fixed.tread;
    expect(blondel).toBeGreaterThanOrEqual(0.63 - 1e-9);
    expect(blondel).toBeLessThanOrEqual(0.65 + 1e-9);
    // Documenta o N obtido: N só pode subir; 16 espelhos (piso mínimo 0,28 m) pedem 4,20 m e ficam mais perto dos 4,0 m
    // que 17 (piso ≥ 0,3006 m, 4,81 m). Vence N = 16, T = 0,28 e o trajeto é estendido em 0,20 m.
    expect(r.fixed.risers).toBe(16);
    expect(r.fixed.tread).toBeCloseTo(0.28, 9);
    expect(r.gap).toBeCloseTo(0.2, 9);
    expect(r.note.startsWith(`Ajustado: ${r.fixed.risers} espelhos`)).toBe(true);
  });
  it('faixa de Blondel vazia: viola, devolve mensagens e ainda um plano', () => {
    const impossivel: StairType = { ...mono, calcMin: 0.9, calcMax: 0.95 };
    const r = opt([v(0, 0), v(5, 0)], 2.8, 1.2, impossivel);
    expect(r.violation).toBeGreaterThan(0);
    expect(r.messages.length).toBeGreaterThan(0);
    expect(r.note).toContain('Sem opção dentro da norma:');
    expect(r.plan.parts.length).toBeGreaterThan(0);
  });
  it('trajeto que obriga a truncar: nota de encurtamento', () => {
    const r = opt([v(0, 0), v(9, 0)], 2.8, 1.2);
    // 9 m: o melhor piso dentro da faixa (≤ 0,32) ainda sobra; o plano encurta o trajeto.
    expect(r.gap).toBeLessThan(0);
    expect(r.note).toMatch(/trajeto encurtado em \d,\d\d m\.$/);
    expect(r.plan.note).toBeDefined();
  });
  it('trajeto que obriga a esticar: nota de extensão', () => {
    const r = opt([v(0, 0), v(2, 0)], 2.8, 1.2);
    expect(r.gap).toBeGreaterThan(0);
    expect(r.note).toMatch(/trajeto estendido em \d,\d\d m\.$/);
  });
  it('nunca devolve plano com erro quando o N mínimo tem plano; erros viram { error }', () => {
    for (const path of [[v(0, 0), v(3, 0), v(3, 2)], [v(0, 0), v(3, 0), v(3, 1.3), v(0, 1.3)], [v(0, 0), v(5, 0)]]) {
      const r = opt(path, 2.8, 1.2);
      expect(r.plan.parts.length).toBeGreaterThan(0);
      expect(r.plan.runs).toBeGreaterThan(0);
    }
    expect('error' in optimizeStair({ path: [v(0, 0)], H: 2.8, type: mono, width: 1.2 })).toBe(true);
    expect('error' in optimizeStair({ path: [v(0, 0), v(3, 0)], H: -1, type: mono, width: 1.2 })).toBe(true);
    expect('error' in optimizeStair({ path: [v(0, 0), v(3, 0)], H: 2.8, type: undefined as never, width: 1.2 })).toBe(true);
  });
  it('layout e plano concordam: o plano estendido usa layoutStairSegment (Infinity)', () => {
    const p = stairLiveParams(2.8, mono, { width: 1 });
    if ('error' in p) throw new Error(p.error);
    expect(layoutStairSegment(Infinity, p, 7, false).length).toBeCloseTo(1.68, 9);
  });
});
