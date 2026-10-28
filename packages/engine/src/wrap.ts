import { difference, type MultiPolygon, type Ring } from '@hestia/geom';
import {
  coreRange,
  openingFrame,
  openingFrameStyle,
  type OpeningType,
  type WallType,
  type WrapMode,
} from '@hestia/model';
import { pointAt, type WallFrame } from './frame.ts';
import { openingCore, openingFramePlacement } from './openingModelContext.ts';

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

/**
 * Fechamento efetivo do vão (decisão 0035 §2): o tipo com batente encosta o acabamento nele, então `inherit` vira
 * `none` (o reboco vai até o batente). O fechamento explícito continua valendo e é recortado pelo batente.
 */
export const insertMode = (wt: WallType, ot: OpeningType): WrapMode =>
  ot.closure === 'inherit' ? (ot.leaves > 0 && openingFrameStyle(ot) !== 'block' ? 'none' : wt.wrapInserts) : ot.closure;

/** Contorno do batente na planta, em coordenadas do mundo: o que o retorno do acabamento não pode invadir. */
export function insertFrameFootprint(f: WallFrame, offset: number, ot: OpeningType, side: 1 | -1): MultiPolygon | null {
  if (ot.leaves === 0 || openingFrameStyle(ot) === 'block') return null;
  const { D, Cd } = openingFramePlacement(f, ot);
  const style = openingFrameStyle(ot);
  const coreWidth = openingCore(f).s1 - openingCore(f).s0;
  const J = style === 'aduela' ? 0.03 : openingFrame(ot, coreWidth).frameWidth;
  const hw = ot.width / 2;
  const toWorld = (t: number, s: number): { x: number; y: number } => pointAt(f, t, f.sMid + s);
  const out: MultiPolygon = [];
  if (ot.kind === 'door' && (style === 'rebate' || style === 'aduela')) {
    const R = (ot.leafThickness ?? (ot.kind === 'door' ? 0.04 : 0.03)) + 0.004;
    for (const j of [-1, 1] as const) {
      const pts: Array<[number, number]> = [
        [offset + j * hw, Cd - side * (D / 2)],
        [offset + j * hw, Cd + side * (D / 2)],
        [offset + j * (hw - J + 0.015), Cd + side * (D / 2)],
        [offset + j * (hw - J + 0.015), Cd + side * (D / 2 - R)],
        [offset + j * (hw - J), Cd + side * (D / 2 - R)],
        [offset + j * (hw - J), Cd - side * (D / 2)],
      ];
      out.push([pts.map(([t, s]) => toWorld(t, s))]);
    }
    return out;
  }
  // Caixilho simples (janelas e batente 'simple'): duas caixas J × D nas ombreiras.
  for (const j of [-1, 1] as const) {
    out.push([
      [
        toWorld(offset + j * (hw - J), Cd - D / 2),
        toWorld(offset + j * hw, Cd - D / 2),
        toWorld(offset + j * hw, Cd + D / 2),
        toWorld(offset + j * (hw - J), Cd + D / 2),
      ],
    ]);
  }
  return out;
}

/** Dados do batente para recortar os retornos explícitos (o modelo é quem manda na largura e no rebaixo). */
export interface InsertFrame {
  ot: OpeningType;
  side: 1 | -1;
}

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

/**
 * Retornos de acabamento nos dois cantos de um vão (planta). Com batente presente (`frame`), cada retorno é recortado
 * pelo contorno do batente (decisão 0035 §2): o que fica atrás do rebaixo continua, o que cruzaria a peça sai.
 */
export function insertReturns(f: WallFrame, offset: number, width: number, mode: WrapMode, frame?: InsertFrame): LayerReturn[] {
  const sides = sidesOf(mode);
  const out: LayerReturn[] = [];
  const footprint = frame && sides.length > 0 ? insertFrameFootprint(f, offset, frame.ot, frame.side) : null;
  for (const side of sides) {
    const [s0, s1] = depthRange(f, side, sides.length === 2);
    for (const w of wrappingLayers(f.type, side)) {
      if (w.off + w.thickness >= width / 2 - 1e-3) continue; // não cabe no vão
      const a0 = offset - width / 2 + w.off;
      const b1 = offset + width / 2 - w.off;
      const cru: MultiPolygon = [
        [rect(f, a0, a0 + w.thickness, s0, s1)],
        [rect(f, b1 - w.thickness, b1, s0, s1)],
      ];
      const poly = footprint ? difference(cru, footprint) : cru;
      if (poly.length > 0) out.push({ layerIndex: w.index, poly });
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
