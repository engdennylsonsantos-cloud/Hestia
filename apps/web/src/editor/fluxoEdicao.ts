import type { JunctionLevel, ResolvedLevel } from '@hestia/engine';
import { calcularAlteracao, type AlteracaoProjeto, type ElementoGeometrico, type PatchNivel, type PatchProvisorio } from '@hestia/engine/src/fluxoPatch.ts';
import { patchesProvisorios } from '@hestia/engine/src/fluxoProvisorio.ts';
import type { ClienteResolucao } from '@hestia/engine/src/worker/cliente.ts';
import type { Id, Project } from '@hestia/model';
import { ResolucaoProgressiva } from './resolucaoAssincrona.ts';

/**
 * Fluxo incremental de edição, do comando até a tela. Contrato (tipos em `packages/engine/src/fluxoPatch.ts`):
 *
 *  1. O projeto muda (`atualizar`): o fluxo calcula a `AlteracaoProjeto` (elementos alterados e níveis afetados).
 *  2. Resposta imediata, no mesmo turno: evento `provisorio` com um `PatchProvisorio` por nível (geometria barata do que
 *     foi editado, sem junção). Meta: a interface mostra isso em até 50 ms. Só é calculado se há quem escute.
 *  3. O recálculo exato dos níveis afetados corre em segundo plano (Worker; sem Worker, em fatias da thread principal,
 *     um nível por turno do event loop), com prioridade para o nível visível.
 *  4. Ao chegar, evento `exato` com um `PatchNivel` por nível (só as paredes e agrupamentos que mudaram). Esse patch
 *     substitui o provisório do nível (ver `ProvisoriosAtivos`). `juncoes` avisa que as junções do nível ficaram prontas
 *     (leia com `juncoes(nivel)`); `concluido` diz que não resta nada pendente.
 *  5. Descarte: resultado de versão anterior à última edição que alcançou o nível é ignorado e vira `descartado`.
 *
 * Mudança grande (carga de projeto, colar, desfazer de lote, tipos e configurações) não gera provisório: o evento é
 * `recarga` e a interface refaz o que mostra daqueles níveis a partir do resultado exato.
 *
 * Duas formas de ler o nível, e as duas podem coexistir:
 *  - por eventos (acima): a interface mantém o estado visual com os patches;
 *  - por consulta (`resolvido`): com `exatoAssincrono` desligado (padrão), devolve sempre o resultado exato da versão
 *    atual, calculando na hora se preciso (como antes do fluxo); ligado, devolve o último exato disponível, possivelmente
 *    de uma versão anterior enquanto o recálculo corre (`pendente(nivel)` diz isso). Quem precisa do exato de verdade
 *    (quantitativos, exportação) passa `exigirExato`.
 */

/** Mudança com mais elementos do que isto vira `recarga` em vez de provisório (colar, carga, desfazer de lote). */
export const LIMITE_PROVISORIO = 64;

/** Por que um resultado foi ignorado. */
export type MotivoDescarte = 'versao-antiga';

/** Eventos do fluxo. `versao` é sempre a do projeto (`store.version`) de que o evento saiu. */
export type EventoFluxo =
  | { tipo: 'provisorio'; versao: number; alteracao: AlteracaoProjeto; patches: PatchProvisorio[] }
  | { tipo: 'exato'; versao: number; patch: PatchNivel }
  | { tipo: 'juncoes'; versao: number; nivel: Id }
  | { tipo: 'descartado'; versao: number; nivel: Id; motivo: MotivoDescarte }
  | { tipo: 'recarga'; versao: number; niveis: ReadonlySet<Id> | 'todos' }
  | { tipo: 'concluido'; versao: number };

export type OuvinteFluxo = (evento: EventoFluxo) => void;

export interface OpcoesFluxoEdicao {
  /** Cliente do protocolo de resolução. Padrão: Worker quando o navegador tem, senão thread principal em fatias. */
  cliente?: ClienteResolucao;
  /** Chamado (com agrupamento) quando um nível fica pronto ou se invalida: a interface redesenha. */
  aoMudar?: () => void;
}

/** Orquestra os passos acima sobre a resolução progressiva por nível. */
export class FluxoEdicao {
  readonly resolucao: ResolucaoProgressiva;
  private readonly ouvintes = new Set<OuvinteFluxo>();
  private ativos: ProvisoriosAtivos | null = null;
  private readonly aoMudar: (() => void) | undefined;
  private projeto: Project | null = null;
  private versaoAtual = 0;

  constructor(opcoes: OpcoesFluxoEdicao = {}) {
    this.aoMudar = opcoes.aoMudar;
    this.resolucao = new ResolucaoProgressiva({ cliente: opcoes.cliente, aoMudar: opcoes.aoMudar, aoEvento: (e) => this.emitir(e) });
  }

  /** Escuta os eventos; devolve a função que para de escutar. */
  assinar(ouvinte: OuvinteFluxo): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  /**
   * Provisórios em vigor, para quem desenha ler (`doNivel`, `removidosDoNivel`). Criado na primeira leitura: o fluxo só
   * calcula a geometria provisória de uma edição se há quem escute, então sem leitor não custa nada.
   */
  get provisorios(): ProvisoriosAtivos {
    if (!this.ativos) {
      const ativos = new ProvisoriosAtivos();
      this.ativos = ativos;
      this.assinar((e) => {
        if (ativos.aplicar(e)) this.aoMudar?.(); // o que há para desenhar mudou: a interface redesenha
      });
    }
    return this.ativos;
  }

  /** Versão do projeto que o fluxo viu por último. */
  get versao(): number {
    return this.versaoAtual;
  }

  /** Ligado: `resolvido` não calcula na hora quando há um exato anterior (ver o cabeçalho). Padrão: desligado. */
  get exatoAssincrono(): boolean {
    return this.resolucao.exatoAssincrono;
  }
  set exatoAssincrono(ligado: boolean) {
    this.resolucao.exatoAssincrono = ligado;
  }

  /** Abre um projeto (novo ou carregado): descarta o estado anterior. Devolve os níveis a resolver já (ver `ResolucaoProgressiva.abrir`). */
  abrir(p: Project, versao: number): Id[] {
    this.projeto = p;
    this.versaoAtual = versao;
    const ids = this.resolucao.abrir(p, versao);
    this.emitir({ tipo: 'recarga', versao, niveis: 'todos' });
    return ids;
  }

  /** Chamado a cada mudança do projeto. Responde com o provisório antes de iniciar o recálculo exato. */
  atualizar(p: Project, versao: number): void {
    const antes = this.projeto;
    this.projeto = p;
    const anterior = this.versaoAtual;
    this.versaoAtual = versao;
    if (!antes || antes === p) {
      this.resolucao.atualizar(p, versao);
      return;
    }
    const alteracao = calcularAlteracao(antes, p, versao, anterior);
    this.responderNaHora(antes, p, alteracao);
    this.resolucao.atualizar(p, versao, alteracao.niveis);
  }

  /** Passo 2: provisório para quem escuta, ou `recarga` quando a mudança é global ou grande demais. */
  private responderNaHora(antes: Project, depois: Project, alteracao: AlteracaoProjeto): void {
    if (this.ouvintes.size === 0) return;
    const quantos = alteracao.adicionados.length + alteracao.alterados.length + alteracao.removidos.length;
    if (alteracao.niveis === 'todos' || quantos > LIMITE_PROVISORIO) {
      this.emitir({ tipo: 'recarga', versao: alteracao.versao, niveis: alteracao.niveis });
      return;
    }
    const patches = patchesProvisorios(antes, depois, alteracao);
    if (patches.length > 0) this.emitir({ tipo: 'provisorio', versao: alteracao.versao, alteracao, patches });
  }

  /** Resolução de um nível para a planta e a 3D (ver o cabeçalho sobre `exatoAssincrono`). */
  resolvido(id: Id, sincrono: () => ResolvedLevel, prioritario = false, exigirExato = false): ResolvedLevel {
    return this.resolucao.resolvido(id, sincrono, prioritario, exigirExato);
  }

  /** Há recálculo exato a caminho para o nível (o que `resolvido` devolve pode ser de uma versão anterior). */
  pendente(id: Id): boolean {
    return this.resolucao.pendente(id);
  }

  /** Junções do nível, se já estiverem prontas em segundo plano (senão `null`). */
  juncoes(id: Id): JunctionLevel | null {
    return this.resolucao.juncoes(id);
  }

  /** Resolução de nível já pronta em segundo plano (senão `null`). Não calcula nada. */
  nivelPronto(id: Id): ResolvedLevel | null {
    return this.resolucao.nivelPronto(id);
  }

  /** Contador que cresce a cada nível pronto ou invalidado: a planta e a 3D observam para saber que algo mudou. */
  get versaoResolucao(): number {
    return this.resolucao.versao;
  }

  /** Libera um nível (aba de planta fechada). */
  liberar(id: Id): void {
    this.resolucao.liberar(id);
  }

  /** Desliga o segundo plano (desmontagem). */
  cancelar(): void {
    this.resolucao.cancelar();
  }

  private emitir(evento: EventoFluxo): void {
    for (const o of [...this.ouvintes]) o(evento);
  }
}

/**
 * Estado visual provisório de quem desenha: guarda os elementos provisórios de cada nível e os tira quando chega o
 * resultado exato do nível (versão igual ou maior), uma recarga ou o fim de tudo (`concluido`). Alimentado pelos eventos do fluxo (`aplicar`); a planta
 * e a 3D leem `doNivel` e `removidosDoNivel` para sobrepor o provisório ao último resultado exato.
 */
export class ProvisoriosAtivos {
  private readonly porNivel = new Map<Id, PatchProvisorio[]>();

  /** Atualiza o estado com um evento do fluxo. Devolve `true` se o que há para desenhar mudou. */
  aplicar(e: EventoFluxo): boolean {
    switch (e.tipo) {
      case 'provisorio':
        for (const p of e.patches) this.porNivel.set(p.nivel, [...(this.porNivel.get(p.nivel) ?? []), p]);
        return true;
      case 'exato': {
        const restantes = (this.porNivel.get(e.patch.nivel) ?? []).filter((p) => p.versao > e.patch.versao);
        const mudou = restantes.length !== (this.porNivel.get(e.patch.nivel)?.length ?? 0);
        if (restantes.length > 0) this.porNivel.set(e.patch.nivel, restantes);
        else this.porNivel.delete(e.patch.nivel);
        return mudou;
      }
      case 'recarga': {
        const mudou = this.porNivel.size > 0;
        if (e.niveis === 'todos') this.porNivel.clear();
        else for (const n of e.niveis) this.porNivel.delete(n);
        return mudou;
      }
      case 'concluido': {
        // Nada pendente: o provisório que sobrou é de nível que não será resolvido (liberado) e não deve ficar para sempre.
        let mudou = false;
        for (const [nivel, lista] of [...this.porNivel]) {
          const restantes = lista.filter((p) => p.versao > e.versao);
          if (restantes.length === lista.length) continue;
          mudou = true;
          if (restantes.length > 0) this.porNivel.set(nivel, restantes);
          else this.porNivel.delete(nivel);
        }
        return mudou;
      }
      default:
        return false;
    }
  }

  /** Elementos provisórios do nível; o mais recente de cada id vence. */
  doNivel(nivel: Id): ElementoGeometrico[] {
    const porId = new Map<Id, ElementoGeometrico>();
    for (const p of this.porNivel.get(nivel) ?? []) {
      for (const el of p.elementos) porId.set(el.id, el);
      for (const id of p.removidos) porId.delete(id);
    }
    return [...porId.values()];
  }

  /** Ids que a edição tirou do nível e que a interface deve esconder até o exato chegar. */
  removidosDoNivel(nivel: Id): Id[] {
    const feitos = new Set<Id>();
    for (const p of this.porNivel.get(nivel) ?? []) {
      for (const id of p.removidos) feitos.add(id);
      for (const el of p.elementos) feitos.delete(el.id);
    }
    return [...feitos];
  }

  /** Níveis com provisório pendente. */
  niveis(): Id[] {
    return [...this.porNivel.keys()];
  }
}
