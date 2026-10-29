import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeLevel, makeRamp, type Project, type StairLanding, type StairRun } from '@hestia/model';
import { planRamp, type RampPlan } from './rampPlan.ts';
import { resolveRamps, type ResolvedRamp } from './ramps.ts';
import { rampIssueList, rampIssuesOf, rampNormIssues } from './rampIssues.ts';

const type = { ...createEmptyProject().rampTypes.rmt_nbr9050! };
const okPlan = (r: ReturnType<typeof planRamp>): RampPlan => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

const componentsOf = (plan: RampPlan): Array<StairRun | StairLanding> =>
  plan.parts.map((x, idx) =>
    x.kind === 'run' ? { id: `c${idx}`, kind: 'run', ...x.run } : { id: `c${idx}`, kind: 'landing', ...x.landing },
  );

interface Opts {
  H: number;
  mode?: 'length' | 'slope';
  slope?: number;
  length?: number;
  width?: number;
  slopeTarget?: number | null;
  components?: Array<StairRun | StairLanding>;
}

/** Projeto com uma rampa resolvida: nível de topo explícito na cota `H`. */
function resolve(o: Opts): ResolvedRamp {
  const mode = o.mode ?? 'slope';
  const plan = okPlan(
    planRamp({
      start: { x: 0, y: 0 },
      dir: { x: 1, y: 0 },
      H: o.H,
      type,
      shape: 'straight',
      turn: 'left',
      width: o.width ?? 1.5,
      mode,
      slope: o.slope ?? 1 / 12,
      length: o.length,
    }),
  );
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: o.H }) });
  s.exec({
    type: 'addRamp',
    ramp: makeRamp({
      id: 'rp1',
      typeId: type.id,
      levelId: 'lv_0',
      topLevelId: 'lv_top',
      components: o.components ?? componentsOf(plan),
      inputMode: mode,
      slopeTarget: mode === 'slope' ? (o.slopeTarget ?? o.slope ?? 1 / 12) : null,
    }),
  });
  return resolveRamps(s.project)[0]!;
}

const codes = (rr: ResolvedRamp): string[] => rr.issues.map((i) => i.code);

describe('rampNormIssues — um caso por código', () => {
  it('ramp-slope-over-norm (8 m, H=0,80 → 10 %) e sem ramp-flight-rise-over-norm', () => {
    const rr = resolve({ H: 0.8, mode: 'length', length: 8 });
    expect(codes(rr)).toContain('ramp-slope-over-norm');
    expect(codes(rr)).not.toContain('ramp-flight-rise-over-norm');
    const msg = rr.issues.find((i) => i.code === 'ramp-slope-over-norm')!;
    expect(msg.severity).toBe('warning');
    expect(msg.message).toContain('passa do máximo do tipo');
    expect(msg.message).toContain('8,33 %');
  });

  it('ramp-flight-rise-over-norm (1 lance de 1,00 m a 1:12)', () => {
    const rr = resolve({ H: 1, mode: 'length', length: 12 });
    expect(codes(rr)).toContain('ramp-flight-rise-over-norm');
    expect(rr.issues.find((i) => i.code === 'ramp-flight-rise-over-norm')!.message).toBe(
      'O lance 1 vence 1,00 m; para 8,33 % o máximo por lance é 0,80 m. (norma a conferir)',
    );
  });

  it('ramp-flights-over-norm (17 lances a 1:12, máximo 15)', () => {
    const rr = resolve({ H: 13 });
    expect(rr.flights).toHaveLength(17);
    expect(codes(rr)).toContain('ramp-flights-over-norm');
  });

  it('ramp-width-min (largura 1,0 < 1,2)', () => {
    const rr = resolve({ H: 0.8, width: 1 });
    expect(codes(rr)).toContain('ramp-width-min');
    expect(rr.issues.find((i) => i.code === 'ramp-width-min')!.message).toBe(
      'O lance 1 tem 1,00 m de largura; o mínimo do tipo é 1,20 m. (norma a conferir)',
    );
  });

  it('ramp-slope-differs (alvo 5 % contra 1:12 resultante)', () => {
    const rr = resolve({ H: 1.2, slopeTarget: 0.05 });
    expect(codes(rr)).toContain('ramp-slope-differs');
  });

  it('ramp-no-landing (dois lances consecutivos)', () => {
    const base = resolve({ H: 1.2 });
    const runs = base.flights.length;
    expect(runs).toBe(2);
    // Dois lances de 7,20 m sem patamar entre eles.
    const plan = okPlan(
      planRamp({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, H: 1.2, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 }),
    );
    const comps = componentsOf(plan).filter((c) => c.kind === 'run');
    const rr = resolve({ H: 1.2, components: comps });
    expect(codes(rr)).toContain('ramp-no-landing');
    expect(rr.issues.find((i) => i.code === 'ramp-no-landing')!.message).toBe('Há lances consecutivos sem patamar entre eles.');
  });

  it('ramp-landing-short (patamar de 1,00 m de largura)', () => {
    const plan = okPlan(
      planRamp({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, H: 1.2, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 }),
    );
    const comps = componentsOf(plan);
    const li = comps.findIndex((c) => c.kind === 'landing');
    const line = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ a, b, sag: 0 });
    const narrow: StairLanding = {
      id: comps[li]!.id,
      kind: 'landing',
      boundary: [line({ x: 7.2, y: 0.5 }, { x: 8.4, y: 0.5 }), line({ x: 8.4, y: 0.5 }, { x: 8.4, y: -0.5 }), line({ x: 8.4, y: -0.5 }, { x: 7.2, y: -0.5 }), line({ x: 7.2, y: -0.5 }, { x: 7.2, y: 0.5 })],
    };
    comps[li] = narrow;
    const rr = resolve({ H: 1.2, components: comps });
    expect(codes(rr)).toContain('ramp-landing-short');
  });
});

describe('rampNormIssues — sufixo e tabela', () => {
  const rr = resolve({ H: 13 });
  const suffixOf = (normChecked: boolean): string => {
    const list = rampNormIssues({ ...rr, type: { ...rr.type, normChecked } });
    return list.find((i) => i.code === 'ramp-flights-over-norm')!.message;
  };

  it('norma a conferir acrescenta o sufixo', () => {
    expect(suffixOf(false).endsWith(' (norma a conferir)')).toBe(true);
  });

  it('norma conferida não tem sufixo', () => {
    expect(suffixOf(true).endsWith(' (norma a conferir)')).toBe(false);
  });

  it('tabela vazia não gera avisos de norma', () => {
    expect(rampNormIssues({ ...rr, type: { ...rr.type, normTable: [] } })).toEqual([]);
  });
});

/** Projeto com 3 rampas do lv_0 ao lv_top (H = 1,2 m), em faixas separadas; a 2ª é íngreme demais para a norma. */
function projectWithThreeRamps(): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: 1.2 }) });
  const specs: Array<[string, number]> = [
    ['rp1', 1 / 12],
    ['rp2', 1 / 4],
    ['rp3', 1 / 12],
  ];
  specs.forEach(([id, slope], k) => {
    const plan = okPlan(planRamp({ start: { x: k * 10, y: 0 }, dir: { x: 1, y: 0 }, H: 1.2, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope }));
    s.exec({
      type: 'addRamp',
      ramp: makeRamp({ id, typeId: type.id, levelId: 'lv_0', topLevelId: 'lv_top', components: componentsOf(plan), inputMode: 'slope', slopeTarget: slope }),
    });
  });
  return s.project;
}

describe('rampIssuesOf — uma rampa sem resolver as outras', () => {
  it('é igual a rampIssueList filtrada pela rampa, em cada rampa de um projeto com 3 (algumas com aviso)', () => {
    const p = projectWithThreeRamps();
    const todos = rampIssueList(p);
    expect(todos.some((i) => i.severity === 'warning')).toBe(true);
    expect(rampIssuesOf(p, 'rp2').length).toBeGreaterThan(0);
    for (const id of ['rp1', 'rp2', 'rp3']) {
      expect(rampIssuesOf(p, id)).toEqual(todos.filter((i) => i.rampId === id));
    }
  });

  it('id que não é rampa devolve lista vazia', () => {
    expect(rampIssuesOf(projectWithThreeRamps(), 'nao_existe')).toEqual([]);
  });
});
