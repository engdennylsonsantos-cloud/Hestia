import type { MultiPolygon, Vec2 } from '@hestia/geom';
import { slabRiseAt, type Id, type SlabSlope } from '@hestia/model';
import type { SectionOrigin } from './section.ts';
import { EPS_T, lineIntervals, type SectionLine } from './sectionGeom.ts';

/** Linha de membrana no plano de corte (decisão 0023 §5): segmento em (t, z), na cota da face da camada. */
export interface SectionMembrane extends SectionOrigin {
  materialId: Id;
  /** Extremidades em (t, z). */
  pts: [Vec2, Vec2];
}

/** Eixo do corte, já calculado por `sectionFrame` (comprimento, direção e normal). */
export interface MembraneFrame {
  line: SectionLine;
  length: number;
  d: Vec2;
  n: Vec2;
}

/**
 * Membranas de um piso ou de uma laje cortados pelo plano: uma linha por intervalo de corte e por camada de membrana, no
 * contorno da própria camada (P8). A cota acompanha a inclinação da laje (`slope` nulo no piso, onde a subida é zero).
 */
export function membraneCutsOf(
  layers: ReadonlyArray<{ materialId: Id; membrane: boolean; z1: number; polygon: MultiPolygon }>,
  origin: SectionOrigin,
  slope: SlabSlope | null,
  frame: MembraneFrame,
): SectionMembrane[] {
  const out: SectionMembrane[] = [];
  const at = (t: number): Vec2 => ({ x: frame.line.a.x + frame.d.x * t, y: frame.line.a.y + frame.d.y * t });
  for (const layer of layers) {
    if (!layer.membrane) continue;
    for (const poly of layer.polygon) {
      for (const [t0, t1] of lineIntervals(poly, frame.line.a, frame.d, frame.n)) {
        const lo = Math.max(0, t0);
        const hi = Math.min(frame.length, t1);
        if (hi - lo < EPS_T) continue;
        const zLo = layer.z1 + slabRiseAt(slope, at(lo));
        const zHi = layer.z1 + slabRiseAt(slope, at(hi));
        out.push({ ...origin, materialId: layer.materialId, pts: [{ x: lo, y: zLo }, { x: hi, y: zHi }] });
      }
    }
  }
  return out;
}
