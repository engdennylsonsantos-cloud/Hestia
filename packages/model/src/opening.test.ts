import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, ProjectStore, createEmptyProject, openingFamilies, openingFamilyName, openingFamilyOf, openingLeaves, openingTypeIssue, type OpeningType } from './index.ts';

const tipo = (id: string): OpeningType => {
  const t = DEFAULT_OPENING_TYPES.find((x) => x.id === id);
  if (!t) throw new Error(`tipo padrão ausente: ${id}`);
  return t;
};

describe('famílias de abertura', () => {
  it('porta e janela têm cinco famílias cada, na ordem da interface', () => {
    expect(openingFamilies('door').map((f) => f.id)).toEqual(['door_swing', 'door_double', 'door_sliding', 'door_pivot', 'door_void']);
    expect(openingFamilies('window').map((f) => f.id)).toEqual(['window_fixed', 'window_tilt', 'window_casement', 'window_sliding', 'window_void']);
  });

  it('cada tipo do catálogo cai na família do seu comportamento', () => {
    expect(openingFamilyOf(tipo('ot_p80'))!.id).toBe('door_swing');
    expect(openingFamilyOf(tipo('ot_p160'))!.id).toBe('door_double');
    expect(openingFamilyOf(tipo('ot_pc160'))!.id).toBe('door_sliding');
    expect(openingFamilyOf(tipo('ot_pp80'))!.id).toBe('door_pivot');
    expect(openingFamilyOf(tipo('ot_vao90'))!.id).toBe('door_void');
    expect(openingFamilyOf(tipo('ot_jfixa60'))!.id).toBe('window_fixed');
    expect(openingFamilyOf(tipo('ot_j60'))!.id).toBe('window_casement');
    expect(openingFamilyOf(tipo('ot_j120'))!.id).toBe('window_sliding');
    expect(openingFamilyOf(tipo('ot_j240'))!.id).toBe('window_sliding');
    expect(openingFamilyOf(tipo('ot_jv120'))!.id).toBe('window_void');
  });

  it('o vão livre de janela tem 0 folhas e o símbolo da fixa (sem folha o desenho é só a soleira)', () => {
    expect(openingFamilyOf({ kind: 'window', plan: 'fixed', leaves: 0 })!.id).toBe('window_void');
    expect(openingFamilyOf({ kind: 'door', plan: 'swing', leaves: 0 })!.id).toBe('door_void');
  });

  it('porta de duas folhas gravada como giro (arquivo antigo ou editor) é a família dupla', () => {
    expect(openingFamilyOf({ kind: 'door', plan: 'swing', leaves: 2 })!.id).toBe('door_double');
    expect(openingFamilyName({ kind: 'door', plan: 'double', leaves: 2 })).toBe('Porta dupla');
  });

  it('folhas aceitas por família: giro 1, dupla 2, correr 2, pivotante 1, vão livre 0; janela de correr 2 e 3', () => {
    expect(openingLeaves({ kind: 'door', plan: 'swing', leaves: 1 })).toEqual([1]);
    expect(openingLeaves({ kind: 'door', plan: 'double', leaves: 2 })).toEqual([2]);
    expect(openingLeaves({ kind: 'door', plan: 'sliding', leaves: 2 })).toEqual([2]);
    expect(openingLeaves({ kind: 'door', plan: 'pivot', leaves: 1 })).toEqual([1]);
    expect(openingLeaves({ kind: 'door', plan: 'swing', leaves: 0 })).toEqual([0]);
    expect(openingLeaves({ kind: 'window', plan: 'sliding', leaves: 3 })).toEqual([2, 3]);
    expect(openingLeaves({ kind: 'window', plan: 'tilt', leaves: 1 })).toEqual([1]);
  });

  it('combinações que não existem não têm família e são recusadas com mensagem', () => {
    const invalidos: Array<Pick<OpeningType, 'kind' | 'plan' | 'leaves'>> = [
      { kind: 'door', plan: 'fixed', leaves: 1 },
      { kind: 'door', plan: 'swing', leaves: 3 },
      { kind: 'window', plan: 'swing', leaves: 1 },
      { kind: 'window', plan: 'sliding', leaves: 1 },
      { kind: 'window', plan: 'tilt', leaves: 2 },
    ];
    for (const t of invalidos) {
      expect(openingFamilyOf(t)).toBeNull();
      expect(openingTypeIssue(t)).toMatch(/Combinação inválida/);
    }
    expect(openingTypeIssue({ kind: 'window', plan: 'sliding', leaves: 1 })).toBe('Combinação inválida: janela com o símbolo "sliding" e 1 folha.');
    expect(openingTypeIssue({ kind: 'door', plan: 'swing', leaves: 3 })).toBe('Combinação inválida: porta com o símbolo "swing" e 3 folhas.');
  });

  it('toda combinação válida passa na regra do tipo', () => {
    for (const f of [...openingFamilies('door'), ...openingFamilies('window')]) {
      for (const leaves of f.leaves) expect(openingTypeIssue({ kind: f.kind, plan: f.plan, leaves })).toBeNull();
    }
  });
});

describe('regra do tipo no comando', () => {
  it('grava o tipo válido e recusa o inválido, sem alterar o projeto', () => {
    const s = new ProjectStore(createEmptyProject());
    const base = tipo('ot_p80');
    s.exec({ type: 'upsertOpeningType', openingType: { ...base, id: 'ot_novo', name: 'Porta da sala', code: 'P-10' } });
    expect(s.project.openingTypes.ot_novo).toMatchObject({ name: 'Porta da sala', code: 'P-10', leaves: 1, plan: 'swing' });
    expect(() => s.exec({ type: 'upsertOpeningType', openingType: { ...base, id: 'ot_ruim', leaves: 3 } })).toThrow(/Combinação inválida/);
    expect(s.project.openingTypes.ot_ruim).toBeUndefined();
  });
});
