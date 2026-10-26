import { safeGet, safeSet } from './storage.ts';

/**
 * Disposição dos painéis acoplados (preferência da tela, não do projeto). Propriedades e Navegador de projeto podem ir
 * para o dock esquerdo ou o direito, e os dois podem ficar no mesmo dock. Por padrão, os dois ficam à esquerda com as
 * Propriedades em cima (como no Revit). Larguras, divisórias e a ordem são guardadas no navegador.
 */
export type DockSide = 'left' | 'right';
export type DockPanel = 'props' | 'browser';
export type OpenPanels = Record<DockPanel, boolean>;

export interface DockLayout {
  /** Dock de cada painel. */
  sides: { props: DockSide; browser: DockSide };
  /** Painel de cima quando os dois estão no mesmo dock. */
  first: DockPanel;
  /** Largura do dock esquerdo e do direito, em px. */
  leftW: number;
  rightW: number;
  /** Fração da altura do dock que o painel de cima ocupa quando os dois estão nele. */
  split: number;
}

export const DOCK_KEY = 'hestia.dock';
export const DOCK_LIMITS = { minW: 250, maxW: 560, minSplit: 0.15, maxSplit: 0.85 } as const;
export const DEFAULT_DOCK: DockLayout = {
  sides: { props: 'left', browser: 'left' },
  first: 'props',
  leftW: 292,
  rightW: 262,
  split: 0.52,
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const side = (v: unknown, d: DockSide): DockSide => (v === 'left' || v === 'right' ? v : d);

/**
 * Valida o que veio do navegador. Lixo (não é objeto, lado inválido, número inválido) volta ao padrão de cada campo; os
 * limites de largura e de divisória são sempre respeitados. Aceita o formato antigo (`browserSide`, propriedades sempre
 * à esquerda) e converte para o novo.
 */
export function normalizeDock(raw: unknown): DockLayout {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_DOCK, sides: { ...DEFAULT_DOCK.sides } };
  const o = raw as Record<string, unknown>;
  const s = typeof o.sides === 'object' && o.sides !== null ? (o.sides as Record<string, unknown>) : null;
  // Formato antigo: só o navegador trocava de lado e as Propriedades ficavam em cima do dock esquerdo.
  const sides: DockLayout['sides'] = s
    ? { props: side(s.props, 'left'), browser: side(s.browser, 'left') }
    : { props: 'left', browser: side(o.browserSide, 'left') };
  return {
    sides,
    first: o.first === 'browser' ? 'browser' : 'props',
    leftW: clamp(num(o.leftW, DEFAULT_DOCK.leftW), DOCK_LIMITS.minW, DOCK_LIMITS.maxW),
    rightW: clamp(num(o.rightW, DEFAULT_DOCK.rightW), DOCK_LIMITS.minW, DOCK_LIMITS.maxW),
    split: clamp(num(o.split, DEFAULT_DOCK.split), DOCK_LIMITS.minSplit, DOCK_LIMITS.maxSplit),
  };
}

/** Painéis abertos num dock, de cima para baixo: o `first` fica em cima quando os dois estão nele. */
export function dockPanels(d: DockLayout, dock: DockSide, open: OpenPanels): DockPanel[] {
  const order: DockPanel[] = d.first === 'browser' ? ['browser', 'props'] : ['props', 'browser'];
  return order.filter((p) => open[p] && d.sides[p] === dock);
}

/** Largura de cada dock (0 quando não tem painel aberto), para a grade da área de trabalho. */
export function dockWidths(propsOpen: boolean, browserOpen: boolean, d: DockLayout): { left: number; right: number } {
  const open: OpenPanels = { props: propsOpen, browser: browserOpen };
  return {
    left: dockPanels(d, 'left', open).length > 0 ? d.leftW : 0,
    right: dockPanels(d, 'right', open).length > 0 ? d.rightW : 0,
  };
}

export function loadDock(): DockLayout {
  try {
    const raw = safeGet(DOCK_KEY);
    return raw ? normalizeDock(JSON.parse(raw)) : normalizeDock(null);
  } catch {
    return normalizeDock(null);
  }
}

export function saveDock(d: DockLayout): void {
  safeSet(DOCK_KEY, JSON.stringify(d));
}
