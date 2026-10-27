import { describe, expect, it } from 'vitest';
import { PERFIS_ATALHOS } from '@hestia/tools';
import { CasadorAtalhos, TEMPO_SEQUENCIA_MS, conflitoAtalhos, mensagemConflito, normalizarSequencia } from './shortcuts.ts';

const mapa = { wall: 'WA', door: 'DR', window: 'WN', atalhos: 'KS' } as const;

describe('normalizarSequencia', () => {
  it('passa para maiúsculas e tira espaços', () => {
    expect(normalizarSequencia(' wa ')).toBe('WA');
    expect(normalizarSequencia('k s')).toBe('KS');
  });
  it('recusa vazio, símbolos e tamanho acima de 4', () => {
    expect(normalizarSequencia('')).toBeUndefined();
    expect(normalizarSequencia('W-A')).toBeUndefined();
    expect(normalizarSequencia('ABCDE')).toBeUndefined();
  });
});

describe('conflitoAtalhos', () => {
  it('um mapa sem repetição nem prefixo é válido', () => {
    expect(conflitoAtalhos(mapa)).toBeNull();
  });
  it('detecta sequência repetida e diz qual comando já a usa', () => {
    const c = conflitoAtalhos({ wall: 'WA', door: 'WA' });
    expect(c).toMatchObject({ motivo: 'igual', outro: 'wall', comando: 'door' });
    expect(mensagemConflito(c!)).toContain('já é usado por Parede');
  });
  it('detecta sequência que é começo de outra', () => {
    const c = conflitoAtalhos({ section: 'K', atalhos: 'KS' });
    // "K" (Corte) é o começo de "KS": o comando curto é o que conflita, o longo é o outro.
    expect(c).toMatchObject({ motivo: 'prefixo', comando: 'section', outro: 'atalhos' });
    expect(mensagemConflito(c!)).toContain('"K" não pode ser usado');
  });
});

describe('CasadorAtalhos', () => {
  it('executa quando a sequência completa casa (W e A)', () => {
    const c = new CasadorAtalhos(mapa);
    expect(c.tecla('w', 0)).toEqual({ tipo: 'espera', buffer: 'W' });
    expect(c.tecla('A', 10)).toEqual({ tipo: 'executa', comando: 'wall' });
    expect(c.texto).toBe('');
  });

  it('espera quando a tecla é início de algum atalho (buffer aparece)', () => {
    const c = new CasadorAtalhos(mapa);
    expect(c.tecla('k', 0)).toEqual({ tipo: 'espera', buffer: 'K' });
    expect(c.texto).toBe('K');
  });

  it('tecla única que casa executa na hora (perfil simples)', () => {
    const c = new CasadorAtalhos({ wall: 'W' });
    expect(c.tecla('w', 0)).toEqual({ tipo: 'executa', comando: 'wall' });
  });

  it('tempo esgotado descarta a sequência pela metade; a tecla seguinte não completa', () => {
    const c = new CasadorAtalhos(mapa);
    c.tecla('w', 0);
    expect(c.tecla('a', TEMPO_SEQUENCIA_MS + 1)).toEqual({ tipo: 'nada' });
    expect(c.texto).toBe('');
  });

  it('dentro do tempo a segunda tecla completa a sequência', () => {
    const c = new CasadorAtalhos(mapa);
    c.tecla('w', 0);
    expect(c.tecla('a', TEMPO_SEQUENCIA_MS - 1)).toEqual({ tipo: 'executa', comando: 'wall' });
  });

  it('tecla que não casa zera o buffer e pode iniciar nova sequência', () => {
    const c = new CasadorAtalhos(mapa);
    c.tecla('w', 0);
    // W seguido de D não existe; o D recomeça e espera o R de DR.
    expect(c.tecla('d', 5)).toEqual({ tipo: 'espera', buffer: 'D' });
    expect(c.tecla('r', 6)).toEqual({ tipo: 'executa', comando: 'door' });
  });

  it('tecla que não é letra nem dígito zera o buffer', () => {
    const c = new CasadorAtalhos(mapa);
    c.tecla('w', 0);
    expect(c.tecla(' ', 1)).toEqual({ tipo: 'nada' });
    expect(c.texto).toBe('');
  });

  it('tecla sem comando e sem buffer não faz nada', () => {
    const c = new CasadorAtalhos(mapa);
    expect(c.tecla('z', 0)).toEqual({ tipo: 'nada' });
  });

  it('o perfil Revit casa sequências de ponta a ponta', () => {
    const c = new CasadorAtalhos(PERFIS_ATALHOS.revit.atalhos);
    expect(c.tecla('s', 0)).toEqual({ tipo: 'espera', buffer: 'S' });
    expect(c.tecla('b', 1)).toEqual({ tipo: 'executa', comando: 'floor' });
  });
});
