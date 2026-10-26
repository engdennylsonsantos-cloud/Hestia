import { describe, expect, it } from 'vitest';
import { ProjectStore, buildTemplate, isOpening, type Id, type Opening } from '@hestia/model';
import { changeOpeningType, planOpeningTypeChange } from './openingTypeActions.ts';

/** Casa de teste com um tipo de porta largo (3 m) para forçar o encaixe. */
function casa(): ProjectStore {
  const store = new ProjectStore(buildTemplate('house2'));
  const base = store.project.openingTypes['ot_p80']!;
  store.exec({ type: 'upsertOpeningType', openingType: { ...base, id: 'ot_larga', name: 'Porta larga', width: 3 } });
  return store;
}

/** Posiciona a abertura `id` no offset dado (a casa de teste tem portas com offset conhecido). */
function posicione(store: ProjectStore, id: Id, offset: number): void {
  store.exec({ type: 'updateElements', ids: [id], patch: { offset } });
}

const aberturas = (store: ProjectStore): Opening[] => Object.values(store.project.elements).filter(isOpening);

describe('troca de tipo de abertura (Propriedades)', () => {
  it('troca o tipo quando a abertura nova cabe onde está, sem aviso de deslocamento', () => {
    const store = casa();
    const porta = aberturas(store)[0]!;
    const msgs: string[] = [];
    posicione(store, porta.id, 1.5);
    changeOpeningType(store, [porta.id], 'ot_larga', (m) => msgs.push(m));
    expect(store.project.elements[porta.id]).toMatchObject({ typeId: 'ot_larga', offset: 1.5 });
    expect(msgs).toEqual([]);
  });

  it('desloca a abertura para caber na parede e avisa a posição antes e depois', () => {
    const store = casa();
    const porta = aberturas(store)[0]!;
    const msgs: string[] = [];
    posicione(store, porta.id, 0.5);
    changeOpeningType(store, [porta.id], 'ot_larga', (m) => msgs.push(m));
    const nova = store.project.elements[porta.id] as Opening;
    expect(nova.typeId).toBe('ot_larga');
    expect(nova.offset).toBeCloseTo(1.5, 6);
    expect(msgs.at(-1)).toBe('A abertura foi deslocada para caber: 0,50 → 1,50 m. Ctrl+Z desfaz.');
  });

  it('recusa quando a abertura nova sobrepõe outra da mesma parede, sem gravar nada', () => {
    const store = casa();
    const [a, b] = aberturas(store).filter((o) => o.hostId === aberturas(store)[0]!.hostId);
    if (!a || !b) throw new Error('a casa de teste precisa de duas aberturas na mesma parede');
    posicione(store, a.id, 1.5);
    posicione(store, b.id, 2.4);
    const antes = JSON.stringify(store.project.elements[a.id]);
    const msgs: string[] = [];
    changeOpeningType(store, [a.id], 'ot_larga', (m) => msgs.push(m));
    expect(JSON.stringify(store.project.elements[a.id])).toBe(antes);
    expect(msgs.at(-1)).toBe('Sem espaço para Porta larga nesta parede: a abertura sobreporia outra.');
  });

  it('o plano de troca não grava: planOpeningTypeChange só descreve o que faria', () => {
    const store = casa();
    const porta = aberturas(store)[0]!;
    const tipoOriginal = porta.typeId;
    posicione(store, porta.id, 0.5);
    const plano = planOpeningTypeChange(store.project, [porta.id], 'ot_larga');
    expect(plano).toEqual({ ok: true, updates: [{ id: porta.id, offset: 1.5, from: 0.5 }] });
    expect((store.project.elements[porta.id] as Opening).typeId).toBe(tipoOriginal);
  });
});
