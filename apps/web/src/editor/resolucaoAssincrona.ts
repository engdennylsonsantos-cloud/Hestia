import { niveisAfetados, type JunctionLevel, type ResolvedLevel } from '@hestia/engine';
import type { ClienteResolucao } from '@hestia/engine/src/worker/cliente.ts';
import type { TipoResolucao } from '@hestia/engine/src/worker/protocolo.ts';
import type { Id, Project } from '@hestia/model';
import { criarClienteResolucao } from './resolveWorker.ts';

/** Atraso (ms) do aviso à interface: resoluções que chegam juntas geram um único redesenho. */
const ATRASO_AVISO_MS = 16;

/** O que já está pronto para um nível: a resolução de nível e as junções (só o que foi pedido). */
interface Pronto {
  nivel?: ResolvedLevel;
  juncoes?: JunctionLevel;
}

/** Pedido em curso: um por vez, para que a prioridade (nível visível) valha a cada passo. */
interface Voo {
  nivel: Id;
  tipo: TipoResolucao;
  token: number;
}

export interface OpcoesResolucaoProgressiva {
  /** Cliente do protocolo. Padrão: Worker quando o navegador tem, senão thread principal em fatias. */
  cliente?: ClienteResolucao;
  /** Chamado (com agrupamento) quando um nível fica pronto ou se invalida: a interface redesenha. */
  aoMudar?: () => void;
}

/** Ordem dos níveis em relação ao visível: o mais perto primeiro, desempate pelo índice. */
const distanciaAoVisivel = (ids: Id[], visivel: Id | null, i: number): number => Math.abs(i - Math.max(0, visivel ? ids.indexOf(visivel) : 0));

/**
 * Resolução progressiva dos níveis do projeto. O nível visível e o seu vizinho imediato são resolvidos na hora (ver
 * `abrir`, que devolve esses ids e o controller resolve de forma síncrona). Os demais níveis, e as junções de todos,
 * são pedidos ao cliente de resolução em segundo plano, um por vez, com prioridade para o mais perto do visível.
 *
 * Invalidação: `atualizar(p)` roda a cada mudança do projeto e usa `niveisAfetados`, a mesma regra do cache síncrono. Só
 * o que a edição alcança sai dos prontos e tem pedido cancelado; o resto segue válido. `liberar(id)` cancela e tira
 * um nível da fila até ele voltar a ser o visível. `versao` cresce a cada nível pronto ou invalidado.
 *
 * Igualdade: o resultado é o mesmo de `executarResolucao` (ver testes). Nada aqui muda a geometria.
 */
export class ResolucaoProgressiva {
  private readonly cliente: ClienteResolucao;
  private readonly aoMudar: () => void;
  private projeto: Project | null = null;
  private versaoProjeto = 0;
  private visivel: Id | null = null;
  private readonly prontos = new Map<Id, Pronto>();
  /** Níveis já resolvidos na thread da interface: o segundo plano não os refaz. */
  private readonly sincronos = new Set<Id>();
  /** Níveis liberados da planta: saem da fila até voltarem a ser o visível. */
  private readonly liberados = new Set<Id>();
  private voo: Voo | null = null;
  /** Verdadeiro depois de `cancelar()`: a fila não dispara mais pedidos até um `abrir`. */
  private parado = false;
  private tokens = 0;
  private avisoAgendado = false;
  private versaoResolucao = 0;

  constructor(opcoes: OpcoesResolucaoProgressiva = {}) {
    this.cliente = opcoes.cliente ?? criarClienteResolucao({ usarWorker: true });
    this.aoMudar = opcoes.aoMudar ?? (() => undefined);
  }

  /** Contador de versão da resolução: a planta observa para saber que algo ficou pronto ou mudou. */
  get versao(): number {
    return this.versaoResolucao;
  }

  /**
   * Abre um projeto: cancela o que restava do anterior e agenda o segundo plano. Devolve os níveis que devem ser
   * resolvidos já (o visível e o vizinho imediato), para o controller chamar `resolvido` neles.
   */
  abrir(p: Project): Id[] {
    this.parado = false;
    this.cliente.cancelarTodos();
    this.voo = null;
    this.prontos.clear();
    this.sincronos.clear();
    this.liberados.clear();
    this.projeto = p;
    this.versaoProjeto++;
    this.visivel = p.levels[0]?.id ?? null;
    this.versaoResolucao++;
    setTimeout(() => this.avancar(), 0);
    return p.levels.slice(0, 2).map((l) => l.id);
  }

  /** Chamado a cada mudança do projeto: invalida só o que a edição alcança e reinicia a fila dos afetados. */
  atualizar(p: Project): void {
    const antes = this.projeto;
    if (!antes) {
      this.projeto = p;
      return;
    }
    if (p === antes) return;
    const afetados = niveisAfetados(antes, p);
    this.projeto = p;
    this.versaoProjeto++;
    if (afetados === 'todos') {
      this.cliente.cancelarTodos();
      this.voo = null;
      this.prontos.clear();
      this.sincronos.clear();
    } else {
      for (const id of afetados) this.invalidar(id);
    }
    this.versaoResolucao++;
    this.avisar();
    this.avancar();
  }

  /**
   * Resolve um nível para a planta: devolve o valor pronto em segundo plano, ou calcula na hora com `sincrono`.
   * Quando calcula, marca o nível como síncrono e cancela um pedido em curso dele. `prioritario` põe o nível
   * como visível para a fila (o nível que a planta mostra).
   */
  resolvido(id: Id, sincrono: () => ResolvedLevel, prioritario = false): ResolvedLevel {
    if (prioritario) this.priorizar(id);
    const pronto = this.nivelPronto(id);
    if (pronto) return pronto;
    this.sincronos.add(id);
    if (this.voo?.nivel === id) this.cancelarVoo();
    return sincrono();
  }

  /** Resolução de nível já pronta em segundo plano (senão `null`). Não calcula nada. */
  nivelPronto(id: Id): ResolvedLevel | null {
    return this.prontos.get(id)?.nivel ?? null;
  }

  /** Junções de um nível, se já estiverem prontas em segundo plano (senão `null`). */
  juncoes(id: Id): JunctionLevel | null {
    return this.prontos.get(id)?.juncoes ?? null;
  }

  /** Libera um nível (aba de planta fechada): cancela o pedido dele e tira-o da fila até voltar a ser o visível. */
  liberar(id: Id): void {
    this.prontos.delete(id);
    this.sincronos.delete(id);
    this.liberados.add(id);
    if (this.voo?.nivel === id) this.cancelarVoo();
  }

  /** Desliga o segundo plano (desmontagem). Os pedidos pendentes são cancelados. */
  cancelar(): void {
    this.parado = true;
    this.cliente.cancelarTodos();
    this.voo = null;
  }

  /** Torna `id` o nível visível para a fila, sem cancelar o pedido em curso (ele termina e o próximo já é o visível). */
  private priorizar(id: Id): void {
    this.liberados.delete(id);
    if (this.visivel === id) return;
    this.visivel = id;
  }

  /** Tira um nível da resolução em segundo plano: pronto, síncrono ou em curso, ele vira pendente de novo. */
  private invalidar(id: Id): void {
    this.prontos.delete(id);
    this.sincronos.delete(id);
    this.cliente.cancelarNivel(id);
    if (this.voo?.nivel === id) this.voo = null;
  }

  /** Cancela o pedido em curso e segue a fila (o cancelamento chega como rejeição, tratada em `avancar`). */
  private cancelarVoo(): void {
    if (!this.voo) return;
    this.cliente.cancelarNivel(this.voo.nivel);
    this.voo = null;
    this.avancar();
  }

  /** Próximo pedido: o nível mais perto do visível que ainda falta, primeiro `nivel` e depois `juncoes`. */
  private proximo(): { nivel: Id; tipo: TipoResolucao } | null {
    const p = this.projeto;
    if (!p) return null;
    const ids = p.levels.map((l) => l.id);
    let melhor: { nivel: Id; tipo: TipoResolucao; distancia: number } | null = null;
    ids.forEach((id, i) => {
      const tipo = this.tipoPendente(id);
      if (!tipo) return;
      const distancia = distanciaAoVisivel(ids, this.visivel, i);
      if (!melhor || distancia < melhor.distancia) melhor = { nivel: id, tipo, distancia };
    });
    return melhor;
  }

  private tipoPendente(id: Id): TipoResolucao | null {
    if (this.liberados.has(id)) return null;
    const e = this.prontos.get(id);
    if (!e?.nivel && !this.sincronos.has(id)) return 'nivel';
    if (!e?.juncoes) return 'juncoes';
    return null;
  }

  /** Dispara o próximo pedido se nenhum está em curso. Um pedido por vez. */
  private avancar(): void {
    if (this.parado || this.voo || !this.projeto) return;
    const alvo = this.proximo();
    if (!alvo) return;
    const token = ++this.tokens;
    this.voo = { nivel: alvo.nivel, tipo: alvo.tipo, token };
    this.cliente
      .resolver(alvo.tipo, alvo.nivel, this.projeto, this.versaoProjeto)
      .then((valor) => this.receber(token, alvo.tipo, alvo.nivel, valor))
      .catch(() => undefined) // cancelado (ResolucaoCancelada) ou falha: a fila segue
      .finally(() => {
        if (this.voo?.token === token) {
          this.voo = null;
          this.avancar();
        }
      });
  }

  private receber(token: number, tipo: TipoResolucao, nivel: Id, valor: unknown): void {
    if (this.voo?.token !== token) return;
    const e: Pronto = this.prontos.get(nivel) ?? {};
    if (tipo === 'nivel') e.nivel = valor as ResolvedLevel;
    else e.juncoes = valor as JunctionLevel;
    this.prontos.set(nivel, e);
    this.versaoResolucao++;
    this.avisar();
  }

  /** Avisa a interface, agrupando respostas que chegam perto uma da outra. */
  private avisar(): void {
    if (this.avisoAgendado) return;
    this.avisoAgendado = true;
    setTimeout(() => {
      this.avisoAgendado = false;
      this.aoMudar();
    }, ATRASO_AVISO_MS);
  }
}
