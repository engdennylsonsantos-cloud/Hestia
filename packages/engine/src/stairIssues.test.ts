import { describe, expect, it } from 'vitest';
import { type Vec2 } from '@hestia/geom';
import {
  ProjectStore,
  createEmptyProject,
  defaultStairTypeId,
  makeStair,
  type Project,
  type StairCurve,
  type StairLanding,
  type StairRun,
  type StairType,
} from '@hestia/model';
import { DEFAULT_STAIR_NORMS } from './stairNorms.ts';
import { minWidth, stairNormIssues, type StairIssueItem } from './stairIssues.ts';
import { resolveStairs } from './stairs.ts';
import { stairIssueList, stairValidationIssues } from './stairChecks.ts';
import { generateSpiralRun, type SpiralRunOptions, type SpiralRunSketch } from './stairSpiral.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

/** Lance reto no sentido +x (ver stairs.test.ts): n espelhos a cada `spacing` a partir de x0, limites em y = ±w/2. */
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

function rect(x0: number, x1: number, w: number): StairLanding {
  const h = w / 2;
  return { id: 'landing', kind: 'landing', boundary: [ln(x0, -h, x1, -h), ln(x1, -h, x1, h), ln(x1, h, x0, h), ln(x0, h, x0, -h)] };
}

/**
 * Lance em leque: o croqui do caracol de 90° sem o metadado (`generatedBy` e `spiral`), ou seja, um leque comum. Os
 * limites são arcos concêntricos e os espelhos são radiais, que é o que a norma do piso do leque mede.
 */
function fan(o: SpiralRunOptions): StairRun {
  const run: Partial<SpiralRunSketch> = generateSpiralRun(o);
  delete run.generatedBy;
  delete run.spiral;
  return { id: 'run', kind: 'run', boundaryLeft: run.boundaryLeft!, boundaryRight: run.boundaryRight!, risers: run.risers!, path: run.path! };
}

/** Projeto com a escada `st1`; padrão térreo + pavimento 2 acima, H = 2,80 m. */
function projectWith(components: Array<StairRun | StairLanding>, topOffset = -0.2): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({
    type: 'addStair',
    stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', topOffset, components }),
  });
  return s.project;
}

/** Mesmo projeto, mas com a regra de cálculo do tipo padrão alterada. */
function projectWithCalc(components: Array<StairRun | StairLanding>, calc: Partial<StairType>): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertStairType', stairType: { ...s.project.stairTypes[defaultStairTypeId]!, ...calc } });
  s.exec({
    type: 'addStair',
    stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', topOffset: -0.2, components }),
  });
  return s.project;
}

const find = (list: StairIssueItem[], code: string): StairIssueItem => {
  const hit = list.find((i) => i.code === code);
  expect(hit, `aviso ${code}`).toBeDefined();
  return hit!;
};
const codes = (list: StairIssueItem[]): string[] => list.map((i) => i.code);

describe('avisos de norma por código', () => {
  it('stair-risers-count (aviso): 17 espelhos em H = 2,80 m, quando ceil(H ÷ 0,18) = 16', () => {
    const list = stairIssueList(projectWith([straight(17, 0.28)]));
    expect(find(list, 'stair-risers-count')).toMatchObject({
      severity: 'warning',
      stairId: 'st1',
      message: 'O nº de espelhos (17) difere do nº desejado (16): adicione/remova espelhos ou ajuste a altura.',
    });
    expect(codes(list)).not.toContain('stair-riser-too-high');
  });

  it('stair-riser-too-high (erro): h = 0,200 m com máximo de 0,180 m; também aviso de contagem e de faixa', () => {
    const list = stairIssueList(projectWith([straight(14, 0.28)]));
    expect(find(list, 'stair-riser-too-high')).toMatchObject({
      severity: 'error',
      message: 'A altura real do espelho (0,200 m) excede a máxima do tipo (0,180 m).',
    });
    expect(find(list, 'stair-risers-count').severity).toBe('warning');
    expect(find(list, 'stair-riser-range').severity).toBe('warning');
  });

  it('stair-winder-tread (aviso): leque apertado, piso a 0,55 m da borda interna abaixo de 0,28 m', () => {
    // 90° com 16 espelhos e raio interno de 0,10 m: a corda a 0,55 m da borda interna é ≈ 0,07 m.
    const list = stairIssueList(projectWith([fan({ center: v(0, 0), rInner: 0.1, rOuter: 1, startAngle: 0, sweep: Math.PI / 2, risers: 16 })]));
    const issue = find(list, 'stair-winder-tread');
    expect(issue).toMatchObject({ severity: 'warning', stairId: 'st1', componentIndex: 0 });
    expect(issue.message).toMatch(/^O piso do degrau do leque a 0,55 m da borda interna \(0,0\d m\) é menor que o mínimo de 0,28 m\.$/);
  });

  it('leque folgado: piso a 0,55 m da borda interna ≥ 0,28 m, sem aviso de piso do leque', () => {
    // 90° com 6 espelhos e raio interno de 1,00 m: a corda a 0,55 m da borda interna é ≈ 0,49 m.
    const list = stairIssueList(projectWith([fan({ center: v(0, 0), rInner: 1, rOuter: 2, startAngle: 0, sweep: Math.PI / 2, risers: 6 })]));
    expect(codes(list)).not.toContain('stair-winder-tread');
  });

  it('lance reto não tem aviso de leque: os espelhos são paralelos', () => {
    const list = stairIssueList(projectWith([straight(16, 0.28)]));
    expect(codes(list)).not.toContain('stair-winder-tread');
  });

  it('stair-riser-range (aviso): h = 0,156 m, abaixo de 0,16 m', () => {
    const list = stairIssueList(projectWith([straight(18, 0.28)]));
    expect(find(list, 'stair-riser-range')).toMatchObject({
      severity: 'warning',
      message: 'A altura do espelho (0,156 m) está fora da faixa de norma (0,16 a 0,18 m).',
    });
    expect(codes(list)).not.toContain('stair-riser-too-high');
  });

  it('stair-width-min (aviso): lance de 0,70 m com mínimo de 0,80 m, no lance 0', () => {
    const list = stairIssueList(projectWith([straight(16, 0.28, 0.7)]));
    expect(find(list, 'stair-width-min')).toMatchObject({
      severity: 'warning',
      componentIndex: 0,
      message: 'A largura do lance (0,70 m) é menor que a mínima do tipo (0,80 m).',
    });
  });

  it('stair-tread-range (aviso): piso médio de 0,25 m, abaixo de 0,28 m (e Blondel também fora)', () => {
    const list = stairIssueList(projectWith([straight(16, 0.25)]));
    expect(find(list, 'stair-tread-range')).toMatchObject({
      severity: 'warning',
      componentIndex: 0,
      message: 'O piso médio do lance (0,250 m) está fora da faixa de norma (0,28 a 0,32 m).',
    });
    expect(codes(list)).toContain('stair-blondel');
  });

  it('stair-blondel (aviso): 2h + p = 0,66 m com h = 0,175 m e piso 0,31 m (só este aviso)', () => {
    const list = stairIssueList(projectWith([straight(16, 0.31)]));
    expect(list).toHaveLength(1);
    expect(find(list, 'stair-blondel')).toMatchObject({
      severity: 'warning',
      componentIndex: 0,
      message: 'A relação 2h + p (0,660 m) está fora da faixa de norma (0,63 a 0,65 m).',
    });
  });

  it('stair-blondel usa a faixa e os fatores do TIPO: aviso derivado da regra personalizada', () => {
    const list = stairIssueList(projectWithCalc([straight(16, 0.28)], { calcTarget: 0.75, calcMin: 0.7, calcMax: 0.8 }));
    expect(find(list, 'stair-blondel')).toMatchObject({
      severity: 'warning',
      componentIndex: 0,
      message: 'A relação 2h + p (0,630 m) está fora da faixa de norma (0,70 a 0,80 m).',
    });
    // a = 1, b = 1: 0,175 + 0,28 = 0,455 m, abaixo da faixa padrão, e o rótulo mostra os fatores.
    const custom = stairIssueList(projectWithCalc([straight(16, 0.28)], { calcRiserFactor: 1, calcTreadFactor: 1 }));
    expect(find(custom, 'stair-blondel').message).toBe(
      'A relação 1h + p (0,455 m) está fora da faixa de norma (0,63 a 0,65 m).',
    );
    // Dentro da faixa personalizada não avisa.
    const ok = stairIssueList(projectWithCalc([straight(16, 0.28)], { calcMin: 0.6, calcMax: 0.7 }));
    expect(codes(ok)).not.toContain('stair-blondel');
  });

  it('stair-landing-rise (aviso): lance de 20 espelhos sobe 3,60 m, acima de 3,20 m (só este aviso)', () => {
    const list = stairIssueList(projectWith([straight(20, 0.28)], 0.6));
    expect(list).toHaveLength(1);
    expect(find(list, 'stair-landing-rise')).toMatchObject({
      severity: 'warning',
      componentIndex: 0,
      message: 'O lance sobe 3,60 m sem patamar; o máximo entre patamares é 3,20 m.',
    });
  });

  it('stair-landing-length (aviso): patamar de 1,00 m de menor dimensão, componente 1', () => {
    const list = stairIssueList(
      projectWith([straight(8, 0.28, 1.2, 0, 0.5, 0.5), rect(2.46, 3.46, 1.0), straight(8, 0.28, 1.2, 3.46, 0.5, 0.5)]),
    );
    expect(find(list, 'stair-landing-length')).toMatchObject({
      severity: 'warning',
      componentIndex: 1,
      message: 'O patamar tem menor dimensão de 1,00 m, abaixo do mínimo de 1,20 m.',
    });
  });
});

describe('erros de croqui e avisos auxiliares', () => {
  it('stair-riser-same-location (erro): dois espelhos na mesma posição, no lance 0', () => {
    const run = straight(16, 0.28);
    const dup: StairRun = { ...run, risers: [...run.risers, ln(0.28, -1, 0.28, 1)] };
    const list = stairIssueList(projectWith([dup]));
    expect(find(list, 'stair-riser-same-location')).toMatchObject({ severity: 'error', componentIndex: 0 });
    expect(resolveStairs(projectWith([dup]))[0]!.steps).toEqual([]);
  });

  it('stairValidationIssues traz o id da escada como elementId, no formato do painel', () => {
    const list = stairValidationIssues(projectWith([straight(16, 0.28, 0.7)]));
    expect(list).toEqual([
      {
        severity: 'warning',
        code: 'stair-width-min',
        message: 'A largura do lance (0,70 m) é menor que a mínima do tipo (0,80 m).',
        elementId: 'st1',
      },
    ]);
  });

  it('o perfil de norma pode ser trocado: patamar de 1,00 m passa com mínimo de 0,90 m', () => {
    const p = projectWith([straight(8, 0.28, 1.2, 0, 0.5, 0.5), rect(2.46, 3.46, 1.0), straight(8, 0.28, 1.2, 3.46, 0.5, 0.5)]);
    const rs = resolveStairs(p)[0]!;
    expect(codes(stairNormIssues(rs, { ...DEFAULT_STAIR_NORMS, landingMinLength: 0.9 }))).not.toContain('stair-landing-length');
  });

  it('minWidth é a menor largura da casca convexa', () => {
    expect(minWidth([v(0, 0), v(2, 0), v(2, 1), v(0, 1)])).toBeCloseTo(1, 12);
    // Losango: lados paralelos y = x e y = x + 2, distância 2 / √2.
    expect(minWidth([v(0, 0), v(1, 1), v(0, 2), v(-1, 1)])).toBeCloseTo(Math.SQRT2, 12);
    expect(minWidth([v(0, 0), v(1, 0)])).toBe(0);
  });

  it('caso limpo: nenhum aviso', () => {
    expect(stairIssueList(projectWith([straight(16, 0.28)]))).toEqual([]);
  });
});
