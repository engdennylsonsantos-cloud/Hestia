import { describe, expect, it } from 'vitest';
import { I18N } from '../editor/i18n.ts';
import { stairRunFields, stairShapeOptions } from './stairRunFields.ts';

describe('stairShapeOptions', () => {
  it('oferece todas as formas da ferramenta, inclusive a escada livre', () => {
    const values = stairShapeOptions(I18N.pt.stair_shape_free).map((o) => o.value);
    expect(values).toContain('free');
    expect(values).toEqual(['straight', 'lshape', 'ushape', 'winder', 'spiral', 'free']);
  });

  it('rotula a livre com o i18n e as demais com o catálogo', () => {
    const pt = stairShapeOptions(I18N.pt.stair_shape_free);
    const en = stairShapeOptions(I18N.en.stair_shape_free);
    expect(pt.find((o) => o.value === 'free')?.label).toBe('Livre');
    expect(en.find((o) => o.value === 'free')?.label).toBe('Free');
    expect(pt.map((o) => o.label)).toEqual(['Reta', 'Em L', 'Em U', 'Com leque', 'Caracol', 'Livre']);
  });
});

describe('stairRunFields', () => {
  it('a livre mostra largura e patamar, sem giro nem caracol', () => {
    expect(stairRunFields('free')).toEqual({ width: true, landing: true, turn: false, spiral: false });
  });

  it('cada forma mostra só os campos que usa', () => {
    expect(stairRunFields('straight')).toEqual({ width: true, landing: false, turn: false, spiral: false });
    expect(stairRunFields('lshape')).toEqual({ width: true, landing: true, turn: true, spiral: false });
    expect(stairRunFields('ushape')).toEqual({ width: true, landing: true, turn: true, spiral: false });
    expect(stairRunFields('winder')).toEqual({ width: true, landing: false, turn: true, spiral: false });
    expect(stairRunFields('spiral')).toEqual({ width: false, landing: false, turn: false, spiral: true });
  });
});
