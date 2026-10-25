import { safeGet, safeSet } from './storage.ts';

/**
 * Disposição dos painéis acoplados (preferência da tela, não do projeto): o Revit empilha Propriedades e Navegador de projeto à
 * esquerda; o navegador pode ir para a direita. Larguras e a divisória entre os dois painéis são guardadas no navegador.
 */
export interface DockLayout {
  /** Lado do navegador de projeto. As Propriedades ficam sempre à esquerda. */
  browserSide: 'left' | 'right';
  /** Largura do dock esquerdo e do direito, em px. */
  leftW: number;
  rightW: number;
  /** Fração da altura do dock esquerdo para as Propriedades quando os dois painéis estão nele. */
  split: number;
}

export const DOCK_KEY = 'hestia.dock';
export const DOCK_LIMITS = { minW: 250, maxW: 560, minSplit: 0.15, maxSplit: 0.85 } as const;
export const DEFAULT_DOCK: DockLayout = { browserSide: 'left', leftW: 292, rightW: 262, split: 0.52 };

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Valida cada campo: valor ausente ou fora do formato volta ao padrão, e os limites são respeitados. */
export function normalizeDock(raw: unknown): DockLayout {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof DockLayout, unknown>>;
  const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    browserSide: o.browserSide === 'right' ? 'right' : 'left',
    leftW: clamp(num(o.leftW, DEFAULT_DOCK.leftW), DOCK_LIMITS.minW, DOCK_LIMITS.maxW),
    rightW: clamp(num(o.rightW, DEFAULT_DOCK.rightW), DOCK_LIMITS.minW, DOCK_LIMITS.maxW),
    split: clamp(num(o.split, DEFAULT_DOCK.split), DOCK_LIMITS.minSplit, DOCK_LIMITS.maxSplit),
  };
}

export function loadDock(): DockLayout {
  try {
    const raw = safeGet(DOCK_KEY);
    return raw ? normalizeDock(JSON.parse(raw)) : DEFAULT_DOCK;
  } catch {
    return DEFAULT_DOCK;
  }
}

export function saveDock(d: DockLayout): void {
  safeSet(DOCK_KEY, JSON.stringify(d));
}
