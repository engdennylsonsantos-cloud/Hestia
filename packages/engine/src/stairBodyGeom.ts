import { asMulti, intersection, ringArea, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';

/** Fundo plano de uma peça da escada monolítica: cota z = a·x + b·y + c (decisão 0012 §2). */
export interface BottomPlane {
  a: number;
  b: number;
  c: number;
}

/** Área e centróide de um anel simples (fórmula do polígono, não a média dos vértices). */
export function ringMoments(r: Ring): { area: number; cx: number; cy: number } {
  let twiceSigned = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i]!;
    const q = r[(i + 1) % r.length]!;
    const cross = p.x * q.y - q.x * p.y;
    twiceSigned += cross;
    sx += (p.x + q.x) * cross;
    sy += (p.y + q.y) * cross;
  }
  if (Math.abs(twiceSigned) < 1e-15) return { area: 0, cx: r[0]?.x ?? 0, cy: r[0]?.y ?? 0 };
  return { area: Math.abs(twiceSigned) / 2, cx: sx / (3 * twiceSigned), cy: sy / (3 * twiceSigned) };
}

/**
 * Retângulo grande o bastante para cobrir `ref`, que é o semiplano `z ≤ level` (`below`) ou `z ≥ level` (`above`)
 * do plano `z = a·x + b·y + c`. O plano não pode ser horizontal (a = b = 0).
 */
function halfPlaneOf(plane: BottomPlane, level: number, side: 'below' | 'above', ref: Ring): MultiPolygon {
  const g = Math.hypot(plane.a, plane.b);
  const n = { x: plane.a / g, y: plane.b / g };
  const k = (level - plane.c) / g; // n·p = k sobre a linha de cota `level`
  const p0 = { x: n.x * k, y: n.y * k };
  const t = { x: -n.y, y: n.x };
  const R = 2 + 2 * Math.max(...ref.map((v) => Math.hypot(v.x - p0.x, v.y - p0.y)));
  const s = side === 'above' ? 1 : -1;
  const at = (u: number, w: number): Vec2 => ({ x: p0.x + t.x * u + s * n.x * R * w, y: p0.y + t.y * u + s * n.y * R * w });
  return [[[at(-R, 0), at(R, 0), at(R, 1), at(-R, 1)]]];
}

/**
 * Partes do anel que ficam no semiplano `z ≤ level` ou `z ≥ level` do plano dado (sem buracos: os degraus e patamares
 * não têm furos). Áreas nulas são descartadas.
 */
export function clipByLevel(ring: Ring, plane: BottomPlane, level: number, side: 'below' | 'above'): Ring[] {
  const parts = intersection(asMulti(ring), halfPlaneOf(plane, level, side, ring));
  const out: Ring[] = [];
  for (const poly of parts) {
    const outer = poly[0];
    if (outer && Math.abs(ringArea(outer)) > 1e-12) out.push(outer);
  }
  return out;
}
