import type { ResolvedLevel } from '@hestia/engine';
import type { Id } from '@hestia/model';
import type { PlanDrawList, PlanFrame, PlanScene, PlanTheme, Viewport } from '@hestia/render';
import type { ProvisoriosAtivos } from '../editor/fluxoEdicao.ts';
import { operacoesProvisorias, temProvisorioVisivel, type OperacoesProvisorias } from './plantaProvisoria.ts';

/** Executa `f` depois que o navegador pintou o quadro atual (rAF e depois uma tarefa); sem navegador, na hora seguinte. */
export function depoisDaPintura(f: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(f, 0));
  else setTimeout(f, 0);
}

/** O que o quadro da planta pede de fora: o fluxo de edição, a referência dos níveis e o pedido de novo quadro. */
export interface DependenciasQuadro {
  provisorios: ProvisoriosAtivos;
  /** Resolução de um nível usada como referência (pavimento de baixo): pode vir do último exato enquanto o novo corre. */
  resolverReferencia: (id: Id) => ResolvedLevel;
  /** O exato do nível ainda não é o da versão atual do projeto. */
  pendente: (id: Id) => boolean;
  /** Pede um quadro novo (a tela redesenha). */
  pedirQuadro: () => void;
  /** Como esperar a pintura; trocável nos testes. */
  depoisDaPintura?: (f: () => void) => void;
}

/** Cena que recebe as camadas de sobreposição (a GPU da planta). */
export type CenaProvisoria = Pick<PlanScene, 'setSlot'>;

/** Quadro da planta como `desenhar` o usa: só o que ele toca. */
export type QuadroDaPlanta = Pick<PlanFrame, 'update' | 'reset'>;

/** Onde o último exato foi desenhado: o provisório só vale sobre ele (mesmo nível e mesmo contexto de vista). */
interface Base {
  versao: number;
  nivel: Id;
  contexto: string;
}

export interface EntradaDesenho {
  quadro: QuadroDaPlanta;
  /** Cena da GPU; `null` no modo CPU (o provisório sai em `extra`). */
  cena: CenaProvisoria | null;
  v: Viewport;
  tema: PlanTheme;
  nivel: Id;
  versao: number;
  /** Tudo o que, se mudar, obriga a refazer a geometria exata (tema, dispositivo, zoom e opções da vista). */
  contexto: string;
  /** Atualização exata da planta (chamada só quando o exato é desenhado). */
  atualizar: () => Parameters<QuadroDaPlanta['update']>[0];
}

/**
 * Planta com resposta imediata de edição. O exato da planta (corte, junção, vista) é calculado na thread da tela; para
 * não segurar o quadro da edição, quando há provisório do nível o quadro desenha só a sobreposição provisória (apaga o
 * contorno antigo dos elementos editados e desenha o novo) e deixa o exato para depois da pintura. Quando o exato é
 * desenhado, a sobreposição some (a camada de sobreposição é reescrita pela chave nova do quadro).
 *
 * Sem provisório do nível (mudança global, outro nível, nada editado) o comportamento é o de antes: exato direto.
 * Também cuida das referências assíncronas (pavimento de baixo): se uma veio do exato antigo, refaz a planta quando
 * o novo chega.
 */
export class QuadroPlanta {
  private base: Base | null = null;
  private agendado = false;
  private liberado = false;
  private readonly referenciasAntigas = new Set<Id>();
  private provisorioNaCena = false;
  private readonly esperar: (f: () => void) => void;

  constructor(private readonly dep: DependenciasQuadro) {
    this.esperar = dep.depoisDaPintura ?? depoisDaPintura;
  }

  /** Resolução de referência para o quadro: lembra as que vieram do exato antigo. */
  readonly resolver = (id: Id): ResolvedLevel => {
    const r = this.dep.resolverReferencia(id);
    if (this.dep.pendente(id)) this.referenciasAntigas.add(id);
    return r;
  };

  /** Esquece a base (saiu da planta: outra vista, ou a cena foi refeita do zero). */
  invalidar(): void {
    this.base = null;
    this.liberado = false;
  }

  /** O que o quadro desenha agora: o exato ou o provisório sobre o último exato. */
  modo(nivel: Id, versao: number, contexto: string): 'exato' | 'provisorio' {
    if (this.liberado || !this.base || this.base.nivel !== nivel || this.base.contexto !== contexto || this.base.versao === versao) return 'exato';
    const d = this.dados(nivel);
    return temProvisorioVisivel(d, this.dep.provisorios.removidosDoNivel(nivel)) ? 'provisorio' : 'exato';
  }

  /**
   * Desenha o quadro da planta. Devolve a sobreposição provisória quando o quadro saiu provisório (o modo CPU a junta à
   * lista de desenho; na GPU ela já foi para a cena), senão `null`.
   */
  desenhar(e: EntradaDesenho): OperacoesProvisorias | null {
    if (this.modo(e.nivel, e.versao, e.contexto) === 'provisorio') {
      const ops = operacoesProvisorias(this.dados(e.nivel), e.tema, e.v.zoom);
      e.cena?.setSlot('fillsOver', ops.fills, [], e.v);
      e.cena?.setSlot('strokesOver', [], ops.strokes, e.v);
      this.provisorioNaCena = true;
      this.agendarExato();
      return ops;
    }
    // Referência de pavimento que veio do exato antigo e já foi atualizada: a geometria deve ser refeita por inteiro.
    if ([...this.referenciasAntigas].some((id) => !this.dep.pendente(id))) e.quadro.reset();
    this.referenciasAntigas.clear();
    // O exato assume a cena: a camada provisória (que ficou por cima na última edição) sai uma vez, sem custo por quadro.
    if (this.provisorioNaCena) {
      e.cena?.setSlot('fillsOver', [], [], e.v);
      e.cena?.setSlot('strokesOver', [], [], e.v);
      this.provisorioNaCena = false;
    }
    e.quadro.update(e.atualizar());
    this.base = { versao: e.versao, nivel: e.nivel, contexto: e.contexto };
    this.liberado = false;
    return null;
  }

  /** Junta o provisório à lista de desenho do modo CPU. */
  static comProvisorio(lista: PlanDrawList, extra: OperacoesProvisorias | null): PlanDrawList {
    return extra ? { ...lista, fills: [...lista.fills, ...extra.fills], strokes: [...lista.strokes, ...extra.strokes] } : lista;
  }

  private dados(nivel: Id): { apagar: ReturnType<ProvisoriosAtivos['apagarDoNivel']>; desenhar: ReturnType<ProvisoriosAtivos['doNivel']> } {
    return { apagar: this.dep.provisorios.apagarDoNivel(nivel), desenhar: this.dep.provisorios.doNivel(nivel) };
  }

  /** Pede o quadro exato para depois da pintura do provisório. Um pedido por vez. */
  private agendarExato(): void {
    if (this.agendado) return;
    this.agendado = true;
    this.esperar(() => {
      this.agendado = false;
      this.liberado = true;
      this.dep.pedirQuadro();
    });
  }
}
