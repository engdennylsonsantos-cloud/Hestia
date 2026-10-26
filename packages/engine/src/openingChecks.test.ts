import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES } from '@hestia/model';
import { openingChecks, openingClearHeight, openingClearWidth, openingVentilationArea, type OpeningCheck } from './openingChecks.ts';

const tipo = (id: string) => DEFAULT_OPENING_TYPES.find((t) => t.id === id)!;
const porTexto = (lista: OpeningCheck[], trecho: string): OpeningCheck | undefined => lista.find((c) => c.text.includes(trecho));

describe('verificações do tipo de abertura', () => {
  it('porta 90: largura livre de 0,80 m ok e altura de batente 2,05 m em aviso', () => {
    const t = tipo('ot_p90');
    expect(openingClearWidth(t)).toBeCloseTo(0.8, 9);
    expect(openingClearHeight(t)).toBeCloseTo(2.05, 9);
    const checks = openingChecks(t, 0.14);
    expect(porTexto(checks, 'Largura livre')?.level).toBe('ok');
    expect(porTexto(checks, 'Altura livre')?.level).toBe('warn');
    expect(porTexto(checks, 'Altura livre')?.text).toContain('2,05');
    expect(porTexto(checks, '2,10')).toBeTruthy();
  });

  it('porta 70: largura livre de 0,60 m em aviso', () => {
    const largura = porTexto(openingChecks(tipo('ot_p70'), 0.14), 'Largura livre');
    expect(largura?.level).toBe('warn');
    expect(largura?.text).toContain('0,60');
  });

  it('janela fixa não conta como ventilação', () => {
    const vent = porTexto(openingChecks(tipo('ot_jfixa60'), 0.14), 'ventilação');
    expect(vent?.level).toBe('warn');
    expect(vent?.text).toContain('não conta como ventilação');
  });

  it('janela de correr 120 × 120 tem 0,72 m² de ventilação útil (50%)', () => {
    const t = tipo('ot_j120');
    expect(openingVentilationArea(t)).toBeCloseTo(0.72, 9);
    const vent = porTexto(openingChecks(t, 0.14), 'ventilação');
    expect(vent?.level).toBe('ok');
    expect(vent?.text).toContain('0,72');
    expect(vent?.text).toContain('50%');
  });

  it('fração de ventilação por família: maxim-ar 100%, basculante 80%', () => {
    const maxim = { ...tipo('ot_j60'), plan: 'casement' as const };
    expect(openingVentilationArea(maxim)).toBeCloseTo(0.36, 9);
    const basculante = { ...tipo('ot_j60'), plan: 'tilt' as const };
    expect(openingVentilationArea(basculante)).toBeCloseTo(0.6 * 0.6 * 0.8, 9);
  });

  it('profundidade do batente contra o núcleo: 0,12 m cabe, 0,20 m avisa', () => {
    const t = tipo('ot_p90');
    expect(porTexto(openingChecks({ ...t, frameDepth: 0.12 }, 0.14), 'Profundidade do batente')?.level).toBe('ok');
    const fundo = porTexto(openingChecks({ ...t, frameDepth: 0.2 }, 0.14), 'Profundidade do batente');
    expect(fundo?.level).toBe('warn');
    expect(fundo?.text).toContain('0,20');
    expect(fundo?.text).toContain('0,14');
  });

  it('verga ausente é aviso; presente fica ok', () => {
    const t = tipo('ot_p90');
    expect(porTexto(openingChecks(t, 0.14), 'Verga')?.level).toBe('warn');
    expect(porTexto(openingChecks({ ...t, lintel: { over: 0.3, height: 0.2 } }, 0.14), 'Verga')?.level).toBe('ok');
  });
});
