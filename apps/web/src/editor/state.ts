import { create } from 'zustand';
import type { Id, LocationLine } from '@hestia/model';
import type { Backend } from '@hestia/render';
import { DEFAULT_DISJOIN, DEFAULT_SNAP, DEFAULT_STAIR_RUN_OPTIONS, type SnapOptions, type ToolId, type ToolOptions } from '@hestia/tools';
import { safeGet, safeSet } from './storage.ts';
import { selectionAfterClick } from './selectionClick.ts';
import { activeViewOf, addView, type OpenView } from './openViews.ts';
import type { RibbonTabId } from '../ui/ribbon/model.ts';
import { loadDock, type DockLayout } from './dockLayout.ts';

export type ViewKind = 'plan' | '3d' | 'section' | 'sheet';
export type ThemePref = 'system' | 'light' | 'dark';
export type DialogKind = 'wallType' | 'floorType' | 'materials' | 'levels' | 'openingType' | 'start' | 'shortcuts' | 'shortcutsConfig' | 'about' | 'schedule' | 'floorSchedule' | 'slabType' | 'slabSchedule' | 'ceilingType' | 'ceilingSchedule' | 'roofType' | 'roofSchedule' | 'stairType' | 'stairSchedule' | 'openingSchedule' | 'graphicsVisibility' | 'lineWeights' | 'sheet' | 'addView' | 'roomSchedule' | 'cotasAuto' | 'moveLevel' | null;

export interface UiState {
  tool: ToolId;
  view: ViewKind;
  levelId: Id;
  /** Vista de corte ou elevação aberta quando `view` é 'section'. */
  sectionId: Id | null;
  /** Prancha aberta quando `view` é 'sheet' (decisão 0022). */
  sheetId: Id | null;
  selection: Id[];
  hover: Id | null;
  options: ToolOptions;
  theme: ThemePref;
  gpu: Backend | 'cpu' | 'pending';
  status: string;
  typed: string;
  prompt: string | null;
  dialog: DialogKind;
  dialogArg: string | null;
  showGrid: boolean;
  showUnderlay: boolean;
  /** Pavimento de referência escolhido nas propriedades da vista (null = o de baixo). */
  underlayLevel: string | null;
  /** Projeção tracejada do contorno da cobertura acima do corte (opção da planta, decisão 0013 §2). */
  showRoofProjection: boolean;
  /** Paleta de propriedades e navegador de projeto abertos. */
  propsOpen: boolean;
  browserOpen: boolean;
  /** Disposição dos painéis acoplados (lado do navegador, larguras, divisória). */
  dock: DockLayout;
  tutorial: boolean;
  /** Incrementa quando a pré-visualização da ferramenta muda (força novo desenho). */
  previewTick: number;
  cursor: { x: number; y: number } | null;
  snapKind: string;
  seen3d: boolean;
  /** Aba da faixa escolhida; 'ctx' é a aba contextual verde. */
  ribbon: RibbonTabId;
  /** Aba de antes da contextual: volta para ela quando a contextual some. */
  ribbonBack: RibbonTabId;
  /** Menu Arquivo aberto (aba Arquivo da faixa). */
  fileMenu: boolean;
  /**
   * Vistas abertas na barra, na ordem das abas (sessão, não vai para o projeto). A vista ativa é sempre uma delas:
   * `view`/`levelId`/`sectionId`/`sheetId` continuam sendo a fonte da vista ativa, e esta lista é sincronizada com eles.
   */
  openViews: OpenView[];
}

const SNAP_KEY = 'hestia.snap';
const SNAP_FLAGS = Object.keys(DEFAULT_SNAP) as Array<keyof SnapOptions>;

/** Capturas guardadas no navegador (preferência da tela, não do projeto). Sem armazenamento ou dado inválido: padrão. */
function loadSnap(): SnapOptions {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return DEFAULT_SNAP;
    const saved = JSON.parse(raw) as Partial<Record<keyof SnapOptions, unknown>>;
    const out: SnapOptions = { ...DEFAULT_SNAP };
    for (const k of SNAP_FLAGS) {
      const v = saved[k];
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  } catch {
    return DEFAULT_SNAP;
  }
}

/** Altera capturas (em parte ou todas) e guarda no navegador para sobreviver ao recarregamento. */
export function setSnap(patch: Partial<SnapOptions>): void {
  const snap: SnapOptions = { ...(useUi.getState().options.snap ?? DEFAULT_SNAP), ...patch };
  useUi.setState((s) => ({ options: { ...s.options, snap } }));
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(snap));
  } catch {
    // Armazenamento indisponível (janela privada, dados bloqueados): a captura vale só nesta sessão.
  }
}

/**
 * Projeção tracejada da cobertura acima do corte (decisão 0013 §2): preferência da tela, não do projeto, como a captura.
 * Guardada no navegador; sem armazenamento ou valor inválido, vale ligada (padrão).
 */
export const ROOF_PROJECTION_KEY = 'hestia.roofProjection';

/** Lê a preferência guardada. Ausente, inválida ou armazenamento indisponível: ligada. */
export function readRoofProjection(): boolean {
  return safeGet(ROOF_PROJECTION_KEY) !== 'false';
}

/** Liga ou desliga a projeção da cobertura e guarda a escolha. Sem armazenamento, vale só nesta sessão. */
export function setRoofProjection(on: boolean): void {
  useUi.setState({ showRoofProjection: on });
  safeSet(ROOF_PROJECTION_KEY, on ? 'true' : 'false');
}

/** Alterna a projeção da cobertura (alternador da faixa, aba Vista, e a caixa de Propriedades usam o mesmo estado). */
export function toggleRoofProjection(): void {
  setRoofProjection(!useUi.getState().showRoofProjection);
}

/**
 * Clique na vista 3D (sem arrasto, decisão 0016 §3): o elemento sob o cursor vai para a seleção comum (planta, árvore e
 * propriedades). `hit` null é o vazio. Com `additive` (Shift/Ctrl), entra ou sai da seleção.
 */
export function clickSelect3d(hit: Id | null, additive: boolean): void {
  const ui = useUi.getState();
  const next = selectionAfterClick(ui.selection, hit, additive);
  useUi.setState({ selection: next });
}

/**
 * Teclas de exclusão nas vistas 3D e de corte (decisão 0016 §5): Delete e Backspace excluem a seleção por `remove`.
 * Esc não passa por aqui: segue o da planta no controlador. Devolve se a tecla foi consumida (sem seleção, nada é consumido).
 */
export function key3d(k: string, selection: readonly Id[], remove: () => void): boolean {
  if (!selection.length || !['Delete', 'Backspace'].includes(k)) return false;
  remove();
  return true;
}

export const DEFAULT_OPTIONS: ToolOptions = {
  snap: loadSnap(),
  wallTypeId: 'wt_alv14',
  locationLine: 'wallCenter' as LocationLine,
  wallHeight: 2.8,
  chain: true,
  wallShape: 'line',
  doorTypeId: 'ot_p80',
  windowTypeId: 'ot_j120',
  openingFacingMode: 'cursor',
  openingToward: 'cursor',
  openingAnchor: 'center',
  openingClear: 0.1,
  openingDimMode: 'axis',
  orthoLock: false,
  arrayCount: 3,
  arrayKind: 'linear',
  arrayAngle: 360,
  arrayAnchor: 'second',
  alignPrefer: 'faces',
  offsetDistance: 1,
  trimMode: 'unico',
  rotateCopy: false,
  mirrorCopy: true,
  offsetCopy: true,
  moveDisjoin: DEFAULT_DISJOIN.move,
  rotateDisjoin: DEFAULT_DISJOIN.rotate,
  mirrorDisjoin: DEFAULT_DISJOIN.mirror,
  floorTypeId: 'ft_ceram',
  floorOffset: 0,
  floorMode: 'poly',
  slabTypeId: 'ls_mac12',
  slabOffset: 0,
  slabMode: 'poly',
  slabSlopePercent: 2,
  ceilingTypeId: 'ct_gesso',
  ceilingOffset: 2.6,
  ceilingMode: 'poly',
  roofTypeId: 'rt_ceramica',
  roofShape: 'edges',
  roofSlope: 30,
  roofOverhang: 0.5,
  roofOffset: null,
  stair: { primitive: 'line', baseOffset: 0, topOffset: 0, height: 2.8, topLevelId: null },
  stairRun: DEFAULT_STAIR_RUN_OPTIONS,
};

/**
 * Padrão ao abrir o projeto (decisão a confirmar): só o nível ativo fica aberto. Ver o relatório da frente D.
 * Para mudar para "todos os níveis", troque esta constante por uma lista com todas as plantas (ou calcule-a ao carregar).
 */
export const DEFAULT_OPEN_VIEWS: OpenView[] = [{ kind: 'plan', levelId: 'lv_0' }];

export const useUi = create<UiState>(() => ({
  tool: 'select',
  view: 'plan',
  levelId: 'lv_0',
  sectionId: null,
  sheetId: null,
  selection: [],
  hover: null,
  options: DEFAULT_OPTIONS,
  theme: 'system',
  gpu: 'pending',
  status: 'Pronto.',
  typed: '',
  prompt: null,
  dialog: null,
  dialogArg: null,
  showGrid: true,
  showUnderlay: true,
  underlayLevel: null,
  showRoofProjection: readRoofProjection(),
  propsOpen: typeof window === 'undefined' || window.innerWidth > 900,
  browserOpen: typeof window === 'undefined' || window.innerWidth > 900,
  dock: loadDock(),
  tutorial: false,
  previewTick: 0,
  cursor: null,
  snapKind: '',
  seen3d: false,
  ribbon: 'arquitetura',
  ribbonBack: 'arquitetura',
  fileMenu: false,
  openViews: DEFAULT_OPEN_VIEWS.map((v) => ({ ...v })),
}));

/**
 * Toda vista ativa entra na lista de vistas abertas (abrir um nível já aberto só ativa, pois `addView` não duplica).
 * Assim, qualquer caminho que muda a vista (árvore, ribbon, corte, prancha, ferramenta de planta) abre a aba sem
 * precisar de cada chamador. O fechamento é feito por `closeView` (ver ViewTabs em ui/ViewTabs.tsx).
 */
useUi.subscribe((s, prev) => {
  if (s.view === prev.view && s.levelId === prev.levelId && s.sectionId === prev.sectionId && s.sheetId === prev.sheetId) return;
  const active = activeViewOf(s);
  if (!active) return;
  const next = addView(s.openViews, active);
  if (next !== s.openViews) useUi.setState({ openViews: next });
});
