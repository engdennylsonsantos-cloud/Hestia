import type { MultiPolygon, Ring } from '@hestia/geom';
import { coreRange, type OpeningType, type WallType, type WrapMode } from '@hestia/model';
import { pointAt, type WallFrame } from './frame.ts';

export type Side = 'exterior' | 'interior';

export interface Wrapper {
  index: number;
  /** Soma das espessuras das camadas "envolventes" entre esta e o núcleo. */
  off: number;
  thickness: number;
}

/** Camadas que envolvem de um lado, do núcleo para fora (as mais próximas do núcleo ficam coladas nele). */
export function wrappingLayers(type: WallType, side: Side): Wrapper[] {
  const core = coreRange(type);
  const out: Wrapper[] = [];
  let off = 0;
  const visit = (i: number): void => {
    const l = type.layers[i]!;
    if (!l.wraps || l.thickness < 1e-6) return;
    out.push({ index: i, off, thickness: l.thickness });
    off += l.thickness;
  };
  if (side === 'exterior') for (let i = core.first - 1; i >= 0; i--) visit(i);
  else for (let i = core.last + 1; i < type.layers.length; i++) visit(i);
  return out;
}

export const sidesOf = (m: WrapMode): Side[] => (m === 'both' ? ['exterior', 'interior'] : m === 'none' ? [] : [m]);

/** Fechamento efetivo do vão: a família da abertura substitui o tipo de parede (Revit: Wall Closure). */
export const insertMode = (wt: WallType, ot: OpeningType): WrapMode => (ot.closure === 'inherit' ? wt.wrapInserts : ot.closure);

/** Faixa de s (profundidade na parede) coberta pelo retorno de um lado. */
function depthRange(f: WallFrame, side: Side, both: boolean): [number, number] {
  const ext = f.sExt;
  const int = f.sInt;
  if (!both) return [Math.min(ext, int), Math.max(ext, int)];
  const [a, b] = side === 'exterior' ? [f.sMid, ext] : [int, f.sMid];
  return [Math.min(a, b), Math.max(a, b)];
}

function rect(f: WallFrame, t0: number, t1: number, s0: number, s1: number): Ring {
  return [pointAt(f, t0, s0), pointAt(f, t1, s0), pointAt(f, t1, s1), pointAt(f, t0, s1)];
}

export interface LayerReturn {
  layerIndex: number;
  poly: MultiPolygon;
}

/** Retornos de acabamento nos dois cantos de um vão (planta). */
export function insertReturns(f: WallFrame, offset: number, width: number, mode: WrapMode): LayerReturn[] {
  const sides = sidesOf(mode);
  const out: LayerReturn[] = [];
  for (const side of sides) {
    const [s0, s1] = depthRange(f, side, sides.length === 2);
    for (const w of wrappingLayers(f.type, side)) {
      if (w.off + w.thickness >= width / 2 - 1e-3) continue; // não cabe no vão
      const a0 = offset - width / 2 + w.off;
      const b1 = offset + width / 2 - w.off;
      out.push({ layerIndex: w.index, poly: [[rect(f, a0, a0 + w.thickness, s0, s1)], [rect(f, b1 - w.thickness, b1, s0, s1)]] });
    }
  }
  return out;
}

/** Retornos nas extremidades livres: os acabamentos contornam a ponta da parede. */
export function endReturns(f: WallFrame, which: 'a' | 'b', mode: WrapMode): LayerReturn[] {
  const sides = sidesOf(mode);
  const out: LayerReturn[] = [];
  for (const side of sides) {
    const [s0, s1] = depthRange(f, side, sides.length === 2);
    for (const w of wrappingLayers(f.type, side)) {
      const [t0, t1] = which === 'a' ? [-(w.off + w.thickness), -w.off] : [f.length + w.off, f.length + w.off + w.thickness];
      out.push({ layerIndex: w.index, poly: [[rect(f, t0, t1, s0, s1)]] });
    }
  }
  return out;
}
