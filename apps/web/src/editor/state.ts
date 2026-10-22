import { create } from 'zustand';
import type { Id, LocationLine } from '@hestia/model';
import type { Backend } from '@hestia/render';
import { DEFAULT_SNAP, DEFAULT_STAIR_RUN_OPTIONS, type RoofEdgeSel, type SnapOptions, type ToolId, type ToolOptions } from '@hestia/tools';
import { safeGet, safeSet } from './storage.ts';
import { selectionAfterClick } from './selectionClick.ts';

export type ViewKind = 'plan' | '3d' | 'section';
export type ThemePref = 'system' | 'light' | 'dark';
export type DialogKind = 'wallType' | 'floorType' | 'materials' | 'levels' | 'openingType' | 'start' | 'shortcuts' | 'about' | 'schedule' | 'floorSchedule' | 'slabType' | 'slabSchedule' | 'roofType' | 'roofSchedule' | 'stairType' | 'stairSchedule' | 'roomSchedule' | 'openingSchedule' | 'graphicsVisibility' | 'lineWeights' | null;

export interface UiState {
  tool: ToolId;
  view: ViewKind;
  levelId: Id;
  /** Vista de corte ou elevação aberta quando `view` é 'section'. */
  sectionId: Id | null;
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
  /** Projeção tracejada do contorno da cobertura acima do corte (opção da planta, decisão 0013 §2). */
  showRoofProjection: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  tutorial: boolean;
  /** Incrementa quando a pré-visualização da ferramenta muda (força novo desenho). */
  previewTick: number;
  cursor: { x: number; y: number } | null;
  snapKind: string;
  seen3d: boolean;
  ribbon: 'arquitetura' | 'modificar' | 'vista';
  /** Aresta de telhado escolhida na planta (seção "Aresta N" em Propriedades). */
  roofEdge: RoofEdgeSel | null;
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
  useUi.setState({ selection: next, roofEdge: next.length === 1 && ui.roofEdge?.roofId === next[0] ? ui.roofEdge : null });
}

/**
 * Teclas de seleção nas vistas 3D e de corte (sem ferramentas de desenho, decisão 0016 §5): Esc limpa a seleção; Delete e Backspace a excluem
 * por `remove`. Devolve se a tecla foi consumida (sem seleção, nada é consumido).
 */
export function key3d(k: string, selection: readonly Id[], remove: () => void): boolean {
  if (!selection.length || !['Escape', 'Delete', 'Backspace'].includes(k)) return false;
  if (k === 'Escape') clickSelect3d(null, false);
  else remove();
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
  orthoLock: false,
  arrayCount: 3,
  offsetDistance: 1,
  rotateCopy: false,
  mirrorCopy: true,
  offsetCopy: true,
  floorTypeId: 'ft_ceram',
  floorOffset: 0,
  floorMode: 'poly',
  slabTypeId: 'ls_mac12',
  slabOffset: 0,
  slabMode: 'poly',
  slabSlopePercent: 2,
  roofTypeId: 'rt_ceramica',
  roofMode: 'poly',
  roofShape: 'gable',
  roofSlope: 30,
  roofOverhang: 0.5,
  roofOffset: null,
  stair: { primitive: 'line', baseOffset: 0, topOffset: 0, height: 2.8, topLevelId: null },
  stairRun: DEFAULT_STAIR_RUN_OPTIONS,
};

export const useUi = create<UiState>(() => ({
  tool: 'select',
  view: 'plan',
  levelId: 'lv_0',
  sectionId: null,
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
  showRoofProjection: readRoofProjection(),
  leftOpen: typeof window === 'undefined' || window.innerWidth > 900,
  rightOpen: typeof window === 'undefined' || window.innerWidth > 900,
  tutorial: false,
  previewTick: 0,
  cursor: null,
  snapKind: '',
  seen3d: false,
  ribbon: 'arquitetura',
  roofEdge: null,
}));
