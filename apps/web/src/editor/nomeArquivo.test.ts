import { describe, expect, it } from 'vitest';
import { safeFilename } from './nomeArquivo.ts';

describe('nome de arquivo seguro para download', () => {
  it('tira acentos e troca espaço por hífen', () => {
    expect(safeFilename('Casa térrea.dxf')).toBe('Casa-terrea.dxf');
    expect(safeFilename('Ação São João.ifc')).toBe('Acao-Sao-Joao.ifc');
    expect(safeFilename('Casa térrea')).toBe('Casa-terrea');
  });

  it('preserva a extensão do arquivo', () => {
    expect(safeFilename('Casa térrea-pranchas.pdf')).toBe('Casa-terrea-pranchas.pdf');
    expect(safeFilename('Casa térrea.hestia.json')).toBe('Casa-terrea.hestia.json');
    expect(safeFilename('Casa térrea-Nível 1.dxf')).toBe('Casa-terrea-Nivel-1.dxf');
  });

  it('troca caracteres inválidos e reservados por hífen sem repeti-lo', () => {
    expect(safeFilename('a/b:c*d-pranchas.pdf')).toBe('a-b-c-d-pranchas.pdf');
    expect(safeFilename('Casa, 2 quartos (v2).ifc')).toBe('Casa-2-quartos-v2.ifc');
    expect(safeFilename('x???y.dxf')).toBe('x-y.dxf');
  });

  it('nome vazio ou só de símbolos cai em "projeto", com a extensão', () => {
    expect(safeFilename('   ')).toBe('projeto');
    expect(safeFilename('///')).toBe('projeto');
    expect(safeFilename('///.dxf')).toBe('projeto.dxf');
    expect(safeFilename('.ifc')).toBe('projeto.ifc');
  });
});
