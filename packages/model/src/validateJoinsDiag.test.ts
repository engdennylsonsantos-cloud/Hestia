import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, validateProject, type Project, type ValidationIssue, type Wall } from './index.ts';

const wall = (id: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Omit<Wall, 'order'> =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: ax, y: ay }, b: { x: bx, y: by }, ...extra });
function build(walls: Array<Omit<Wall, 'order'>>, settings?: Partial<Project['settings']>): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const w of walls) s.exec({ type: 'addWall', wall: w });
  return settings ? { ...s.project, settings: { ...s.project.settings, ...settings } } : s.project;
}
const codes = (issues: ValidationIssue[]): string[] => issues.map((i) => i.code);

describe('quase-encosto (J-04)', () => {
  it('pontas a 3 cm uma da outra (tolerância 2 cm, dentro de 2×) avisam', () => {
    // b começa em (4,03; 0), 3 cm depois da ponta de a (4; 0): colineares com folga.
    const issues = validateProject(build([wall('a', 0, 0, 4, 0), wall('b', 4.03, 0, 4.03, 3)]));
    expect(codes(issues)).toContain('wall-end-near-miss');
  });

  it('pontas já unidas (até a tolerância) não avisam', () => {
    expect(codes(validateProject(build([wall('a', 0, 0, 4, 0), wall('b', 4, 0, 4, 3)])))).not.toContain('wall-end-near-miss');
  });

  it('pontas a 10 cm (longe de 2×) não avisam: não é quase-encosto', () => {
    expect(codes(validateProject(build([wall('a', 0, 0, 4, 0), wall('b', 4.1, 0, 4.1, 3)])))).not.toContain('wall-end-near-miss');
  });

  it('com a tolerância do projeto em 5 cm, pontas a 3 cm já unem: sem aviso (J-02)', () => {
    const issues = validateProject(build([wall('a', 0, 0, 4, 0), wall('b', 4.03, 0, 4.03, 3)], { joinTolerance: 0.05 }));
    expect(codes(issues)).not.toContain('wall-end-near-miss');
  });
});

describe('esquadria em ângulo agudo (J-04)', () => {
  it('ângulo interno de ~30° entre duas paredes retas avisa, em vez de deixar vão calado', () => {
    // a sai de (0,0) para (4,0); b volta do nó (4,0) para (0,1.73) — ângulo interno ~30°.
    const issues = validateProject(build([wall('a', 0, 0, 4, 0), wall('b', 4, 0, 0, 1.732)]));
    expect(codes(issues)).toContain('wall-acute-join');
  });

  it('esquadria de 90° não avisa', () => {
    expect(codes(validateProject(build([wall('a', 0, 0, 4, 0), wall('b', 4, 0, 4, 3)])))).not.toContain('wall-acute-join');
  });
});
