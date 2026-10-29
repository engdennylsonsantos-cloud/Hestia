import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeRamp, type RampType } from '@hestia/model';
import { duplicateRampType, rampTypeDeleteBlock, rampTypeError, renameRampType, tryDeleteRampType } from './rampTypeActions.ts';

const store = (): ProjectStore => new ProjectStore(createEmptyProject());

describe('ações de tipo de rampa', () => {
  it('duplicar cria um tipo a mais com nome "(cópia)"', () => {
    const s = store();
    const before = Object.keys(s.project.rampTypes).length;
    const id = duplicateRampType(s, 'rmt_nbr9050');
    expect(id).toBeTruthy();
    expect(Object.keys(s.project.rampTypes)).toHaveLength(before + 1);
    expect(s.project.rampTypes[id!]!.name).toBe('Rampa de concreto (NBR 9050) (cópia)');
  });

  it('excluir tipo em uso fica bloqueado com a contagem', () => {
    const s = store();
    s.exec({ type: 'addRamp', ramp: makeRamp({ id: 'rp1', typeId: 'rmt_nbr9050', levelId: 'lv_0' }) });
    expect(rampTypeDeleteBlock(s.project, 'rmt_nbr9050')).toBe('Em uso por 1 rampa.');
    expect(tryDeleteRampType(s, 'rmt_nbr9050')).toEqual({ ok: false, error: 'Tipo em uso' });
  });

  it('excluir o único tipo fica bloqueado', () => {
    const s = store();
    s.exec({ type: 'deleteRampType', id: 'rmt_ada' });
    expect(rampTypeDeleteBlock(s.project, 'rmt_nbr9050')).toBe('É o único tipo de rampa do projeto.');
  });

  it('renomear com nome vazio é recusado', () => {
    const s = store();
    expect(renameRampType(s, 'rmt_nbr9050', '   ')).toEqual({ ok: false, error: 'Dê um nome ao tipo.' });
    expect(renameRampType(s, 'rmt_nbr9050', 'Rampa nova')).toEqual({ ok: true });
    expect(s.project.rampTypes.rmt_nbr9050!.name).toBe('Rampa nova');
  });

  it('rampTypeError devolve a mensagem do modelo para tabela fora de ordem', () => {
    const t: RampType = {
      ...structuredClone(createEmptyProject().rampTypes.rmt_nbr9050!),
      normTable: [
        { maxSlope: 0.08, maxRise: 0.8, maxFlights: null },
        { maxSlope: 0.05, maxRise: 1.5, maxFlights: null },
      ],
    };
    expect(rampTypeError(t)).toBe('A tabela de norma deve estar em ordem crescente de inclinação, com valores positivos.');
    expect(rampTypeError({ ...t, name: '  ' })).toBe('Dê um nome ao tipo.');
  });
});
