import { describe, expect, it } from 'vitest';
import { lerOpcoesPerf } from './opcoes.ts';

const ler = (query: string) => lerOpcoesPerf(new URLSearchParams(query));

describe('opções do ?perf', () => {
  it('sem o parâmetro, tudo desligado', () => {
    expect(ler('debug=1')).toEqual({ ativo: false, overlay: false });
  });

  it('perf=1 liga medição e overlay', () => {
    expect(ler('debug=1&perf=1')).toEqual({ ativo: true, overlay: true });
  });

  it('perf sem valor liga (atalho)', () => {
    expect(ler('perf')).toEqual({ ativo: true, overlay: true });
  });

  it('perf=0 desliga', () => {
    expect(ler('perf=0')).toEqual({ ativo: false, overlay: false });
    expect(ler('perf=false')).toEqual({ ativo: false, overlay: false });
  });

  it('overlay=0 mede sem desenhar o overlay', () => {
    expect(ler('perf=1&overlay=0')).toEqual({ ativo: true, overlay: false });
  });
});
