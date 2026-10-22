import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, validateProject, type ValidationIssue, type Wall } from './index.ts';

const wall = (id: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Omit<Wall, 'order'> =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: ax, y: ay }, b: { x: bx, y: by }, ...extra });

/** Projeto construído só com comandos (addWall), como na aplicação. */
function build(walls: Array<Omit<Wall, 'order'>>) {
  const s = new ProjectStore(createEmptyProject());
  for (const w of walls) s.exec({ type: 'addWall', wall: w });
  return s.project;
}

const domainIssues = (issues: ValidationIssue[]): ValidationIssue[] => issues.filter((i) => i.code === 'wall-curve-join-domain');

// Arco de a=(0,0) a b=(6,0) com flecha 1 m: raio 5 m (dentro do domínio). Na ponta b a tangente aponta para (-0,8; 0,6).
// Arco de raio 2 m (semicircunferência de (0,0) a (4,0)): fora do domínio por raio.

describe('validação: junção de parede curva fora do domínio (CV-2)', () => {
  it('arco com raio de 5 m e quina de 90° não gera aviso', () => {
    const issues = validateProject(build([wall('arc', 0, 0, 6, 0, { sag: 1 }), wall('r', 6, 0, 7.8, 2.4)]));
    expect(domainIssues(issues)).toEqual([]);
  });

  it('continuidade tangente com arco de raio 5 m não gera aviso', () => {
    const issues = validateProject(build([wall('arc', 0, 0, 6, 0, { sag: 1 }), wall('r', 6, 0, 8.4, -1.8)]));
    expect(domainIssues(issues)).toEqual([]);
  });

  it('arco com raio menor que 3 m gera aviso de raio, com o id da parede', () => {
    const issues = validateProject(build([wall('arc', 0, 0, 4, 0, { sag: 2 }), wall('r', 4, 0, 7, 0)]));
    const found = domainIssues(issues);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'warning', elementId: 'arc' });
    expect(found[0]!.message).toContain('raio de 2,00 m');
    expect(found[0]!.message).toContain('mínimo 3,00 m');
  });

  it('quina de 30° com arco de raio 5 m gera aviso de quina', () => {
    // Direção de saída do arco em b: (-0,8; 0,6). Parede a 30° dela: (-0,3923; 0,9199).
    const issues = validateProject(build([wall('arc', 0, 0, 6, 0, { sag: 1 }), wall('q', 6, 0, 4.8231, 2.7597)]));
    const found = domainIssues(issues);
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toContain('quina de 30,0° fora de 60° a 120°');
    expect(found[0]!.message).not.toContain('raio');
  });

  it('ponta de parede reta sobre o corpo de arco de raio 2 m (T) gera aviso de raio', () => {
    const issues = validateProject(build([wall('arc', 0, 0, 4, 0, { sag: 2 }), wall('t', 2, 5, 2, 2)]));
    const found = domainIssues(issues);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'warning', elementId: 't' });
    expect(found[0]!.message).toContain('raio de 2,00 m');
  });

  it('paredes retas sem arco não geram aviso de domínio', () => {
    const issues = validateProject(build([wall('a', 0, 0, 4, 0), wall('b', 4, 0, 4, 3)]));
    expect(domainIssues(issues)).toEqual([]);
  });
});
