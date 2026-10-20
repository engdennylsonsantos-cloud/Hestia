import { levelFrames, openingGeometry, resolveRoofs, type ResolvedLevel } from '@hestia/engine';
import { exportDxf, type DxfLevelGeometry } from '@hestia/io';
import { floorsOnLevel, openingsOfWall, slabsOnLevel, type Id, type Project } from '@hestia/model';
import { saveText } from './saveText.ts';

/**
 * Geometria do nível para o DXF: regiões e contornos já resolvidos pelo engine (`editor.resolved`), o retângulo de
 * cada vão, o contorno de cada piso e de cada laje (com furos, na camada do código do tipo). O io não importa o engine, então a
 * montagem fica aqui, no web.
 */
export function dxfGeometryOf(p: Project, levelId: Id, resolved: ResolvedLevel): DxfLevelGeometry {
  const openings = levelFrames(p, levelId).flatMap((f) => openingsOfWall(p, f.wall.id).map((o) => openingGeometry(p, o, f)));
  return {
    clusters: resolved.clusters,
    openings: openings.map((g) => ({ center: g.center, u: g.u, width: g.width, thickness: g.thickness })),
    floors: floorsOnLevel(p, levelId).map((f) => ({ outline: f.boundary, holes: f.holes, typeCode: p.floorTypes[f.typeId]?.code ?? '' })),
    slabs: slabsOnLevel(p, levelId).map((s) => ({ outline: s.boundary, holes: s.holes, typeCode: p.slabTypes[s.typeId]?.code ?? '' })),
    // Telhado: contorno do beiral e linhas de cumeeira, espigão e rincão (as de beiral já estão no contorno).
    roofs: resolveRoofs(p, levelId).map((r) => ({
      outline: p.elements[r.roofId]?.kind === 'roof' ? (p.elements[r.roofId] as { boundary: Array<{ x: number; y: number }> }).boundary : [],
      ridges: r.lines.filter((l) => l.kind !== 'eave').map((l): [typeof l.a, typeof l.b] => [l.a, l.b]),
      typeCode: p.roofTypes[r.typeId]?.code ?? '',
    })),
  };
}

/** Texto DXF da planta do nível. */
export function planDxf(p: Project, levelId: Id, resolved: ResolvedLevel): string {
  return exportDxf(p, levelId, dxfGeometryOf(p, levelId, resolved));
}

/** Entrega o DXF pelo mesmo caminho do CSV (`saveText`) e devolve a frase de status. */
export function savePlanDxf(p: Project, levelId: Id, resolved: ResolvedLevel): Promise<string> {
  const base = p.name.replace(/[^\w\- ]+/g, '').trim() || 'projeto';
  const level = (p.levels.find((l) => l.id === levelId)?.name ?? levelId).replace(/[^\w\- ]+/g, '').trim() || 'nivel';
  return saveText(`${base}-${level}.dxf`, planDxf(p, levelId, resolved));
}
