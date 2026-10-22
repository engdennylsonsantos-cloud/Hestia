import {
  asMulti,
  boxOf,
  closeGapsSafe,
  difference,
  expandBox,
  polygonArea,
  pointInPolygon,
  union,
  type Box,
  type MultiPolygon,
  type Polygon,
  type Ring,
  type Vec2,
} from '@hestia/geom';
import { dist } from '@hestia/geom';
import { roomCeilingHeight, roomsOnLevel, type Id, type Project, type ValidationIssue } from '@hestia/model';
import { wallFaces } from './faces.ts';
import { noteCircuitRecalc, wallsSignature } from './enclosed.ts';
import { levelFrames } from './resolve.ts';

/** Por que o ponto do ambiente não está num circuito fechado. */
export type RoomProblem = 'aberto' | 'fora';

/** Ambiente resolvido: contorno derivado do circuito de paredes que contém o ponto (nunca gravado). */
export interface ResolvedRoom {
  roomId: Id;
  levelId: Id;
  name: string;
  number: string;
  point: Vec2;
  /** null quando o ponto está num circuito fechado; 'aberto' (vão) ou 'fora' (sem circuito) quando não. */
  problem: RoomProblem | null;
  /** Anel externo + furos de pilares/shafts internos; null quando há problema. */
  polygon: Polygon | null;
  /** Área líquida (m²). */
  area: number;
  /** Perímetro do contorno externo (m). */
  perimeter: number;
  /** Pé-direito (m). */
  ceilingHeight: number;
  /** Volume (m³) = área × pé-direito. */
  volume: number;
  floorFinish: string;
  wallFinish: string;
  ceilingFinish: string;
  color?: string;
  /** Id do primeiro ambiente no mesmo circuito (este é o duplicado); undefined quando único. */
  duplicateOf?: Id;
}

/** Margem (m) além das paredes: a caixa que envolve o nível fica longe o bastante para ser "o externo". */
const MARGIN = 1;
const EPS = 1e-6;

/**
 * Silhueta de uma parede SEM os vãos (porta e janela contam como parede para o circuito, como no piso): o `outline` de
 * `wallFaces` — corpo inteiro da parede com os cantos das junções (esquadria, encosto, T) e arcos já resolvidos. A face
 * interna é a de acabamento (`sLo`); a região fechada é o que sobra entre essas faces.
 */
function wallBand(outline: Ring): Ring {
  return outline;
}

interface RegionSet {
  walls: MultiPolygon;
  frame: Ring;
  free: MultiPolygon;
  wallBox: Box;
}

const frameCount = (p: Project, levelId: Id): number => levelFrames(p, levelId).length;

const insideBox = (q: Vec2, b: Box): boolean => q.x >= b.minX - EPS && q.x <= b.maxX + EPS && q.y >= b.minY - EPS && q.y <= b.maxY + EPS;

/** Espaço livre entre as faces internas das paredes do nível (a caixa envolvente menos a união das silhuetas). */
function regionSet(p: Project, levelId: Id): RegionSet {
  const walls = closeGapsSafe(union(...wallFaces(p, levelId).map((w) => asMulti(wallBand(w.outline)))));
  const wallBox = boxOf(walls.flatMap((poly) => poly.flat()));
  const b = expandBox(wallBox, MARGIN);
  const frame: Ring = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];
  const free = difference(asMulti(frame), walls);
  return { walls, frame, free, wallBox };
}

/** Comprimento de um anel fechado (o último ponto liga-se ao primeiro). */
const ringLength = (r: Ring): number => r.reduce((s, p, i) => s + dist(p, r[(i + 1) % r.length]!), 0);

/** Circuito que contém o ponto (o mesmo critério de `resolveRooms`): anel de borda + furos, ou o motivo de não haver. */
function classifyPoint(at: Vec2, set: RegionSet): { problem: RoomProblem | null; polygon: Polygon | null } {
  const b = boxOf(set.frame);
  const onFrame = (v: Vec2): boolean => Math.abs(v.x - b.minX) < EPS || Math.abs(v.x - b.maxX) < EPS || Math.abs(v.y - b.minY) < EPS || Math.abs(v.y - b.maxY) < EPS;
  const holder = set.free.find((poly) => pointInPolygon(at, poly)) ?? null;
  if (!holder) return { problem: 'fora', polygon: null };
  if (holder[0]!.some(onFrame)) return { problem: insideBox(at, set.wallBox) ? 'aberto' : 'fora', polygon: null };
  return { problem: null, polygon: holder };
}

/**
 * Circuito de paredes sob um ponto em planta (a pré-visualização da ferramenta Ambiente usa o mesmo critério de
 * `resolveRooms`). `problem` diz por que o ponto não fecha um circuito; `polygon` é o anel externo + furos quando fecha.
 */
export function roomRegionAt(p: Project, levelId: Id, at: Vec2): { problem: RoomProblem | null; polygon: Polygon | null } {
  if (frameCount(p, levelId) === 0) return { problem: 'fora', polygon: null };
  return classifyPoint(at, regionSetCached(p, levelId));
}

/** Espaço livre do nível em cache por conteúdo das paredes (decisão 0023 §11): só o nível editado refaz a união. */
const regionCache = new Map<Id, { sig: string; set: RegionSet }>();

/** Zera o cache do espaço livre (isolamento entre suítes de teste; o cache de circuitos é `resetCircuitCache`). */
export function resetRegionCache(): void {
  regionCache.clear();
}

function regionSetCached(p: Project, levelId: Id): RegionSet {
  const sig = wallsSignature(p, levelId);
  const hit = regionCache.get(levelId);
  if (hit && hit.sig === sig) return hit.set;
  noteCircuitRecalc();
  const set = regionSet(p, levelId);
  regionCache.set(levelId, { sig, set });
  return set;
}

/**
 * Ambientes resolvidos de um nível. O contorno vem do circuito fechado pelas faces internas das paredes que contém o
 * `point` (derivado a cada chamada, nunca guardado): quando as paredes mudam, o ambiente é recalculado. Pilares/shafts
 * internos (ilhas de parede dentro do circuito) viram furos. `problem` marca o ponto fora de um circuito fechado.
 */
export function resolveRooms(p: Project, levelId: Id): ResolvedRoom[] {
  const rooms = roomsOnLevel(p, levelId);
  if (rooms.length === 0) return [];
  const frames = levelFrames(p, levelId);
  const base = (r: (typeof rooms)[number]) => ({
    roomId: r.id,
    levelId: r.levelId,
    name: r.name,
    number: r.number,
    point: r.point,
    ceilingHeight: roomCeilingHeight(p, r),
    floorFinish: r.floorFinish ?? '',
    wallFinish: r.wallFinish ?? '',
    ceilingFinish: r.ceilingFinish ?? '',
    color: r.color,
  });
  if (frames.length === 0) {
    return rooms.map((r) => ({ ...base(r), problem: 'fora' as const, polygon: null, area: 0, perimeter: 0, volume: 0 }));
  }
  const set = regionSetCached(p, levelId);
  const seen = new Map<Polygon, Id>();
  return rooms.map((r) => {
    const { problem, polygon } = classifyPoint(r.point, set);
    const area = polygon ? polygonArea(polygon) : 0;
    const perimeter = polygon ? ringLength(polygon[0]!) : 0;
    let duplicateOf: Id | undefined;
    if (problem === null && polygon) {
      const first = seen.get(polygon);
      if (first !== undefined) duplicateOf = first;
      else seen.set(polygon, r.id);
    }
    return { ...base(r), problem, polygon, area, perimeter, volume: area * roomCeilingHeight(p, r), duplicateOf };
  });
}

/** Ambientes resolvidos de todos os níveis do projeto. */
export const resolveAllRooms = (p: Project): ResolvedRoom[] => p.levels.flatMap((l) => resolveRooms(p, l.id));

/** Avisos de geometria dos ambientes: ponto fora de circuito (fora/aberto) e ambiente duplicado no mesmo circuito. */
export function roomValidationIssues(p: Project): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const r of resolveAllRooms(p)) {
    const name = r.number ? `"${r.number}"` : `"${r.name || r.roomId}"`;
    if (r.problem === 'fora') {
      out.push({ severity: 'error', code: 'room-point-outside', message: `Ambiente ${name} não está dentro de nenhum circuito fechado de paredes.`, elementId: r.roomId });
    } else if (r.problem === 'aberto') {
      out.push({ severity: 'error', code: 'room-point-open', message: `Ambiente ${name} está num circuito aberto (há um vão entre as paredes).`, elementId: r.roomId });
    }
    if (r.duplicateOf !== undefined) {
      out.push({ severity: 'warning', code: 'room-duplicate', message: `Ambiente ${name} está no mesmo circuito do ambiente "${r.duplicateOf}".`, elementId: r.roomId });
    }
  }
  return out;
}
