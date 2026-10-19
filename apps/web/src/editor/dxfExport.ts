import { levelFrames, openingGeometry, type ResolvedLevel } from '@hestia/engine';
import { exportDxf, type DxfLevelGeometry } from '@hestia/io';
import { openingsOfWall, type Id, type Project } from '@hestia/model';
import { saveText } from './saveText.ts';

/**
 * Geometria do nível para o DXF: regiões e contornos já resolvidos pelo engine (`editor.resolved`), mais o
 * retângulo de cada vão. O io não importa o engine, então a montagem fica aqui, no web.
 */
export function dxfGeometryOf(p: Project, levelId: Id, resolved: ResolvedLevel): DxfLevelGeometry {
  const openings = levelFrames(p, levelId).flatMap((f) => openingsOfWall(p, f.wall.id).map((o) => openingGeometry(p, o, f)));
  return {
    clusters: resolved.clusters,
    openings: openings.map((g) => ({ center: g.center, u: g.u, width: g.width, thickness: g.thickness })),
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
