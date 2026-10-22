import { pointInMulti, union, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { ceilingsOnLevel, floorsOnLevel, followsRoom, levelAbove, levelElevation, slabsOnLevel, type Ceiling, type Id, type Project } from '@hestia/model';
import { resolveRooms, type ResolvedRoom, type RoomProblem } from './rooms.ts';
import { cutStairOpenings, stairHolesFor, stairOpeningsOnLevel, type StairOpening } from './stairOpenings.ts';

/** Camada resolvida do forro: a mesma área em planta, entre as cotas absolutas z0 e z1. */
export interface ResolvedCeilingLayer {
  layerIndex: number;
  materialId: Id;
  z0: number;
  z1: number;
}

/**
 * Por que um forro que acompanha o ambiente não segue o contorno dele: o ambiente não fecha (`aberto`, `fora`) ou não
 * existe mais (`apagado`). Nesses casos o forro mantém o último contorno gravado.
 */
export type CeilingRoomProblem = RoomProblem | 'apagado';

/** Contorno efetivo do forro: o do ambiente de origem quando acompanha e resolve; senão, o gravado (último válido). */
export interface CeilingOutline {
  boundary: Vec2[];
  holes: Vec2[][];
  /** Motivo de o forro que acompanha o ambiente não segui-lo; null quando segue ou é estático. */
  problem: CeilingRoomProblem | null;
}

/** Ambientes resolvidos de um nível, por id. */
export type RoomsById = Map<Id, ResolvedRoom>;

export const roomsById = (p: Project, levelId: Id): RoomsById => new Map(resolveRooms(p, levelId).map((r) => [r.roomId, r] as const));

/**
 * Contorno efetivo de um forro (decisão 0023 §13, P-5). Forro que acompanha o ambiente (`followsRoom`) usa o contorno e os
 * furos do ambiente, derivado das paredes; se o ambiente não resolve ou foi apagado, devolve o contorno gravado e o
 * `problem`. Forro solto ou desenhado à mão devolve o gravado, sem problema. Nunca lança.
 */
export function ceilingOutline(p: Project, c: Ceiling, rooms?: RoomsById): CeilingOutline {
  const stored = { boundary: c.boundary, holes: c.holes };
  if (!followsRoom(c)) return { ...stored, problem: null };
  const room = p.elements[c.roomId ?? ''];
  if (!room || room.kind !== 'room') return { ...stored, problem: 'apagado' };
  const r = (rooms ?? roomsById(p, c.levelId)).get(room.id);
  if (!r) return { ...stored, problem: 'apagado' };
  if (!r.polygon || r.problem) return { ...stored, problem: r.problem ?? 'fora' };
  const [outer, ...holes] = r.polygon;
  return { boundary: outer!, holes, problem: null };
}

/**
 * Ambiente a que um forro volta em "Revincular ao ambiente": o de origem, se ainda existe no nível; senão, o primeiro
 * ambiente com circuito fechado que contém o centro do forro ou um de seus vértices. Null quando nenhum serve.
 */
export function ceilingRoomFor(p: Project, c: Ceiling): Id | null {
  const rooms = roomsById(p, c.levelId);
  if (c.roomId && rooms.has(c.roomId)) return c.roomId;
  const closed = [...rooms.values()].filter((r) => r.polygon && !r.problem);
  const n = c.boundary.length || 1;
  const centre: Vec2 = { x: c.boundary.reduce((s, q) => s + q.x, 0) / n, y: c.boundary.reduce((s, q) => s + q.y, 0) / n };
  for (const q of [centre, ...c.boundary]) {
    const hit = closed.find((r) => pointInMulti(q, [r.polygon!]));
    if (hit) return hit.roomId;
  }
  return null;
}

export interface ResolvedCeiling {
  ceilingId: Id;
  typeId: Id;
  levelId: Id;
  /** Contorno menos furos, em planta. */
  polygon: MultiPolygon;
  /** Cota absoluta do topo do forro (nível + `heightOffset`). */
  topZ: number;
  /** Cota absoluta da face inferior, visível (topo menos a espessura total). */
  bottomZ: number;
  /** Do topo para baixo (índice 0 = camada de cima). */
  layers: ResolvedCeilingLayer[];
  /** Motivo de o forro que acompanha o ambiente não segui-lo (mantém o contorno gravado); null quando segue ou é estático. */
  problem: CeilingRoomProblem | null;
}

/** Vãos do nível de cima que atravessam o forro: escadas que furam o nível de cima e furos próprios de pisos e lajes dele. */
interface UpperOpenings {
  stairs: StairOpening[];
  /** Furos das lajes e dos pisos do nível de cima, em planta (independem da cota). */
  shafts: MultiPolygon[];
}

/** Vãos do nível acima do forro (decisão 0021, B6). Sem nível acima, nada a recortar. */
function upperOpenings(p: Project, levelId: Id): UpperOpenings {
  const above = levelAbove(p, levelId);
  if (!above) return { stairs: [], shafts: [] };
  const holes = [...floorsOnLevel(p, above.id), ...slabsOnLevel(p, above.id)].flatMap((e) => e.holes);
  return { stairs: stairOpeningsOnLevel(p, above.id), shafts: holes.map((h): MultiPolygon => [[h]]) };
}

/**
 * Região que o forro perde no vão de cima (decisão 0021, B6): a projeção das escadas na cota da face inferior do forro,
 * pela mesma regra do furo da laje (decisão 0011, item 11), e os furos do piso e da laje do nível de cima. O forro fica
 * pendurado sob essa laje, então a escada e o furo aparecem nele.
 */
function ceilingVoid(upper: UpperOpenings, bottomZ: number): MultiPolygon {
  const parts = [stairHolesFor(upper.stairs, bottomZ), ...upper.shafts].filter((region) => region.length > 0);
  return parts.length ? union(...parts) : [];
}

/**
 * Geometria dos forros de um nível (decisão 0021). Forro não é recortado por parede: o forro desenhado à mão fica onde o
 * usuário desenhou; o criado de ambiente acompanha o contorno do ambiente (`ceilingOutline`, P-5). Perde o vão de escada
 * e de furo do nível de cima (B6, `ceilingVoid`). Tipo ausente, contorno com menos de 3 pontos ou forro inteiro coberto
 * pelo vão são ignorados (a validação avisa).
 */
export function resolveCeilings(p: Project, levelId: Id): ResolvedCeiling[] {
  const out: ResolvedCeiling[] = [];
  const upper = upperOpenings(p, levelId);
  const list = ceilingsOnLevel(p, levelId);
  const rooms = list.some(followsRoom) ? roomsById(p, levelId) : new Map<Id, ResolvedRoom>();
  for (const c of list) {
    const type = p.ceilingTypes[c.typeId];
    const outline = ceilingOutline(p, c, rooms);
    if (!type || outline.boundary.length < 3) continue;
    const topZ = levelElevation(p, c.levelId) + c.heightOffset;
    let z = topZ;
    const layers: ResolvedCeilingLayer[] = [];
    type.layers.forEach((l, i) => {
      if (l.thickness < 1e-6) return;
      layers.push({ layerIndex: i, materialId: l.materialId, z0: z - l.thickness, z1: z });
      z -= l.thickness;
    });
    const polygon = cutStairOpenings([[outline.boundary, ...outline.holes]], ceilingVoid(upper, z));
    if (polygon.length === 0) continue;
    out.push({ ceilingId: c.id, typeId: c.typeId, levelId: c.levelId, polygon, topZ, bottomZ: z, layers, problem: outline.problem });
  }
  return out;
}

/** Forros de todos os níveis do projeto. */
export const resolveAllCeilings = (p: Project): ResolvedCeiling[] => p.levels.flatMap((l) => resolveCeilings(p, l.id));

/** Rascunho de forro para um ambiente: contorno e furos do ambiente, no pé-direito dele (forro por ambiente, decisão 0021). */
export type CeilingDraft = Omit<Ceiling, 'order'>;

/**
 * Um rascunho de forro por ambiente do nível que tem circuito fechado (ambientes "aberto", "fora" ou duplicados no mesmo
 * circuito não entram). O id vem
 * de `idOf` para o chamador escolher (o comando grava o lote inteiro com um só desfazer).
 */
export function ceilingDraftsFromRooms(p: Project, levelId: Id, typeId: Id, idOf: (i: number) => Id): CeilingDraft[] {
  const out: CeilingDraft[] = [];
  for (const r of resolveRooms(p, levelId)) {
    if (!r.polygon || r.problem !== null || r.duplicateOf !== undefined) continue;
    const [outer, ...holes] = r.polygon;
    if (!outer || outer.length < 3) continue;
    const boundary: Vec2[] = outer;
    out.push({
      id: idOf(out.length),
      kind: 'ceiling',
      typeId,
      levelId,
      boundary,
      holes,
      roomId: r.roomId,
      heightOffset: r.ceilingHeight,
      mark: r.number,
      comments: '',
    });
  }
  return out;
}
