import { describe, expect, it } from 'vitest';
import { ProjectStore, buildTemplate, type OpeningType } from '@hestia/model';
import { applyFamily, familyOptionsFor, leavesChoicesFor, leavesLabel, newOpeningTypeFromFamily } from './openingTypeForm.ts';

const store = (): ProjectStore => new ProjectStore(buildTemplate('house2'));

describe('famílias de abertura no formulário', () => {
  it('oferece só as famílias do tipo, na ordem da interface', () => {
    expect(familyOptionsFor('door').map((f) => f.id)).toEqual(['door_swing', 'door_double', 'door_sliding', 'door_pivot', 'door_void']);
    expect(familyOptionsFor('window').map((f) => f.id)).toEqual(['window_fixed', 'window_tilt', 'window_casement', 'window_sliding', 'window_void']);
  });

  it('rótulo de folhas e opções aceitas pela família (janela de correr: 2 ou 3)', () => {
    expect(leavesLabel(0)).toBe('Vão livre (sem folha)');
    expect(leavesLabel(1)).toBe('1 folha');
    expect(leavesLabel(2)).toBe('2 folhas');
    expect(leavesLabel(3)).toBe('3 folhas');
    const correr = familyOptionsFor('window').find((f) => f.id === 'window_sliding')!;
    expect(leavesChoicesFor(correr).map((o) => o.value)).toEqual([2, 3]);
    const fixa = familyOptionsFor('window').find((f) => f.id === 'window_fixed')!;
    expect(leavesChoicesFor(fixa)).toHaveLength(1);
  });

  it('escolher a família grava o símbolo e a 1ª contagem de folhas aceita', () => {
    const base = newOpeningTypeFromFamily(familyOptionsFor('door').find((f) => f.id === 'door_swing')!);
    const correr = familyOptionsFor('door').find((f) => f.id === 'door_sliding')!;
    const next = applyFamily(base, correr);
    expect(next.plan).toBe('sliding');
    expect(next.leaves).toBe(2);
  });
});

describe('tipo novo pelo comando', () => {
  it('cria um tipo da família escolhida e o comando aceita', () => {
    const s = store();
    const t = newOpeningTypeFromFamily(familyOptionsFor('door').find((f) => f.id === 'door_pivot')!);
    s.exec({ type: 'upsertOpeningType', openingType: t });
    const saved = s.project.openingTypes[t.id];
    expect(saved?.plan).toBe('pivot');
    expect(saved?.leaves).toBe(1);
    expect(saved?.name).toBe('Nova porta');
  });

  it('o comando recusa combinação fora das famílias', () => {
    const s = store();
    const base = newOpeningTypeFromFamily(familyOptionsFor('window')[0]!);
    const bad: OpeningType = { ...base, plan: 'fixed', leaves: 3 };
    expect(() => s.exec({ type: 'upsertOpeningType', openingType: bad })).toThrow('Combinação inválida');
    expect(s.project.openingTypes[bad.id]).toBeUndefined();
  });
});
