import { union, type MultiPolygon } from '@hestia/geom';
import {
  frameOfWall,
  openingGeometry,
  resolveFloors,
  resolveLevel,
  resolveRoofs,
  resolveSlabs,
  resolveStairs,
  roofThickness,
  stairArrivalTopZ,
  stairBody,
  type ResolvedStair,
} from '@hestia/engine';
import { exportIfc, type IfcGeometry, type IfcPlane, type IfcPolygon, type IfcPrism, type IfcStairGeo } from '@hestia/io';
import { isOpening, openingSill, openingType, wallBaseElevation, type Id, type Project, type Wall } from '@hestia/model';
import { saveText } from './saveText.ts';

/** Cota constante (sem inclinação). */
const flatPlane = (z: number): IfcPlane => ({ a: 0, b: 0, c: z });

/** Plano da inclinação `percent` (%) com origem `origin` e direção `dir` (unitária), cota `z0` na origem. */
function slopePlane(z0: number, origin: { x: number; y: number }, dir: { x: number; y: number }, percent: number): IfcPlane {
  const k = percent / 100;
  return { a: k * dir.x, b: k * dir.y, c: z0 - k * (dir.x * origin.x + dir.y * origin.y) };
}

/** Polígonos de um MultiPolygon do engine (cada um é [contorno, ...furos]) como prismas com as mesmas faces. */
function prismsOf(m: MultiPolygon, top: IfcPlane, bottom: IfcPlane): IfcPrism[] {
  return m.map((polygon) => ({ polygon, top, bottom }));
}

/** Cotas de topo e fundo de uma camada inclinada: o fundo é o topo deslocado pela espessura vertical. */
function slabPlanes(topZ: number, bottomZ: number, slope: { origin: { x: number; y: number }; dir: { x: number; y: number }; percent: number } | null): [IfcPlane, IfcPlane] {
  const thickness = topZ - bottomZ;
  const top = slope ? slopePlane(topZ, slope.origin, slope.dir, slope.percent) : flatPlane(topZ);
  return [top, { ...top, c: top.c - thickness }];
}

/** Paredes do nível: união das camadas (sem os vãos) como contorno e a base e a altura resolvidas pelo engine. */
function wallsOfLevel(p: Project, levelId: Id): IfcGeometry['walls'] {
  const level = resolveLevel(p, levelId);
  return Object.values(level.walls).map((rw) => {
    const footprint = rw.layers.reduce<MultiPolygon>((acc, l) => union(acc, l.fragment), []);
    return { wallId: rw.wallId, footprints: footprint.map((poly) => poly as IfcPolygon), baseZ: rw.baseZ, height: rw.height };
  });
}

/** Vãos do projeto: centro, eixo e esquadria no plano da parede hospedeira (vão bruto e peitoril em cota absoluta). */
function openingsOf(p: Project): IfcGeometry['openings'] {
  const out: IfcGeometry['openings'] = [];
  for (const o of Object.values(p.elements)) {
    if (!isOpening(o)) continue;
    const host = p.elements[o.hostId] as Wall | undefined;
    const frame = host ? frameOfWall(p, host.id) : null;
    if (!host || !frame) continue;
    const t = openingType(p, o);
    const g = openingGeometry(p, o, frame);
    const baseZ = wallBaseElevation(p, host);
    const sillZ = baseZ + openingSill(t, o);
    out.push({
      openingId: o.id,
      center: { x: g.center.x, y: g.center.y },
      u: { x: g.u.x, y: g.u.y },
      width: g.width,
      height: g.height,
      roughWidth: g.roughWidth,
      roughHeight: g.roughHeight,
      roughBottomZ: sillZ - (g.roughHeight - g.height) / 2,
      sillZ,
      thickness: g.thickness,
    });
  }
  return out;
}

/** Escada resolvida em lances (degraus e chegada agrupados pelo lance) e patamares, com as contagens do lance. */
function stairOf(p: Project, s: ResolvedStair): IfcStairGeo {
  const arrival = stairArrivalTopZ(p, s);
  const { pieces } = stairBody(s, { arrivalTopZ: arrival ?? undefined });
  const prismOf = (pc: (typeof pieces)[number]): IfcPrism => ({
    polygon: [pc.polygon],
    top: flatPlane(pc.zTop),
    bottom: { a: pc.bottom.a, b: pc.bottom.b, c: pc.bottom.c },
  });
  const comps = [...new Set(pieces.filter((pc) => pc.kind !== 'landing').map((pc) => pc.componentIndex))].sort((x, y) => x - y);
  const flights = comps.map((componentIndex) => {
    const mine = pieces.filter((pc) => pc.kind !== 'landing' && pc.componentIndex === componentIndex);
    return {
      componentIndex,
      pieces: mine.map(prismOf),
      treads: mine.filter((pc) => pc.kind === 'tread').length,
      risers: s.risers.filter((r) => r.componentIndex === componentIndex).length,
    };
  });
  return {
    stairId: s.id,
    levelId: s.levelId,
    spiral: pieces.some((pc) => pc.kind === 'post'),
    riserHeight: s.riserHeight,
    flights,
    landings: pieces.filter((pc) => pc.kind === 'landing').map(prismOf),
  };
}

/**
 * Geometria RESOLVIDA do projeto para o IFC (decisão 0020): paredes, vãos, pisos, lajes, telhados e escadas pelo mesmo
 * motor da planta e do DXF. O io não importa o engine, então a montagem fica aqui, no web.
 */
export function ifcGeometryOf(p: Project): IfcGeometry {
  const levels = p.levels.map((l) => l.id);
  const walls = levels.flatMap((id) => wallsOfLevel(p, id));
  const floors = levels.flatMap((id) => resolveFloors(p, id)).map((f) => ({ floorId: f.floorId, prisms: prismsOf(f.polygon, flatPlane(f.topZ), flatPlane(f.bottomZ)) }));
  const slabs = levels.flatMap((id) => resolveSlabs(p, id)).map((s) => {
    const [top, bottom] = slabPlanes(s.topZ, s.bottomZ, s.slope);
    return { slabId: s.slabId, prisms: prismsOf(s.polygon, top, bottom) };
  });
  const roofs = levels.flatMap((id) => resolveRoofs(p, id)).map((r) => {
    const t = roofThickness(r);
    const planes = r.planes.flatMap((pl) => {
      const top = slopePlane(pl.z0, pl.origin, pl.up, pl.percent);
      return prismsOf(pl.polygon, top, { ...top, c: top.c - t });
    });
    return { roofId: r.roofId, planes };
  });
  const stairs = resolveStairs(p).map((s) => stairOf(p, s));
  return { walls, openings: openingsOf(p), floors, slabs, roofs, stairs };
}

/** Texto IFC4 (STEP) do projeto inteiro, com a data atual no cabeçalho. */
export function projectIfc(p: Project, now: Date = new Date()): string {
  return exportIfc(p, ifcGeometryOf(p), { timestamp: now.toISOString().slice(0, 19) });
}

/** Entrega o `.ifc` pelo mesmo caminho do DXF (`saveText`) e devolve a frase de status. */
export function saveProjectIfc(p: Project): Promise<string> {
  const base = p.name.replace(/[^\w\- ]+/g, '').trim() || 'projeto';
  return saveText(`${base}.ifc`, projectIfc(p));
}
