import { levelFrames, openingGeometry, resolveFloors, resolveRoofs, resolveSlabs, resolveStairsOnLevel, type ResolvedLevel, type ResolvedStair } from '@hestia/engine';
import { exportDxf, type DxfLevelGeometry, type DxfPoint } from '@hestia/io';
import { openingsOfWall, type Id, type Project } from '@hestia/model';
import { saveText } from './saveText.ts';

type StairDxf = NonNullable<DxfLevelGeometry['stairs']>[number];

/** Seta de subida: haste de `a` a `b` e duas pontas a 30° no fim (LINE, camada ESCADA_SETA). Vazia sem comprimento. */
export function stairArrow(a: DxfPoint, b: DxfPoint): Array<[DxfPoint, DxfPoint]> {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return [];
  const bx = -dx / len;
  const by = -dy / len;
  const L = Math.min(0.2, len * 0.25);
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  // Gira a direção de volta de ±30° para as duas pontas.
  const barb = (sg: 1 | -1): DxfPoint => ({ x: b.x + (bx * c - sg * by * s) * L, y: b.y + (sg * bx * s + by * c) * L });
  return [
    [a, b],
    [b, barb(1)],
    [b, barb(-1)],
  ];
}

/** Escada resolvida em geometria de DXF: degraus e patamares, espelhos e a seta do 1º ao último espelho. */
export function stairDxf(r: ResolvedStair): StairDxf {
  const mid = (k: { a: DxfPoint; b: DxfPoint }): DxfPoint => ({ x: (k.a.x + k.b.x) / 2, y: (k.a.y + k.b.y) / 2 });
  const ordered = [...r.risers].sort((x, y) => x.componentIndex - y.componentIndex || x.index - y.index);
  const first = ordered[0];
  const last = ordered.at(-1);
  return {
    outlines: r.steps.map((st) => st.polygon.map((q) => ({ x: q.x, y: q.y }))),
    risers: r.risers.map((k): [DxfPoint, DxfPoint] => [k.a, k.b]),
    arrow: first && last && ordered.length > 1 ? stairArrow(mid(first), mid(last)) : [],
  };
}

/**
 * Geometria do nível para o DXF: regiões e contornos já resolvidos pelo engine (`editor.resolved`), o retângulo de
 * cada vão, o contorno de cada piso e de cada laje (com furos, na camada do código do tipo). Pisos e lajes saem da geometria
 * resolvida (com as aberturas de escada); cada polígono resolvido vira um contorno com os seus furos. O io não importa o
 * engine, então a montagem fica aqui, no web.
 */
export function dxfGeometryOf(p: Project, levelId: Id, resolved: ResolvedLevel): DxfLevelGeometry {
  const openings = levelFrames(p, levelId).flatMap((f) => openingsOfWall(p, f.wall.id).map((o) => openingGeometry(p, o, f)));
  return {
    clusters: resolved.clusters,
    openings: openings.map((g) => ({ center: g.center, u: g.u, width: g.width, thickness: g.thickness })),
    floors: resolveFloors(p, levelId).flatMap((f) =>
      f.polygon.map((poly) => ({ outline: poly[0] ?? [], holes: poly.slice(1), typeCode: p.floorTypes[f.typeId]?.code ?? '' })),
    ),
    slabs: resolveSlabs(p, levelId).flatMap((s) =>
      s.polygon.map((poly) => ({ outline: poly[0] ?? [], holes: poly.slice(1), typeCode: p.slabTypes[s.typeId]?.code ?? '' })),
    ),
    // Escadas: degraus e patamares (contorno), espelhos e seta de subida (camadas ESCADA, ESCADA_ESPELHO e ESCADA_SETA).
    stairs: resolveStairsOnLevel(p, levelId).map(stairDxf),
    // Telhado: contorno do beiral e linhas de cumeeira, espigão e rincão (as de beiral já estão no contorno).
    roofs: resolveRoofs(p, levelId).map((r) => ({
      outline: p.elements[r.roofId]?.kind === 'roof' ? (p.elements[r.roofId] as { boundary: Array<{ x: number; y: number }> }).boundary : [],
      ridges: r.lines.filter((l) => l.kind !== 'eave' && l.kind !== 'gable').map((l): [typeof l.a, typeof l.b] => [l.a, l.b]),
      gables: r.lines.filter((l) => l.kind === 'gable').map((l): [typeof l.a, typeof l.b] => [l.a, l.b]),
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
