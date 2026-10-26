import type { SketchDraft, SketchTarget } from '@hestia/geom';
import { DEFAULT_CEILING_HEIGHT, type Id, type Project } from '@hestia/model';
import {
  PerimeterTool,
  type ToolId,
  SKETCH_DEFAULTS,
  commitPerimeter,
  draftFromElement,
  perimeterOptionsOf,
  setDefaults,
  setSegSlope,
  type CommitPerimeterOptions,
  type PerimeterBarOptions,
  type Tool,
  type ToolEnv,
  type ToolOptions,
} from '@hestia/tools';
import type { PerimeterView } from './perimeterApi.ts';
import { VISAO_FECHADA, alvoDaFerramenta, arestaDe, formaDaFerramenta, formaDaTela } from './perimeterView.ts';
import { useUi } from './state.ts';
import type { PerimeterLineKind, PerimeterShape } from '../ui/perimeter/PerimeterRibbonPanels.tsx';

/** O que o modo precisa do controlador: o ambiente das ferramentas, o projeto, a troca da ferramenta ativa e o aviso de mudança. */
export interface PerimetroPorta {
  env(): ToolEnv;
  projeto(): Project;
  /** Torna `tool` a ferramenta ativa; null volta à Selecionar. */
  ativar(tool: Tool | null): void;
  /** Avisa a interface de que o estado do modo mudou (repinta a planta e a barra). */
  atualizar(): void;
}

/** Uma sessão aberta: a ferramenta com o rascunho, o alvo, o elemento em edição (se houver) e as opções da barra. */
interface Sessao {
  tool: PerimeterTool;
  target: SketchTarget;
  /** Elemento em edição; ausente = criando. */
  editing?: Id;
  levelId: Id;
  typeId?: Id;
  opts: PerimeterBarOptions;
}

const ABERTO_FERRAMENTA = 'Perímetro em edição: use Concluir ou Cancelar antes de trocar de ferramenta.';
const ABERTO_VISTA = 'Perímetro em edição: use Concluir ou Cancelar antes de mudar de vista ou de nível.';
const JA_ABERTO = 'Já há um perímetro em edição: use Concluir ou Cancelar.';

/**
 * Tipo, opções da barra e padrão de cada alvo, lidos das opções de ferramenta atuais: o modo começa com o que o usuário
 * já usava (balanço e inclinação do telhado, cota e núcleo do piso, laje e forro).
 */
function iniciais(target: SketchTarget, o: ToolOptions): { typeId?: Id; opts: PerimeterBarOptions } {
  const padrao = { overhang: SKETCH_DEFAULTS.overhang, slopePct: SKETCH_DEFAULTS.slopePct };
  switch (target) {
    case 'roof':
      return { typeId: o.roofTypeId, opts: { overhang: o.roofOverhang ?? padrao.overhang, slopePct: o.roofSlope ?? padrao.slopePct, extendToCore: false, heightOffset: 0 } };
    case 'floor':
      return { typeId: o.floorTypeId, opts: { ...padrao, extendToCore: o.floorCore ?? false, heightOffset: o.floorOffset } };
    case 'slab':
      return { typeId: o.slabTypeId, opts: { ...padrao, extendToCore: false, heightOffset: o.slabOffset } };
    case 'ceiling':
      return { typeId: o.ceilingTypeId, opts: { ...padrao, extendToCore: false, heightOffset: o.ceilingOffset ?? DEFAULT_CEILING_HEIGHT } };
  }
}

/**
 * Opções de `commitPerimeter`. O telhado recebe balanço e inclinação padrão; piso, laje e forro, estender até o núcleo
 * e a cota. A cota do telhado não vai: a barra não a mostra, e o motor a calcula na criação.
 */
function opcoesDe(s: Sessao): CommitPerimeterOptions {
  const base = { typeId: s.typeId, levelId: s.levelId };
  const o = s.opts;
  if (s.target === 'roof') return { ...base, overhang: o.overhang, slopePct: o.slopePct };
  return { ...base, extendToCore: o.extendToCore, heightOffset: o.heightOffset };
}

/**
 * Modo "Criar/Editar perímetro". Abre a ferramenta de perímetro para um alvo (ou para editar um elemento), guarda a
 * barra, e grava o resultado de Concluir num só passo de desfazer. Mudar de ferramenta, vista ou nível não conclui:
 * a barra pede Concluir ou Cancelar. Esc e Enter ficam com a ferramenta (ver `PerimeterTool`).
 */
export class PerimeterMode {
  private sessao: Sessao | null = null;
  /** Última visão montada, com o contador e a barra de status em que foi montada: repintar sem mudança devolve o mesmo objeto. */
  private cache: { tick: number; status: string; visao: PerimeterView } | null = null;

  constructor(private readonly porta: PerimetroPorta) {}

  /** Verdadeiro enquanto o modo está aberto. */
  get ativo(): boolean {
    return this.sessao !== null;
  }

  /** Abre o modo para criar um elemento do alvo, no nível atual, com a forma padrão (linha). */
  begin(target: SketchTarget): void {
    if (this.recusaSeAberto()) return;
    const ui = useUi.getState();
    const { typeId, opts } = iniciais(target, ui.options);
    this.abrir({ tool: new PerimeterTool(this.porta.env(), target), target, levelId: ui.levelId, typeId, opts });
  }

  /** "Editar perímetro": abre o modo com o contorno do elemento. Elemento sem perímetro editável é recusado na barra. */
  edit(id: Id): void {
    if (this.recusaSeAberto()) return;
    const p = this.porta.projeto();
    const el = p.elements[id];
    const d = draftFromElement(p, id);
    const opts = perimeterOptionsOf(p, id);
    if (!el || !d || !opts || !('levelId' in el)) {
      this.dizer('Este elemento não tem perímetro editável.');
      return;
    }
    const tool = new PerimeterTool(this.porta.env(), d.target);
    tool.loadDraft(d);
    this.abrir({ tool, target: d.target, editing: id, levelId: el.levelId, opts });
  }

  /**
   * Concluir: valida e grava num só passo de desfazer, seleciona o elemento e fecha o modo. Em recusa (contorno aberto,
   * ou o motor não gera o telhado), nada é criado: o modo fica aberto e o motivo vai para a barra.
   */
  finish(): void {
    const s = this.sessao;
    if (!s) return;
    const r = commitPerimeter(this.porta.projeto(), s.tool.draft(), opcoesDe(s));
    if (!r.ok) {
      this.dizer(r.message);
      return;
    }
    const env = this.porta.env();
    env.transaction(s.editing ? 'Editar perímetro' : 'Criar perímetro', () => {
      for (const c of r.commands) env.exec(c);
    });
    this.fechar();
    env.setSelection([r.id]);
    this.dizer(r.message);
  }

  /** Cancelar: descarta o rascunho e fecha o modo. O elemento em edição não muda. */
  cancel(): void {
    const s = this.sessao;
    if (!s) return;
    this.fechar();
    this.dizer(s.editing ? 'Edição do perímetro cancelada. O elemento não mudou.' : 'Perímetro descartado.');
  }

  setShape(f: PerimeterShape): void {
    this.comSessao((s) => s.tool.setShape(formaDaTela(f)));
  }

  /** Linha de limite ou seta de inclinação. Voltar a limite com a seleção vazia põe a linha, a forma padrão. */
  setLineKind(k: PerimeterLineKind): void {
    this.comSessao((s) => {
      s.tool.setLineKind(k);
      if (k === 'boundary' && s.tool.activeShape() === null) s.tool.setShape('line');
    });
  }

  /**
   * Opções da barra. No telhado, balanço e inclinação padrão valem também para as linhas sem valor próprio: o rascunho
   * guarda o padrão novo, para a aresta selecionada mostrar o que o telhado vai gravar.
   */
  setOptions(patch: Partial<PerimeterBarOptions>): void {
    this.comSessao((s) => {
      s.opts = { ...s.opts, ...patch };
      if (s.target === 'roof' && (patch.overhang !== undefined || patch.slopePct !== undefined)) {
        s.tool.loadDraft(setDefaults(s.tool.draft(), { overhang: s.opts.overhang, slopePct: s.opts.slopePct }));
      }
    });
  }

  /** Flags da aresta selecionada (só telhado): define ou não inclinação, inclinação própria e balanço próprio. */
  setEdge(patch: { definesSlope?: boolean; slopePct?: number; overhang?: number }): void {
    const s = this.sessao;
    if (!s) return;
    const d = s.tool.draft();
    const id = d.selected[0];
    if (s.target !== 'roof') this.dizer('Só o telhado tem inclinação e balanço por aresta.');
    else if (id === undefined) this.dizer('Selecione uma aresta para mudar a inclinação ou o balanço.');
    else s.tool.loadDraft(setSegSlope(d, id, patch));
    this.porta.atualizar();
  }

  /**
   * Escolha de ferramenta da faixa. Com o modo aberto, qualquer troca é recusada e o modo fica. Fora dele, Telhado,
   * Piso, Laje e Forro abrem o modo para o alvo. Devolve true quando a escolha foi tratada aqui.
   */
  intercepta(id: ToolId): boolean {
    if (this.ativo) {
      this.dizer(ABERTO_FERRAMENTA);
      return true;
    }
    const alvo = alvoDaFerramenta(id);
    if (alvo) this.begin(alvo);
    return alvo !== null;
  }

  /** Troca de vista ou de nível com o modo aberto: recusada (true), e o modo fica. */
  bloqueiaNavegacao(): boolean {
    if (!this.ativo) return false;
    this.dizer(ABERTO_VISTA);
    return true;
  }

  /** Fecha sem mensagem, quando o projeto é trocado e o modo deixa de valer. */
  encerrar(): void {
    this.sessao = null;
  }

  /** Estado para a tela: rascunho e resultado correntes, barra, linha sob o cursor e aresta selecionada. */
  view(): PerimeterView {
    const { previewTick: tick, status } = useUi.getState();
    if (this.cache?.tick === tick && this.cache.status === status) return this.cache.visao;
    const visao = this.montaVisao(status);
    this.cache = { tick, status, visao };
    return visao;
  }

  private montaVisao(status: string): PerimeterView {
    const s = this.sessao;
    if (!s) return { ...VISAO_FECHADA, status };
    const d: SketchDraft = s.tool.draft();
    return {
      active: true,
      target: s.target,
      ...(s.editing ? { editing: s.editing } : {}),
      draft: d,
      result: s.tool.closeInfo(),
      shape: formaDaFerramenta(s.tool.activeShape()),
      lineKind: s.tool.lineKind(),
      options: s.opts,
      hoverId: s.tool.hoverId(),
      selectedEdge: arestaDe(d),
      status,
    };
  }

  private abrir(s: Sessao): void {
    this.sessao = s;
    useUi.setState({ view: 'plan', sectionId: null, levelId: s.levelId, selection: [], hover: null });
    this.porta.ativar(s.tool);
    s.tool.setShape('line');
    this.porta.atualizar();
  }

  private fechar(): void {
    this.sessao = null;
    this.porta.ativar(null);
  }

  /** Aplica `fn` à sessão aberta e avisa a interface. Sem sessão, nada acontece. */
  private comSessao(fn: (s: Sessao) => void): void {
    const s = this.sessao;
    if (!s) return;
    fn(s);
    this.porta.atualizar();
  }

  /** Mostra uma mensagem na barra de status e avisa a interface. */
  private dizer(msg: string): void {
    this.porta.env().say(msg);
    this.porta.atualizar();
  }

  /** Com o modo aberto, begin e edit são recusados (true). */
  private recusaSeAberto(): boolean {
    if (!this.ativo) return false;
    this.dizer(JA_ABERTO);
    return true;
  }
}
