import { describe, expect, it } from 'vitest';
import { formDoTermino, terminoDoForm, TERMINO_OPCOES } from './terminoForm.ts';

describe('campo "Término na junção" (decisão 0023 §2, P8)', () => {
  it('oferece as quatro opções da decisão, nesta ordem', () => {
    expect(TERMINO_OPCOES.map((o) => o.value)).toEqual(['auto', 'nucleo', 'face', 'cm']);
  });

  it('lê o término guardado: automático e valores de nome não têm texto; o deslocamento mostra o número', () => {
    expect(formDoTermino('auto')).toEqual({ kind: 'auto', cmText: '0' });
    expect(formDoTermino('face')).toEqual({ kind: 'face', cmText: '0' });
    expect(formDoTermino({ cm: -1.5 })).toEqual({ kind: 'cm', cmText: '-1.5' });
  });

  it('automático não grava a chave (volta ao padrão); nome grava o valor', () => {
    expect(terminoDoForm('auto', '5')).toEqual({ termino: undefined });
    expect(terminoDoForm('nucleo', '')).toEqual({ termino: 'nucleo' });
  });

  it('deslocamento aceita vírgula, arredonda a 1 mm e recusa fora de −30 a +30 cm', () => {
    expect(terminoDoForm('cm', '-1,26')).toEqual({ termino: { cm: -1.3 } });
    expect(terminoDoForm('cm', ' 30 ')).toEqual({ termino: { cm: 30 } });
    expect(terminoDoForm('cm', '30,1')).toEqual({ erro: 'Entre −30 e 30 cm' });
    expect(terminoDoForm('cm', '')).toEqual({ erro: 'Entre −30 e 30 cm' });
    expect(terminoDoForm('cm', 'abc')).toEqual({ erro: 'Entre −30 e 30 cm' });
  });
});
