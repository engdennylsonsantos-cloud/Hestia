import { boxOf, boxesOverlap, intersection, multiArea, multiPoints, triangulate, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { levelAbove, type Id, type Project } from '@hestia/model';
import { bandTopAt } from './profile.ts';
import { resolveFloors, type ResolvedFloor, type ResolvedFloorLayer } from './floors.ts';
import { resolveSlabs, slabRiseAt, type ResolvedSlab } from './slabs.ts';
import { winsOver, type JunctionKind, type JunctionMeta } from './junctionPlanar.ts';
import { resolveLevel } from './resolve.ts';
import type { LayerBand, ResolvedWall } from './types.ts';

export type { JunctionKind } from './junctionPlanar.ts';

/**
 * Quantitativos líquidos (decisão 0023 §4, P5). Um elemento cortado perde o volume que está dentro do elemento que o
 * corta, nas faixas de cota que se cruzam. O padrão por tipo vale para todo o projeto (P-4 adiada: sem inversão por par):
 * laje corta piso e parede; piso corta parede; parede não corta ninguém; laje não é cortada por nenhum elemento.
 */

/** Quem corta um elemento deste tipo sem atributo de camada (padrão por tipo, §1.3). Só para peças sem `meta`. */
const CUTTERS: Record<JunctionKind, readonly JunctionKind[]> = {
  wall: ['floor', 'slab'],
  floor: ['slab'],
  slab: [],
};

/** Atributos de junção da camada e o elemento dono (a camada não corta as outras do próprio elemento). */
export interface PieceMeta extends JunctionMeta {
  owner: string;
}

/**
 * Pedaço sólido: a forma em planta e a faixa de cota (base e topo absolutos, em m) em cada ponto. `flat` indica cota
 * constante (sem inclinação nem perfil de topo); então a conta é exata por área.
 */
export interface SolidPiece {
  poly: MultiPolygon;
  span: (p: Vec2) => readonly [number, number];
  flat: boolean;
  /** Prioridade, núcleo e dono da camada (P7). Sem ele, vale o padrão por tipo (`CUTTERS`). */
  meta?: PieceMeta;
}

/** Elemento que corta outros, como os pedaços de cada camada dele. */
export interface CutterSolid {
  kind: JunctionKind;
  pieces: SolidPiece[];
}

/** Tolerância (m) para a face de espessura zero (membrana) estar dentro da faixa de um cortador. */
const Z_EPS = 1e-6;

/**
 * `c` (com a peça `cp`) corta a peça `piece`? Com atributos de camada, vale a prioridade (0023 §1, P7) e o outro elemento
 * do próprio dono não corta. Sem atributos, vale o padrão por tipo.
 */
function cuts(c: CutterSolid, cp: SolidPiece, piece: SolidPiece, kind: JunctionKind): boolean {
  if (cp.meta && piece.meta) {
    if (cp.meta.owner === piece.meta.owner) return false;
    return winsOver(cp.meta, piece.meta) === true;
  }
  return CUTTERS[kind].includes(c.kind);
}

const ORIGIN: Vec2 = { x: 0, y: 0 };

/** Pedaço de faixa constante `z0..z1` sobre a forma `poly`. */
export const flatPiece = (poly: MultiPolygon, z0: number, z1: number): SolidPiece => ({ poly, span: () => [z0, z1], flat: true });

/**
 * Integral de `f` sobre a forma: triangula cada polígono e usa a média de `f` nos três vértices de cada triângulo,
 * ponderada pela área. É exata quando `f` é afim dentro do triângulo (inclinação sem quebra de faixa).
 */
function integrate(m: MultiPolygon, f: (p: Vec2) => number): number {
  let total = 0;
  for (const poly of m) {
    const mesh = triangulate(poly);
    const v = mesh.positions;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const pts = [0, 1, 2].map((k) => {
        const j = mesh.indices[i + k]! * 2;
        return { x: v[j]!, y: v[j + 1]! };
      });
      const [a, b, c] = pts as [Vec2, Vec2, Vec2];
      const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
      total += (area * (f(a) + f(b) + f(c))) / 3;
    }
  }
  return total;
}

/** Faixa de cota (menor base e maior topo) de um pedaço, pelos vértices. Cacheada: o pedaço não muda depois de montado. */
const envelopes = new WeakMap<SolidPiece, readonly [number, number]>();
function zEnvelope(sp: SolidPiece): readonly [number, number] {
  const hit = envelopes.get(sp);
  if (hit) return hit;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const poly of sp.poly) for (const ring of poly) for (const v of ring) {
    const [a, b] = sp.span(v);
    z0 = Math.min(z0, a);
    z1 = Math.max(z1, b);
  }
  const env = [z0, z1] as const;
  envelopes.set(sp, env);
  return env;
}

/** Volume (m³) de `a` que está dentro de `b`: área da interseção em planta vezes a sobreposição de cota. */
export function overlapVolume(a: SolidPiece, b: SolidPiece): number {
  const [a0, a1] = zEnvelope(a);
  const [b0, b1] = zEnvelope(b);
  if (Math.min(a1, b1) - Math.max(a0, b0) <= 0) return 0;
  if (!boxesOverlap(boxOf(multiPoints(a.poly)), boxOf(multiPoints(b.poly)))) return 0;
  const common = intersection(a.poly, b.poly);
  if (common.length === 0) return 0;
  const height = (p: Vec2): number => {
    const [a0, a1] = a.span(p);
    const [b0, b1] = b.span(p);
    return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  };
  if (a.flat && b.flat) return multiArea(common) * height(ORIGIN);
  return integrate(common, height);
}

/** Volume (m³) de um pedaço de tipo `kind` que cai dentro dos elementos que o cortam (padrão por tipo). */
export function cutVolume(piece: SolidPiece, kind: JunctionKind, cutters: readonly CutterSolid[]): number {
  let cut = 0;
  for (const c of cutters) {
    for (const cp of c.pieces) if (cuts(c, cp, piece, kind)) cut += overlapVolume(piece, cp);
  }
  return cut;
}

/**
 * Área (m²) de uma face de espessura zero (membrana) em `piece` que está numa faixa de cortador na cota `z`: a face
 * some onde o cortador a engloba. Sem sobreposição de cota vale zero.
 */
export function coveredFaceArea(piece: SolidPiece, kind: JunctionKind, cutters: readonly CutterSolid[]): number {
  let area = 0;
  for (const c of cutters) {
    for (const cp of c.pieces) {
      if (!cuts(c, cp, piece, kind)) continue;
      const common = intersection(piece.poly, cp.poly);
      const first = common[0]?.[0]?.[0];
      if (!first) continue;
      const [z, zTop] = piece.span(first);
      const [c0, c1] = cp.span(first);
      if (z >= c0 - Z_EPS && zTop <= c1 + Z_EPS) area += multiArea(common);
    }
  }
  return area;
}

/** Pedaço de uma camada de laje: a forma em planta da camada (P8) e a faixa de cota dela (inclinação incluída). */
export function slabLayerPiece(rs: ResolvedSlab, l: ResolvedSlab['layers'][number]): SolidPiece {
  return {
    poly: l.polygon,
    span: (q: Vec2) => [l.z0 + slabRiseAt(rs.slope, q), l.z1 + slabRiseAt(rs.slope, q)] as const,
    flat: rs.slope === null,
    meta: { kind: 'slab', priority: l.priority, core: l.core, owner: rs.slabId },
  };
}

/** Pedaços das lajes do nível, camada a camada (a inclinação entra na faixa de cada ponto). */
export function slabCutters(p: Project, levelId: Id): CutterSolid[] {
  return resolveSlabs(p, levelId).map((rs) => ({ kind: 'slab', pieces: rs.layers.map((l) => slabLayerPiece(rs, l)) }));
}

/** Pedaço de uma camada de piso: a forma em planta da camada (P8, pode ir ao núcleo da parede) e a faixa de cota dela. */
export function floorLayerPiece(rf: ResolvedFloor, l: ResolvedFloorLayer): SolidPiece {
  return { ...flatPiece(l.polygon, l.z0, l.z1), meta: { kind: 'floor', priority: l.priority, core: l.core, owner: rf.floorId } };
}

/** Pedaços dos pisos do nível, camada a camada. */
export function floorCutters(p: Project, levelId: Id): CutterSolid[] {
  return resolveFloors(p, levelId).map((rf: ResolvedFloor) => ({ kind: 'floor', pieces: rf.layers.map((l) => floorLayerPiece(rf, l)) }));
}

/** Faixa de parede de uma camada (índice da camada na parede), para a junção que devolve partes por camada (P7c). */
export interface WallLayerPiece {
  layerIndex: number;
  piece: SolidPiece;
}

/** Pedaços das faixas de parede do nível, com o índice da camada de cada um (base da junção por camada, P7c). */
export function wallLayerPieces(p: Project, levelId: Id): WallLayerPiece[] {
  const r = resolveLevel(p, levelId);
  return Object.values(r.walls).flatMap((rw) =>
    rw.layers.flatMap((l) => l.bands.map((b) => ({ layerIndex: l.layerIndex, piece: bandPiece(rw, b, { priority: l.priority, core: l.core }) }))),
  );
}

/** Pedaços das faixas de parede do nível, camada a camada: piso e laje também podem ser cortados por parede (0023 §1, P7). */
export function wallCutters(p: Project, levelId: Id): CutterSolid[] {
  return [{ kind: 'wall', pieces: wallLayerPieces(p, levelId).map((x) => x.piece) }];
}

/**
 * Níveis adjacentes (0023 §10, P7c): o de elevação imediatamente acima e o imediatamente abaixo. Sem nível vizinho,
 * a lista sai menor. Nível inexistente sai vazio.
 */
export function adjacentLevelIds(p: Project, levelId: Id): Id[] {
  const base = p.levels.find((l) => l.id === levelId);
  if (!base) return [];
  let below: { id: Id; elevation: number } | null = null;
  for (const l of p.levels) if (l.elevation < base.elevation && (!below || l.elevation > below.elevation)) below = l;
  const above = levelAbove(p, levelId);
  return [above?.id, below?.id].filter((id): id is Id => id !== undefined);
}

/**
 * Cortadores de um nível vizinho que cortam os elementos do nível (P7c, junção entre níveis). Para parede do nível, são
 * os pisos e as lajes dos níveis adjacentes (a laje do nível de cima apoiada na parede do térreo, ou a laje que a
 * atravessa). Para piso e laje do nível, são as faixas de parede dos níveis adjacentes (a parede do térreo que sobe
 * até a laje). Quem perde é só o de menor prioridade, então o volume sai uma vez (0023 §4).
 */
export function adjacentCutters(p: Project, levelId: Id, target: 'wall' | 'horizontal'): CutterSolid[] {
  return adjacentLevelIds(p, levelId).flatMap((id) => (target === 'wall' ? [...floorCutters(p, id), ...slabCutters(p, id)] : wallCutters(p, id)));
}

/** Pedaço de uma faixa de altura de parede: a base absoluta da parede mais a faixa (o topo pode ser inclinado). */
export function bandPiece(rw: ResolvedWall, b: LayerBand, meta?: Pick<PieceMeta, 'priority' | 'core'>): SolidPiece {
  return {
    poly: b.poly,
    span: (q: Vec2) => [rw.baseZ + b.z0, rw.baseZ + bandTopAt(b, q)] as const,
    flat: !b.slope,
    ...(meta ? { meta: { kind: 'wall' as const, owner: rw.wallId, ...meta } } : {}),
  };
}
