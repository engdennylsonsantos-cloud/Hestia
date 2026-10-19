import { create } from 'zustand';
import type { Id, LocationLine } from '@hestia/model';
import type { Backend } from '@hestia/render';
import type { ToolId, ToolOptions } from '@hestia/tools';

export type ViewKind = 'plan' | '3d';
export type ThemePref = 'system' | 'light' | 'dark';
export type DialogKind = 'wallType' | 'materials' | 'levels' | 'openingType' | 'start' | 'shortcuts' | 'about' | 'schedule' | null;

export interface UiState {
  tool: ToolId;
  view: ViewKind;
  levelId: Id;
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
}

export const DEFAULT_OPTIONS: ToolOptions = {
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
};

export const useUi = create<UiState>(() => ({
  tool: 'select',
  view: 'plan',
  levelId: 'lv_0',
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
}));
