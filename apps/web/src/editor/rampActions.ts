import type { Id, ProjectStore, Ramp, StairRun } from '@hestia/model';

interface Pt {
  x: number;
  y: number;
}

export interface RampBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Pontos de referência da rampa: extremos de todas as curvas (limites, espelhos, caminhada e contorno dos patamares). */
export function rampPoints(r: Ramp): Pt[] {
  return r.components.flatMap((c) => {
    if (c.kind === 'landing') return c.boundary.flatMap((k) => [k.a, k.b]);
    const run: StairRun = c;
    return [...run.boundaryLeft, ...run.boundaryRight, ...run.risers, ...run.path].flatMap((k) => [k.a, k.b]);
  });
}

/** Caixa que envolve a rampa em planta (para enquadrar em "Ir para"); null sem geometria. */
export function rampBox(r: Ramp): RampBox | null {
  const pts = rampPoints(r);
  if (pts.length === 0) return null;
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Altera campos de uma ou mais rampas num único passo de desfazer (um `updateElements` dentro de uma transação). */
export function patchRamps(store: ProjectStore, ids: Id[], patch: Partial<Ramp>, label = 'Editar rampa'): void {
  if (ids.length === 0) return;
  store.transaction(label, () => {
    store.exec({ type: 'updateElements', ids, patch });
  });
}
