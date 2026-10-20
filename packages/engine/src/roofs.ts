import { asMulti, difference, dot, multiArea, sub, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { levelElevation, roofsOnLevel, type Id, type Project, type Roof } from '@hestia/model';
import { planeHas, WATER_MIN_AREA } from './roofGeom.ts';
import { roofLines } from './roofLines.ts';
import { waterPlanes } from './roofShapes.ts';

/** Água resolvida: região em planta e plano da face superior (cota absoluta z0 em `origin`, subida `up`, `percent`). */
export interface ResolvedRoofPlane {
  polygon: MultiPolygon;
  origin: Vec2;
  /** Direção unitária de subida. */
  up: Vec2;
  percent: number;
  /** Cota absoluta da face superior em `origin`. */
  z0: number;
}

/** Linha notável do telhado em planta (para desenho e quantitativos). */
export interface RoofLine {
  kind: 'ridge' | 'hip' | 'valley' | 'eave';
  a: Vec2;
  b: Vec2;
}

export interface ResolvedRoofLayer {
  layerIndex: number;
  materialId: Id;
  /** Espessura vertical. */
  thickness: number;
  /** Distância vertical da face superior do telhado ao topo desta camada (soma das camadas acima). */
  below: number;
}

export interface ResolvedRoof {
  roofId: Id;
  typeId: Id;
  levelId: Id;
  planes: ResolvedRoofPlane[];
  lines: RoofLine[];
  layers: ResolvedRoofLayer[];
  /** Cota absoluta do beiral (nível + deslocamento). */
  eaveZ: number;
}

/** Cota absoluta da face superior de uma água em p (a água define o plano, sem conferir se p está dentro). */
export const planeZ = (pl: ResolvedRoofPlane, p: Vec2): number => pl.z0 + (pl.percent / 100) * dot(sub(p, pl.origin), pl.up);

/** Cota absoluta da face superior do telhado em `p`, ou null fora de todas as águas (sobre a borda vale). */
export function roofTopAt(r: ResolvedRoof, p: Vec2): number | null {
  for (const pl of r.planes) if (planeHas(pl.polygon, p)) return planeZ(pl, p);
  return null;
}

/** Espessura vertical total do telhado (soma das camadas). */
export const roofThickness = (r: ResolvedRoof): number => r.layers.reduce((s, l) => s + l.thickness, 0);

/** Um telhado: águas da forma menos os furos, linhas notáveis e camadas (espessura > 0). Sem tipo ou contorno válido, null. */
function resolveOne(p: Project, r: Roof): ResolvedRoof | null {
  const type = p.roofTypes[r.typeId];
  if (!type || r.boundary.length < 3) return null;
  const eaveZ = levelElevation(p, r.levelId) + r.heightOffset;
  const holes = r.holes.filter((h) => h.length >= 3).map((h): MultiPolygon => asMulti(h));
  const planes = waterPlanes(r, eaveZ)
    .map((pl) => ({ ...pl, polygon: holes.length ? difference(pl.polygon, ...holes) : pl.polygon }))
    .filter((pl) => multiArea(pl.polygon) > WATER_MIN_AREA);
  const layers: ResolvedRoofLayer[] = [];
  let below = 0;
  type.layers.forEach((l, i) => {
    if (l.thickness < 1e-6) return;
    layers.push({ layerIndex: i, materialId: l.materialId, thickness: l.thickness, below });
    below += l.thickness;
  });
  return { roofId: r.id, typeId: r.typeId, levelId: r.levelId, planes, lines: roofLines(r, planes), layers, eaveZ };
}

/** Águas, linhas e camadas dos telhados de um nível (ordem de criação). */
export function resolveRoofs(p: Project, levelId: Id): ResolvedRoof[] {
  return roofsOnLevel(p, levelId).flatMap((r) => {
    const rr = resolveOne(p, r);
    return rr ? [rr] : [];
  });
}

/** Telhados de todos os níveis do projeto (a parede anexada cruza níveis, como com lajes). */
export const resolveAllRoofs = (p: Project): ResolvedRoof[] => p.levels.flatMap((l) => resolveRoofs(p, l.id));
