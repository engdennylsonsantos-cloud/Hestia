import { dot, len as vlen, norm, perp, sub, type Vec2 } from '@hestia/geom';
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
  length: number;
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
  const length = vlen(d);
  if (length < 1e-4) return null;
  const u = norm(d);
  const n = perp(u);
  const sign: 1 | -1 = wall.flipped ? -1 : 1;
  const thickness = totalThickness(type);
  const extOffset = exteriorOffset(type, wall.locationLine);
  const sExt = sign * extOffset;
  const sInt = sign * (extOffset - thickness);
  const sHi = Math.max(sExt, sInt);
  const sLo = Math.min(sExt, sInt);
  return { wall, type, a: wall.a, b: wall.b, u, n, length, sign, extOffset, thickness, sExt, sInt, sHi, sLo, sMid: (sHi + sLo) / 2 };
}

export const pointAt = (f: WallFrame, t: number, s: number): Vec2 => ({
  x: f.a.x + f.u.x * t + f.n.x * s,
  y: f.a.y + f.u.y * t + f.n.y * s,
});

/** Coordenada s de um plano a profundidade `d` da face externa. */
export const sAtDepth = (f: WallFrame, d: number): number => f.sign * (f.extOffset - d);

/** Posição (t, s) de um ponto do mundo no sistema da parede. */
export const toLocal = (f: WallFrame, p: Vec2): { t: number; s: number } => {
  const r = sub(p, f.a);
  return { t: dot(r, f.u), s: dot(r, f.n) };
};
