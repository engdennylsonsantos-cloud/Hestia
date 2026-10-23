import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, type Layer } from './index.ts';
import { TERMINO_MAX_CM, comTerminoValido, limiteExternoIssue, terminoAtePrioridade, terminoEhRegraParede, terminoIssue, terminoMeters, terminoOf } from './termino.ts';

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

describe('término nas paredes: regra de parede e prioridade (decisão 0025)', () => {
  it('reconhece a regra de parede (face, núcleo, passa, prioridade) e não o deslocamento em cm', () => {
    expect(terminoEhRegraParede(camada('face'))).toBe(true);
    expect(terminoEhRegraParede(camada('nucleo'))).toBe(true);
    expect(terminoEhRegraParede(camada('passa'))).toBe(true);
    expect(terminoEhRegraParede(camada({ ate: { prioridade: 3 } }))).toBe(true);
    expect(terminoEhRegraParede(camada({ cm: -1 }))).toBe(false);
    expect(terminoEhRegraParede(camada('auto'))).toBe(false);
    expect(terminoEhRegraParede(camada())).toBe(false);
  });

  it('a prioridade de `ate` vai de 1 a 9, inteira; fora disso, erro de validação', () => {
    expect(terminoIssue(camada({ ate: { prioridade: 1 } }))).toBeNull();
    expect(terminoIssue(camada({ ate: { prioridade: 9 } }))).toBeNull();
    expect(terminoIssue(camada({ ate: { prioridade: 0 } }))).toMatch(/1 e 9/);
    expect(terminoIssue(camada({ ate: { prioridade: 10 } }))).toMatch(/1 e 9/);
    expect(terminoIssue(camada({ ate: { prioridade: 2.5 } }))).toMatch(/1 e 9/);
    expect(terminoAtePrioridade({ ate: { prioridade: 4 } })).toBe(4);
    expect(terminoAtePrioridade('face')).toBeNull();
  });

  it('passa é válido e não tem deslocamento', () => {
    expect(terminoIssue(camada('passa'))).toBeNull();
    expect(terminoMeters('passa')).toBe(0);
  });
});

describe('limite no perímetro externo (decisão 0027)', () => {
  const comLimite = (limiteExterno?: Layer['limiteExterno']): Layer => ({ ...camada(), ...(limiteExterno === undefined ? {} : { limiteExterno }) });

  it('campo ausente é válido e significa "contorno do elemento"', () => {
    expect(limiteExternoIssue(comLimite())).toBeNull();
  });

  it('as duas faces externas são válidas; qualquer outro valor é erro', () => {
    expect(limiteExternoIssue(comLimite('parede'))).toBeNull();
    expect(limiteExternoIssue(comLimite('nucleo'))).toBeNull();
    expect(limiteExternoIssue({ limiteExterno: 'externo' as never })).toMatch(/Limite no perímetro externo/);
  });

  it('o limite é independente do término: não muda a regra de parede', () => {
    expect(terminoEhRegraParede(comLimite('nucleo'))).toBe(false);
    expect(terminoOf(comLimite('parede'))).toBe('auto');
  });

  it('comTerminoValido barra o limite inválido ao gravar o tipo', () => {
    const tipo = { layers: [{ ...camada(), limiteExterno: 'x' as never }] };
    expect(() => comTerminoValido(tipo)).toThrow(/Limite no perímetro externo/);
    expect(comTerminoValido({ layers: [comLimite('nucleo')] }).layers).toHaveLength(1);
  });
});
