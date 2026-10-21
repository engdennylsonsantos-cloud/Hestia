import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeRoof, validateProject, type Project, type Roof, type ValidationIssue } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const roof = (id: string, extra: Partial<Roof> = {}): Omit<Roof, 'order'> =>
  makeRoof({ id, typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect(0, 0, 8, 6), shape: 'gable', slopePercent: 30, ...extra });

/** Projeto com telhados montados pelo comando addRoof (como na aplicação). */
function build(items: Array<Omit<Roof, 'order'>>): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const x of items) s.exec({ type: 'addRoof', roof: x });
  return s.project;
}

/** Telhado inserido direto no mapa, para os casos que o comando recusaria. */
function raw(x: Omit<Roof, 'order'>): Project {
  return { ...createEmptyProject(), elements: { [x.id]: { ...x, order: 1 } } };
}

const issuesOf = (p: Project): ValidationIssue[] => validateProject(p).filter((i) => i.code.startsWith('roof-'));
const codes = (p: Project): string[] => issuesOf(p).map((i) => i.code);

describe('validação de telhados', () => {
  it('telhados válidos de cada forma não geram problemas', () => {
    const p = build([
      roof('r1', { shape: 'gable' }),
      roof('r2', { shape: 'hip', levelId: 'lv_1' }),
      roof('r3', { shape: 'shed', dir: { x: 0, y: 1 }, boundary: rect(20, 0, 28, 6) }),
    ]);
    expect(issuesOf(p)).toEqual([]);
  });

  it('contorno com menos de 3 pontos e furo com menos de 3 pontos são erros de pontos', () => {
    expect(codes(raw(roof('r1', { boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }] })))).toEqual(['roof-few-points']);
    expect(codes(raw(roof('r1', { holes: [[{ x: 1, y: 1 }, { x: 2, y: 1 }]] })))).toEqual(['roof-few-points']);
  });

  it('contorno que se cruza é erro de auto-interseção (gravata)', () => {
    const bow = [{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 4, y: 0 }, { x: 0, y: 3 }];
    const issues = issuesOf(raw(roof('r1', { boundary: bow })));
    expect(issues.map((i) => i.code)).toContain('roof-self-intersect');
    expect(issues[0]).toMatchObject({ severity: 'error', elementId: 'r1' });
  });

  it('contorno de área zero é erro', () => {
    expect(codes(raw(roof('r1', { boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 0 }] })))).toContain('roof-zero-area');
  });

  it('furo fora do contorno é erro', () => {
    expect(codes(raw(roof('r1', { holes: [rect(20, 20, 21, 21)] })))).toEqual(['roof-hole-outside']);
  });

  it('tipo de telhado inexistente e nível inexistente são erros', () => {
    expect(codes(raw(roof('r1', { typeId: 'rt_nada' })))).toEqual(['roof-type-missing']);
    expect(codes(raw(roof('r1', { levelId: 'lv_nada' })))).toEqual(['roof-level-missing']);
  });

  it('inclinação zero, negativa, acima de 300 % ou não finita é erro de inclinação', () => {
    for (const slopePercent of [0, -5, 350, Number.NaN]) {
      expect(codes(raw(roof('r1', { slopePercent })))).toEqual(['roof-slope-invalid']);
    }
  });

  it('direção não unitária em uma água e em duas águas é erro; em quatro águas não se aplica', () => {
    expect(codes(raw(roof('r1', { shape: 'shed', dir: { x: 2, y: 0 } })))).toEqual(['roof-slope-invalid']);
    expect(codes(raw(roof('r1', { shape: 'gable', dir: { x: 0, y: 0 } })))).toEqual(['roof-slope-invalid']);
    expect(codes(raw(roof('r1', { shape: 'hip', dir: { x: 2, y: 0 } })))).toEqual([]);
  });

  it('água livre com menos de 3 pontos, área zero ou sem direção é água degenerada', () => {
    const planes = [
      { polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }], origin: { x: 0, y: 0 }, up: { x: 1, y: 0 }, percent: 10, z0: 0 },
      { polygon: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], origin: { x: 0, y: 0 }, up: { x: 1, y: 0 }, percent: 10, z0: 0 },
      { polygon: rect(0, 0, 2, 2), origin: { x: 0, y: 0 }, up: { x: 0, y: 0 }, percent: 10, z0: 0 },
    ];
    const got = issuesOf(raw(roof('r1', { shape: 'free', planes })));
    expect(got.map((i) => i.code)).toEqual(['roof-plane-degenerate', 'roof-plane-degenerate', 'roof-plane-degenerate']);
  });

  it('quatro águas com contorno côncavo é válido: o cálculo por esqueleto cobre o L (sem aviso)', () => {
    const L = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 6 }, { x: 0, y: 6 }];
    expect(issuesOf(raw(roof('r1', { shape: 'hip', boundary: L })))).toEqual([]);
  });

  it('dois telhados do mesmo nível sobrepostos por mais de 1 cm² geram aviso; vizinhos que só se encostam não', () => {
    const overlap = build([roof('r1'), roof('r2', { boundary: rect(6, 0, 14, 6) })]);
    expect(issuesOf(overlap)).toEqual([expect.objectContaining({ severity: 'warning', code: 'roof-overlap' })]);
    const touching = build([roof('r1'), roof('r2', { boundary: rect(8, 0, 16, 6) })]);
    expect(issuesOf(touching)).toEqual([]);
    const otherLevel = build([roof('r1'), roof('r2', { boundary: rect(6, 0, 14, 6), levelId: 'lv_1' })]);
    expect(issuesOf(otherLevel)).toEqual([]);
  });

  it('cumeeira de duas águas sem aresta paralela a dir (± 5°) é aviso: a cumeeira acompanha as arestas', () => {
    const a = (40 * Math.PI) / 180;
    const got = issuesOf(build([roof('r1', { dir: { x: Math.cos(a), y: Math.sin(a) } })]));
    expect(got).toEqual([expect.objectContaining({ severity: 'warning', code: 'roof-ridge-off-edges', elementId: 'r1' })]);
    expect(got[0]!.message).toContain('a cumeeira acompanha as arestas do contorno: nenhuma aresta é paralela à direção informada');
  });

  it('cumeeira com aresta paralela a dir (até 5° de folga), direção padrão e formas que não usam cumeeira não avisam', () => {
    const a = (3 * Math.PI) / 180;
    expect(issuesOf(build([roof('r1', { dir: { x: Math.cos(a), y: Math.sin(a) } })]))).toEqual([]);
    expect(issuesOf(build([roof('r1', { dir: { x: 0, y: 1 } })]))).toEqual([]);
    expect(codes(raw(roof('r1', { shape: 'hip', dir: { x: Math.cos(0.7), y: Math.sin(0.7) } })))).toEqual([]);
    expect(codes(raw(roof('r1', { shape: 'shed', dir: { x: Math.cos(0.7), y: Math.sin(0.7) } })))).toEqual([]);
  });
});
