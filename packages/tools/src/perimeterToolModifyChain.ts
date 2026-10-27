import type { SketchSeg } from '@hestia/geom';
import { gap, MOD_TOL } from './perimeterModifyCurve.ts';

/** Uma ponta de `a` coincide com uma ponta de `b` (cadeia pelas pontas, como no validador do esboço). */
function touches(a: SketchSeg, b: SketchSeg): boolean {
  return (
    gap(a.a, b.a) <= MOD_TOL ||
    gap(a.a, b.b) <= MOD_TOL ||
    gap(a.b, b.a) <= MOD_TOL ||
    gap(a.b, b.b) <= MOD_TOL
  );
}

/**
 * Ids das linhas ligadas pelas pontas à linha `id`: a cadeia aberta ou o laço conectado. A ordem segue a do rascunho.
 * É o que o Tab escolhe na etapa de escolher o alvo ("todo o laço conectado"). Ids desconhecidos devolvem lista vazia.
 */
export function chainIds(segs: SketchSeg[], id: string): string[] {
  const start = segs.find((s) => s.id === id);
  if (!start) return [];
  const found = new Set<string>([id]);
  const queue: SketchSeg[] = [start];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const other of segs) {
      if (found.has(other.id) || !touches(cur, other)) continue;
      found.add(other.id);
      queue.push(other);
    }
  }
  return segs.filter((s) => found.has(s.id)).map((s) => s.id);
}
