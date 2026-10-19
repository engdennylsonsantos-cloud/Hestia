import { arcFromSagitta, arcLocal, arcPointAt, arcTangentAt, dot, len as vlen, norm, perp, sub, type Arc, type Vec2 } from '@hestia/geom';
import { coreSpan, totalThickness, type LocationLine, type Wall, type WallType } from '@hestia/model';

/**
 * Sistema de coordenadas de uma parede. `t` corre ao longo do eixo a→b; `s` mede para a ESQUERDA
 * de a→b (normal `n`). A face externa fica à esquerda, salvo `flipped` (docs/05 §3).
 */
export interface WallFrame {
  wall: Wall;
  type: WallType;
  a: Vec2;
  b: Vec2;
  u: Vec2;
  n: Vec2;
  /** Comprimento do eixo: arco nas paredes curvas. */
  length: number;
  /** Arco do eixo; null se reta. u e n são a tangente e a normal do INÍCIO. */
  arc: Arc | null;
  sign: 1 | -1;
  /** Distância da face externa até a linha de localização. */
  extOffset: number;
  thickness: number;
  /** Coordenada s da face externa / interna. */
  sExt: number;
  sInt: number;
  sHi: number;
  sLo: number;
  sMid: number;
}

/** Distância da face externa até a linha de localização escolhida. */
export function exteriorOffset(type: WallType, loc: LocationLine): number {
  const total = totalThickness(type);
  const core = coreSpan(type);
  switch (loc) {
    case 'wallCenter':
      return total / 2;
    case 'coreCenter':
      return (core.from + core.to) / 2;
    case 'finishExterior':
      return 0;
    case 'finishInterior':
      return total;
    case 'coreExterior':
      return core.from;
    case 'coreInterior':
      return core.to;
  }
}

export function buildFrame(wall: Wall, type: WallType): WallFrame | null {
  const d = sub(wall.b, wall.a);
  const chord = vlen(d);
  if (chord < 1e-4) return null;
  const arc = arcFromSagitta(wall.a, wall.b, wall.sag);
  const length = arc ? arc.length : chord;
  const u = arc ? arcTangentAt(arc, 0) : norm(d);
  const n = perp(u);
  const sign: 1 | -1 = wall.flipped ? -1 : 1;
  const thickness = totalThickness(type);
  const extOffset = exteriorOffset(type, wall.locationLine);
  const sExt = sign * extOffset;
  const sInt = sign * (extOffset - thickness);
  const sHi = Math.max(sExt, sInt);
  const sLo = Math.min(sExt, sInt);
  return { wall, type, a: wall.a, b: wall.b, u, n, length, arc, sign, extOffset, thickness, sExt, sInt, sHi, sLo, sMid: (sHi + sLo) / 2 };
}

export function pointAt(f: WallFrame, t: number, s: number): Vec2 {
  if (f.arc) return arcPointAt(f.arc, t, s);
  return { x: f.a.x + f.u.x * t + f.n.x * s, y: f.a.y + f.u.y * t + f.n.y * s };
}

/** Tangente do eixo em t (sentido a→b) e normal à esquerda. */
export function tangentAt(f: WallFrame, t: number): Vec2 {
  return f.arc ? arcTangentAt(f.arc, t) : f.u;
}
export const normalAt = (f: WallFrame, t: number): Vec2 => perp(tangentAt(f, t));

/** Tangente em a ou b (sentido a→b). */
export const endTangent = (f: WallFrame, which: 'a' | 'b'): Vec2 => tangentAt(f, which === 'a' ? 0 : f.length);

/** Coordenada s de um plano a profundidade `d` da face externa. */
export const sAtDepth = (f: WallFrame, d: number): number => f.sign * (f.extOffset - d);

/** Posição (t, s) de um ponto do mundo no sistema da parede. */
export function toLocal(f: WallFrame, p: Vec2): { t: number; s: number } {
  if (f.arc) return arcLocal(f.arc, p);
  const r = sub(p, f.a);
  return { t: dot(r, f.u), s: dot(r, f.n) };
}
