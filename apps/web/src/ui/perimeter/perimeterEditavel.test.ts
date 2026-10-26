import { describe, expect, it } from 'vitest';
import type { Project } from '@hestia/model';
import { createEmptyProject } from '@hestia/model';
import type { MenuEntry } from '../../editor/contextMenu.ts';
import { comEditarPerimetro, EDITAR_PERIMETRO_ID, idPerimetroEditavel } from './perimeterEditavel.ts';

/** Projeto vazio com elementos mínimos de cada tipo (só o `kind` importa para estes testes). */
const comElementos = (kinds: Record<string, string>): Project =>
  ({ ...createEmptyProject('vazio'), elements: Object.fromEntries(Object.entries(kinds).map(([id, kind]) => [id, { id, kind }])) }) as unknown as Project;

describe('idPerimetroEditavel', () => {
  const p = comElementos({ r1: 'roof', f1: 'floor', s1: 'slab', c1: 'ceiling', w1: 'wall', w2: 'wall' });
  it('um telhado, piso, laje ou forro selecionado é editável', () => {
    for (const id of ['r1', 'f1', 's1', 'c1']) expect(idPerimetroEditavel(p, [id])).toBe(id);
  });
  it('parede, nada selecionado ou mais de um elemento não são editáveis', () => {
    expect(idPerimetroEditavel(p, ['w1'])).toBeNull();
    expect(idPerimetroEditavel(p, [])).toBeNull();
    expect(idPerimetroEditavel(p, ['r1', 'f1'])).toBeNull();
    expect(idPerimetroEditavel(p, ['inexistente'])).toBeNull();
  });
});

describe('comEditarPerimetro', () => {
  const itens: MenuEntry[] = [
    { id: 'repeat', label: 'Repetir' },
    { id: 'createSimilar', label: 'Criar semelhante' },
    { id: 'delete', label: 'Excluir' },
  ];
  it('põe "Editar perímetro" logo depois de "Criar semelhante" quando há elemento editável', () => {
    const out = comEditarPerimetro(itens, 'pt', true);
    expect(out.map((e) => e.id)).toEqual(['repeat', 'createSimilar', EDITAR_PERIMETRO_ID, 'delete']);
    expect(out[2]?.label).toBe('Editar perímetro');
    expect(comEditarPerimetro(itens, 'en', true)[2]?.label).toBe('Edit Perimeter');
  });
  it('sem elemento editável, o menu sai igual', () => {
    expect(comEditarPerimetro(itens, 'pt', false)).toBe(itens);
  });
});
