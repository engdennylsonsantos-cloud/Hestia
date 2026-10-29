import { describe, expect, it } from 'vitest';
import { rotuloInclinacao, textoFaltaDesnivel, textoPassouDesnivel, textoResultaInclinacao } from './rampLiveMessages.ts';

describe('mensagens da rampa ao vivo', () => {
  it('falta de desnível usa vírgula e ≈ com o comprimento equivalente (exemplo A)', () => {
    expect(textoFaltaDesnivel(0.6, 1 / 12)).toBe('faltam 0,60 m de desnível (≈ 7,2 m de rampa)');
    expect(textoFaltaDesnivel(0.35, 1 / 12)).toBe('faltam 0,35 m de desnível (≈ 4,2 m de rampa)');
  });

  it('sobra de desnível diz que a rampa termina antes do cursor (exemplo B)', () => {
    expect(textoPassouDesnivel(0.12, 1 / 12)).toBe('passou 0,12 m (≈ 1,4 m): termina antes do cursor');
    expect(textoPassouDesnivel(0.1, 1 / 12)).toBe('passou 0,10 m (≈ 1,2 m): termina antes do cursor');
  });

  it('rótulo do modo inclinação: falta, alcançado e passou', () => {
    expect(rotuloInclinacao(1 / 12, 0.35)).toBe('8,33 % (1:12) · faltam 0,35 m de desnível (≈ 4,2 m de rampa)');
    expect(rotuloInclinacao(1 / 12, -0.1)).toBe('8,33 % (1:12) · passou 0,10 m (≈ 1,2 m): termina antes do cursor');
  });

  it('dentro da tolerância de 0,005 m o nível está alcançado, nos dois sentidos', () => {
    expect(rotuloInclinacao(1 / 12, 0)).toBe('8,33 % (1:12) · nível de topo alcançado');
    expect(rotuloInclinacao(1 / 12, 0.005)).toBe('8,33 % (1:12) · nível de topo alcançado');
    expect(rotuloInclinacao(1 / 12, -0.005)).toBe('8,33 % (1:12) · nível de topo alcançado');
    expect(rotuloInclinacao(1 / 12, 0.0051)).toBe('8,33 % (1:12) · faltam 0,01 m de desnível (≈ 0,1 m de rampa)');
  });

  it('resulta no modo comprimento: acima do máximo, com o que falta de rampa', () => {
    expect(textoResultaInclinacao(0.094, 1 / 12, 1.3)).toBe('Resulta 9,40 % (1:10,6) · acima do máximo 8,33 % · faltam ≈ 1,3 m');
  });

  it('resulta no modo comprimento: dentro da norma e sem tabela', () => {
    expect(textoResultaInclinacao(0.069, 1 / 12, 0)).toBe('Resulta 6,90 % (1:14,5) · dentro da norma');
    expect(textoResultaInclinacao(1 / 12, 1 / 12, 0)).toBe('Resulta 8,33 % (1:12) · dentro da norma');
    expect(textoResultaInclinacao(0.069, null, 0)).toBe('Resulta 6,90 % (1:14,5)');
  });
});
