import { describe, expect, it } from 'vitest';
import { defaultUnits, resolveUnits } from '@hestia/model';
import {
  applyDraft,
  draftFrom,
  draftSettings,
  exampleLines,
  validateDraft,
} from './unitsDialogModel.ts';

describe('draftFrom e applyDraft', () => {
  it('padrão → undefined', () => {
    expect(applyDraft(draftFrom(defaultUnits()))).toBeUndefined();
  });

  it('ida e volta preserva as unidades', () => {
    const original = resolveUnits({
      length: { unit: 'cm', decimals: 1 },
      smallLength: { unit: 'mm', decimals: 2 },
      area: { unit: 'ft2', decimals: 2 },
      volume: { unit: 'l', decimals: 1 },
      angle: { unit: 'rad', decimals: 3 },
      slope: { unit: 'deg', decimals: 1 },
      decimalSymbol: '.',
      currency: 'USD',
    });
    const patch = applyDraft(draftFrom(original));
    expect(resolveUnits(patch)).toEqual(original);
  });

  it('grava só o que difere do padrão', () => {
    const d = draftFrom(defaultUnits());
    d.length.unit = 'cm';
    d.length.decimals = 1;
    const patch = applyDraft(d);
    expect(patch).toBeDefined();
    expect(Object.keys(patch!)).toEqual(['length']);
    expect(patch!.length?.unit).toBe('cm');
    expect(patch!.smallLength).toBeUndefined();
  });

  it('preserva fração de polegada e suprimir zeros', () => {
    const d = draftFrom(defaultUnits());
    d.length.unit = 'ft-in';
    d.length.denominator = 8;
    d.length.suppressZeros = true;
    const u = resolveUnits(draftSettings(d));
    expect(u.length).toEqual({ unit: 'ft-in', decimals: 2, suppressZeros: true, denominator: 8 });
  });

  it('voltar para metros zera a fração herdada', () => {
    const d = draftFrom(resolveUnits({ length: { unit: 'ft-in', decimals: 2, denominator: 8 } }));
    d.length.unit = 'm';
    expect(applyDraft(d)).toBeUndefined();
  });
});

describe('validateDraft', () => {
  it('aceita o padrão', () => {
    expect(validateDraft(draftFrom(defaultUnits()))).toBeNull();
  });

  it('recusa casas decimais fora de 0..5 e não inteiras', () => {
    const d = draftFrom(defaultUnits());
    d.length.decimals = 6;
    expect(validateDraft(d)).toContain('0 a 5');
    d.length.decimals = 1.5;
    expect(validateDraft(d)).toContain('inteiro');
    d.length.decimals = -1;
    expect(validateDraft(d)).toContain('0 a 5');
  });

  it('recusa símbolo de moeda vazio ou com mais de 4 caracteres', () => {
    const d = draftFrom(defaultUnits());
    d.currency = '   ';
    expect(validateDraft(d)).toContain('moeda');
    d.currency = 'ABCDE';
    expect(validateDraft(d)).toContain('moeda');
    d.currency = 'USD';
    expect(validateDraft(d)).toBeNull();
  });
});

describe('exampleLines', () => {
  it('mostra uma linha por grandeza, com o valor de referência e o formatado', () => {
    const linhas = exampleLines(draftFrom(defaultUnits()));
    expect(linhas).toHaveLength(7);
    expect(linhas[0]?.label).toBe('Comprimento');
    expect(linhas[0]?.text).toContain('→');
    expect(linhas[0]?.text).toContain('1234,57 m');
  });

  it('acompanha as escolhas do rascunho', () => {
    const d = draftFrom(defaultUnits());
    d.length.unit = 'cm';
    d.length.decimals = 1;
    const texto = exampleLines(d)[0]?.text ?? '';
    expect(texto).toContain('cm');
    expect(texto).toContain('123456,8 cm');
  });
});
