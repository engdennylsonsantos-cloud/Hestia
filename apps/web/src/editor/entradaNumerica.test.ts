import { describe, expect, it } from 'vitest';
import { aceitaCaractereNumerico } from './entradaNumerica.ts';

describe('aceitaCaractereNumerico', () => {
  it('aceita dígitos, separadores e operadores ainda com o campo vazio', () => {
    for (const k of ['5', ',', '.', '+', '-', '*', '/', '(', ')']) {
      expect(aceitaCaractereNumerico(k, '')).toBe(true);
    }
  });

  it('não aceita letras com o campo vazio: a primeira letra continua sendo atalho', () => {
    expect(aceitaCaractereNumerico('W', '')).toBe(false);
    expect(aceitaCaractereNumerico('m', '')).toBe(false);
  });

  it('aceita letras e aspas de unidade depois do primeiro caractere', () => {
    expect(aceitaCaractereNumerico('c', '120')).toBe(true);
    expect(aceitaCaractereNumerico("'", '5')).toBe(true);
    expect(aceitaCaractereNumerico('"', "5'6")).toBe(true);
    expect(aceitaCaractereNumerico('°', '45')).toBe(true);
    expect(aceitaCaractereNumerico('%', '5')).toBe(true);
    expect(aceitaCaractereNumerico(' ', "5'")).toBe(true);
  });

  it('recusa teclas de mais de um caractere', () => {
    expect(aceitaCaractereNumerico('Enter', '5')).toBe(false);
  });
});
