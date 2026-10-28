import { describe, expect, it } from 'vitest';
import { OPENING_FAMILIES } from './opening.ts';
import { openingOptionSupport } from './openingSupport.ts';

describe('opções por família', () => {
  it('toda família registrada tem linha na tabela', () => {
    for (const f of OPENING_FAMILIES) expect(openingOptionSupport(f.id), f.id).toBeDefined();
  });
  it('bandeira: portas de giro e janelas com folha; nunca guilhotina, veneziana nem vãos', () => {
    expect(openingOptionSupport('door_swing').transom).toBe(true);
    expect(openingOptionSupport('window_casement').transom).toBe(true);
    for (const id of ['window_hung', 'window_louver', 'window_void', 'door_void', 'door_garage'] as const) expect(openingOptionSupport(id).transom, id).toBe(false);
  });
  it('só a basculante tem eixo; a referência nominal da folha ainda não é oferecida (fica fora do diálogo)', () => {
    expect(OPENING_FAMILIES.filter((f) => openingOptionSupport(f.id).tiltAxis).map((f) => f.id)).toEqual(['window_tilt']);
    expect(OPENING_FAMILIES.some((f) => openingOptionSupport(f.id).nominalRef)).toBe(false);
  });
  it('maçaneta só em porta de giro e dupla; grade só em janela; espessura da folha só onde há folha', () => {
    expect(OPENING_FAMILIES.filter((f) => openingOptionSupport(f.id).handle).map((f) => f.id)).toEqual(['door_swing', 'door_double']);
    expect(OPENING_FAMILIES.filter((f) => openingOptionSupport(f.id).grid).every((f) => f.kind === 'window')).toBe(true);
    for (const id of ['door_void', 'window_void', 'window_fixed'] as const) expect(openingOptionSupport(id).leafThickness, id).toBe(false);
    expect(openingOptionSupport('door_swing').leafThickness).toBe(true);
  });

  it('família nula ou desconhecida: nada se aplica', () => {
    expect(Object.values(openingOptionSupport(null)).every((v) => v === false)).toBe(true);
  });
});
