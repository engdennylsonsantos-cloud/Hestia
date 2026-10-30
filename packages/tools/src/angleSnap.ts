import { dot, len, sub, v2, type Vec2 } from '@hestia/geom';

/** Projeção ortogonal (F8): devolve null quando o cursor está sobre o ponto de partida. */
export function orthoPoint(cursor: Vec2, from: Vec2, free: (v: number) => number): Vec2 | null {
  const d = sub(cursor, from);
  if (len(d) <= 1e-6) return null;
  return Math.abs(d.y) <= Math.abs(d.x) ? v2(free(cursor.x), from.y) : v2(from.x, free(cursor.y));
}

/** Projeção polar (F10): trava o ângulo no múltiplo de `incrementDeg` e mantém a distância projetada. */
export function polarPoint(cursor: Vec2, from: Vec2, incrementDeg?: number): Vec2 | null {
  const d = sub(cursor, from);
  if (len(d) <= 1e-6) return null;
  const inc = incrementDeg && incrementDeg > 0 ? incrementDeg : 15;
  const step = (inc * Math.PI) / 180;
  const angle = Math.round(Math.atan2(d.y, d.x) / step) * step;
  const u = { x: Math.cos(angle), y: Math.sin(angle) };
  const along = Math.max(0, dot(d, u));
  return v2(from.x + u.x * along, from.y + u.y * along);
}
