import type { WorkerLike } from './cliente.ts';
import { instalarServidor, type Executor } from './servidor.ts';

export interface OpcoesWorkerSimulado {
  /** Atraso de cada mensagem nos dois sentidos (ms), para simular resposta lenta. */
  latenciaMs?: number;
  executor?: Executor;
}

/** Worker de mentira para testes no Node: cada mensagem dá a volta por `structuredClone` (como no navegador). */
export interface WorkerSimuladoTeste extends WorkerLike {
  /** Quantas mensagens o cliente mandou para o worker (inclui cancelamentos). */
  enviadas: number;
  /** Simula a queda do worker: dispara `onerror` no cliente. */
  quebrar(): void;
}

/**
 * Cria um worker simulado com o servidor do protocolo instalado. Mensagens que não são clonáveis disparam `DataCloneError`
 * de forma síncrona, como `postMessage` faz no navegador.
 */
export function criarWorkerSimulado(opcoes: OpcoesWorkerSimulado = {}): WorkerSimuladoTeste {
  const latencia = opcoes.latenciaMs ?? 0;
  const escopo: { onmessage: ((evento: { data: unknown }) => void) | null; postMessage: (m: unknown) => void } = {
    onmessage: null,
    postMessage: (m: unknown) => {
      const copia = structuredClone(m);
      setTimeout(() => cliente.onmessage?.({ data: copia }), latencia);
    },
  };
  instalarServidor(escopo, opcoes.executor);
  const cliente: WorkerSimuladoTeste = {
    enviadas: 0,
    onmessage: null,
    onerror: null,
    postMessage(m: unknown): void {
      const copia = structuredClone(m);
      cliente.enviadas++;
      setTimeout(() => escopo.onmessage?.({ data: copia }), latencia);
    },
    terminate(): void {
      escopo.onmessage = null;
    },
    quebrar(): void {
      cliente.onerror?.({ message: 'worker simulado caiu' });
    },
  };
  return cliente;
}
