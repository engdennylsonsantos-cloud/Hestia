/* eslint-disable max-lines */
import { useSyncExternalStore } from 'react';
import type { Vec2 } from '@hestia/geom';
import { computeSection, cotasAutomaticas, LevelResolveCache, resolveRooms, type AutoCotaOptions, type ResolvedLevel, type SectionResult } from '@hestia/engine';
import {
  ProjectStore,
  annotationIdsIn, projectGrids, areaPlanOf, areaPlansOfLevel, DEFAULT_AREA_GRAPHICS, isRoom,
  planAnnotationIds,
  buildTemplate,
  createEmptyProject,
  migrateProject,
  newId,
  sectionPoints,
  type AnnotationCommand,
  type Command,
  type Id,
  type Project,
  type RoomTag,
  type SectionView,
  type TemplateId,
} from '@hestia/model';
import { annotationAt, DEFAULT_SNAP, createTool, execWithHostedLoss, isStairTool, type HostedApplyResult, type PointerInfo, type Tool, type ToolEnv, type ToolId } from '@hestia/tools';
import { transfer } from './transfer.ts';
import { desfazerOuRefazer } from './historyStatus.ts';
import { keptFloorType } from './typeActions.ts'; import { keptSlabType } from './slabTypeActions.ts'; import { PerimeterMode } from './perimeterMode.ts';
import { AUTOSAVE_KEY, safeGet, safeSet } from './storage.ts';
import { useI18n } from './i18n.ts';
import { pedirConfirmacaoHostedLoss } from './hostedLossPrompt.ts';
import { fitBox, levelFrameBox, panBy, planViewOf, referenceAt, roomTagLines, sectionBox, tagBoxModel, underlayIdOf, effectiveGridStep, zoomAt, type Viewport } from '@hestia/render';
import { key3d, setSnap, toggleOrtho, useUi } from './state.ts';
import { defaultOpenViews, type PlanKind } from './openViews.ts';
import { casador } from './shortcutConfig.ts'; import { clearSelectionForTool } from './toolSelection.ts';
import { elevationCommand, type PlanBox } from './elevations.ts';
import { deleteSelectionIn } from './deleteIds.ts';
import { deleteViewAction, renameViewAction, updateViewAction } from './sectionViewActions.ts';
import { entregarArquivo } from './entregarArquivo.ts';
import { safeFilename } from './nomeArquivo.ts';
import { FluxoEdicao } from './fluxoEdicao.ts';
import { CacheGeometria } from './geometryCache.ts';
import { abrirComCache, TETO_GEOMETRIA_BYTES, type PortasAbertura } from './geometriaAbertura.ts';
import { aceitaCaractereNumerico } from './entradaNumerica.ts';


/**
 * Ferramentas que continuam disponíveis na planta de área: anotação e as ferramentas de área (ambiente e separador).
 * O resto (parede, porta, piso, laje, forro, telhado, escada, grade...) é do modelo e fica bloqueado nela.
 */
export const AREA_PLAN_TOOLS: readonly ToolId[] = ['select', 'measure', 'dimension', 'text', 'tag', 'detailLine', 'filledRegion', 'room', 'roomsep'];

/** A ferramenta pode rodar na planta de área? */
export const areaPlanToolAllowed = (id: ToolId): boolean => AREA_PLAN_TOOLS.includes(id);

/** Comandos de anotação que, na planta de área, moram em `plan.annotations` (não no nível). */
const PLAN_ANNOTATION_TYPES = new Set<Command['type']>([
  'addDimension', 'updateDimension', 'removeDimension',
  'addText', 'updateText', 'removeText',
  'addDetailLine', 'updateDetailLine', 'removeDetailLine',
  'addDetailRegion', 'updateDetailRegion', 'removeDetailRegion',
  'addTag', 'updateTag', 'removeTag',
]);

const isPlanAnnotation = (c: Command): c is AnnotationCommand => PLAN_ANNOTATION_TYPES.has(c.type);

/** Ambiente cujo rótulo está sob um ponto (mundo), com tolerância de 0,10 m além da caixa do texto. */
function labelHit(p: Project, levelId: Id, scale: number, planId: Id | null, at: Vec2): { roomId: Id; at: Vec2 } | null {
  const plan = planId ? areaPlanOf(p, planId) : areaPlansOfLevel(p, levelId)[0];
  const graphics = plan?.graphics ?? DEFAULT_AREA_GRAPHICS;
  const resolved = resolveRooms(p, levelId);
  for (const r of resolved) {
    const room = p.elements[r.roomId];
    if (!isRoom(room) || !r.polygon) continue;
    const tag = plan?.tags.find((t) => t.roomId === room.id);
    const labelAt = room.labelPosition ?? tag?.at ?? referenceAt(room, r);
    const draft: RoomTag = tag ?? {
      id: `auto:${room.id}`,
      planId: plan?.id ?? '',
      roomId: room.id,
      at: labelAt,
      orientation: 'horizontal',
      leader: graphics.tagDefault.leader,
      fields: [...graphics.tagDefault.fields],
      visible: true,
    };
    const box = tagBoxModel(roomTagLines(p, room, r, draft), scale);
    if (Math.abs(at.x - labelAt.x) <= box.w / 2 + 0.1 && Math.abs(at.y - labelAt.y) <= box.h / 2 + 0.1) return { roomId: room.id, at: labelAt };
  }
  return null;
}

/**
 * Controlador do editor: junta projeto (histórico), ferramenta ativa, seleção e vistas.
 * A interface só lê estado e chama ações; as regras vivem aqui e nos pacotes.
 */
export class Editor {
  readonly store = new ProjectStore(createEmptyProject());
  /** Arraste de rótulo de ambiente em andamento (mundo); vale na planta de piso e na de área. */
  private tagDrag: { planId: Id | null; roomId: Id; offset: Vec2; at: Vec2; moved: boolean } | null = null;
  private suppressNextClick = false;
  private tool: Tool;
  private viewports = new Map<Id, Viewport>();
  /** Resolução por nível: uma edição recalcula só o nível editado e os que dependem dele (ver `LevelResolveCache`). */
  private readonly levels = new LevelResolveCache();
  readonly fluxo = new FluxoEdicao({ aoMudar: () => this.bump(), exatoAssincrono: true }); // provisório na hora, exato em segundo plano (fluxoEdicao.ts)
  readonly provisorios = this.fluxo.provisorios; // a planta os desenha (ui/quadroPlanta.ts); ler aqui liga o cálculo a cada edição
  /** Modo "Criar/Editar perímetro" (perimeterMode.ts): abre-se pelas ferramentas Telhado, Piso, Laje e Forro. */
  readonly perimetro = new PerimeterMode({ env: () => this.env, projeto: () => this.project, ativar: (t) => (t ? this.activate('perimeter', t) : this.activate('select')), atualizar: () => this.bump() });
  /** Cache de geometria por projeto: na abertura restaura os níveis (ver `geometriaAbertura.ts`); só a abertura grava. */
  private readonly portasAbertura: PortasAbertura = {
    cache: new CacheGeometria({ tetoBytes: TETO_GEOMETRIA_BYTES }),
    atual: () => this.store.project,
    lerNivel: (id) => this.fluxo.nivelPronto(id) ?? this.levels.get(this.store.project, id),
    pendente: (id) => this.fluxo.pendente(id),
    semear: (id, valor) => this.fluxo.resolucao.semear(id, valor),
  };
  private sectionCache = new Map<Id, { project: Project; value: SectionResult }>();
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  fileName = 'projeto.hestia.json';

  constructor() {
    this.tool = createTool('select', this.env);
    this.store.subscribe(() => {
      this.pruneSelection();
      this.scheduleAutosave(); this.fluxo.atualizar(this.project, this.store.version);
      useUi.setState((s) => ({ previewTick: s.previewTick + 1 }));
    });
  }

  // ---------- ambiente entregue às ferramentas ----------
  private env: ToolEnv = {
    project: () => this.store.project,
    levelId: () => useUi.getState().levelId,
    // Contrato do ToolEnv (subagente de modelo): as ferramentas de anotação gravam com `planId` quando há planta de área.
    areaPlanId: () => this.areaPlanIdNow(),
    hiddenInView: () => planViewOf(this.store.project, useUi.getState().levelId).hidden,
    underlayLevelId: () => { const st = useUi.getState(); return underlayIdOf(this.store.project, st.levelId, st.showUnderlay, st.underlayLevel); },
    selection: () => useUi.getState().selection,
    setSelection: (ids) => useUi.setState({ selection: ids }),
    exec: (c) => this.exec(c),
    transaction: (l, fn, session) => this.store.transaction(l, fn, session),
    metersPerPixel: () => 1 / (this.viewport()?.zoom ?? 60),
    gridStep: () => effectiveGridStep(this.viewport()?.zoom ?? 60, useUi.getState().gridStep),
    say: (m) => useUi.setState({ status: m }), lang: () => useI18n.getState().lang, confirmHostedLoss: (losses, message) => pedirConfirmacaoHostedLoss(losses, message),
    done: () => this.setTool('select'),
    openView: (id) => this.openSection(id),
    options: () => useUi.getState().options, setOptions: (patch) => useUi.setState({ options: { ...useUi.getState().options, ...patch } }),
  };

  get project(): Project { return this.store.project; }

  /** Planta de área ativa (só quando a vista atual é a planta de área), ou null. */
  private areaPlanIdNow(): Id | null {
    const st = useUi.getState();
    return st.view === 'plan' && st.planKind === 'area' ? st.areaPlanId : null;
  }

  /**
   * Roteia um comando: na planta de área, as anotações recebem `planId` e o modelo as guarda em `plan.annotations`
   * (não no nível). As ferramentas já mandam `planId`; o preenchimento aqui é a rede de segurança para comandos
   * antigos e para o modo de compatibilidade sem o contrato novo.
   */
  private exec(c: Command): void {
    const planId = this.areaPlanIdNow();
    if (planId && isPlanAnnotation(c) && (!('planId' in c) || c.planId === undefined)) {
      this.store.exec({ ...c, planId } as AnnotationCommand);
      return;
    }
    this.store.exec(c);
  }

  // ---------- vistas ----------
  /** Chave do viewport: cada planta tem o seu (a de cobertura tem outro, do mesmo nível); cada corte ou elevação tem o próprio. */
  private viewKey(): Id {
    const st = useUi.getState();
    return st.view === 'section' ? `sec:${st.sectionId}` : st.planKind === 'roof' ? `roof:${st.levelId}` : st.planKind === 'area' ? `area:${st.areaPlanId ?? st.levelId}` : st.levelId;
  }

  viewport(): Viewport | null {
    return this.viewports.get(this.viewKey()) ?? null;
  }

  setViewport(v: Viewport): void {
    this.viewports.set(this.viewKey(), v);
    useUi.setState((s) => ({ previewTick: s.previewTick + 1 }));
  }

  /** Caixa para enquadrar a vista atual: o nível na planta, o corte na vista de corte. */
  private frameBox(): PlanBox | null {
    const st = useUi.getState();
    if (st.view === 'section') {
      const r = this.sectionOf(st.sectionId);
      return r ? sectionBox(r) : null;
    }
    return levelFrameBox(this.project, st.levelId);
  }

  ensureViewport(width: number, height: number): Viewport {
    const id = this.viewKey();
    const cur = this.viewports.get(id);
    if (cur && cur.width === width && cur.height === height) return cur;
    const base: Viewport = cur ?? { cx: 5, cy: 3.5, zoom: 60, width, height };
    const v = { ...base, width, height };
    if (!cur) {
      const box = this.frameBox();
      if (box) Object.assign(v, fitBox(v, box));
    }
    this.viewports.set(id, v);
    return v;
  }

  zoomExtents(): void {
    const v = this.viewport();
    if (!v) return;
    const box = this.frameBox();
    this.setViewport(box ? fitBox(v, box) : { ...v, cx: 5, cy: 3.5, zoom: 60 });
  }

  /** Corte calculado de uma vista, cacheado enquanto o projeto não muda (equivale a um useMemo por projeto). */
  sectionOf(id: Id | null): SectionResult | null {
    if (!id) return null;
    const view = this.project.views.find((x) => x.id === id);
    if (!view) return null;
    const hit = this.sectionCache.get(id);
    if (hit && hit.project === this.project) return hit.value;
    const pts = sectionPoints(this.project, view);
    const value = computeSection(this.project, { a: pts.a, b: pts.b, depth: view.depth });
    this.sectionCache.set(id, { project: this.project, value });
    return value;
  }

  zoomWheel(screen: { x: number; y: number }, deltaY: number): void { const v = this.viewport(); if (v) this.setViewport(zoomAt(v, screen, Math.exp(-deltaY * 0.0015))); }

  pan(dx: number, dy: number): void { const v = this.viewport(); if (v) this.setViewport(panBy(v, dx, dy)); }

  resolved(levelId: Id, exigirExato = true): ResolvedLevel { return this.fluxo.resolvido(levelId, () => this.levels.get(this.project, levelId), levelId === useUi.getState().levelId, exigirExato); }

  /** Resolução do nível já pronta em segundo plano (ou do cache de geometria), sem calcular. Para a montagem da 3D. */
  resolucaoPronta(levelId: Id): ResolvedLevel | null { return this.fluxo.nivelPronto(levelId); }

  /** Libera os caches de um nível (viewport da planta e resolução). Chamado ao fechar uma aba de planta. */
  releaseLevel(levelId: Id): void {
    this.viewports.delete(levelId);
    this.levels.release(levelId); this.fluxo.liberar(levelId);
  }

  // ---------- ferramentas ----------
  get activeTool(): Tool { return this.tool; }

  /** Aplica comandos pela mesma regra das aberturas hospedadas usada pelas ferramentas (cotas temporárias). */
  applyCommands(label: string, commands: readonly Command[]): HostedApplyResult { return execWithHostedLoss(this.env, label, commands); }

  private activate(id: ToolId, tool: Tool = createTool(id, this.env)): void {
    this.tool = tool;
    useUi.setState({ tool: id, typed: '', prompt: null, hover: null });
    this.tool.start();
    this.bump();
  }

  // Perímetro: Telhado, Piso, Laje e Forro abrem o modo; com o modo aberto, trocar de ferramenta não conclui (a barra pede Concluir ou Cancelar).
  setTool(id: ToolId): void {
    const st = useUi.getState();
    // A planta de área é de anotação: ferramentas de modelo não entram nela (nem por atalho, nem ao voltar de um corte).
    if (st.planKind === 'area' && st.view !== '3d' && !areaPlanToolAllowed(id)) {
      useUi.setState({ status: 'Na planta de área ficam disponíveis só as ferramentas de anotação (medir, cota, texto, etiqueta e detalhe).' });
      return;
    }
    if (this.perimetro.intercepta(id)) return;
    // Ferramentas de desenho são da planta: escolher uma delas na vista de corte volta à planta.
    if (useUi.getState().view === 'section') useUi.setState({ view: 'plan', sectionId: null });
    if (clearSelectionForTool(id)) useUi.setState({ selection: [] });
    this.activate(id);
  }

  bump(): void {
    // Sem campo numérico a caixa some; o buffer digitado não pode sobreviver a ela, senão prende os atalhos de letra sem aviso.
    useUi.setState((s) => {
      const prompt = this.tool.inputPrompt();
      return { previewTick: s.previewTick + 1, prompt, typed: prompt ? s.typed : '' };
    });
  }

  pointer(kind: 'move' | 'down' | 'drag' | 'up' | 'click', info: PointerInfo): void {
    const ui = useUi.getState();
    // Rótulo do ambiente: alvo do arraste na planta de piso e na de área. Só com a ferramenta Selecionar:
    // com Cota/Texto/Etiqueta/Detalhe/Medir ativos, o clique é da ferramenta (a planta de área é de anotação).
    // A posição é do MODELO (vale em todas as vistas).
    if (ui.tool === 'select' && ui.view === 'plan' && (ui.planKind === 'area' || ui.planKind === 'floor')) {
      const levelPlan = ui.planKind === 'area' ? (ui.areaPlanId ? areaPlanOf(this.project, ui.areaPlanId) : undefined) : areaPlansOfLevel(this.project, ui.levelId)[0];
      const planId = levelPlan?.id ?? null;
      const scale = levelPlan?.scale ?? 50;
      if (kind === 'down') {
        // A anotação da vista fica por cima do rótulo do ambiente: com uma cota/texto sob o cursor, o clique é dela.
        const anotacao = annotationAt(this.project, ui.levelId, info.raw, this.env.metersPerPixel(), planId ?? undefined);
        const hit = anotacao ? null : labelHit(this.project, ui.levelId, scale, planId, info.raw);
        if (hit) {
          this.tagDrag = { planId, roomId: hit.roomId, offset: { x: hit.at.x - info.raw.x, y: hit.at.y - info.raw.y }, at: hit.at, moved: false };
          useUi.setState({ status: 'Arraste o rótulo e solte para posicionar. A chamada liga ao sair do ambiente.' });
          return;
        }
      }
      if (kind === 'drag' && this.tagDrag) {
        this.tagDrag.at = { x: info.raw.x + this.tagDrag.offset.x, y: info.raw.y + this.tagDrag.offset.y };
        this.tagDrag.moved = true;
        useUi.setState({ tagDrag: { planId: this.tagDrag.planId ?? '', roomId: this.tagDrag.roomId, at: this.tagDrag.at } });
        return;
      }
      if (kind === 'up' && this.tagDrag) {
        const d = this.tagDrag;
        this.tagDrag = null;
        if (d.moved) {
          this.store.exec({ type: 'setRoomLabel', id: d.roomId, position: d.at }, 'Mover rótulo');
          this.suppressNextClick = true;
          useUi.setState({ tagDrag: null, status: 'Rótulo reposicionado em todas as vistas. Ctrl+Z desfaz.' });
        } else {
          // Clique sem arrastar: seleciona o ambiente para configurar o rótulo no painel.
          this.suppressNextClick = true;
          useUi.setState({ tagDrag: null, selection: [d.roomId] });
        }
        return;
      }
      if (kind === 'click' && this.suppressNextClick) {
        this.suppressNextClick = false;
        return;
      }
    }
    // Planta de área: o `selectTool` decide o alvo (anotação da vista antes do modelo e o ambiente por último). O
    // atalho antigo de pegar o ambiente aqui impedia cotas e textos de receberem o clique.
    const t = this.tool;
    switch (kind) {
      case 'move':
        t.move(info);
        if (t.id === 'select') {
          const first = t.preview().find((i) => i.kind === 'highlight');
          useUi.setState({ hover: first && first.kind === 'highlight' ? (first.ids[0] ?? null) : null });
        }
        break;
      case 'down':
        t.down?.(info);
        break;
      case 'drag':
        if (t.drag) t.drag(info);
        else t.move(info);
        break;
      case 'up':
        t.up?.(info);
        break;
      case 'click':
        t.click(info);
        break;
    }
    this.bump();
  }

  // ---------- teclado ----------
  /** Devolve true se a tecla foi consumida. */
  key(e: KeyboardEvent): boolean {
    const ui = useUi.getState();
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    // Na aba de prancha, as teclas de ferramenta e de seleção não valem (o desfazer, com Ctrl, vale).
    if (ui.view === 'sheet' && !mod) return false;
    if (mod && (k === 'z' || k === 'Z')) {
      if (this.stairPickHistory(e.shiftKey)) return true;
      if (e.shiftKey) this.redo();
      else this.undo();
      return true;
    }
    if (mod && (k === 'y' || k === 'Y')) {
      if (this.stairPickHistory(true)) return true;
      this.redo();
      return true;
    }
    if (mod && (k === 's' || k === 'S')) {
      this.save();
      return true;
    }
    if (mod && ui.view === 'plan' && /^[cv]$/i.test(k) && !this.perimetro.ativo) return k.toLowerCase() === 'c' ? this.copySelection() : this.pasteAligned(ui.levelId);
    if (mod) return /^a$/i.test(k) && this.perimetro.selecionarTudo();
    if (k === 'F3') {
      const cur = (useUi.getState().options.snap ?? DEFAULT_SNAP).enabled !== false;
      setSnap({ enabled: !cur });
      useUi.setState({ status: !cur ? 'Capturas ativadas (F3)' : 'Capturas desativadas (F3)' });
      return true;
    }
    if (k === 'F8') {
      toggleOrtho();
      return true;
    }
    if (k === 'F11') {
      const cur = (useUi.getState().options.snap ?? DEFAULT_SNAP).alignment;
      setSnap({ alignment: !cur });
      useUi.setState({ status: !cur ? 'Rastreamento de alinhamento ativado (F11)' : 'Rastreamento de alinhamento desativado (F11)' });
      return true;
    }
    if (ui.view === 'section') {
      if (k === 'Escape') {
        this.closeSection();
        return true;
      }
      // Delete e Backspace excluem a seleção, como na 3D (decisão 0016 §5).
      return key3d(k, ui.selection, () => this.deleteSelection());
    }
    // Na 3D, Esc segue o da planta (cancela a operação, senão volta à Selecionar; decisão 0016 §5). Ferramenta de escolha (Anexar topo): Enter e Tab seguem para a planta, senão a etapa não avança.
    if (ui.view === '3d' && k !== 'Escape' && !(this.tool.pick3d && (k === 'Enter' || k === 'Tab'))) return key3d(k, ui.selection, () => this.deleteSelection());
    if (k === 'Escape') {
      casador.limpar(); if (ui.typed) useUi.setState({ typed: '' });
      // Ferramenta de texto: Esc com texto digitado também cancela o ponto, senão a próxima tecla vira texto.
      if (!ui.typed || this.tool.freeText) { if (!this.perimetro.esc()) this.tool.cancel(); }
      this.bump();
      return true;
    }
    // Qualquer outra tecla de controle (Enter, Tab, Delete, Espaço…) interrompe uma sequência em andamento; modificadores não.
    if (k.length > 1 && !['Shift', 'Control', 'Alt', 'Meta'].includes(k)) casador.limpar();
    if (k === 'Enter') {
      if (ui.typed) {
        const ok = this.tool.type(ui.typed);
        if (ok) useUi.setState({ typed: '' });
      } else this.tool.confirm();
      this.bump();
      return true;
    }
    if (k === 'Backspace' && ui.typed) {
      useUi.setState({ typed: ui.typed.slice(0, -1) });
      return true;
    }
    if (k === 'Delete' || k === 'Backspace') {
      // Vértice de piso em foco: a ferramenta o remove antes de a seleção ser excluída.
      if (this.tool.deleteKey?.()) {
        // Repinta a barra da ferramenta (contador de espelhos, aviso) sem esperar o próximo clique.
        this.bump();
        return true;
      }
      if (ui.selection.length && !this.perimetro.ativo) { this.deleteSelection(); return true; }
    }
    if (/^a$/i.test(k) && !ui.typed && this.tool.adjust?.()) { this.bump(); return true; } // A ajusta a rampa livre em andamento
    if (k === 'Tab') {
      this.tool.tab();
      this.bump();
      return true;
    }
    if (k === ' ' && this.tool.id === 'wall') {
      this.tool.space?.();
      this.bump();
      return true;
    }
    // Campo numérico: dígitos, operadores e sufixo de unidade (`120cm`, `5'6"`); ferramenta de texto (freeText): qualquer tecla digitável.
    if (this.tool.inputPrompt() && (this.tool.freeText ? k.length === 1 : aceitaCaractereNumerico(k, ui.typed))) {
      useUi.setState({ typed: ui.typed + k });
      return true;
    }
    if (k === ' ' && (this.tool.id === 'door' || this.tool.id === 'window')) {
      this.tool.space?.(); this.bump();
      return true;
    }
    // Atalho por sequência (ex.: WA). Alt não dispara; digitação ativa ou ferramenta de texto (freeText, sem ponto) não deixa letras virarem atalho.
    if (e.altKey || ui.typed || this.tool.freeText) return false;
    const r = casador.tecla(k);
    if (!r.tratada) return false;
    if (r.comando === 'atalhos' || r.comando === 'unidades') useUi.setState({ dialog: r.comando === 'atalhos' ? 'shortcutsConfig' : 'units', dialogArg: null });
    else if (r.comando) this.setTool(r.comando);
    return true;
  }

  // ---------- seleção e edição ----------
  private pruneSelection(): void {
    const sel = useUi.getState().selection;
    const p = this.store.project;
    // A seleção guarda ids de elementos, cotas/textos (do nível ou da planta de área) e vistas: só sai o que sumiu.
    const st = useUi.getState();
    const plan = st.view === 'plan' && st.planKind === 'area' && st.areaPlanId ? areaPlanOf(p, st.areaPlanId) : undefined;
    const notes = new Set([...annotationIdsIn(p, st.levelId, sel), ...(plan ? planAnnotationIds(plan).filter((id) => sel.includes(id)) : [])]);
    const views = new Set(p.views.map((v) => v.id));
    const keep = sel.filter((id) => p.elements[id] || notes.has(id) || views.has(id) || projectGrids(p).some((g) => g.id === id));
    if (keep.length !== sel.length) useUi.setState({ selection: keep });
    const lv = useUi.getState().levelId;
    if (!p.levels.some((l) => l.id === lv)) useUi.setState({ levelId: p.levels[0]?.id ?? 'lv_0' });
    const after = useUi.getState();
    if (after.view === 'section' && !p.views.some((v) => v.id === after.sectionId)) useUi.setState({ view: 'plan', sectionId: null });
  }

  // ---------- cortes e elevações ----------
  /** Abre um corte ou elevação na área central, com viewport próprio. */
  openSection(id: Id): void {
    if (this.perimetro.bloqueiaNavegacao() || !this.project.views.some((v) => v.id === id)) return;
    // Ao abrir, enquadra de novo: descarta o viewport guardado desta vista.
    this.viewports.delete(`sec:${id}`);
    useUi.setState({ view: 'section', sectionId: id, selection: [], hover: null });
    this.activate('select');
  }

  /** Volta à planta do nível ativo. */
  closeSection(): void {
    if (useUi.getState().view !== 'section') return;
    useUi.setState({ view: 'plan', sectionId: null, hover: null });
    this.activate('select');
  }

  updateView(id: Id, patch: Partial<Omit<SectionView, 'id'>>): string | null {
    return updateViewAction(this.store, id, patch);
  }

  renameView(id: Id, name: string): boolean {
    return renameViewAction(this.store, id, name);
  }

  deleteView(id: Id): void {
    deleteViewAction(this.store, id);
  }

  /** Gera (ou atualiza) as quatro elevações do nível ativo, em um único passo de desfazer. */
  generateElevations(): void {
    const box = levelFrameBox(this.project, useUi.getState().levelId);
    if (!box) {
      useUi.setState({ status: 'Não há paredes neste nível para gerar elevações.' });
      return;
    }
    this.store.exec(elevationCommand(this.project.views, box, newId), 'Gerar elevações');
    useUi.setState({ status: 'Elevações Norte, Sul, Leste e Oeste geradas. Ctrl+Z desfaz.' });
  }

  deleteSelection(): void {
    void deleteSelectionIn(this.store);
  }

  /** Copiar (Ctrl+C): paredes selecionadas e suas aberturas, em memória. */
  copySelection(): boolean { return transfer.copy(this.project, useUi.getState().selection); }
  /** Colar alinhado (Ctrl+V): mesmas coordenadas no nível dado. */
  pasteAligned(levelId: Id): boolean { return transfer.paste(this.store, levelId); }
  /** Seleciona todas as paredes e aberturas do nível ativo com o tipo dado. */
  selectAllOfType(typeId: Id): number { return transfer.ofType(this.project, useUi.getState().levelId, typeId); }
  /** "Mesmo tipo" (botão na aba Modificar). */
  selectAllOfSelectedType(): boolean { this.setTool('select'); return transfer.sameType(this.project, useUi.getState().levelId) > 0; }
  /** "Mesmo nome" dos ambientes selecionados (botão na aba Modificar). */
  selectAllOfSelectedName(): boolean { this.setTool('select'); return transfer.sameName(this.project, useUi.getState().levelId) > 0; }

  /** Ctrl+Z / Ctrl+Y no croqui da escada: desfaz ou refaz a última linha pegada. Sem pegada, vale o histórico do modelo. */
  private stairPickHistory(redo: boolean): boolean {
    const t = this.tool;
    if (!isStairTool(t)) return false;
    const done = redo ? t.redoPick() : t.undoPick();
    if (done) this.bump();
    return done;
  }

  // Com o modo de perímetro aberto, desfazer e refazer valem para o rascunho do esboço, nunca para o projeto.
  undo(): void { if (!this.perimetro.historico(false)) desfazerOuRefazer(this.store, 'undo'); }
  redo(): void { if (!this.perimetro.historico(true)) desfazerOuRefazer(this.store, 'redo'); }

  /**
   * Cotas automáticas da planta (camadas por lado: aberturas → paredes → contorno → total). As cotas entram como
   * qualquer cota manual, com `refs` nas pontas de parede (associativas e projetadas no eixo do lado).
   */
  cotasAutomaticasDaPlanta(opts: AutoCotaOptions = {}): void {
    const st = useUi.getState();
    const levelId = st.levelId;
    const plan = st.view === 'plan' && st.planKind === 'area' && st.areaPlanId ? areaPlanOf(this.store.project, st.areaPlanId) : undefined;
    const cotas = cotasAutomaticas(this.store.project, levelId, opts);
    // Na planta de área, as cotas são anotações da vista (`plan.annotations`): entram com `planId`, não no nível.
    // Todas as cotas geradas entram num só passo de desfazer (Ctrl+Z desfaz o lote inteiro).
    this.store.transaction('Cotas automáticas', () => {
      for (const dimension of cotas) this.store.exec({ type: 'addDimension', levelId, ...(plan ? { planId: plan.id } : {}), dimension });
    });
    useUi.setState({
      status: cotas.length > 0
        ? `${cotas.length} cotas automáticas criadas ${plan ? 'na planta de área' : 'no nível'}. Ctrl+Z desfaz.`
        : 'Nenhuma cota gerada: confira as camadas escolhidas e os lados com parede paralela.',
    });
  }

  selectLevel(id: Id, kind: PlanKind = 'floor', areaPlanId: Id | null = null): void {
    if (this.perimetro.bloqueiaNavegacao()) return;
    useUi.setState((s) => ({ levelId: id, planKind: kind, areaPlanId: kind === 'area' ? areaPlanId : null, selection: [], hover: null, view: 'plan', sectionId: null, previewTick: s.previewTick + 1 }));
    this.setTool('select');
  }

  setView(v: 'plan' | '3d'): void {
    if (this.perimetro.bloqueiaNavegacao()) return;
    useUi.setState((s) => ({ view: v, hover: null, typed: '', previewTick: s.previewTick + 1 }));
  }

  // ---------- arquivo ----------
  newProject(id: TemplateId): void {
    this.load(buildTemplate(id), 'projeto.hestia.json');
  }

  load(p: Project, name: string): void {
    this.perimetro.encerrar(); this.store.load(p);
    this.fileName = name;
    this.levels.clear(); this.fluxo.abrir(p, this.store.version).forEach((id) => this.resolved(id));
    void abrirComCache(this.portasAbertura, p);
    this.viewports.clear();
    // Abas de vista são da sessão: projeto novo começa só com o nível ativo, sem herdar abas do anterior.
    useUi.setState({ selection: [], levelId: p.levels[0]?.id ?? 'lv_0', view: 'plan', planKind: 'floor', areaPlanId: null, sectionId: null, openViews: defaultOpenViews(p.levels.map((l) => l.id)), options: { ...useUi.getState().options, wallTypeId: p.defaults.wallTypeId, doorTypeId: p.defaults.doorTypeId, windowTypeId: p.defaults.windowTypeId, floorTypeId: keptFloorType(p, useUi.getState().options.floorTypeId), slabTypeId: keptSlabType(p, useUi.getState().options.slabTypeId) } });
    this.setTool('select');
  }

  openFromText(text: string, name: string): { ok: true } | { ok: false; error: string } {
    try {
      this.load(migrateProject(JSON.parse(text)), name);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Arquivo inválido' };
    }
  }

  /**
   * Salva o projeto. Dentro de um artefato do claude.ai o download direto é bloqueado, então usa a
   * capacidade `downloads` (o viewer confirma). Fora dele, baixa o arquivo; em último caso copia o JSON.
   */
  async save(): Promise<void> {
    const text = JSON.stringify(this.project, null, 1);
    const name = safeFilename(`${this.project.name.trim() || 'projeto'}.hestia.json`);
    safeSet(AUTOSAVE_KEY, text);
    const entrega = await entregarArquivo({ nome: name, conteudo: text });
    if (entrega === 'salvo') {
      this.store.markSaved();
      useUi.setState({ status: `Salvo como ${name}.` });
      return;
    }
    if (entrega === 'cancelado') {
      useUi.setState({ status: 'Salvamento cancelado. O projeto continua guardado neste navegador.' });
      return;
    }
    const downloaded = entrega === 'baixado';
    this.store.markSaved();
    try {
      await navigator.clipboard.writeText(text);
      useUi.setState({ status: downloaded ? `Arquivo ${name} gerado e JSON copiado.` : 'JSON do projeto copiado para a área de transferência.' });
    } catch {
      useUi.setState({ status: downloaded ? `Arquivo ${name} gerado.` : 'Não foi possível baixar. O projeto está guardado neste navegador.' });
    }
  }

  private scheduleAutosave(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => safeSet(AUTOSAVE_KEY, JSON.stringify(this.project, null, 1)), 800);
  }

  restoreAutosave(): boolean {
    const raw = safeGet(AUTOSAVE_KEY);
    if (!raw) return false;
    try {
      this.load(migrateProject(JSON.parse(raw)), 'projeto.hestia.json');
      return true;
    } catch {
      return false;
    }
  }


}

export const editor = new Editor();

/** Reage a qualquer mudança do projeto (documento + histórico). */
export function useProjectVersion(): number {
  return useSyncExternalStore(
    (cb) => editor.store.subscribe(cb),
    () => editor.store.version,
  );
}
export const useProject = (): Project => {
  useProjectVersion();
  return editor.project;
};
