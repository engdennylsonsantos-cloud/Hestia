import { describe, expect, it } from 'vitest';
import { instalarServidor, type EscopoServidor } from './servidor.ts';
import { colherBuffers, type PedidoResolucao, type RespostaResolucao } from './protocolo.ts';

/** Espera o servidor drenar a fila (cada tarefa é um `setTimeout` de 0; no Windows a resolução do timer é grosseira). */
const esperar = (ms = 60) => new Promise((r) => setTimeout(r, ms));

function escopoFalso(): EscopoServidor & { respostas: RespostaResolucao[] } {
  const respostas: RespostaResolucao[] = [];
  return {
    respostas,
    onmessage: null,
    postMessage(m: unknown) {
      respostas.push(m as RespostaResolucao);
    },
  };
}

const pedido = (id: number, tipo: PedidoResolucao['tipo'], nivel: string): PedidoResolucao => ({
  id,
  tipo,
  nivel,
  projeto: { versao: 1, estrutura: {} as PedidoResolucao['projeto']['estrutura'] },
});

describe('instalarServidor', () => {
  it('responde com o resultado do executor e transfere os buffers do resultado', async () => {
    const escopo = escopoFalso();
    const buffer = new Float32Array([1, 2, 3]);
    instalarServidor(escopo, () => ({ pontos: buffer }));
    escopo.onmessage?.({ data: pedido(7, 'lajes', 'lv_0') });
    await esperar();
    expect(escopo.respostas).toEqual([{ id: 7, resultado: { pontos: buffer }, erro: null }]);
    expect(colherBuffers({ pontos: buffer })).toHaveLength(1);
  });

  it('erro do executor vira resposta com erro, sem derrubar o servidor', async () => {
    const escopo = escopoFalso();
    instalarServidor(escopo, (tipo) => {
      if (tipo === 'pisos') throw new Error('falha de teste');
      return 'ok';
    });
    escopo.onmessage?.({ data: pedido(1, 'pisos', 'lv_0') });
    escopo.onmessage?.({ data: pedido(2, 'nivel', 'lv_0') });
    await esperar();
    expect(escopo.respostas).toEqual([
      { id: 1, resultado: null, erro: 'falha de teste' },
      { id: 2, resultado: 'ok', erro: null },
    ]);
  });

  it('só processa o pedido mais recente de cada tipo+nível (os da fila com a mesma chave saem)', async () => {
    const escopo = escopoFalso();
    instalarServidor(escopo, (_t, _p, nivel) => nivel);
    escopo.onmessage?.({ data: pedido(1, 'nivel', 'lv_0') });
    escopo.onmessage?.({ data: pedido(2, 'nivel', 'lv_0') });
    escopo.onmessage?.({ data: pedido(3, 'nivel', 'lv_0') });
    await esperar();
    expect(escopo.respostas.map((r) => r.id)).toEqual([3]);
  });

  it('cancelamento tira da fila um pedido que ainda não começou', async () => {
    const escopo = escopoFalso();
    instalarServidor(escopo, (_t, _p, nivel) => nivel);
    escopo.onmessage?.({ data: pedido(1, 'nivel', 'lv_0') });
    escopo.onmessage?.({ data: pedido(2, 'nivel', 'lv_1') });
    escopo.onmessage?.({ data: { id: 2, tipo: 'cancelar' } });
    await esperar();
    expect(escopo.respostas.map((r) => r.id)).toEqual([1]);
  });

  it('desinstalar limpa a fila e para de ouvir mensagens', async () => {
    const escopo = escopoFalso();
    const desinstalar = instalarServidor(escopo, (_t, _p, nivel) => nivel);
    escopo.onmessage?.({ data: pedido(1, 'nivel', 'lv_0') });
    desinstalar();
    await esperar();
    expect(escopo.respostas).toEqual([]);
    expect(escopo.onmessage).toBeNull();
  });
});
