import { dot, sub, type Ring, type Vec2 } from '@hestia/geom';
import type { ResolvedRamp } from './ramps.ts';
import { ringMoments } from './stairBodyGeom.ts';

/** Plano z = a·x + b·y + c. */
export interface RampPlane {
  a: number;
  b: number;
  c: number;
}

export interface RampBodyPiece {
  kind: 'flight' | 'landing';
  componentIndex: number;
  polygon: Ring;
  top: RampPlane;
  bottom: RampPlane;
}

/** Cota do plano no ponto (x, y). */
export const planeZ = (pl: RampPlane, x: number, y: number): number => pl.a * x + pl.b * y + pl.c;

/** Cota do fundo da peça no ponto (x, y). */
export const pieceBottomZ = (piece: RampBodyPiece, x: number, y: number): number => planeZ(piece.bottom, x, y);

/** Volume da peça = área × (topo − fundo no centróide). Exato porque o topo e o fundo são planos. */
export function rampPieceVolume(piece: RampBodyPiece): number {
  const { area, cx, cy } = ringMoments(piece.polygon);
  return area * (planeZ(piece.top, cx, cy) - planeZ(piece.bottom, cx, cy));
}

/**
 * Corpo da rampa resolvida: um prisma por lance (topo inclinado, fundo paralelo a `structuralDepth` perpendicular) e por
 * patamar (topo plano, fundo a `landingThickness`). Rampa com erro não gera peças.
 */
export function rampBody(rr: ResolvedRamp): { pieces: RampBodyPiece[] } {
  if (rr.issues.some((i) => i.severity === 'error')) return { pieces: [] };
  const pieces: RampBodyPiece[] = [];
  const t = rr.type.structuralDepth;
  for (const f of rr.flights) {
    const d = unit(sub(f.end, f.start));
    const s = f.slope;
    const a = s * d.x;
    const b = s * d.y;
    const c = f.z0 - s * dot(f.start, d);
    const top: RampPlane = { a, b, c };
    const vertical = t * Math.sqrt(1 + s * s);
    const bottom: RampPlane = { a, b, c: c - vertical };
    pieces.push({ kind: 'flight', componentIndex: f.componentIndex, polygon: f.polygon, top, bottom });
  }
  for (const l of rr.landings) {
    pieces.push({
      kind: 'landing',
      componentIndex: l.componentIndex,
      polygon: l.polygon,
      top: { a: 0, b: 0, c: l.z },
      bottom: { a: 0, b: 0, c: l.z - rr.type.landingThickness },
    });
  }
  return { pieces };
}

/** Versor de `v`; zero se o comprimento é nulo. */
function unit(v: Vec2): Vec2 {
  const l = Math.hypot(v.x, v.y);
  return l > 1e-12 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
}
