import { create } from 'zustand';
import type { Id, LocationLine } from '@hestia/model';
import type { Backend } from '@hestia/render';
import { DEFAULT_SNAP, type RoofEdgeSel, type SnapOptions, type ToolId, type ToolOptions } from '@hestia/tools';

export type ViewKind = 'plan' | '3d' | 'section';
export type ThemePref = 'system' | 'light' | 'dark';
export type DialogKind = 'wallType' | 'floorType' | 'materials' | 'levels' | 'openingType' | 'start' | 'shortcuts' | 'about' | 'schedule' | 'floorSchedule' | 'slabType' | 'slabSchedule' | 'roofType' | 'roofSchedule' | null;

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
  shadows: boolean;
  edges: boolean;
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
  shadows: true,
  edges: true,
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
