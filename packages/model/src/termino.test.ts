import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, type Layer } from './index.ts';
import { TERMINO_MAX_CM, terminoIssue, terminoMeters, terminoOf } from './termino.ts';

const camada = (termino?: Layer['termino']): Layer => ({ function: 'structure', materialId: 'mat_concreto', thickness: 0.1, wraps: false, ...(termino === undefined ? {} : { termino }) });

describe('término na junção (decisão 0023 §2, P8)', () => {
  it('campo ausente lê como automático (arquivo antigo abre igual)', () => {
    expect(terminoOf(camada())).toBe('auto');
    expect(terminoIssue(camada())).toBeNull();
  });

  it('valores de nome são válidos e o deslocamento vale entre −30 e +30 cm', () => {
    expect(terminoIssue(camada('nucleo'))).toBeNull();
    expect(terminoIssue(camada('face'))).toBeNull();
    expect(terminoIssue(camada({ cm: TERMINO_MAX_CM }))).toBeNull();
    expect(terminoIssue(camada({ cm: -TERMINO_MAX_CM }))).toBeNull();
    expect(terminoIssue(camada({ cm: TERMINO_MAX_CM + 0.5 }))).not.toBeNull();
    expect(terminoIssue(camada({ cm: Number.NaN }))).not.toBeNull();
    expect(terminoIssue(camada({ cm: Number.POSITIVE_INFINITY }))).not.toBeNull();
  });

  it('converte o deslocamento para metros e zera nos valores de nome', () => {
    expect(terminoMeters({ cm: -2 })).toBeCloseTo(-0.02, 12);
    expect(terminoMeters('auto')).toBe(0);
  });

  it('o comando de tipo de piso e de laje recusa deslocamento fora da faixa', () => {
    const s = new ProjectStore(createEmptyProject());
    const t = s.project.floorTypes.ft_ceram!;
    expect(() => s.exec({ type: 'upsertFloorType', floorType: { ...t, layers: [{ ...t.layers[0]!, termino: { cm: 31 } }, ...t.layers.slice(1)] } })).toThrow(/30 cm/);
    expect(() => s.exec({ type: 'upsertFloorType', floorType: { ...t, layers: [{ ...t.layers[0]!, termino: { cm: 30 } }, ...t.layers.slice(1)] } })).not.toThrow();
    const u = s.project.slabTypes.ls_mac12!;
    expect(() => s.exec({ type: 'upsertSlabType', slabType: { ...u, layers: [{ ...u.layers[0]!, termino: { cm: -31 } }] } })).toThrow(/30 cm/);
    expect(() => s.exec({ type: 'upsertSlabType', slabType: { ...u, layers: [{ ...u.layers[0]!, termino: 'nucleo' }] } })).not.toThrow();
  });
});
