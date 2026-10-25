import type { ResolvedLevel } from '@hestia/engine';
import type { Id, Project } from '@hestia/model';
import type { Scene3DOptions } from '@hestia/render';
import { useUi } from '../editor/state.ts';

/** Lote da primeira fatia: o nível visível e os dois vizinhos mais próximos, na mesma montagem síncrona. */
export const LOTE_INICIAL = 3;
/** Teto do lote: fatias grandes demais voltam a travar a tela mesmo com o orçamento. */
export const LOTE_MAXIMO = 8;
/** Orçamento (ms) de uma fatia quando não se informa outro. */
export const ORCAMENTO_PADRAO_MS = 12;

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

export interface OpcoesMontagem {
  cena: CenaMontagem;
  fonte: FonteNiveis;
  /** Chamado a cada fatia que muda a cena: a interface redesenha. */
  aoAtualizar: () => void;
  /** Chamado quando todos os níveis estão na cena. */
  aoConcluir: () => void;
  /** Agenda a próxima fatia. Padrão: `requestIdleCallback` quando existe, senão `setTimeout`. */
  agendar?: (tarefa: () => void) => void;
  /** Relógio (ms) para medir a fatia. Padrão: `performance.now`. */
  relogio?: () => number;
  /** Orçamento (ms) de uma fatia: o lote cresce ou encolhe para ficar perto dele. */
  orcamentoMs?: number;
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
 * Monta a 3D por níveis, em fatias, sem bloquear a tela. A primeira fatia (visível e vizinhos) é síncrona, então o
 * primeiro quadro já tem a parte principal do modelo. As seguintes entram com `setTimeout`/`requestIdleCallback`, em
 * lotes cujo tamanho se ajusta ao orçamento de tempo. A cena é sempre atualizada com os níveis já prontos, na ordem do
 * projeto: quando o último chega, a chamada é idêntica à montagem completa (`ModelScene.update` com todos os níveis).
 *
 * Cancelamento: `iniciar` (outro projeto ou outra chave) e `cancelar` invalidam as fatias agendadas por geração.
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

  constructor(private readonly op: OpcoesMontagem) {
    this.agendar = op.agendar ?? agendarPadrao;
    this.relogio = op.relogio ?? (() => performance.now());
    this.orcamentoMs = op.orcamentoMs ?? ORCAMENTO_PADRAO_MS;
  }

  /** Quantos níveis já estão na cena. */
  get montados(): number {
    return this.prontos.size;
  }

  /** Começa a montagem de `p`: cancela a anterior, faz a primeira fatia na hora e agenda as demais. */
  iniciar(p: Project, opt: Scene3DOptions, visivel: Id | null): void {
    const geracao = ++this.geracao;
    this.projeto = p;
    this.opcoes = opt;
    this.ordemProjeto = p.levels.map((l) => l.id);
    this.pendentes = ordemDeMontagem(this.ordemProjeto, visivel);
    this.prontos = new Map();
    this.lote = LOTE_INICIAL;
    this.fatia(geracao);
  }

  /** Para a montagem em curso: as fatias agendadas não fazem mais nada. */
  cancelar(): void {
    this.geracao++;
    this.projeto = null;
    this.pendentes = [];
  }

  /** Uma fatia: resolve o próximo lote, atualiza a cena com o que está pronto e agenda a seguinte. */
  private fatia(geracao: number): void {
    if (geracao !== this.geracao || !this.projeto || !this.opcoes) return;
    const inicio = this.relogio();
    for (const id of this.pendentes.splice(0, this.lote)) this.prontos.set(id, this.nivel(id));
    const niveis = this.ordemProjeto.flatMap((id) => {
      const nivel = this.prontos.get(id);
      return nivel ? [nivel] : [];
    });
    this.op.cena.update(this.projeto, niveis, this.opcoes);
    this.op.aoAtualizar();
    if (this.pendentes.length === 0) {
      this.projeto = null;
      this.op.aoConcluir();
      return;
    }
    this.lote = proximoLote(this.lote, this.relogio() - inicio, this.orcamentoMs);
    this.agendar(() => this.fatia(geracao));
  }

  /** O pronto em segundo plano quando há; senão calcula (a fatia é o limite de quanto se bloqueia de cada vez). */
  private nivel(id: Id): ResolvedLevel {
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
  });
}
