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
} from '@hestia/model';
import { DEFAULT_STAIR_NORMS } from './stairNorms.ts';
import { minWidth, stairNormIssues, type StairIssueItem } from './stairIssues.ts';
import { resolveStairs } from './stairs.ts';
import { stairIssueList, stairValidationIssues } from './stairChecks.ts';

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

/** Projeto com a escada `st1`; padrão térreo + pavimento 2 acima, H = 2,80 m. */
function projectWith(components: Array<StairRun | StairLanding>, topOffset = -0.2): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({
    type: 'addStair',
    stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', topOffset, components }),
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

  it('stair-blondel (aviso): 2h + p = 0,65 m com h = 0,175 m e piso 0,30 m (só este aviso)', () => {
    const list = stairIssueList(projectWith([straight(16, 0.3)]));
    expect(list).toHaveLength(1);
    expect(find(list, 'stair-blondel')).toMatchObject({
      severity: 'warning',
      componentIndex: 0,
      message: 'A relação 2h + p (0,650 m) está fora da faixa de norma (0,63 a 0,64 m).',
    });
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
