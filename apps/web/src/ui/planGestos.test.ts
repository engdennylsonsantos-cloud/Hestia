import { describe, expect, it } from 'vitest';
import { gestosComShift } from './planGestos.ts';

const base = { view: 'plan', botao: 0, shift: true, espaco: false, ferramenta: 'perimeter', selecionandoNoEsboco: false };

describe('gesto com Shift na planta', () => {
  it('no Selecionar do esboço, Shift é da seleção: nem trava o desenho nem arrasta a vista', () => {
    expect(gestosComShift({ ...base, selecionandoNoEsboco: true })).toEqual({ shiftDesenho: false, shiftPan: false });
  });

  it('na ferramenta Selecionar normal, Shift também é da seleção', () => {
    expect(gestosComShift({ ...base, ferramenta: 'select' })).toEqual({ shiftDesenho: false, shiftPan: false });
  });

  it('com ferramenta de desenho no perímetro, Shift trava ortogonal e não vira pan antes de o ponteiro se mover', () => {
    expect(gestosComShift(base)).toEqual({ shiftDesenho: true, shiftPan: false });
  });

  it('no corte, Shift continua arrastando a vista', () => {
    expect(gestosComShift({ ...base, view: 'section' })).toEqual({ shiftDesenho: false, shiftPan: true });
  });

  it('sem Shift, ou com Espaço, não há gesto de seleção nem de desenho', () => {
    expect(gestosComShift({ ...base, shift: false })).toEqual({ shiftDesenho: false, shiftPan: false });
    expect(gestosComShift({ ...base, espaco: true })).toEqual({ shiftDesenho: false, shiftPan: true });
  });
});
