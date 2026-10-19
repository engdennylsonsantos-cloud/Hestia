import { useSyncExternalStore } from 'react';
import { resolveLevel, type ResolvedLevel } from '@hestia/engine';
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
import { createTool, type PointerInfo, type Tool, type ToolEnv, type ToolId } from '@hestia/tools';
import { fitBox, levelBox, panBy, visibleGridStep, zoomAt, type Viewport } from '@hestia/render';
import { useUi } from './state.ts';

const STORAGE_KEY = 'hestia.autosave.v1';
const TUTORIAL_KEY = 'hestia.tutorial.v1';

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* armazenamento indisponível: o app segue funcionando sem autosave */
  }
}

/**
 * Controlador do editor: junta projeto (histórico), ferramenta ativa, seleção e vistas.
 * A interface só lê estado e chama ações; as regras vivem aqui e nos pacotes.
 */
export class Editor {
  readonly store = new ProjectStore(createEmptyProject());
  private tool: Tool;
  private viewports = new Map<Id, Viewport>();
  private resolveCache = new Map<Id, { project: Project; value: ResolvedLevel }>();
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
    setSelection: (ids) => useUi.setState({ selection: ids }),
    exec: (c) => this.store.exec(c),
    transaction: (l, fn) => this.store.transaction(l, fn),
    metersPerPixel: () => 1 / (this.viewport()?.zoom ?? 60),
    gridStep: () => visibleGridStep(this.viewport()?.zoom ?? 60),
    say: (m) => useUi.setState({ status: m }),
    done: () => this.setTool('select'),
    options: () => useUi.getState().options,
  };

  get project(): Project {
    return this.store.project;
  }

  // ---------- vistas ----------
  viewport(): Viewport | null {
    return this.viewports.get(useUi.getState().levelId) ?? null;
  }

  setViewport(v: Viewport): void {
    this.viewports.set(useUi.getState().levelId, v);
    useUi.setState((s) => ({ previewTick: s.previewTick + 1 }));
  }

  ensureViewport(width: number, height: number): Viewport {
    const id = useUi.getState().levelId;
    const cur = this.viewports.get(id);
    if (cur && cur.width === width && cur.height === height) return cur;
    const base: Viewport = cur ?? { cx: 5, cy: 3.5, zoom: 60, width, height };
    const v = { ...base, width, height };
    if (!cur) {
      const box = levelBox(this.project, id);
      if (box) Object.assign(v, fitBox(v, box));
    }
    this.viewports.set(id, v);
    return v;
  }

  zoomExtents(): void {
    const v = this.viewport();
    if (!v) return;
    const box = levelBox(this.project, useUi.getState().levelId);
    this.setViewport(box ? fitBox(v, box) : { ...v, cx: 5, cy: 3.5, zoom: 60 });
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

  setTool(id: ToolId): void {
    this.tool = createTool(id, this.env);
    useUi.setState({ tool: id, typed: '', prompt: null, hover: null });
    this.tool.start();
    this.bump();
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
    if (mod && (k === 'z' || k === 'Z')) {
      if (e.shiftKey) this.redo();
      else this.undo();
      return true;
    }
    if (mod && (k === 'y' || k === 'Y')) {
      this.redo();
      return true;
    }
    if (mod && (k === 's' || k === 'S')) {
      this.save();
      return true;
    }
    if (mod) return false;
    if (ui.view === '3d') return false;
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
      if (ui.selection.length) {
        this.deleteSelection();
        return true;
      }
    }
    if (k === 'Tab') {
      this.tool.tab();
      this.bump();
      return true;
    }
    if (this.tool.inputPrompt() && /^[0-9.,+\-*/()]$/.test(k)) {
      useUi.setState({ typed: ui.typed + k });
      return true;
    }
    if (k === ' ' && (this.tool.id === 'door' || this.tool.id === 'window')) {
      (this.tool as unknown as { flipHandToggle?: () => void }).flipHandToggle?.();
      return true;
    }
    const map: Record<string, ToolId> = { v: 'select', w: 'wall', d: 'door', j: 'window', m: 'move', c: 'copy', r: 'rotate', s: 'mirror', a: 'array', o: 'offset', t: 'trim', l: 'align', n: 'joins', p: 'split', e: 'measure' };
    const id = map[k.toLowerCase()];
    if (id && !e.altKey) {
      this.setTool(id);
      return true;
    }
    if (k === 'F' || k === 'f') return false;
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
  }

  deleteSelection(): void {
    const ids = useUi.getState().selection;
    if (!ids.length) return;
    this.store.exec({ type: 'deleteElements', ids });
    useUi.setState({ selection: [], status: 'Elementos excluídos.' });
  }

  undo(): void {
    this.store.undo();
  }
  redo(): void {
    this.store.redo();
  }

  selectLevel(id: Id): void {
    useUi.setState({ levelId: id, selection: [], hover: null, view: 'plan' });
    this.setTool('select');
  }

  setView(v: 'plan' | '3d'): void {
    useUi.setState({ view: v });
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
    useUi.setState({ selection: [], levelId: p.levels[0]?.id ?? 'lv_0', view: 'plan', options: { ...useUi.getState().options, wallTypeId: p.defaults.wallTypeId, doorTypeId: p.defaults.doorTypeId, windowTypeId: p.defaults.windowTypeId } });
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
