import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERFIL_REVIT, PERFIL_SIMPLES, type ShortcutMap } from '@hestia/tools';
import { CasadorSequencia, TEMPO_SEQUENCIA_MS, conflitoDe, conflitoNoMapa, normalizaSequencia } from './shortcuts.ts';

describe('normalizaSequencia', () => {
  it('põe em maiúsculas e aceita letras e dígitos até 4 caracteres', () => {
    expect(normalizaSequencia('wa')).toBe('WA');
    expect(normalizaSequencia(' a1 ')).toBe('A1');
    expect(normalizaSequencia('ab12')).toBe('AB12');
  });

  it('recusa vazio, espaço no meio, símbolo e mais de 4 caracteres', () => {
    expect(normalizaSequencia('')).toBeNull();
    expect(normalizaSequencia('w a')).toBeNull();
    expect(normalizaSequencia('-')).toBeNull();
    expect(normalizaSequencia('ABCDE')).toBeNull();
  });
});

describe('conflitos', () => {
  const mapa: ShortcutMap = { wall: 'WA', window: 'WN', room: 'RM' };

  it('sequência igual à de outro comando é conflito', () => {
    expect(conflitoDe(mapa, 'room', 'WA')).toEqual({ comando: 'wall', sequencia: 'WA', motivo: 'igual' });
  });

  it('sequência que começa igual a outra (ou é começo dela) é conflito por prefixo', () => {
    expect(conflitoDe(mapa, 'room', 'W')?.motivo).toBe('prefixo');
    expect(conflitoDe({ wall: 'W' }, 'room', 'WA')).toEqual({ comando: 'wall', sequencia: 'W', motivo: 'prefixo' });
  });

  it('o próprio comando não conflita consigo, e sequência livre passa', () => {
    expect(conflitoDe(mapa, 'wall', 'WA')).toBeUndefined();
    expect(conflitoDe(mapa, 'room', 'PA')).toBeUndefined();
  });

  it('os dois perfils padrão são livres de conflito', () => {
    expect(conflitoNoMapa(PERFIL_REVIT)).toBeUndefined();
    expect(conflitoNoMapa(PERFIL_SIMPLES)).toBeUndefined();
  });

  it('conflitoNoMapa acha o par que colide', () => {
    expect(conflitoNoMapa({ wall: 'W', door: 'WA' })).toEqual({ a: 'wall', b: 'door', sequencia: 'W', motivo: 'prefixo' });
    expect(conflitoNoMapa({ wall: 'WA', door: 'WA' })?.motivo).toBe('igual');
  });
});

describe('CasadorSequencia', () => {
  let pendentes: string[];
  let casa: CasadorSequencia;

  beforeEach(() => {
    vi.useFakeTimers();
    pendentes = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const monta = (mapa: ShortcutMap): CasadorSequencia => new CasadorSequencia(() => mapa, (b) => pendentes.push(b));

  it('sequência de uma tecla executa na hora (perfil simples)', () => {
    casa = monta(PERFIL_SIMPLES);
    expect(casa.tecla('w')).toEqual({ comando: 'wall', tratada: true });
    expect(casa.pendente).toBe('');
  });

  it('prefixo espera a próxima tecla e então executa (Revit: W, A = parede)', () => {
    casa = monta(PERFIL_REVIT);
    expect(casa.tecla('W')).toEqual({ tratada: true });
    expect(casa.pendente).toBe('W');
    expect(casa.tecla('a')).toEqual({ comando: 'wall', tratada: true });
    expect(casa.pendente).toBe('');
    expect(pendentes).toEqual(['W', '']);
  });

  it('sem a segunda tecla no tempo limite, zera e não executa nada', () => {
    casa = monta(PERFIL_REVIT);
    casa.tecla('W');
    vi.advanceTimersByTime(TEMPO_SEQUENCIA_MS);
    expect(casa.pendente).toBe('');
    // A tecla seguinte inicia nova sequência: A é prefixo (AR, AL, AT), então espera, e R executa matriz.
    expect(casa.tecla('A')).toEqual({ tratada: true });
    expect(casa.tecla('R')).toEqual({ comando: 'array', tratada: true });
  });

  it('cada tecla reinicia o tempo: o buffer só zera depois de um intervalo sem tecla', () => {
    casa = monta(PERFIL_REVIT);
    casa.tecla('W');
    vi.advanceTimersByTime(1000);
    casa.tecla('W'); // "WW" não existe: a segunda W sozinha inicia nova sequência e o tempo recomeça.
    expect(casa.pendente).toBe('W');
    vi.advanceTimersByTime(1000);
    expect(casa.pendente).toBe('W');
    vi.advanceTimersByTime(300);
    expect(casa.pendente).toBe('');
  });

  it('tecla que não casa com nada zera o buffer e não é tratada', () => {
    casa = monta(PERFIL_REVIT);
    casa.tecla('W');
    expect(casa.tecla('X')).toEqual({ tratada: false }); // WX não existe e X sozinha também não inicia sequência
    expect(casa.pendente).toBe('');
  });

  it('tecla sem casamento e sem buffer não é tratada', () => {
    casa = monta(PERFIL_REVIT);
    expect(casa.tecla('Q')).toEqual({ tratada: false });
    expect(casa.tecla('1')).toEqual({ tratada: false });
  });

  it('teclas de modificador não zeram o buffer; teclas especiais zeram', () => {
    casa = monta(PERFIL_REVIT);
    casa.tecla('W');
    expect(casa.tecla('Shift')).toEqual({ tratada: false });
    expect(casa.pendente).toBe('W');
    expect(casa.tecla('Enter')).toEqual({ tratada: false });
    expect(casa.pendente).toBe('');
  });

  it('KS abre a tela de atalhos no Revit; no simples, a tela é 8', () => {
    casa = monta(PERFIL_REVIT);
    expect(casa.tecla('k')).toEqual({ tratada: true });
    expect(casa.tecla('s')).toEqual({ comando: 'atalhos', tratada: true });
    casa = monta(PERFIL_SIMPLES);
    expect(casa.tecla('8')).toEqual({ comando: 'atalhos', tratada: true });
  });

  it('limpar() zera o buffer e cancela o tempo', () => {
    casa = monta(PERFIL_REVIT);
    casa.tecla('W');
    casa.limpar();
    expect(casa.pendente).toBe('');
    expect(casa.tecla('A')).toEqual({ tratada: true });
    expect(casa.pendente).toBe('A');
  });

  it('o mapa é lido a cada tecla (troca de perfil vale na hora)', () => {
    let mapa: ShortcutMap = PERFIL_REVIT;
    casa = new CasadorSequencia(() => mapa);
    mapa = PERFIL_SIMPLES;
    expect(casa.tecla('w')).toEqual({ comando: 'wall', tratada: true });
  });
});
