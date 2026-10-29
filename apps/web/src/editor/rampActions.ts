import { dist } from '@hestia/geom';
import { optimizeRamp, rebuildPathFromSegments, regenRamp, resolveRamps, type RampRegenPatch, type RampRegenResult } from '@hestia/engine';
import { rampBaseZ, rampTopZ, type Id, type ProjectStore, type Ramp, type StairRun } from '@hestia/model';

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

/** Grava o resultado de `regenRamp` na rampa: componentes, modo, alvo, patamar e (rampa livre) o trajeto, em UMA transação. */
export function applyRegen(store: ProjectStore, id: Id, r: RampRegenResult, label = 'Editar rampa'): void {
  store.transaction(label, () => {
    store.exec({
      type: 'updateElements',
      ids: [id],
      patch: {
        components: r.components,
        inputMode: r.inputMode,
        slopeTarget: r.slopeTarget,
        landingDepth: r.landingDepth,
        ...(r.freePath ? { freePath: r.freePath } : {}),
      },
    });
  });
}

/**
 * "Ajustar" da rampa selecionada (livre, reta, L ou U): `optimizeRamp` escolhe a inclinação e o comprimento dentro da
 * norma do tipo (ou a menor violação) e a rampa é regenerada em UMA transação "Ajustar rampa". Devolve a mensagem
 * "Ajustado: ..." ou o erro.
 */
export function adjustRamp(store: ProjectStore, id: Id): { message: string } | { error: string } {
  const p = store.project;
  const ramp = p.elements[id] as Ramp | undefined;
  if (!ramp || ramp.kind !== 'ramp') return { error: 'Rampa inexistente.' };
  const type = p.rampTypes[ramp.typeId];
  if (!type) return { error: 'Tipo de rampa inexistente' };
  const H = rampTopZ(p, ramp) - rampBaseZ(p, ramp);
  if (!(H > 0)) return { error: 'O nível de topo não fica acima da base: nada a ajustar.' };
  const free = ramp.shape === 'free' && ramp.freePath && ramp.freePath.length >= 2 ? ramp.freePath : null;
  const resolved = resolveRamps(p).find((r) => r.id === id);
  const segments = free ? free.slice(1).map((v, i) => dist(free[i]!, v)) : resolved ? [resolved.pathLength] : [];
  if (segments.length === 0) return { error: 'A rampa não tem geometria válida para ajustar.' };
  const res = optimizeRamp({
    H,
    type,
    segments,
    mode: 'auto',
    ...(ramp.slopeTarget !== null ? { slope: ramp.slopeTarget } : {}),
    turnLanding: ramp.landingDepth,
  });
  const patch: RampRegenPatch = { mode: 'slope', slope: res.slope, ...(free ? { freePath: rebuildPathFromSegments(free, res.segments) } : {}) };
  const r = regenRamp(ramp, p, patch);
  if ('error' in r) return { error: r.error };
  applyRegen(store, id, r, 'Ajustar rampa');
  return { message: res.note };
}
