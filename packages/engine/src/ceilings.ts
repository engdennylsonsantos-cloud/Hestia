import type { MultiPolygon, Vec2 } from '@hestia/geom';
import { ceilingPolygon, ceilingsOnLevel, levelElevation, type Ceiling, type Id, type Project } from '@hestia/model';
import { resolveRooms } from './rooms.ts';

/** Camada resolvida do forro: a mesma área em planta, entre as cotas absolutas z0 e z1. */
export interface ResolvedCeilingLayer {
  layerIndex: number;
  materialId: Id;
  z0: number;
  z1: number;
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
}

/**
 * Geometria dos forros de um nível (decisão 0021). Forro não é recortado por escada nem por parede: fica onde o usuário
 * desenhou. Tipo ausente ou contorno com menos de 3 pontos são ignorados (a validação avisa).
 */
export function resolveCeilings(p: Project, levelId: Id): ResolvedCeiling[] {
  const out: ResolvedCeiling[] = [];
  for (const c of ceilingsOnLevel(p, levelId)) {
    const type = p.ceilingTypes[c.typeId];
    if (!type || c.boundary.length < 3) continue;
    const topZ = levelElevation(p, c.levelId) + c.heightOffset;
    let z = topZ;
    const layers: ResolvedCeilingLayer[] = [];
    type.layers.forEach((l, i) => {
      if (l.thickness < 1e-6) return;
      layers.push({ layerIndex: i, materialId: l.materialId, z0: z - l.thickness, z1: z });
      z -= l.thickness;
    });
    const polygon: MultiPolygon = [ceilingPolygon(c)];
    out.push({ ceilingId: c.id, typeId: c.typeId, levelId: c.levelId, polygon, topZ, bottomZ: z, layers });
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
