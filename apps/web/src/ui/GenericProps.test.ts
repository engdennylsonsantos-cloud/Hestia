import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createEmptyProject, type Generic } from '@hestia/model';

/** O painel lê o projeto pelo controlador; no teste de render, um projeto em memória basta (sem DOM). */
const estado = vi.hoisted(() => ({ project: null as unknown }));
vi.mock('../editor/controller.ts', () => ({ useProject: () => estado.project }));

const { GenericProps, isOpenMesh } = await import('./GenericProps.tsx');

/** Cubo unitário fechado, com os vértices repetidos por triângulo como na malha importada. */
const CUBE_VERTS = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
] as const;
const CUBE_TRIS = [
  [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
  [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
  [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
] as const;
const cube = (): Generic['mesh'] => {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const tri of CUBE_TRIS) {
    for (const vi of tri) {
      indices.push(positions.length / 3);
      positions.push(...CUBE_VERTS[vi]!);
    }
  }
  return { positions, indices };
};

const beam = (id: string, overrides: Partial<Generic> = {}): Generic => ({
  id,
  kind: 'generic',
  levelId: 'lv_0',
  name: id,
  sourceClass: 'IFCBEAM',
  mesh: cube(),
  order: 1,
  ...overrides,
});

function projectWith(...items: Generic[]) {
  const p = createEmptyProject();
  for (const g of items) p.elements[g.id] = g;
  return p;
}

const render = (items: Generic[]): string => renderToStaticMarkup(createElement(GenericProps, { items }));

describe('propriedades do objeto genérico importado do IFC', () => {
  it('mostra classe, dados do arquivo, nível e quantitativos formatados', () => {
    const g = beam('g1', {
      name: 'Viga 01',
      predefinedType: 'BEAM',
      objectType: 'Viga de concreto',
      ifcProperties: [{ name: 'Fabricante', value: 'ACME' }],
    });
    estado.project = projectWith(g);
    const html = render([g]);
    expect(html).toContain('Classe IFC');
    expect(html).toContain('IFCBEAM');
    expect(html).toContain('Tipo predefinido');
    expect(html).toContain('BEAM');
    expect(html).toContain('Tipo de objeto');
    expect(html).toContain('Viga de concreto');
    expect(html).toContain('Viga 01');
    expect(html).toContain('Térreo');
    expect(html).toMatch(/>12</);
    expect(html).toContain('1,00 m³');
    expect(html).toContain('6,00 m²');
    expect(html).toContain('Fabricante');
    expect(html).toContain('ACME');
  });

  it('marca o volume de malha aberta como indicativo', () => {
    const aberta: Generic['mesh'] = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] };
    expect(isOpenMesh(aberta)).toBe(true);
    expect(isOpenMesh(cube())).toBe(false);
    const g = beam('g2', { name: 'Face aberta', mesh: aberta });
    estado.project = projectWith(g);
    const html = render([g]);
    expect(html).toContain('Volume indicativo');
    expect(html).toContain('0,50 m²');
  });

  it('lista no máximo 30 propriedades IFC e avisa quantas sobraram', () => {
    const props = Array.from({ length: 35 }, (_, i) => ({ name: `Propriedade ${String(i + 1).padStart(2, '0')}`, value: i }));
    const g = beam('g3', { ifcProperties: props });
    estado.project = projectWith(g);
    const html = render([g]);
    expect(html).toContain('Propriedade 01');
    expect(html).toContain('Propriedade 30');
    expect(html).not.toContain('Propriedade 31');
    expect(html).toContain('+5');
  });
});
