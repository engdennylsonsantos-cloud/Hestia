import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, openingTypeIssue, openingTypeWarning, type OpeningType } from './index.ts';
import { openingOptionSupport } from './openingSupport.ts';
import {
  HARDWARE_DEFAULTS,
  hingeHeights,
  openingHandleHeight,
  openingHandleInset,
  openingHardwareIssue,
  openingHardwareWarning,
  openingHinges,
  openingLeafBottom,
  openingLeafUndercut,
  openingThreshold,
} from './openingHardware.ts';

const tipo = (id: string): OpeningType => {
  const t = DEFAULT_OPENING_TYPES.find((x) => x.id === id);
  if (!t) throw new Error(`tipo padrão ausente: ${id}`);
  return t;
};

describe('leitura das ferragens com padrão por campo ausente', () => {
  it('sem os campos novos: folga 7 mm, maçaneta a 1,00 m com recuo de 6 cm, 3 dobradiças, sem soleira', () => {
    const t = tipo('ot_p90');
    expect(openingLeafUndercut(t)).toBe(0.007);
    expect(openingHandleHeight(t)).toBe(1);
    expect(openingHandleInset(t)).toBe(0.06);
    expect(openingHinges(t)).toBe(3);
    expect(openingThreshold(t)).toBeNull();
    expect(openingLeafBottom(t)).toBeCloseTo(0.007, 9);
    expect(HARDWARE_DEFAULTS.hinges).toBe(3);
  });

  it('valores válidos são lidos; a soleira soma à folga na face inferior da folha', () => {
    const t = { ...tipo('ot_p90'), leafUndercut: 0.017, threshold: { thickness: 0.02 } };
    expect(openingLeafUndercut(t)).toBe(0.017);
    expect(openingLeafBottom(t)).toBeCloseTo(0.037, 9);
    expect(openingThreshold(t)).toEqual({ thickness: 0.02 });
  });

  it('valor inválido ou fora da faixa de erro cai no padrão; janela devolve 0, sem soleira nem dobradiça', () => {
    expect(openingLeafUndercut({ kind: 'door', leafUndercut: 0.2 })).toBe(0.007);
    expect(openingHandleHeight({ handleHeight: 2 })).toBe(1);
    expect(openingHinges({ kind: 'door', hinges: 2.5 })).toBe(3);
    expect(openingLeafUndercut({ kind: 'window', leafUndercut: 0.017 })).toBe(0);
    expect(openingHinges({ kind: 'window', hinges: 3 })).toBe(0);
    expect(openingThreshold({ kind: 'window', threshold: { thickness: 0.02 } })).toBeNull();
  });

  it('soleira zerada ou acima de 15 cm não existe', () => {
    expect(openingThreshold({ kind: 'door', threshold: { thickness: 0 } })).toBeNull();
    expect(openingThreshold({ kind: 'door', threshold: { thickness: 0.2 } })).toBeNull();
  });

  it('o material da soleira é opcional e segue junto quando informado', () => {
    expect(openingThreshold({ kind: 'door', threshold: { thickness: 0.015, materialId: 'mat_pedra' } })).toEqual({ thickness: 0.015, materialId: 'mat_pedra' });
  });
});

describe('alturas das dobradiças', () => {
  it('3 dobradiças: 0,25 m de cada borda e uma no meio', () => {
    expect(hingeHeights(3, 0, 2)).toEqual([0.25, 1, 1.75]);
  });

  it('2 nas bordas; 1 no meio; 0 nenhuma; 4 distribuídas entre as bordas', () => {
    expect(hingeHeights(2, 0, 2)).toEqual([0.25, 1.75]);
    expect(hingeHeights(1, 0, 2)).toEqual([1]);
    expect(hingeHeights(0, 0, 2)).toEqual([]);
    const quatro = hingeHeights(4, 0, 2);
    expect(quatro[0]).toBeCloseTo(0.25, 9);
    expect(quatro[3]).toBeCloseTo(1.75, 9);
    expect(quatro[1]! - quatro[0]!).toBeCloseTo(quatro[2]! - quatro[1]!, 9);
  });
});

describe('validação das ferragens (openingHardwareIssue)', () => {
  const porta = openingOptionSupport('door_swing');
  const correr = openingOptionSupport('door_sliding');

  it('recusa maçaneta fora de 0,50 a 1,50 m, folga acima de 5 cm, dobradiças fora de 0 a 6 e soleira acima de 15 cm', () => {
    expect(openingHardwareIssue({ handleHeight: 0.3 }, porta)).toMatch(/Altura da maçaneta/);
    expect(openingHardwareIssue({ handleHeight: 1.7 }, porta)).toMatch(/Altura da maçaneta/);
    expect(openingHardwareIssue({ leafUndercut: 0.1 }, porta)).toMatch(/Folga inferior/);
    expect(openingHardwareIssue({ hinges: 7 }, porta)).toMatch(/Dobradiças/);
    expect(openingHardwareIssue({ hinges: 2.5 }, porta)).toMatch(/Dobradiças/);
    expect(openingHardwareIssue({ threshold: { thickness: 0.2 } }, porta)).toMatch(/Soleira/);
  });

  it('aceita os valores de dentro das faixas e o tipo sem campos novos', () => {
    expect(openingHardwareIssue({ handleHeight: 0.7, leafUndercut: 0.027, hinges: 6, threshold: { thickness: 0.15 } }, porta)).toBeNull();
    expect(openingHardwareIssue({}, porta)).toBeNull();
  });

  it('campo que a família não usa é ignorado (sem erro): correr não tem dobradiça nem maçaneta', () => {
    expect(openingHardwareIssue({ hinges: 9 }, correr)).toBeNull();
    expect(openingHardwareIssue({ handleHeight: 9 }, correr)).toBeNull();
    expect(openingHardwareIssue({ leafUndercut: 0.1 }, correr)).toMatch(/Folga/);
    expect(openingHardwareIssue({ threshold: { thickness: 0.2 } }, openingOptionSupport('door_garage'))).toBeNull();
  });
});

describe('aviso da NBR 9050 para a maçaneta (openingHardwareWarning)', () => {
  const porta = openingOptionSupport('door_swing');

  it('avisa fora de 0,80 a 1,10 m, mas não erra: a faixa de erro já é erro', () => {
    expect(openingHardwareWarning({ handleHeight: 0.7 }, porta)).toMatch(/NBR 9050/);
    expect(openingHardwareWarning({ handleHeight: 1.2 }, porta)).toMatch(/NBR 9050/);
    expect(openingHardwareWarning({ handleHeight: 0.9 }, porta)).toBeNull();
    expect(openingHardwareWarning({ handleHeight: 0.3 }, porta)).toBeNull();
    expect(openingHardwareWarning({ handleHeight: 0.7 }, openingOptionSupport('door_garage'))).toBeNull();
  });
});

describe('regra do tipo com as ferragens (openingTypeIssue e openingTypeWarning)', () => {
  it('porta de giro com maçaneta de 0,30 m é recusada; com 0,70 m é aceita e avisa a NBR 9050', () => {
    expect(openingTypeIssue({ ...tipo('ot_p90'), handleHeight: 0.3 })).toMatch(/Altura da maçaneta/);
    expect(openingTypeIssue({ ...tipo('ot_p90'), handleHeight: 0.7 })).toBeNull();
    expect(openingTypeWarning({ ...tipo('ot_p90'), handleHeight: 0.7 })).toMatch(/NBR 9050/);
  });

  it('janela e correr ignoram a maçaneta fora da faixa (o motor não a usa)', () => {
    expect(openingTypeIssue({ ...tipo('ot_j120'), handleHeight: 0.3 })).toBeNull();
    expect(openingTypeIssue({ ...tipo('ot_pc160'), handleHeight: 0.3 })).toBeNull();
  });

  it('dobradiças fora da faixa e soleira acima de 15 cm são recusadas na porta de giro', () => {
    expect(openingTypeIssue({ ...tipo('ot_p90'), hinges: 9 })).toMatch(/Dobradiças/);
    expect(openingTypeIssue({ ...tipo('ot_p90'), threshold: { thickness: 0.2 } })).toMatch(/Soleira/);
  });

  it('o aviso com tipo parcial (sem família) não quebra e não avisa', () => {
    expect(openingTypeWarning({ closure: 'inherit' })).toBeNull();
  });
});
