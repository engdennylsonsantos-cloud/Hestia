import { useSyncExternalStore } from 'react';
import { computeSection, resolveLevel, type ResolvedLevel, type SectionResult } from '@hestia/engine';
import {
  ProjectStore,
  buildTemplate,
  createEmptyProject,
  isOpening,
  isWall,
  migrateProject,
  newId,
  type Id,
  type Project,
  type TemplateId,
} from '@hestia/model';
import { createTool, isStairTool, type PointerInfo, type Tool, type ToolEnv, type ToolId } from '@hestia/tools';
import { transfer } from './transfer.ts';
import { keptFloorType } from './typeActions.ts';
import { keptSlabType } from './slabTypeActions.ts';
import { safeGet, safeSet } from './storage.ts';
import { fitBox, levelBox, panBy, sectionBox, visibleGridStep, zoomAt, type Viewport } from '@hestia/render';
import { key3d, useUi } from './state.ts';
import { toolForKey } from './toolKeys.ts';
import { elevationCommand, type PlanBox } from './elevations.ts';
import { deleteSelectionIn } from './deleteIds.ts';

const STORAGE_KEY = 'hestia.autosave.v1';
const TUTORIAL_KEY = 'hestia.tutorial.v1';

/**
 * Controlador do editor: junta projeto (histórico), ferramenta ativa, seleção e vistas.
 * A interface só lê estado e chama ações; as regras vivem aqui e nos pacotes.
 */
export class Editor {
  readonly store = new ProjectStore(createEmptyProject());
  private tool: Tool;
  private viewports = new Map<Id, Viewport>();
  private resolveCache = new Map<Id, { project: Project; value: ResolvedLevel }>();
  private sectionCache = new Map<Id, { project: Project; value: SectionResult }>();
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  fileName = 'projeto.hestia.json';

  constructor() {
    this.tool = createTool('select', this.env);
    this.store.subscribe(() => {
      this.pruneSelection();
      this.scheduleAutosave();
      useUi.setState((s) => ({ previewTick: s.previewTick + 1 }));
    });
  }

  // ---------- ambiente entregue às ferramentas ----------
  private env: ToolEnv = {
    project: () => this.store.project,
    levelId: () => useUi.getState().levelId,
    selection: () => useUi.getState().selection,
    setSelection: (ids) => useUi.setState({ selection: ids, roofEdge: ids.length === 1 && useUi.getState().roofEdge?.roofId === ids[0] ? useUi.getState().roofEdge : null }),
    exec: (c) => this.store.exec(c),
    transaction: (l, fn) => this.store.transaction(l, fn),
    metersPerPixel: () => 1 / (this.viewport()?.zoom ?? 60),
    gridStep: () => visibleGridStep(this.viewport()?.zoom ?? 60),
    say: (m) => useUi.setState({ status: m }),
    done: () => this.setTool('select'),
    options: () => useUi.getState().options,
    roofEdge: () => useUi.getState().roofEdge, setRoofEdge: (sel) => useUi.setState({ roofEdge: sel }),
  };

  get project(): Project {
    return this.store.project;
  }

  // ---------- vistas ----------
  /** Chave do viewport: cada planta tem o seu; cada corte ou elevação tem o próprio. */
  private viewKey(): Id {
    const st = useUi.getState();
    return st.view === 'section' ? `sec:${st.sectionId}` : st.levelId;
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
    return levelBox(this.project, st.levelId);
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
    const value = computeSection(this.project, { a: view.a, b: view.b, depth: view.depth });
    this.sectionCache.set(id, { project: this.project, value });
    return value;
  }

  zoomWheel(screen: { x: number; y: number }, deltaY: number): void {
    const v = this.viewport();
    if (v) this.setViewport(zoomAt(v, screen, Math.exp(-deltaY * 0.0015)));
  }

  pan(dx: number, dy: number): void {
    const v = this.viewport();
    if (v) this.setViewport(panBy(v, dx, dy));
  }

  resolved(levelId: Id): ResolvedLevel {
    const hit = this.resolveCache.get(levelId);
    if (hit && hit.project === this.project) return hit.value;
    const value = resolveLevel(this.project, levelId);
    this.resolveCache.set(levelId, { project: this.project, value });
    return value;
  }

  // ---------- ferramentas ----------
  get activeTool(): Tool {
    return this.tool;
  }

  private activate(id: ToolId): void {
    this.tool = createTool(id, this.env);
    useUi.setState({ tool: id, typed: '', prompt: null, hover: null });
    this.tool.start();
    this.bump();
  }

  setTool(id: ToolId): void {
    // Ferramentas de desenho são da planta: escolher uma delas na vista de corte volta à planta.
    if (useUi.getState().view === 'section') useUi.setState({ view: 'plan', sectionId: null });
    this.activate(id);
  }

  bump(): void {
    useUi.setState((s) => ({ previewTick: s.previewTick + 1, prompt: this.tool.inputPrompt() }));
  }

  pointer(kind: 'move' | 'down' | 'drag' | 'up' | 'click', info: PointerInfo): void {
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
    if (mod && ui.view === 'plan' && /^[cv]$/i.test(k)) return k.toLowerCase() === 'c' ? this.copySelection() : this.pasteAligned(ui.levelId);
    if (mod) return false;
    if (ui.view === 'section') {
      if (k === 'Escape') {
        this.closeSection();
        return true;
      }
      // Delete e Backspace excluem a seleção, como na 3D (decisão 0016 §5).
      return key3d(k, ui.selection, () => this.deleteSelection());
    }
    if (ui.view === '3d') return key3d(k, ui.selection, () => this.deleteSelection());
    if (k === 'Escape') {
      if (ui.typed) useUi.setState({ typed: '' });
      else this.tool.cancel();
      this.bump();
      return true;
    }
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
      if (ui.selection.length) { this.deleteSelection(); return true; }
    }
    if (k === 'Tab') {
      this.tool.tab();
      this.bump();
      return true;
    }
    // Campo numérico: dígitos e operadores; ferramenta de texto (freeText): qualquer tecla digitável.
    if (this.tool.inputPrompt() && (this.tool.freeText ? k.length === 1 : /^[0-9.,+\-*/()]$/.test(k))) {
      useUi.setState({ typed: ui.typed + k });
      return true;
    }
    if (k === ' ' && (this.tool.id === 'door' || this.tool.id === 'window')) {
      (this.tool as unknown as { flipHandToggle?: () => void }).flipHandToggle?.();
      return true;
    }
    const id = toolForKey(k);
    if (id && !e.altKey) {
      this.setTool(id);
      return true;
    }
    return false;
  }

  // ---------- seleção e edição ----------
  private pruneSelection(): void {
    const sel = useUi.getState().selection;
    const p = this.store.project;
    const keep = sel.filter((id) => p.elements[id]);
    if (keep.length !== sel.length) useUi.setState({ selection: keep });
    const lv = useUi.getState().levelId;
    if (!p.levels.some((l) => l.id === lv)) useUi.setState({ levelId: p.levels[0]?.id ?? 'lv_0' });
    const st = useUi.getState();
    if (st.view === 'section' && !p.views.some((v) => v.id === st.sectionId)) useUi.setState({ view: 'plan', sectionId: null });
  }

  // ---------- cortes e elevações ----------
  /** Abre um corte ou elevação na área central, com viewport próprio. */
  openSection(id: Id): void {
    if (!this.project.views.some((v) => v.id === id)) return;
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

  renameView(id: Id, name: string): boolean {
    const clean = name.trim();
    if (!clean) return false;
    this.store.exec({ type: 'updateView', id, patch: { name: clean } });
    return true;
  }

  deleteView(id: Id): void {
    const v = this.project.views.find((x) => x.id === id);
    if (!v) return;
    this.store.exec({ type: 'deleteView', id });
    useUi.setState({ status: `${v.name} excluído. Ctrl+Z desfaz.` });
  }

  /** Gera (ou atualiza) as quatro elevações do nível ativo, em um único passo de desfazer. */
  generateElevations(): void {
    const box = levelBox(this.project, useUi.getState().levelId);
    if (!box) {
      useUi.setState({ status: 'Não há paredes neste nível para gerar elevações.' });
      return;
    }
    this.store.exec(elevationCommand(this.project.views, box, newId), 'Gerar elevações');
    useUi.setState({ status: 'Elevações Norte, Sul, Leste e Oeste geradas. Ctrl+Z desfaz.' });
  }

  deleteSelection(): void {
    deleteSelectionIn(this.store);
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

  undo(): void {
    this.store.undo();
  }
  redo(): void {
    this.store.redo();
  }

  selectLevel(id: Id): void {
    useUi.setState({ levelId: id, selection: [], hover: null, view: 'plan', sectionId: null });
    this.setTool('select');
  }

  setView(v: 'plan' | '3d'): void {
    useUi.setState({ view: v, hover: null });
  }

  // ---------- arquivo ----------
  newProject(id: TemplateId): void {
    this.load(buildTemplate(id), 'projeto.hestia.json');
  }

  load(p: Project, name: string): void {
    this.store.load(p);
    this.fileName = name;
    this.resolveCache.clear();
    this.viewports.clear();
    useUi.setState({ selection: [], levelId: p.levels[0]?.id ?? 'lv_0', view: 'plan', sectionId: null, options: { ...useUi.getState().options, wallTypeId: p.defaults.wallTypeId, doorTypeId: p.defaults.doorTypeId, windowTypeId: p.defaults.windowTypeId, floorTypeId: keptFloorType(p, useUi.getState().options.floorTypeId), slabTypeId: keptSlabType(p, useUi.getState().options.slabTypeId) } });
    this.setTool('select');
  }

  serialize(): string {
    return JSON.stringify(this.project, null, 1);
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
    const text = this.serialize();
    const name = `${this.project.name.replace(/[^\w\- ]+/g, '').trim() || 'projeto'}.hestia.json`;
    safeSet(STORAGE_KEY, text);
    type Dl = { save(r: { filename: string; data: string }): Promise<unknown> };
    const host = (window as unknown as { claude?: { use?: (n: string) => Promise<Dl | null> } }).claude;
    if (host?.use) {
      try {
        const dl = await host.use('downloads');
        if (dl) {
          await dl.save({ filename: name, data: text });
          this.store.markSaved();
          useUi.setState({ status: `Salvo como ${name}.` });
          return;
        }
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'declined') {
          useUi.setState({ status: 'Salvamento cancelado. O projeto continua guardado neste navegador.' });
          return;
        }
      }
    }
    let downloaded = false;
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      downloaded = true;
    } catch {
      downloaded = false;
    }
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
    this.autosaveTimer = setTimeout(() => safeSet(STORAGE_KEY, this.serialize()), 800);
  }

  restoreAutosave(): boolean {
    const raw = safeGet(STORAGE_KEY);
    if (!raw) return false;
    try {
      this.load(migrateProject(JSON.parse(raw)), 'projeto.hestia.json');
      return true;
    } catch {
      return false;
    }
  }

  hasAutosave(): boolean {
    return safeGet(STORAGE_KEY) !== null;
  }

  tutorialSeen(): boolean {
    return safeGet(TUTORIAL_KEY) === '1';
  }
  markTutorialSeen(): void {
    safeSet(TUTORIAL_KEY, '1');
  }

  // ---------- consultas úteis para a UI ----------
  selectedWalls(): Id[] {
    return useUi.getState().selection.filter((id) => isWall(this.project.elements[id]));
  }
  selectedOpenings(): Id[] {
    return useUi.getState().selection.filter((id) => isOpening(this.project.elements[id]));
  }

  newTypeId(prefix: string): string {
    return newId(prefix);
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
