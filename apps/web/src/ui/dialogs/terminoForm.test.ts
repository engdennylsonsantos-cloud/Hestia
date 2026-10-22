import { describe, expect, it } from 'vitest';
import { TERMINO_AJUDA, TERMINO_OPCOES, formDoTermino, terminoDoForm } from './terminoForm.ts';

describe('campo "Término nas paredes" (decisão 0023 §2, P8; decisão 0025)', () => {
  it('oferece as seis opções, nesta ordem, com rótulos de até 22 caracteres', () => {
    expect(TERMINO_OPCOES.map((o) => o.value)).toEqual(['auto', 'face', 'nucleo', 'passa', 'ate', 'cm']);
    for (const o of TERMINO_OPCOES) expect([...o.label].length).toBeLessThanOrEqual(22);
  });

  it('cada opção tem uma dica curta', () => {
    for (const o of TERMINO_OPCOES) expect(TERMINO_AJUDA[o.value].length).toBeGreaterThan(10);
  });

  it('lê o término guardado: nomes não têm texto; deslocamento e prioridade mostram o número', () => {
    expect(formDoTermino('auto')).toEqual({ kind: 'auto', cmText: '0' });
    expect(formDoTermino('face')).toEqual({ kind: 'face', cmText: '0' });
    expect(formDoTermino('passa')).toEqual({ kind: 'passa', cmText: '0' });
    expect(formDoTermino({ cm: -1.5 })).toEqual({ kind: 'cm', cmText: '-1.5' });
    expect(formDoTermino({ ate: { prioridade: 3 } })).toEqual({ kind: 'ate', cmText: '3' });
  });

  it('automático não grava a chave (volta ao padrão); nome grava o valor', () => {
    expect(terminoDoForm('auto', '5')).toEqual({ termino: undefined });
    expect(terminoDoForm('nucleo', '')).toEqual({ termino: 'nucleo' });
    expect(terminoDoForm('passa', '')).toEqual({ termino: 'passa' });
  });

  it('deslocamento aceita vírgula, arredonda a 1 mm e recusa fora de −30 a +30 cm', () => {
    expect(terminoDoForm('cm', '-1,26')).toEqual({ termino: { cm: -1.3 } });
    expect(terminoDoForm('cm', ' 30 ')).toEqual({ termino: { cm: 30 } });
    expect(terminoDoForm('cm', '30,1')).toEqual({ erro: 'Entre −30 e 30 cm' });
    expect(terminoDoForm('cm', '')).toEqual({ erro: 'Entre −30 e 30 cm' });
    expect(terminoDoForm('cm', 'abc')).toEqual({ erro: 'Entre −30 e 30 cm' });
  });

  it('prioridade é inteira de 1 a 9; fora disso, erro sem gravar', () => {
    expect(terminoDoForm('ate', '4')).toEqual({ termino: { ate: { prioridade: 4 } } });
    expect(terminoDoForm('ate', ' 9 ')).toEqual({ termino: { ate: { prioridade: 9 } } });
    expect(terminoDoForm('ate', '0')).toEqual({ erro: 'Informe um número de 1 a 9' });
    expect(terminoDoForm('ate', '10')).toEqual({ erro: 'Informe um número de 1 a 9' });
    expect(terminoDoForm('ate', '2,5')).toEqual({ erro: 'Informe um número de 1 a 9' });
    expect(terminoDoForm('ate', '')).toEqual({ erro: 'Informe um número de 1 a 9' });
  });
});
