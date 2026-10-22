import { intersection, type Polygon, type Vec2 } from '@hestia/geom';
import type { HatchKind, Id, Project } from '@hestia/model';
import { resolveCeilings } from './ceilings.ts';
import { EPS_T, lineIntervals, rect, sectionFrame, type SectionLine } from './sectionGeom.ts';
import type { SectionBeyond, SectionOrigin } from './section.ts';

/** Faixa de forro cortada pela linha: material, polígono (t, z) e a origem (o forro). */
export interface CeilingCut {
  materialId: Id;
  polygon: Polygon;
  origin: SectionOrigin;
  /** Hachura do tipo de forro (D3); sem valor, vale a do material. */
  hatch?: HatchKind;
}

export interface CeilingSection {
  cut: CeilingCut[];
  beyond: SectionBeyond[];
  zMin: number;
  zMax: number;
}

/**
 * Forros de um nível no corte e na elevação (decisão 0021): como os pisos planos, uma faixa t×z por camada cortada; o
 * forro atrás do plano de corte (dentro da profundidade) vai para `beyond`. Separado de `section.ts` pelo limite de linhas.
 */
export function sectionOfCeilings(p: Project, levelId: Id, line: SectionLine): CeilingSection {
  const { length, d, n, slab } = sectionFrame(line);
  const along = (v: Vec2): number => (v.x - line.a.x) * d.x + (v.y - line.a.y) * d.y;
  const dist = (v: Vec2): number => (v.x - line.a.x) * n.x + (v.y - line.a.y) * n.y;
  const out: CeilingSection = { cut: [], beyond: [], zMin: Infinity, zMax: -Infinity };
  for (const c of resolveCeilings(p, levelId)) {
    const inCut = intersection(c.polygon, slab);
    const hatch = p.ceilingTypes[c.typeId]?.hatch;
    for (const layer of c.layers) {
      for (const poly of c.polygon) {
        for (const [t0, t1] of lineIntervals(poly, line.a, d, n)) {
          const lo = Math.max(0, t0);
          const hi = Math.min(length, t1);
          if (hi - lo < EPS_T) continue;
          out.cut.push({ materialId: layer.materialId, polygon: [rect(lo, hi, layer.z0, layer.z1)], origin: { ceilingId: c.ceilingId }, hatch });
          out.zMin = Math.min(out.zMin, layer.z0);
          out.zMax = Math.max(out.zMax, layer.z1);
        }
      }
      for (const sp of inCut) {
        const outer = sp[0];
        if (!outer || outer.length < 3) continue;
        const ts = outer.map(along);
        const tMin = Math.max(0, Math.min(...ts));
        const tMax = Math.min(length, Math.max(...ts));
        if (tMax - tMin < EPS_T) continue;
        out.beyond.push({
          ceilingId: c.ceilingId,
          materialId: layer.materialId,
          layerIndex: layer.layerIndex,
          depth: Math.max(0, Math.min(...outer.map(dist))),
          polygons: [[rect(tMin, tMax, layer.z0, layer.z1)]],
          hatch,
        });
        out.zMin = Math.min(out.zMin, layer.z0);
        out.zMax = Math.max(out.zMax, layer.z1);
      }
    }
  }
  return out;
}
