import type { ResolvedLevel } from '@hestia/engine';
import type { Id, Project } from '@hestia/model';
import type { Scene3DOptions } from '@hestia/render';
import { useUi } from '../editor/state.ts';
import { criarFonteNiveisWorker } from './montagem3dNiveis.ts';

/** Lote da primeira fatia: o nível visível e os dois vizinhos mais próximos, na mesma montagem síncrona. */
export const LOTE_INICIAL = 3;
/** Teto do lote: fatias grandes demais voltam a travar a tela mesmo com o orçamento. */
export const LOTE_MAXIMO = 8;
/** Orçamento (ms) de uma fatia quando não se informa outro. */
export const ORCAMENTO_PADRAO_MS = 12;
/** Prazo (ms) de uma resposta do worker antes de calcular o nível na thread da interface (rede de segurança). */
export const PRAZO_WORKER_MS = 8000;
/** Pedidos que podem estar no worker ao mesmo tempo: a resolução de um nível corre enquanto a cena monta o anterior. */
export const PEDIDOS_EM_VOO = 2;

/** Cena que recebe os níveis: o mesmo contrato de `ModelScene.update`. */
export interface CenaMontagem {
  update(p: Project, niveis: ResolvedLevel[], opt: Scene3DOptions): void;
}

/** De onde vem cada nível: o pronto em segundo plano (quando há) ou o cálculo na hora. */
export interface FonteNiveis {
  /** Resolução pronta em segundo plano, sem calcular. `null` se ainda não chegou. Opcional. */
  pronto?(id: Id): ResolvedLevel | null;
  /** Resolve o nível na thread da interface (ou devolve o que o cache já tem). */
  resolver(id: Id): ResolvedLevel;
}

/**
 * Worker da montagem 3D (ver `montagem3dNiveis.ts`): resolve o nível fora da thread da interface, um pedido de cada
 * vez, na ordem em que a montagem pede. `pedir` rejeita quando o pedido é cancelado.
 */
export interface FonteWorker {
  /** Prepara o projeto no worker (a estrutura atravessa uma vez por projeto). */
  iniciar(projeto: Project): void;
  /** Pede a resolução de um nível; o resultado é o mesmo de `resolveLevel` na thread principal. */
  pedir(nivel: Id, projeto: Project): Promise<ResolvedLevel>;
  /** Cancela os pedidos em curso e os que ainda não saíram. */
  cancelar(): void;
  /** Desliga o worker (desmontagem da vista). */
  encerrar(): void;
}

export interface OpcoesMontagem {
  cena: CenaMontagem;
  fonte: FonteNiveis;
  /** Chamado a cada fatia que muda a cena: a interface redesenha. */
  aoAtualizar: () => void;
  /** Chamado quando todos os níveis estão na cena. */
  aoConcluir: () => void;
  /** Agenda a próxima fatia síncrona. Padrão: `requestIdleCallback` quando existe, senão `setTimeout`. */
  agendar?: (tarefa: () => void) => void;
  /** Relógio (ms) para medir a fatia e o prazo do worker. Padrão: `performance.now`. */
  relogio?: () => number;
  /** Orçamento (ms) de uma fatia: o lote cresce ou encolhe para ficar perto dele. */
  orcamentoMs?: number;
  /**
   * Worker que resolve os níveis (ver `FonteWorker`). Presente, a montagem **não calcula** níveis na thread da
   * interface: a primeira fatia traz só o nível visível e cada nível seguinte chega do worker (até `PEDIDOS_EM_VOO`
   * pedidos em voo, na ordem da montagem). Ausente, o comportamento é o de sempre: fatias síncronas com lote adaptativo.
   */
  worker?: FonteWorker | null;
  /** Prazo (ms) de uma resposta do worker antes da rede de segurança (padrão `PRAZO_WORKER_MS`). */
  prazoWorkerMs?: number;
}

/** Níveis na ordem de montagem: o visível primeiro, depois os mais perto dele. Empate: a ordem do projeto. */
export function ordemDeMontagem(ids: readonly Id[], visivel: Id | null): Id[] {
  const origem = Math.max(0, visivel ? ids.indexOf(visivel) : 0);
  return ids
    .map((id, i) => ({ id, i }))
    .sort((a, b) => Math.abs(a.i - origem) - Math.abs(b.i - origem) || a.i - b.i)
    .map((x) => x.id);
}

/** Tamanho do próximo lote: dobra quando a fatia coube com folga, divide quando estourou o orçamento (mínimo 1). */
export function proximoLote(atual: number, duracaoMs: number, orcamentoMs: number): number {
  if (duracaoMs > orcamentoMs) return Math.max(1, Math.floor(atual / 2));
  if (duracaoMs < orcamentoMs / 2) return Math.min(LOTE_MAXIMO, atual * 2);
  return atual;
}

/** Agenda por tempo ocioso quando o navegador tem; senão por macrotarefa (o mesmo efeito de ceder a thread). */
function agendarPadrao(tarefa: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === 'function') ric(tarefa, { timeout: 100 });
  else setTimeout(tarefa, 0);
}

/**
 * Monta a 3D por níveis, em fatias, sem bloquear a tela.
 *
 * Com worker (`worker` em `OpcoesMontagem`), a thread da interface não calcula nenhum nível: a primeira fatia traz só o
 * nível visível (vindo do segundo plano, ou calculado uma vez, para o primeiro quadro ter o que mostrar) e os demais
 * chegam do worker, com até `PEDIDOS_EM_VOO` pedidos em voo, na ordem da montagem. Cada resposta monta um nível na cena
 * e reabastece a fila; o trabalho da thread da interface por nível fica só a montagem da cena. Nível que o segundo
 * plano da planta já entregou é usado direto, sem pedir de novo ao worker.
 *
 * Sem worker (ou se ele falhar duas vezes), a montagem é a de sempre: a primeira fatia (visível e vizinhos) é síncrona
 * e as seguintes entram em lotes cujo tamanho se ajusta ao orçamento de tempo.
 *
 * A cena é sempre atualizada com os níveis já prontos, na ordem do projeto: quando o último chega, a chamada é
 * idêntica à montagem completa (`ModelScene.update` com todos os níveis).
 *
 * Cancelamento: `iniciar` (outro projeto ou outra chave) e `cancelar` invalidam os pedidos e as fatias por geração.
 */
export class Montagem3dProgressiva {
  private geracao = 0;
  private ordemProjeto: Id[] = [];
  private pendentes: Id[] = [];
  private prontos = new Map<Id, ResolvedLevel>();
  private projeto: Project | null = null;
  private opcoes: Scene3DOptions | null = null;
  private lote = LOTE_INICIAL;
  private readonly agendar: (tarefa: () => void) => void;
  private readonly relogio: () => number;
  private readonly orcamentoMs: number;
  private readonly prazoWorkerMs: number;
  /** Worker dos níveis; `null` depois de desistir dele (duas falhas) ou quando não há. */
  private worker: FonteWorker | null;
  /** Níveis pedidos e ainda sem resposta. */
  private emVoo = new Set<Id>();
  /** Níveis que o worker respondeu e ainda não entraram na cena. */
  private recebidos = new Map<Id, ResolvedLevel>();
  /** Prazo da fila do worker (rearmado a cada resposta). */
  private prazo: ReturnType<typeof setTimeout> | null = null;
  /** Quantos níveis o worker falhou seguidos: dois e a montagem volta ao caminho síncrono. */
  private falhas = 0;
  /** Há um passo de montagem agendado (um nível por tarefa). */
  private passoAgendado = false;

  constructor(private readonly op: OpcoesMontagem) {
    this.agendar = op.agendar ?? agendarPadrao;
    this.relogio = op.relogio ?? (() => performance.now());
    this.orcamentoMs = op.orcamentoMs ?? ORCAMENTO_PADRAO_MS;
    this.prazoWorkerMs = op.prazoWorkerMs ?? PRAZO_WORKER_MS;
    this.worker = op.worker ?? null;
  }

  /** Quantos níveis já estão na cena. */
  get montados(): number {
    return this.prontos.size;
  }

  /** A montagem está usando o worker (e não o caminho síncrono). */
  get usandoWorker(): boolean {
    return this.worker !== null && this.pendentes.length > 0;
  }

  /** Começa a montagem de `p`: cancela a anterior, faz a primeira fatia na hora e segue no worker ou em fatias. */
  iniciar(p: Project, opt: Scene3DOptions, visivel: Id | null): void {
    const geracao = ++this.geracao;
    this.worker?.cancelar();
    this.limparPrazo();
    this.projeto = p;
    this.opcoes = opt;
    this.ordemProjeto = p.levels.map((l) => l.id);
    this.pendentes = ordemDeMontagem(this.ordemProjeto, visivel);
    this.prontos = new Map();
    this.emVoo.clear();
    this.recebidos.clear();
    this.passoAgendado = false;
    this.lote = this.worker ? 1 : LOTE_INICIAL;
    this.falhas = 0;
    if (this.worker) this.worker.iniciar(p);
    // Primeira fatia na hora: com worker, só o visível (o primeiro quadro mostra o pavimento ativo).
    this.fatia(geracao);
    if (this.worker && this.pendentes.length > 0) this.bombear(geracao);
  }

  /** Para a montagem em curso: os pedidos e as fatias agendadas não fazem mais nada. */
  cancelar(): void {
    this.geracao++;
    this.worker?.cancelar();
    this.limparPrazo();
    this.emVoo.clear();
    this.recebidos.clear();
    this.passoAgendado = false;
    this.projeto = null;
    this.pendentes = [];
  }

  /** Desliga o worker (desmontagem da vista). Depois disso a montagem ainda funciona em fatias síncronas. */
  encerrar(): void {
    this.cancelar();
    this.worker?.encerrar();
    this.worker = null;
  }

  /** Uma fatia síncrona: resolve o próximo lote, atualiza a cena com o que está pronto e agenda a seguinte. */
  private fatia(geracao: number): void {
    if (geracao !== this.geracao || !this.projeto || !this.opcoes) return;
    const inicio = this.relogio();
    for (const id of this.pendentes.splice(0, this.lote)) this.prontos.set(id, this.nivel(id));
    this.aplicar();
    if (this.pendentes.length === 0) return this.concluir();
    // Com worker, a partir daqui cada nível vem de um pedido (a fatia síncrona é só a primeira e a rede de segurança).
    if (this.worker) return;
    this.lote = proximoLote(this.lote, this.relogio() - inicio, this.orcamentoMs);
    this.agendar(() => this.fatia(geracao));
  }

  /**
   * Mantém a fila do worker cheia (até `PEDIDOS_EM_VOO` pedidos) na ordem da montagem: enquanto a cena monta um nível,
   * o worker já resolve os próximos. Cada resposta entra na cena na ordem do projeto; um passo de cena por resposta
   * mantém a tarefa curta e o `resolveLevel` fora da thread da interface.
   */
  private bombear(geracao: number): void {
    const worker = this.worker;
    const projeto = this.projeto;
    if (!worker || !projeto || geracao !== this.geracao) return;
    if (this.pendentes.length === 0) return;
    // O segundo plano já entregou: monta um por tarefa, sem pedir ao worker (e sem duplicar o trabalho dele).
    const pronto = this.op.fonte.pronto;
    if (pronto) {
      for (const id of this.pendentes) {
        const nivel = pronto.call(this.op.fonte, id);
        if (!nivel || this.recebidos.has(id)) continue;
        this.emVoo.delete(id);
        this.recebidos.set(id, nivel);
        this.pedirPasso(geracao, () => this.montarRecebido(geracao));
        return;
      }
    }
    this.armarPrazo(geracao);
    for (const id of this.pendentes) {
      if (this.emVoo.size >= PEDIDOS_EM_VOO) break;
      if (this.emVoo.has(id) || this.recebidos.has(id)) continue;
      this.emVoo.add(id);
      worker.pedir(id, projeto).then(
        (nivel) => {
          if (geracao !== this.geracao) return;
          this.emVoo.delete(id);
          // Nível que já entrou na cena pela rede de segurança: a resposta atrasada é descartada.
          if (!this.pendentes.includes(id)) return;
          this.recebidos.set(id, nivel);
          this.montarRecebido(geracao);
        },
        () => {
          // Cancelado (outra montagem) ou falhou: só a falha da geração atual vira rede de segurança.
          if (geracao !== this.geracao) return;
          this.emVoo.delete(id);
          this.redeDeSeguranca(geracao);
        },
      );
    }
  }

  /** Agenda um passo da montagem (um nível por tarefa; não empilha passos). */
  private pedirPasso(geracao: number, acao: () => void): void {
    if (this.passoAgendado) return;
    this.passoAgendado = true;
    this.agendar(() => {
      this.passoAgendado = false;
      if (geracao === this.geracao) acao();
    });
  }

  /** Monta o primeiro nível pendente que o worker já entregou (ordem do projeto) e reabastece a fila. */
  private montarRecebido(geracao: number): void {
    if (geracao !== this.geracao || !this.projeto) return;
    this.limparPrazo();
    this.falhas = 0;
    const id = this.pendentes.find((x) => this.recebidos.has(x));
    if (id === undefined) return void this.bombear(geracao);
    const nivel = this.recebidos.get(id)!;
    this.recebidos.delete(id);
    this.pendentes = this.pendentes.filter((x) => x !== id);
    this.prontos.set(id, nivel);
    this.aplicar();
    if (this.pendentes.length === 0) return this.concluir();
    this.bombear(geracao);
  }

  /** O worker não respondeu (ou falhou): calcula um nível na thread da interface e tenta de novo; duas falhas, desiste. */
  private redeDeSeguranca(geracao: number): void {
    if (geracao !== this.geracao || !this.projeto) return;
    this.limparPrazo();
    this.lote = 1;
    if (++this.falhas >= 2) {
      this.worker?.cancelar();
      this.worker = null;
    }
    this.fatia(geracao);
    if (this.worker && this.pendentes.length > 0) this.bombear(geracao);
  }

  /** Prazo da fila do worker: sem resposta nesse tempo, a montagem calcula um nível aqui (rede de segurança). */
  private armarPrazo(geracao: number): void {
    this.limparPrazo();
    this.prazo = setTimeout(() => {
      this.prazo = null;
      if (geracao !== this.geracao || !this.worker) return;
      this.redeDeSeguranca(geracao);
    }, this.prazoWorkerMs);
  }

  private limparPrazo(): void {
    if (this.prazo === null) return;
    clearTimeout(this.prazo);
    this.prazo = null;
  }

  /** Cena com o que já está pronto, na ordem do projeto; avisa a interface. */
  private aplicar(): void {
    if (!this.projeto || !this.opcoes) return;
    const niveis = this.ordemProjeto.flatMap((id) => {
      const nivel = this.prontos.get(id);
      return nivel ? [nivel] : [];
    });
    this.op.cena.update(this.projeto, niveis, this.opcoes);
    this.op.aoAtualizar();
  }

  private concluir(): void {
    this.projeto = null;
    this.limparPrazo();
    this.op.aoConcluir();
  }

  /** O pronto em segundo plano quando há; senão o que o worker acabou de entregar; senão calcula. */
  private nivel(id: Id): ResolvedLevel {
    const recebido = this.recebidos.get(id);
    if (recebido) {
      this.recebidos.delete(id);
      return recebido;
    }
    return this.op.fonte.pronto?.(id) ?? this.op.fonte.resolver(id);
  }
}

/** Cena da vista 3D: o contrato da montagem mais o enquadramento inicial (`ModelScene`). */
export interface CenaVista3d extends CenaMontagem {
  fit(): void;
}

/**
 * Montagem da vista 3D do canvas: a interface redesenha a cada fatia, e a primeira vez que o modelo fica pronto a câmera
 * enquadra tudo (uma vez por sessão, como antes: `seen3d`). O enquadramento espera a última fatia, para não pular enquanto
 * os níveis chegam.
 *
 * Os níveis são resolvidos no worker (ver `montagem3dNiveis.ts`); sem `Worker` (ou se ele falhar), a montagem cai nas
 * fatias síncronas de antes, com o mesmo resultado.
 */
export function criarMontagemVista3d(
  cena: CenaVista3d,
  resolver: (id: Id) => ResolvedLevel,
  pronto?: (id: Id) => ResolvedLevel | null,
): Montagem3dProgressiva {
  return new Montagem3dProgressiva({
    cena,
    fonte: { resolver, pronto },
    aoAtualizar: () => useUi.setState((x) => ({ previewTick: x.previewTick + 1 })),
    aoConcluir: () => {
      if (useUi.getState().seen3d) return;
      cena.fit();
      useUi.setState({ seen3d: true });
    },
    worker: criarFonteNiveisWorker(),
  });
}
