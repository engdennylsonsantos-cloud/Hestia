import type { Id, Project } from '@hestia/model';
import { executarResolucao } from './executor.ts';
import { colherBuffers, chaveDoPedido, ehCancelamento, type MensagemResolucao, type PedidoResolucao, type RespostaResolucao, type TipoResolucao } from './protocolo.ts';

/** Parte do escopo do worker que o servidor usa (`self` em um Worker dedicado). */
export interface EscopoServidor {
  postMessage(mensagem: unknown, transferencia?: Transferable[]): void;
  onmessage: ((evento: { data: unknown }) => void) | null;
}

/** Função que resolve um pedido; no worker é `executarResolucao`, em testes pode ser outra. */
export type Executor = (tipo: TipoResolucao, projeto: Project, nivel: Id) => unknown;

const executorPadrao: Executor = (tipo, projeto, nivel) => executarResolucao(tipo, projeto, nivel);

/** Mensagem de erro legível para o cliente. */
const textoDoErro = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Instala o servidor do protocolo no escopo do worker. Os pedidos entram numa fila processada um por tarefa do event
 * loop, para que cancelamentos chegados depois possam tirar da fila um pedido que ainda não começou. Ao chegar um pedido,
 * os da mesma chave (tipo + nível) que ainda estão na fila saem: só o mais recente interessa.
 * Devolve a função que desinstala o servidor.
 */
export function instalarServidor(escopo: EscopoServidor, executor: Executor = executorPadrao): () => void {
  const fila: PedidoResolucao[] = [];
  let agendado = false;

  const executar = (pedido: PedidoResolucao): void => {
    const { id } = pedido;
    try {
      const resultado = executor(pedido.tipo, pedido.projeto.estrutura, pedido.nivel);
      const resposta: RespostaResolucao = { id, resultado, erro: null };
      escopo.postMessage(resposta, colherBuffers(resultado));
    } catch (e) {
      const resposta: RespostaResolucao = { id, resultado: null, erro: textoDoErro(e) };
      escopo.postMessage(resposta);
    }
  };

  const processar = (): void => {
    agendado = false;
    const pedido = fila.shift();
    if (pedido) executar(pedido);
    agendar();
  };

  const agendar = (): void => {
    if (agendado || fila.length === 0) return;
    agendado = true;
    setTimeout(processar, 0);
  };

  escopo.onmessage = (evento) => {
    const mensagem = evento.data as MensagemResolucao;
    if (ehCancelamento(mensagem)) {
      const i = fila.findIndex((p) => p.id === mensagem.id);
      if (i >= 0) fila.splice(i, 1);
      return;
    }
    const chave = chaveDoPedido(mensagem.tipo, mensagem.nivel);
    for (let i = fila.length - 1; i >= 0; i--) {
      const antigo = fila[i]!;
      if (chaveDoPedido(antigo.tipo, antigo.nivel) === chave) fila.splice(i, 1);
    }
    fila.push(mensagem);
    agendar();
  };

  return () => {
    escopo.onmessage = null;
    fila.length = 0;
  };
}
