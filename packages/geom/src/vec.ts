/** Vetor 2D em metros. Imutável por convenção: toda função devolve um novo valor. */
export interface Vec2 {
  x: number;
  y: number;
}

export const EPS = 1e-9;

export const v2 = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const mid = (a: Vec2, b: Vec2): Vec2 => lerp(a, b, 0.5);

export function norm(a: Vec2): Vec2 {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** Perpendicular à esquerda (rotação de +90°). */
export const perp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });

export function rotate(a: Vec2, angle: number, about: Vec2 = { x: 0, y: 0 }): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = a.x - about.x;
  const dy = a.y - about.y;
  return { x: about.x + dx * c - dy * s, y: about.y + dx * s + dy * c };
}

/** Ângulo do vetor em radianos, em (-π, π]. */
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x);

export const equal = (a: Vec2, b: Vec2, tol = 1e-6): boolean =>
  Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;

export const normalizeAngle = (a: number): number => {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
};
