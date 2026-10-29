import { describe, expect, it } from 'vitest';
import { createEmptyProject, defaultRampTypeId, makeRamp, validateProject, type Project, type Ramp, type ValidationIssue } from './index.ts';

const codesOf = (p: Project): string[] =>
  validateProject(p)
    .filter((i: ValidationIssue) => i.code.startsWith('ramp-'))
    .map((i) => i.code);

/** Projeto com a rampa `rp1` gravada direto em `elements` (sem passar pelas regras do comando). */
const projectWith = (extra: Partial<Ramp> = {}): Project => {
  const p = createEmptyProject();
  p.elements.rp1 = { ...makeRamp({ id: 'rp1', typeId: defaultRampTypeId, levelId: 'lv_0', ...extra }), order: 1 } as Ramp;
  return p;
};

describe('validação da rampa', () => {
  it('tipo ausente → ramp-type-missing', () => {
    expect(codesOf(projectWith({ typeId: 'nope' }))).toContain('ramp-type-missing');
  });

  it('topo igual à base → ramp-top-not-above', () => {
    expect(codesOf(projectWith({ topLevelId: 'lv_0' }))).toContain('ramp-top-not-above');
  });

  it('nível base e nível de topo ausentes', () => {
    const codes = codesOf(projectWith({ levelId: 'nope', topLevelId: 'nope2' }));
    expect(codes).toEqual(expect.arrayContaining(['ramp-level-missing', 'ramp-top-level-missing']));
  });

  it('rampa válida não tem erro de rampa', () => {
    expect(codesOf(projectWith())).toEqual([]);
  });
});
