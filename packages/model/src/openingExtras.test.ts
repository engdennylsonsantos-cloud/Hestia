import { describe, expect, it } from 'vitest';
import { ACABAMENTO_LIMITES, acabamentoIssue } from './openingExtras.ts';

describe('acabamentoIssue (faixa das medidas do acabamento)', () => {
  it('aceita campos ausentes, zero e os limites exatos', () => {
    expect(acabamentoIssue({})).toBeNull();
    expect(acabamentoIssue({ casing: { width: 0, thickness: 0 } })).toBeNull();
    expect(acabamentoIssue({ roughOversize: { w: ACABAMENTO_LIMITES.folga, h: 0 } })).toBeNull();
    expect(acabamentoIssue({ lintel: { over: ACABAMENTO_LIMITES.transpasse, height: ACABAMENTO_LIMITES.alturaVerga } })).toBeNull();
  });

  it('recusa valor negativo, não finito ou acima do limite, com a mensagem do campo em cm', () => {
    expect(acabamentoIssue({ roughOversize: { w: -0.01, h: 0 } })).toBe('Folga do vão, largura: use um valor de 0 a 20 cm.');
    expect(acabamentoIssue({ roughOversize: { w: 0, h: 0.21 } })).toBe('Folga do vão, altura: use um valor de 0 a 20 cm.');
    expect(acabamentoIssue({ casing: { width: 0.31, thickness: 0.01 } })).toBe('Alizar, largura: use um valor de 0 a 30 cm.');
    expect(acabamentoIssue({ casing: { width: 0.05, thickness: Number.NaN } })).toBe('Alizar, espessura: use um valor de 0 a 5 cm.');
    expect(acabamentoIssue({ sillBoard: { projection: 0.11, thickness: 0.02 } })).toBe('Soleira, projeção: use um valor de 0 a 10 cm.');
    expect(acabamentoIssue({ sillBeam: { over: 1.01 } })).toBe('Contraverga, transpasse: use um valor de 0 a 100 cm.');
    expect(acabamentoIssue({ lintel: { height: 0.7 } })).toBe('Verga, altura: use um valor de 0 a 60 cm.');
  });

  it('devolve a 1ª medida fora da faixa na ordem dos campos', () => {
    expect(acabamentoIssue({ casing: { width: 9, thickness: 9 }, lintel: { over: 9 } })).toBe('Alizar, largura: use um valor de 0 a 30 cm.');
  });
});
