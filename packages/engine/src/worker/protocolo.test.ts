import { describe, expect, it } from 'vitest';
import { caminhoNaoSerializavel, chaveDoPedido, colherBuffers, ehCancelamento, ResolucaoCancelada } from './protocolo.ts';
import { projetoComPavimentos } from './fixturePavimentos.ts';

describe('colherBuffers', () => {
  it('acha buffers de Float32Array aninhados e não repete um buffer compartilhado', () => {
    const f = new Float32Array([1, 2, 3]);
    const g = new Float32Array(f.buffer, 4, 2); // mesmo buffer de f
    const solo = new ArrayBuffer(8);
    const valor = { a: { pontos: f }, lista: [g, { raw: solo }], texto: 'x', n: 4 };
    const achados = colherBuffers(valor);
    expect(achados).toHaveLength(2);
    expect(achados).toContain(f.buffer);
    expect(achados).toContain(solo);
  });

  it('devolve lista vazia para dado sem binário', () => {
    expect(colherBuffers({ niveis: [{ id: 'a', pontos: [{ x: 1, y: 2 }] }] })).toEqual([]);
  });

  it('não entra em ciclo', () => {
    const v: { self?: unknown; buf: ArrayBuffer } = { buf: new ArrayBuffer(4) };
    v.self = v;
    expect(colherBuffers(v)).toEqual([v.buf]);
  });
});

describe('caminhoNaoSerializavel', () => {
  it('é null para um projeto de pavimentos inteiro (passa pelo clone)', () => {
    const p = projetoComPavimentos(20);
    expect(caminhoNaoSerializavel(p)).toBeNull();
    expect(structuredClone(p)).toEqual(p);
  });

  it('acha função e instância de classe, com o caminho até o valor', () => {
    expect(caminhoNaoSerializavel({ a: { b: () => 1 } })).toBe('projeto.a.b');
    class Ponto {
      x = 1;
    }
    expect(caminhoNaoSerializavel({ lista: [{ p: new Ponto() }] })).toBe('projeto.lista[0].p');
  });

  it('aceita Map, Set e tipos binários', () => {
    expect(caminhoNaoSerializavel({ m: new Map([[1, 2]]), s: new Set([1]), f: new Float32Array(2) })).toBeNull();
  });
});

describe('chaves e mensagens', () => {
  it('chave do pedido separa tipo e nível', () => {
    expect(chaveDoPedido('nivel', 'lv_1')).not.toBe(chaveDoPedido('pisos', 'lv_1'));
    expect(chaveDoPedido('nivel', 'lv_1')).not.toBe(chaveDoPedido('nivel', 'lv_2'));
  });

  it('reconhece cancelamento e erro tem motivo', () => {
    expect(ehCancelamento({ id: 3, tipo: 'cancelar' })).toBe(true);
    expect(ehCancelamento({ id: 3, tipo: 'nivel', nivel: 'lv_0', projeto: { versao: 1, estrutura: projetoComPavimentos(1) } })).toBe(false);
    expect(new ResolucaoCancelada('substituido').motivo).toBe('substituido');
  });
});
