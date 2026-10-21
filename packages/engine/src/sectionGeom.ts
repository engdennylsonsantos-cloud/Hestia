import { orientedRect, type MultiPolygon, type Polygon, type Ring, type Vec2 } from '@hestia/geom';

/**
 * Primitivas do corte e da elevação, compartilhadas por `section.ts`, `sectionRoof*` e `sectionStairs.ts` (sem ciclo
 * entre eles). A linha de corte define o eixo: x = distância ao longo da linha, y = cota.
 */
export interface SectionLine {
  a: Vec2;
  b: Vec2;
  /** Profundidade visível além do plano de corte. */
  depth: number;
}

/** Tolerância (m) para descartar intervalos de corte de tamanho nulo. */
export const EPS_T = 1e-6;

/** Retângulo (t0..t1, z0..z1); com `zb` diferente de `z1` o topo é inclinado (trapézio de `z1` em t0 a `zb` em t1). */
export const rect = (t0: number, t1: number, z0: number, z1: number, zb = z1): Ring => [
  { x: t0, y: z0 },
  { x: t1, y: z0 },
  { x: t1, y: zb },
  { x: t0, y: z1 },
];

/** Intervalos de `t` em que a reta a + t·d (d unitário, n sua normal) está dentro do polígono (par-ímpar, serve a furos). */
export function lineIntervals(poly: Polygon, a: Vec2, d: Vec2, n: Vec2): Array<[number, number]> {
  const ts: number[] = [];
  for (const ring of poly) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!;
      const q = ring[(i + 1) % ring.length]!;
      const sp = (p.x - a.x) * n.x + (p.y - a.y) * n.y;
      const sq = (q.x - a.x) * n.x + (q.y - a.y) * n.y;
      if (sp <= 0 === sq <= 0) continue;
      const k = sp / (sp - sq);
      ts.push((p.x + (q.x - p.x) * k - a.x) * d.x + (p.y + (q.y - p.y) * k - a.y) * d.y);
    }
  }
  ts.sort((x, y) => x - y);
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < ts.length; i += 2) out.push([ts[i]!, ts[i + 1]!]);
  return out;
}

/** Eixo do corte: comprimento, direção `d`, normal `n` e a região de visão (`depth` além da linha). */
export function sectionFrame(line: SectionLine): { length: number; d: Vec2; n: Vec2; slab: MultiPolygon } {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const length = Math.hypot(dx, dy);
  const k = length || 1;
  const d = { x: dx / k, y: dy / k };
  const n = { x: -d.y, y: d.x };
  const cx = line.a.x + d.x * (length / 2) + n.x * (line.depth / 2);
  const cy = line.a.y + d.y * (length / 2) + n.y * (line.depth / 2);
  return { length, d, n, slab: [[orientedRect(cx, cy, d.x, d.y, length / 2, line.depth / 2)]] };
}
