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

  it('ventilação das famílias novas: abrir 100%, guilhotina 50%, pivotante 90% e veneziana 70%', () => {
    const casos = [
      { id: 'ot_ja120', fracao: 1, area: 1.2 * 1.2 },
      { id: 'ot_jg90', fracao: 0.5, area: 0.9 * 1.5 * 0.5 },
      { id: 'ot_jp80', fracao: 0.9, area: 0.8 * 1.2 * 0.9 },
      { id: 'ot_jv80', fracao: 0.7, area: 0.8 * 0.6 * 0.7 },
    ] as const;
    for (const c of casos) {
      const t = tipo(c.id);
      expect(openingVentilationArea(t), c.id).toBeCloseTo(c.area, 9);
      const vent = porTexto(openingChecks(t, 0.14), 'ventilação');
      expect(vent?.level, c.id).toBe('ok');
      expect(vent?.text, c.id).toContain(`${Math.round(c.fracao * 100)}%`);
    }
  });

  it('porta não tem ventilação útil', () => {
    for (const id of ['ot_p90', 'ot_pvv90', 'ot_pe80', 'ot_pg300']) {
      expect(openingVentilationArea(tipo(id)), id).toBe(0);
      expect(openingChecks(tipo(id), 0.14).some((c) => c.text.includes('ventilação')), id).toBe(false);
    }
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
