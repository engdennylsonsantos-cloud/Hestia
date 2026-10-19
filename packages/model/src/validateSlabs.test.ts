import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, validateProject, type Floor, type Project, type Slab, type ValidationIssue } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number): Slab['boundary'] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

const slab = (id: string, extra: Partial<Slab> = {}): Omit<Slab, 'order'> =>
  makeSlab({ id, typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(0, 0, 4, 3), ...extra });

/** Projeto com lajes montadas pelo comando addSlab (como na aplicação). */
function build(items: Array<Omit<Slab, 'order'>>, floors: Array<Omit<Floor, 'order'>> = []): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const x of items) s.exec({ type: 'addSlab', slab: x });
  for (const f of floors) s.exec({ type: 'addFloor', floor: f });
  return s.project;
}

/** Insere a laje direto no mapa, para os casos que o comando addSlab recusaria. */
function raw(x: Omit<Slab, 'order'>): Project {
  const p = createEmptyProject();
  return { ...p, elements: { [x.id]: { ...x, order: 1 } } };
}

const codes = (issues: ValidationIssue[]): string[] => issues.map((i) => i.code);
const issuesOf = (p: Project): ValidationIssue[] => validateProject(p).filter((i) => i.code.startsWith('slab-'));

describe('validação de lajes', () => {
  it('laje retangular válida não gera problemas', () => {
    expect(issuesOf(build([slab('s1')]))).toEqual([]);
  });

  it('contorno com menos de 3 pontos é erro', () => {
    const issues = issuesOf(raw(slab('s1', { boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }] })));
    expect(codes(issues)).toEqual(['slab-few-points']);
    expect(issues[0]).toMatchObject({ severity: 'error', elementId: 's1' });
  });

  it('furo com menos de 3 pontos é erro de pontos', () => {
    expect(codes(issuesOf(raw(slab('s1', { holes: [[{ x: 1, y: 1 }, { x: 2, y: 1 }]] }))))).toEqual(['slab-few-points']);
  });

  it('contorno que se cruza é erro (gravata)', () => {
    const bow = [
      { x: 0, y: 0 },
      { x: 4, y: 3 },
      { x: 4, y: 0 },
      { x: 0, y: 2 },
    ];
    expect(codes(issuesOf(raw(slab('s1', { boundary: bow }))))).toEqual(['slab-self-intersect']);
  });

  it('furo que se cruza consigo mesmo é erro', () => {
    const bowHole = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ];
    expect(codes(issuesOf(raw(slab('s1', { holes: [bowHole] }))))).toEqual(['slab-self-intersect']);
  });

  it('contorno de área zero (pontos alinhados) é erro', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
    ];
    expect(codes(issuesOf(raw(slab('s1', { boundary: line }))))).toEqual(['slab-zero-area']);
  });

  it('furo que cobre toda a laje deixa área zero', () => {
    const codesOut = codes(issuesOf(raw(slab('s1', { holes: [rect(-1, -1, 5, 4)] }))));
    expect(codesOut).toContain('slab-hole-outside');
    expect(codesOut).toContain('slab-zero-area');
  });

  it('tipo de laje inexistente é erro', () => {
    const issues = issuesOf(raw(slab('s1', { typeId: 'ls_nao_existe' })));
    expect(codes(issues)).toEqual(['slab-type-missing']);
    expect(issues[0]!.message).toContain('ls_nao_existe');
  });

  it('nível inexistente é erro', () => {
    expect(codes(issuesOf(raw(slab('s1', { levelId: 'lv_x' }))))).toEqual(['slab-level-missing']);
  });

  it('furo fora do contorno é erro', () => {
    expect(codes(issuesOf(raw(slab('s1', { holes: [rect(5, 1, 6, 2)] }))))).toEqual(['slab-hole-outside']);
  });

  it('furo dentro do contorno é aceito', () => {
    expect(issuesOf(build([slab('s1', { holes: [rect(1, 1, 2, 2)] })]))).toEqual([]);
  });

  it('inclinação com direção não unitária é erro', () => {
    const issues = issuesOf(raw(slab('s1', { slope: { origin: { x: 0, y: 0 }, dir: { x: 2, y: 0 }, percent: 1 } })));
    expect(codes(issues)).toEqual(['slab-slope-invalid']);
    expect(issues[0]).toMatchObject({ severity: 'error', elementId: 's1' });
  });

  it('direção com erro de 1e-4 é aceita (tolerância de 1e-3)', () => {
    expect(issuesOf(raw(slab('s1', { slope: { origin: { x: 0, y: 0 }, dir: { x: 1.0001, y: 0 }, percent: 2 } })))).toEqual([]);
  });

  it('percentual acima de 100 em módulo é erro', () => {
    expect(codes(issuesOf(raw(slab('s1', { slope: { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: -120 } }))))).toEqual(['slab-slope-invalid']);
  });

  it('percentual ou direção não finitos são erro', () => {
    for (const slope of [
      { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: Number.NaN },
      { origin: { x: 0, y: 0 }, dir: { x: Number.NaN, y: 0 }, percent: 2 },
      { origin: { x: Number.POSITIVE_INFINITY, y: 0 }, dir: { x: 1, y: 0 }, percent: 2 },
    ]) {
      expect(codes(issuesOf(raw(slab('s1', { slope }))))).toEqual(['slab-slope-invalid']);
    }
  });

  it('inclinação de 100 % é aceita', () => {
    expect(issuesOf(build([slab('s1', { slope: { origin: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, percent: 100 } })]))).toEqual([]);
  });

  it('duas lajes do mesmo nível com 1 m² em comum geram aviso com a área', () => {
    const issues = issuesOf(build([slab('s1'), slab('s2', { boundary: rect(3, 2, 5, 4) })]));
    expect(codes(issues)).toEqual(['slab-overlap']);
    expect(issues[0]).toMatchObject({ severity: 'warning', elementId: 's1' });
    expect(issues[0]!.message).toContain('1,00 m²');
  });

  it('sobreposição de lajes abaixo de 1 cm² não avisa', () => {
    expect(issuesOf(build([slab('s1'), slab('s2', { boundary: rect(3.995, 2.995, 6, 5) })]))).toEqual([]);
  });

  it('lajes sobrepostas em níveis diferentes não avisam', () => {
    expect(issuesOf(build([slab('s1'), slab('s2', { levelId: 'lv_1', boundary: rect(1, 1, 3, 2) })]))).toEqual([]);
  });

  it('laje e piso do mesmo nível sobrepostos geram aviso com sugestão de deslocamento', () => {
    const floor = makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(3, 2, 5, 4) });
    const issues = issuesOf(build([slab('s1')], [floor]));
    expect(codes(issues)).toEqual(['slab-floor-overlap']);
    expect(issues[0]).toMatchObject({ severity: 'warning', elementId: 's1' });
    expect(issues[0]!.message).toContain('1,00 m²');
    expect(issues[0]!.message).toContain('deslocamento');
  });

  it('piso de acabamento encostado na face superior da laje não avisa', () => {
    // Laje de 12 cm no térreo: topo em 0. ft_ceram tem 19 cm; com deslocamento 0,19 a face inferior do piso fica em 0.
    const floor = makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3), heightOffset: 0.19 });
    expect(issuesOf(build([slab('s1')], [floor]))).toEqual([]);
  });

  it('piso que entra 1 cm na laje avisa, mesmo com a mesma área em planta', () => {
    const floor = makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3), heightOffset: 0.18 });
    expect(codes(issuesOf(build([slab('s1')], [floor])))).toEqual(['slab-floor-overlap']);
  });

  it('piso abaixo da laje, sem volume em comum, não avisa', () => {
    // Piso com topo em -0,20 e base em -0,39: a laje vai de -0,12 a 0.
    const floor = makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3), heightOffset: -0.2 });
    expect(issuesOf(build([slab('s1')], [floor]))).toEqual([]);
  });

  it('laje inclinada que sobe e passa pelo piso avisa só onde há volume em comum', () => {
    // Piso de -0,05 a -0,24 sobre o retângulo todo. A laje sobe 10 % em x: a faixa da laje é [-0,12 + r, r], com r de 0 a 0,4.
    const floor = makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3), heightOffset: -0.05 });
    const sloped = slab('s1', { slope: { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 10 } });
    const issues = issuesOf(build([sloped], [floor]));
    expect(codes(issues)).toEqual(['slab-floor-overlap']);
    expect(issues[0]!.message).toContain('m²');
  });

  it('laje inclinada totalmente acima do piso não avisa', () => {
    // Piso de -0,5 a -0,69: a laje, de -0,12 + r a r, com r de 0,4 a 0,8 (origem em x = -4), fica inteira acima dele.
    const floor = makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3), heightOffset: -0.5 });
    const sloped = slab('s1', { slope: { origin: { x: -4, y: 0 }, dir: { x: 1, y: 0 }, percent: 10 } });
    expect(issuesOf(build([sloped], [floor]))).toEqual([]);
  });

  it('piso e laje em níveis diferentes não avisam', () => {
    const floor = makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_1', boundary: rect(0, 0, 4, 3) });
    expect(issuesOf(build([slab('s1')], [floor]))).toEqual([]);
  });

  it('validateProject inclui os problemas de laje', () => {
    const issues = validateProject(raw(slab('s1', { typeId: 'ls_nao_existe' })));
    expect(issues.some((i) => i.code === 'slab-type-missing' && i.elementId === 's1')).toBe(true);
  });
});
