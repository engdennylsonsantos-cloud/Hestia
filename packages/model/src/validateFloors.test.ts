import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, validateProject, type Floor, type Project, type ValidationIssue } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number): Floor['boundary'] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

const floor = (id: string, extra: Partial<Floor> = {}): Omit<Floor, 'order'> =>
  makeFloor({ id, typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3), ...extra });

/** Projeto com pisos montados pelo comando addFloor (como na aplicação). */
function build(floors: Array<Omit<Floor, 'order'>>): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const f of floors) s.exec({ type: 'addFloor', floor: f });
  return s.project;
}

/** Insere o piso direto no mapa, para os casos que o comando addFloor recusaria. */
function raw(f: Omit<Floor, 'order'>): Project {
  const p = createEmptyProject();
  return { ...p, elements: { [f.id]: { ...f, order: 1 } } };
}

const codes = (issues: ValidationIssue[]): string[] => issues.map((i) => i.code);
const issuesOf = (p: Project): ValidationIssue[] => validateProject(p).filter((i) => i.code.startsWith('floor-') || i.code === 'level-missing');

describe('validação de pisos', () => {
  it('piso retangular válido não gera problemas', () => {
    expect(issuesOf(build([floor('f1')]))).toEqual([]);
  });

  it('contorno com menos de 3 pontos é erro', () => {
    const issues = issuesOf(raw(floor('f1', { boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }] })));
    expect(codes(issues)).toEqual(['floor-few-points']);
    expect(issues[0]).toMatchObject({ severity: 'error', elementId: 'f1' });
  });

  it('furo com menos de 3 pontos é erro de pontos', () => {
    const issues = issuesOf(raw(floor('f1', { holes: [[{ x: 1, y: 1 }, { x: 2, y: 1 }]] })));
    expect(codes(issues)).toEqual(['floor-few-points']);
  });

  it('contorno que se cruza é erro (gravata)', () => {
    // Laço assimétrico: com os dois lóbulos iguais a área líquida daria zero e o aviso de área viria junto.
    const bow = [
      { x: 0, y: 0 },
      { x: 4, y: 3 },
      { x: 4, y: 0 },
      { x: 0, y: 2 },
    ];
    expect(codes(issuesOf(raw(floor('f1', { boundary: bow }))))).toEqual(['floor-self-intersect']);
  });

  it('furo que se cruza consigo mesmo é erro', () => {
    const bowHole = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ];
    expect(codes(issuesOf(raw(floor('f1', { holes: [bowHole] }))))).toEqual(['floor-self-intersect']);
  });

  it('contorno de área zero (pontos alinhados) é erro', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
    ];
    expect(codes(issuesOf(raw(floor('f1', { boundary: line }))))).toEqual(['floor-zero-area']);
  });

  it('furo que cobre todo o piso deixa área zero', () => {
    const issues = issuesOf(raw(floor('f1', { holes: [rect(-1, -1, 5, 4)] })));
    expect(codes(issues)).toContain('floor-hole-outside');
    expect(codes(issues)).toContain('floor-zero-area');
  });

  it('tipo de piso inexistente é erro', () => {
    const issues = issuesOf(raw(floor('f1', { typeId: 'ft_nao_existe' })));
    expect(codes(issues)).toEqual(['floor-type-missing']);
    expect(issues[0]!.message).toContain('ft_nao_existe');
  });

  it('nível inexistente é erro', () => {
    expect(codes(issuesOf(raw(floor('f1', { levelId: 'lv_x' }))))).toEqual(['level-missing']);
  });

  it('furo fora do contorno é erro', () => {
    expect(codes(issuesOf(raw(floor('f1', { holes: [rect(5, 1, 6, 2)] }))))).toEqual(['floor-hole-outside']);
  });

  it('furo com a aresta cruzando o contorno é erro, mesmo com vértices dentro', () => {
    // Contorno em L: os três vértices do furo caem dentro do L, mas a aresta de (3,5; 0,2) a (0,2; 2,5) cruza a quina do recorte.
    const L = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
    ];
    const hole = [
      { x: 0.2, y: 0.2 },
      { x: 3.5, y: 0.2 },
      { x: 0.2, y: 2.5 },
    ];
    expect(codes(issuesOf(raw(floor('f1', { boundary: L, holes: [hole] }))))).toContain('floor-hole-outside');
  });

  it('furo que encosta no contorno por um vértice é aceito', () => {
    const hole = [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ];
    expect(issuesOf(raw(floor('f1', { holes: [hole] })))).toEqual([]);
  });

  it('furo dentro do contorno é aceito', () => {
    expect(issuesOf(build([floor('f1', { holes: [rect(1, 1, 2, 2)] })]))).toEqual([]);
  });

  it('dois pisos do mesmo nível com 1 m² em comum geram aviso com a área', () => {
    const issues = issuesOf(build([floor('f1'), floor('f2', { boundary: rect(3, 2, 5, 4) })]));
    expect(codes(issues)).toEqual(['floor-overlap']);
    expect(issues[0]).toMatchObject({ severity: 'warning', elementId: 'f1' });
    expect(issues[0]!.message).toContain('1,00 m²');
  });

  it('sobreposição abaixo de 1 cm² não avisa', () => {
    // 5 mm x 5 mm = 0,25 cm².
    expect(issuesOf(build([floor('f1'), floor('f2', { boundary: rect(3.995, 2.995, 6, 5) })]))).toEqual([]);
  });

  it('pisos sobrepostos em níveis diferentes não avisam', () => {
    expect(issuesOf(build([floor('f1'), floor('f2', { levelId: 'lv_1', boundary: rect(1, 1, 3, 2) })]))).toEqual([]);
  });

  it('validateProject inclui os problemas de piso', () => {
    const issues = validateProject(raw(floor('f1', { typeId: 'ft_nao_existe' })));
    expect(issues.some((i) => i.code === 'floor-type-missing' && i.elementId === 'f1')).toBe(true);
  });
});
