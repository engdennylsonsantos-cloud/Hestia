import { describe, expect, it } from 'vitest';
import { safeFilename } from './savePdf.ts';

describe('nome do arquivo PDF', () => {
  it('tira acentos e mantém o nome legível', () => {
    expect(safeFilename('Casa térrea, 2 quartos-pranchas.pdf')).toBe('Casa terrea, 2 quartos-pranchas.pdf');
    expect(safeFilename('Ação São João-pranchas.pdf')).toBe('Acao Sao Joao-pranchas.pdf');
  });

  it('troca barras e outros caracteres reservados por hífen', () => {
    expect(safeFilename('a/b:c*d-pranchas.pdf')).toBe('a-b-c-d-pranchas.pdf');
  });

  it('nome vazio ou só de símbolos cai no padrão', () => {
    expect(safeFilename('   ')).toBe('projeto.pdf');
    expect(safeFilename('///')).toBe('projeto.pdf');
  });
});
