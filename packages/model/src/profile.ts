import type { ProfilePoint } from './types.ts';

const EPS = 1e-9;

/**
 * Altura do topo em `t`. Dois pontos com o mesmo `t` formam um degrau: nesse `t`, vale o valor à direita
 * (o degrau pertence ao trecho seguinte). Fora do intervalo, mantém o valor do ponto mais próximo.
 */
export function profileHeightAt(pts: ProfilePoint[], t: number): number {
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last) return 0;
  if (t < first.t) return first.h;
  if (t >= last.t) return last.h;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (t >= a.t && t < b.t) return b.t - a.t < EPS ? b.h : a.h + ((b.h - a.h) * (t - a.t)) / (b.t - a.t);
  }
  return last.h;
}

export const profileMax = (pts: ProfilePoint[]): number => Math.max(...pts.map((q) => q.h));

/** Problema do perfil (texto) ou null: t não decrescente, ao menos 2 pontos e alturas positivas. */
export function profileError(pts: ProfilePoint[]): string | null {
  if (pts.length < 2) return 'o perfil precisa de ao menos 2 pontos';
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i]!;
    if (!(q.h > 0) || !Number.isFinite(q.t) || !Number.isFinite(q.h)) return 'as alturas devem ser maiores que zero';
    if (i > 0 && q.t < pts[i - 1]!.t - EPS) return 'as posições devem estar em ordem crescente';
  }
  return null;
}

/**
 * Divide o perfil em `ts` (esquerda: t ≤ ts; direita: t ≥ ts, re-referenciado em `offset`, que pode ser maior que `ts`
 * quando há folga entre as duas partes). Cada lado ganha um ponto na altura exata do corte.
 */
export function splitProfile(pts: ProfilePoint[], ts: number, offset = ts): [ProfilePoint[], ProfilePoint[]] {
  const hl = profileHeightAt(pts, ts - 1e-12);
  const hr = profileHeightAt(pts, offset);
  const left = [...pts.filter((q) => q.t < ts - EPS), { t: ts, h: hl }];
  const right = [{ t: 0, h: hr }, ...pts.filter((q) => q.t > offset + EPS).map((q) => ({ t: q.t - offset, h: q.h }))];
  return [dedupe(left), dedupe(right)];
}

function dedupe(pts: ProfilePoint[]): ProfilePoint[] {
  return pts.length === 1 ? [pts[0]!, { ...pts[0]! }] : pts;
}

/** Altura média do topo em [0, length]: integral do perfil (trapézios entre pontos) dividida pelo comprimento. */
export function profileMean(pts: ProfilePoint[], length: number): number {
  if (!pts.length || length <= 0) return 0;
  const ts = [...new Set([0, length, ...pts.map((q) => Math.min(length, Math.max(0, q.t)))])].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i + 1 < ts.length; i++) {
    const ta = ts[i]!;
    const tb = ts[i + 1]!;
    if (tb - ta < EPS) continue;
    area += ((profileHeightAt(pts, ta) + profileHeightAt(pts, tb - EPS * 1e-3)) / 2) * (tb - ta);
  }
  return area / length;
}
