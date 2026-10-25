import type { Id, Project } from '@hestia/model';
import type { ResolveCache } from '../resolve.ts';
import { executarResolucao } from './executor.ts';
import {
  chaveDoPedido,
  ResolucaoCancelada,
  TIPOS_RESOLUCAO,
  type MensagemResolucao,
  type MotivoCancelamento,
  type PedidoResolucao,
  type RespostaResolucao,
  type TipoResolucao,
} from './protocolo.ts';

/** Forma mínima de um `Worker` do navegador (ou de um substituto nos testes). */
export interface WorkerLike {
  postMessage(mensagem: unknown, transferencia?: Transferable[]): void;
  terminate(): void;
  onmessage: ((evento: { data: unknown }) => void) | null;
  onerror: ((evento: unknown) => void) | null;
}

export interface OpcoesClienteResolucao {
  /** Cria o worker (no app: `new Worker(...)`). Se faltar, ou lançar, o cliente roda na thread principal. */
  criarWorker?: () => WorkerLike;
  /** Padrão desligado: o worker só entra quando a medição mostrar ganho (ver relatório do protocolo). */
  usarWorker?: boolean;
  /** Cache de resolução usado na thread principal (fallback). */
  cache?: ResolveCache;
}

/** Pedido ainda sem resposta: guarda o que é preciso para refazê-lo na thread principal se o worker falhar. */
interface Pendente {
  id: number;
  chave: string;
  tipo: TipoResolucao;
  nivel: Id;
  projeto: Project;
  versao: number;
  resolver: (valor: unknown) => void;
  rejeitar: (erro: unknown) => void;
}

/**
 * Cliente da resolução de níveis. `resolver` devolve uma promessa do resultado; a resolução roda no worker quando ele
 * está ligado e existe, e na thread principal caso contrário (ou quando o worker falha, ou o projeto não é clonável).
 *
 * Regras de descarte: só vale o pedido mais recente de cada tipo+nível. Um pedido mais antigo da mesma chave é encerrado
 * com `ResolucaoCancelada('substituido')`, e a resposta dele, se chegar depois, é ignorada. `cancelar(id)` faz o mesmo
 * com `'cancelado'`.
 */
export class ClienteResolucao {
  private proximoId = 1;
  private worker: WorkerLike | null = null;
  private readonly pendentes = new Map<number, Pendente>();
  /** Id do pedido mais recente de cada chave (tipo + nível). */
  private readonly atuais = new Map<string, number>();

  constructor(private readonly opcoes: OpcoesClienteResolucao = {}) {
    if (opcoes.usarWorker && opcoes.criarWorker) this.worker = this.tentarCriar(opcoes.criarWorker);
  }

  /** `'worker'` quando as resoluções vão para o worker; `'principal'` quando rodam na thread principal. */
  get modo(): 'worker' | 'principal' {
    return this.worker ? 'worker' : 'principal';
  }

  /** Quantos pedidos estão sem resposta (medição e testes). */
  get pendentesAbertos(): number {
    return this.pendentes.size;
  }

  /** Pede a resolução de um tipo de um nível. `versao` é o contador de edição do projeto (ver `ProjetoEnviado`). */
  resolver(tipo: TipoResolucao, nivel: Id, projeto: Project, versao: number): Promise<unknown> {
    const chave = chaveDoPedido(tipo, nivel);
    const anterior = this.atuais.get(chave);
    if (anterior !== undefined) this.encerrarPedido(anterior, 'substituido');
    const id = this.proximoId++;
    return new Promise((resolver, rejeitar) => {
      const pendente: Pendente = { id, chave, tipo, nivel, projeto, versao, resolver, rejeitar };
      this.pendentes.set(id, pendente);
      this.atuais.set(chave, id);
      this.enviar(pendente);
    });
  }

  /** Cancela um pedido pelo id: a promessa dele é rejeitada com `ResolucaoCancelada('cancelado')`. */
  cancelar(id: number): void {
    this.encerrarPedido(id, 'cancelado');
  }

  /** Cancela os pedidos pendentes de um nível (todos os tipos). Ex.: nível liberado da planta, ou editado. */
  cancelarNivel(nivel: Id): void {
    for (const tipo of TIPOS_RESOLUCAO) {
      const id = this.atuais.get(chaveDoPedido(tipo, nivel));
      if (id !== undefined) this.encerrarPedido(id, 'cancelado');
    }
  }

  /** Cancela todos os pedidos pendentes, sem desligar o worker. */
  cancelarTodos(): void {
    for (const pid of [...this.pendentes.keys()]) this.encerrarPedido(pid, 'cancelado');
  }

  /** Cancela todos os pedidos e desliga o worker. Depois disso, `resolver` ainda funciona, na thread principal. */
  encerrar(): void {
    this.cancelarTodos();
    const w = this.worker;
    this.worker = null;
    try {
      w?.terminate();
    } catch {
      // Worker já encerrado: nada a fazer.
    }
  }

  private encerrarPedido(id: number, motivo: MotivoCancelamento): void {
    const p = this.pendentes.get(id);
    if (!p) return;
    this.pendentes.delete(id);
    if (this.atuais.get(p.chave) === id) this.atuais.delete(p.chave);
    this.mandarCancelamento(id);
    p.rejeitar(new ResolucaoCancelada(motivo));
  }

  private tentarCriar(criar: () => WorkerLike): WorkerLike | null {
    try {
      const w = criar();
      w.onmessage = (evento) => this.receber(evento.data as RespostaResolucao);
      w.onerror = () => this.falhaDoWorker();
      return w;
    } catch {
      return null;
    }
  }

  private enviar(p: Pendente): void {
    if (this.worker) {
      const mensagem: PedidoResolucao = { id: p.id, tipo: p.tipo, nivel: p.nivel, projeto: { versao: p.versao, estrutura: p.projeto } };
      try {
        this.worker.postMessage(mensagem);
        return;
      } catch (e) {
        // Projeto que não atravessa o clone: só esta vez, na thread principal. Outras falhas derrubam o worker.
        if (!(e instanceof DOMException && e.name === 'DataCloneError')) {
          this.falhaDoWorker();
          return;
        }
      }
    }
    this.executarLocal(p);
  }

  /** Roda o pedido na thread principal, num turno próprio do event loop (um cancelamento antes dele vale). */
  private executarLocal(p: Pendente): void {
    setTimeout(() => {
      if (this.pendentes.get(p.id) !== p) return;
      this.pendentes.delete(p.id);
      if (this.atuais.get(p.chave) === p.id) this.atuais.delete(p.chave);
      try {
        p.resolver(executarResolucao(p.tipo, p.projeto, p.nivel, this.opcoes.cache));
      } catch (e) {
        p.rejeitar(e);
      }
    }, 0);
  }

  private receber(resposta: RespostaResolucao): void {
    const p = this.pendentes.get(resposta.id);
    if (!p) return; // cancelada, substituída ou já respondida: descarta
    this.pendentes.delete(p.id);
    if (this.atuais.get(p.chave) === p.id) this.atuais.delete(p.chave);
    if (resposta.erro !== null) p.rejeitar(new Error(resposta.erro));
    else p.resolver(resposta.resultado);
  }

  /** O worker quebrou: desliga e refaz na thread principal tudo o que estava sem resposta. */
  private falhaDoWorker(): void {
    const w = this.worker;
    this.worker = null;
    try {
      w?.terminate();
    } catch {
      // Já encerrado.
    }
    for (const p of [...this.pendentes.values()]) this.executarLocal(p);
  }

  private mandarCancelamento(id: number): void {
    if (!this.worker) return;
    const mensagem: MensagemResolucao = { id, tipo: 'cancelar' };
    try {
      this.worker.postMessage(mensagem);
    } catch {
      // Cancelamento não chegou: o worker responde e a resposta é descartada aqui.
    }
  }
}
