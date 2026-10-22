import { arcPointAt, pointInMulti, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { profileMax, slabRiseAt, wallArc, wallBaseElevation, wallMaxHeight, type Id, type Project, type ProfilePoint, type Wall } from '@hestia/model';
import { resolveAllFloors, type ResolvedFloor } from './floors.ts';
import { resolveAllRoofs, type ResolvedRoof } from './roofs.ts';
import { roofWallProfile } from './roofWall.ts';
import { resolveAllSlabs, type ResolvedSlab } from './slabs.ts';

/** Cota absoluta da base e altura máxima de uma parede, já com os anexos a piso. */
export interface WallZ {
  /** Cota absoluta da base. */
  z0: number;
  /** Altura máxima (o perfil superior, quando há, define a maior altura). */
  height: number;
  /** Perfil superior vindo do telhado (attachTopToRoof), relativo à base; ausente nas demais paredes. */
  profile?: ProfilePoint[];
}

/** Folga mínima para uma parede anexada continuar com altura (1 cm). */
const MIN_HEIGHT = 0.01;

/** Tolerância para considerar o ponto médio exatamente sobre a borda de um contorno (m). */
const ON_EDGE_EPS = 1e-7;

/** Distância do ponto ao segmento [a, b]. */
function distToSegment(pt: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(pt.x - a.x, pt.y - a.y);
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

/** O ponto cai sobre a borda do anel (a menos de `ON_EDGE_EPS`). */
function onRing(pt: Vec2, r: Ring): boolean {
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if (distToSegment(pt, r[j]!, r[i]!) <= ON_EDGE_EPS) return true;
  }
  return false;
}

/**
 * O ponto é coberto pelo contorno (piso ou laje)? Além do teste de interior (`pointInMulti`), trata o ponto sobre a
 * borda como coberto: o ray-casting de `pointInRing` é ambíguo exatamente sobre a borda (o resultado depende do lado em
 * que o ponto cai — defeito 6.1 de docs/projetos/casa-alto-padrao/C-montagem.md). Aqui a decisão fica consistente nos
 * quatro lados, sem alterar o `pointInRing`/`pointInMulti` do geom, que seguem com o comportamento padrão.
 */
function covered(at: Vec2, m: MultiPolygon): boolean {
  if (pointInMulti(at, m)) return true;
  for (const poly of m) for (const ring of poly) if (onRing(at, ring)) return true;
  return false;
}

/** Ponto médio do eixo: no arco, o ponto do meio do comprimento do arco. */
function axisMid(w: Wall): Vec2 {
  const arc = wallArc(w);
  if (arc) return arcPointAt(arc, arc.length / 2);
  return { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
}

/** Faces superior e inferior (cotas absolutas) de pisos e lajes do nível que cobrem o ponto. */
function facesAt(levelId: Id, at: Vec2, floors: ResolvedFloor[], slabs: ResolvedSlab[]): { tops: number[]; bottoms: number[] } {
  const tops: number[] = [];
  const bottoms: number[] = [];
  for (const f of floors) {
    if (f.levelId !== levelId || !covered(at, f.polygon)) continue;
    tops.push(f.topZ);
    bottoms.push(f.bottomZ);
  }
  for (const s of slabs) {
    if (s.levelId !== levelId || !covered(at, s.polygon)) continue;
    // Lajes inclinadas: as faces sobem juntas, então a cota vale no ponto (topo ou base da origem + subida).
    const rise = slabRiseAt(s.slope, at);
    tops.push(s.topZ + rise);
    bottoms.push(s.bottomZ + rise);
  }
  return { tops, bottoms };
}

/**
 * Base e altura da parede (Revit: base e topo anexados ao piso ou à laje, docs/paridade/pisos C1 e lajes C1, decisão 0006
 * item 6 e decisão 0007). Com `attachBottomToFloor`, a base vai para a face superior do elemento (piso ou laje) do mesmo
 * nível que cobre o ponto médio. Com `attachTopToFloor`, o topo vai para a face inferior do elemento do nível `topLevelId`
 * que cobre esse ponto. Entre vários que cobrem, a base usa o mais alto e o topo o mais baixo. Laje inclinada conta pela
 * cota no ponto médio.
 * Sem piso, ou se o ajuste deixasse a parede sem altura, o ajuste é ignorado. Parede com perfil superior não
 * recebe o topo anexado (o perfil já define o topo); a base anexada move o perfil junto. Sem os flags, devolve
 * exatamente a base e a altura do modelo.
 * Com `attachTopToRoof` (decisão 0008, item 6), o topo vai para a face inferior do telhado ao longo do eixo (`roofWallProfile`);
 * só o trecho coberto pelo telhado segue a face inferior; o trecho sem telhado fica na altura normal (`roofWallProfile`).
 * `roofs` vem do engine (resolveAllRoofs); sem ele, é resolvido aqui.
 */
export function wallZRange(
  p: Project,
  w: Wall,
  floors: ResolvedFloor[] = resolveAllFloors(p),
  slabs: ResolvedSlab[] = resolveAllSlabs(p),
  roofs?: ResolvedRoof[],
): WallZ {
  const base = wallBaseElevation(p, w);
  const height = wallMaxHeight(p, w);
  const profiled = Boolean(w.topProfile && w.sag === 0);
  const wantsBottom = w.attachBottomToFloor === true;
  const wantsRoof = w.attachTopToRoof === true;
  const wantsTop = w.attachTopToFloor === true && w.topLevelId !== null && !profiled;
  if (!wantsBottom && !wantsTop && !wantsRoof) return { z0: base, height };
  const mid = axisMid(w);
  let z0 = base;
  let top = base + height;
  if (wantsBottom) {
    const tops = facesAt(w.levelId, mid, floors, slabs).tops;
    if (tops.length > 0) {
      const z = Math.max(...tops);
      if (z < top - MIN_HEIGHT) z0 = z;
    }
  }
  if (wantsRoof) {
    const profile = roofWallProfile(w, roofs ?? resolveAllRoofs(p), z0, base + height);
    if (profile) return { z0, height: profileMax(profile), profile };
  }
  if (wantsTop && w.topLevelId !== null) {
    const bottoms = facesAt(w.topLevelId, mid, floors, slabs).bottoms;
    if (bottoms.length > 0) {
      const z = Math.min(...bottoms);
      if (z > z0 + MIN_HEIGHT) top = z;
    }
  }
  if (z0 === base && top === base + height) return { z0: base, height };
  return { z0, height: profiled ? height : top - z0 };
}
