import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeRoof, validateProject, type Project, type Roof, type ValidationIssue } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const edges = (extra: Partial<Roof>): Omit<Roof, 'order'> =>
  makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: rect(0, 0, 8, 6), shape: 'edges', ...extra });

/** Telhado inserido direto no mapa (a validação vê o que está no arquivo, inclusive o que o comando recusaria). */
function raw(x: Omit<Roof, 'order'>): Project {
  return { ...createEmptyProject(), elements: { [x.id]: { ...x, order: 1 } } };
}

const issuesOf = (p: Project): ValidationIssue[] => validateProject(p).filter((i) => i.code.startsWith('roof-'));
const codes = (p: Project): string[] => issuesOf(p).map((i) => i.code);

describe('validação da inclinação por aresta (forma edges)', () => {
  it('um contorno de quatro arestas com duas inclinações não tem problema', () => {
    expect(issuesOf(raw(edges({ edgeSlopes: [30, null, 30, null], edgeOverhangs: [0, 0, 0, 0] })))).toEqual([]);
  });

  it('lista de inclinações com tamanho diferente do contorno é erro roof-edges-length', () => {
    const got = issuesOf(raw(edges({ edgeSlopes: [30, null, 30], edgeOverhangs: [0, 0, 0, 0] })));
    expect(got).toEqual([expect.objectContaining({ severity: 'error', code: 'roof-edges-length' })]);
  });

  it('balanço por aresta com tamanho diferente também é roof-edges-length', () => {
    expect(codes(raw(edges({ edgeSlopes: [30, null, 30, null], edgeOverhangs: [0, 0] })))).toEqual(['roof-edges-length']);
  });

  it('nenhuma aresta com inclinação é roof-all-flat (sem água não há telhado)', () => {
    expect(codes(raw(edges({ edgeSlopes: [null, null, null, null], edgeOverhangs: [0, 0, 0, 0] })))).toEqual(['roof-all-flat']);
  });

  it('inclinação de aresta zero, negativa ou acima de 300 % é roof-edge-slope-invalid; a aresta sem inclinação não conta', () => {
    const got = issuesOf(raw(edges({ edgeSlopes: [30, 0, null, 400], edgeOverhangs: [0, 0, 0, 0] })));
    expect(got.map((i) => i.code)).toEqual(['roof-edge-slope-invalid', 'roof-edge-slope-invalid']);
    expect(got[0]!.message).toContain('aresta 2');
    expect(got[1]!.message).toContain('aresta 4');
  });

  it('inclinação de aresta não finita é erro', () => {
    expect(codes(raw(edges({ edgeSlopes: [Number.NaN, null, 30, null], edgeOverhangs: [0, 0, 0, 0] })))).toEqual(['roof-edge-slope-invalid']);
  });

  it('nas formas de uma inclinação só (quatro águas) a lista por aresta não é checada pela regra de aresta', () => {
    expect(codes(raw(edges({ shape: 'hip', edgeSlopes: [null, null, null, null], edgeOverhangs: [0, 0, 0, 0], slopePercent: 30 })))).toEqual([]);
  });
});
