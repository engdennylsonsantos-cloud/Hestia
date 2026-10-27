import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, type OpeningType } from '@hestia/model';
import { withOpeningField } from './openingTypeFields.ts';

const tipo = (id: string): OpeningType => DEFAULT_OPENING_TYPES.find((t) => t.id === id)!;

describe('campos v2 com padrão por leitura', () => {
  it('grava só quando o valor difere do padrão e volta à leitura quando igual', () => {
    const porta = tipo('ot_p90');
    expect(porta.handle).toBeUndefined();
    expect(withOpeningField(porta, 'handle', 'lever', 'lever').handle).toBeUndefined();
    const knob = withOpeningField(porta, 'handle', 'knob', 'lever');
    expect(knob.handle).toBe('knob');
    expect(withOpeningField(knob, 'handle', 'lever', 'lever').handle).toBeUndefined();
  });

  it('vale para estilo da folha, batente, ângulos, grade e detalhe', () => {
    const porta = tipo('ot_p90');
    expect(withOpeningField(porta, 'leafStyle', 'flush', 'flush').leafStyle).toBeUndefined();
    expect(withOpeningField(porta, 'leafStyle', 'panel', 'flush').leafStyle).toBe('panel');
    expect(withOpeningField(porta, 'frameStyle', 'rebate', 'rebate').frameStyle).toBeUndefined();
    expect(withOpeningField(porta, 'frameStyle', 'simple', 'rebate').frameStyle).toBe('simple');
    expect(withOpeningField(porta, 'angle2d', 90, 90).angle2d).toBeUndefined();
    expect(withOpeningField(porta, 'angle3d', 90, 90).angle3d).toBeUndefined();
    expect(withOpeningField(porta, 'angle3d', 30, 90).angle3d).toBe(30);
    const umPorUm = { cols: 1, rows: 1 };
    expect(withOpeningField(porta, 'grid', umPorUm, umPorUm).grid).toBeUndefined();
    expect(withOpeningField(porta, 'grid', { cols: 2, rows: 1 }, umPorUm).grid).toEqual({ cols: 2, rows: 1 });
    expect(withOpeningField(porta, 'detail2d', 'scale', 'scale').detail2d).toBeUndefined();
    expect(withOpeningField(porta, 'detail2d', 'high', 'scale').detail2d).toBe('high');
    expect(withOpeningField(porta, 'detail3d', 'view', 'view').detail3d).toBeUndefined();
    expect(withOpeningField(porta, 'detail3d', 'full', 'view').detail3d).toBe('full');
  });
});
