import { missingText, type StairStatus } from '@hestia/tools';
import type { Id, Project, ProjectStore, Stair, StairRun } from '@hestia/model';

interface Pt {
  x: number;
  y: number;
}

export interface StairBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Pontos de referência da escada: extremos de todas as curvas (limites, espelhos, caminhada e contorno dos patamares). */
export function stairPoints(s: Stair): Pt[] {
  return s.components.flatMap((c) => {
    if (c.kind === 'landing') return c.boundary.flatMap((k) => [k.a, k.b]);
    const run: StairRun = c;
    return [...run.boundaryLeft, ...run.boundaryRight, ...run.risers, ...run.path].flatMap((k) => [k.a, k.b]);
  });
}

/** Caixa que envolve a escada em planta (para enquadrar em "Ir para"); null sem geometria. */
export function stairBox(s: Stair): StairBox | null {
  const pts = stairPoints(s);
  if (pts.length === 0) return null;
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Altera campos de uma ou mais escadas num único passo de desfazer (um `updateElements` dentro de uma transação). */
export function patchStairs(store: ProjectStore, ids: Id[], patch: Partial<Stair>, label = 'Editar escada'): void {
  if (ids.length === 0) return;
  store.transaction(label, () => {
    store.exec({ type: 'updateElements', ids, patch });
  });
}

/** Nota da barra do croqui: o 1º erro (cor de erro); sem erro, o 1º aviso; sem nada, null. */
export function stairNote(st: Pick<StairStatus, 'firstError' | 'issues'> & Partial<Pick<StairStatus, 'created' | 'remaining' | 'desired'>>): { tone: 'error' | 'warning'; text: string } | null {
  if (st.firstError) return { tone: 'error', text: st.firstError };
  // Espelhos faltando: a conta vai à barra antes do aviso de norma (Concluir não grava enquanto faltarem).
  const missing = st.created !== undefined && st.remaining !== undefined && st.desired !== undefined ? missingText({ created: st.created, remaining: st.remaining, desired: st.desired }) : null;
  if (missing) return { tone: 'warning', text: missing };
  const w = st.issues.find((i) => i.severity === 'warning');
  return w ? { tone: 'warning', text: w.message } : null;
}

/** Tipo de escada que a interface mostra: o escolhido se existir no projeto, senão o primeiro (nunca vazio). */
export function keptStairType(p: Project, current: Id | null | undefined): Id {
  if (current && p.stairTypes[current]) return current;
  return Object.keys(p.stairTypes)[0] ?? current ?? '';
}

/** Valores comuns a todas as escadas selecionadas, ou `mixed` quando divergem. */
export function commonOf<T, K>(items: T[], get: (t: T) => K): { value: K; mixed: boolean } {
  const first = get(items[0]!);
  return { value: first, mixed: items.some((x) => get(x) !== first) };
}
