import { boxOf, boxesOverlap, intersection, multiArea, multiPoints, triangulate, type MultiPolygon, type Vec2 } from '@hestia/geom';
import type { Id, Project } from '@hestia/model';
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
  /** Camada do elemento (piso, laje e parede) e faixa de altura (só parede): chaves para devolver a parte resolvida (F1b). */
  layerIndex?: number;
  bandIndex?: number;
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

/** Volume (m³) de `a` que está dentro de `b`: área da interseção em planta vezes a sobreposição de cota. */
export function overlapVolume(a: SolidPiece, b: SolidPiece): number {
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
    meta: { kind: 'slab', priority: l.priority, core: l.core, owner: rs.slabId, layerIndex: l.layerIndex },
  };
}

/** Pedaço de uma camada de piso: a forma em planta da camada (P8, pode ir ao núcleo da parede) e a faixa de cota dela. */
export function floorLayerPiece(rf: ResolvedFloor, l: ResolvedFloorLayer): SolidPiece {
  return {
    ...flatPiece(l.polygon, l.z0, l.z1),
    meta: { kind: 'floor', priority: l.priority, core: l.core, owner: rf.floorId, layerIndex: l.layerIndex },
  };
}

/** Pedaço de uma faixa de altura de parede: a base absoluta da parede mais a faixa (o topo pode ser inclinado). */
export function bandPiece(rw: ResolvedWall, b: LayerBand, meta?: Pick<PieceMeta, 'priority' | 'core' | 'layerIndex' | 'bandIndex'>): SolidPiece {
  return {
    poly: b.poly,
    span: (q: Vec2) => [rw.baseZ + b.z0, rw.baseZ + bandTopAt(b, q)] as const,
    flat: !b.slope,
    ...(meta ? { meta: { kind: 'wall' as const, owner: rw.wallId, ...meta } } : {}),
  };
}

/** Cota absoluta em que um pedaço existe: envolvente dos vértices (topo inclinado incluído). Sem vértices: null. */
export function spanRange(sp: SolidPiece): readonly [number, number] | null {
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const poly of sp.poly) {
    for (const ring of poly) {
      for (const v of ring) {
        const [a, b] = sp.span(v);
        z0 = Math.min(z0, a);
        z1 = Math.max(z1, b);
      }
    }
  }
  return z0 <= z1 ? [z0, z1] : null;
}

/**
 * Pedaços de cada categoria de um nível, sem filtro: pisos e lajes por camada; paredes por faixa (`wallBandPieces`).
 */
function levelCutters(p: Project, levelId: Id): LevelCutters {
  return {
    floors: resolveFloors(p, levelId).map((rf) => ({ kind: 'floor', pieces: rf.layers.map((l) => floorLayerPiece(rf, l)) })),
    slabs: resolveSlabs(p, levelId).map((rs) => ({ kind: 'slab', pieces: rs.layers.map((l) => slabLayerPiece(rs, l)) })),
    walls: [{ kind: 'wall', pieces: wallBandPieces(p, levelId).map((w) => w.piece) }],
  };
}

/** Cortadores separados por categoria, como os usam quantitativos e junção. */
export interface LevelCutters {
  floors: CutterSolid[];
  slabs: CutterSolid[];
  walls: CutterSolid[];
}

/**
 * Cortadores de um nível (0023 §1, F1b): pisos, lajes e paredes do próprio nível, mais os de OUTROS níveis que tocam a
 * faixa de cota do nível. Assim a laje do pavimento de cima corta a parede do térreo que a atravessa, e a parede que sobe
 * corta a laje de cima. Peças de outro nível sem cota comum com o nível não entram. Peças próprias entram sempre.
 */
export function levelCutterSet(p: Project, levelId: Id): LevelCutters {
  const own = levelCutters(p, levelId);
  const ownRanges = [...own.floors, ...own.slabs, ...own.walls]
    .flatMap((c) => c.pieces.map(spanRange))
    .filter((r): r is readonly [number, number] => r !== null);
  if (ownRanges.length === 0) return own;
  const lo = Math.min(...ownRanges.map((r) => r[0]));
  const hi = Math.max(...ownRanges.map((r) => r[1]));
  const reaches = (sp: SolidPiece): boolean => {
    const r = spanRange(sp);
    return r !== null && r[1] > lo + Z_EPS && r[0] < hi - Z_EPS;
  };
  const out: LevelCutters = { floors: [...own.floors], slabs: [...own.slabs], walls: [...own.walls] };
  for (const other of p.levels) {
    if (other.id === levelId) continue;
    const c = levelCutters(p, other.id);
    const keep = (solids: CutterSolid[]): CutterSolid[] =>
      solids.map((s) => ({ kind: s.kind, pieces: s.pieces.filter(reaches) })).filter((s) => s.pieces.length > 0);
    out.floors.push(...keep(c.floors));
    out.slabs.push(...keep(c.slabs));
    out.walls.push(...keep(c.walls));
  }
  return out;
}

/** Pedaços dos pisos do nível e dos níveis que o alcançam (F1b), camada a camada. */
export function floorCutters(p: Project, levelId: Id): CutterSolid[] {
  return levelCutterSet(p, levelId).floors;
}

/** Pedaços das lajes do nível e dos níveis que o alcançam (F1b), camada a camada (a inclinação entra na faixa). */
export function slabCutters(p: Project, levelId: Id): CutterSolid[] {
  return levelCutterSet(p, levelId).slabs;
}

/** Pedaços das faixas de parede do nível e dos níveis que o alcançam (F1b): piso e laje também cortam parede (0023 §1). */
export function wallCutters(p: Project, levelId: Id): CutterSolid[] {
  return levelCutterSet(p, levelId).walls;
}

/**
 * Pedaço de uma faixa de parede com a origem dela (parede, camada e faixa), para devolver a parte resolvida à faixa certa
 * (decisão 0023 §3, F1). Faixa com topo inclinado vem com `slope` e não entra na junção.
 */
export interface WallBandPiece {
  wallId: Id;
  layerIndex: number;
  bandIndex: number;
  piece: SolidPiece;
}

/** Pedaços de todas as faixas de parede do próprio nível, com a origem de cada um. */
export function wallBandPieces(p: Project, levelId: Id): WallBandPiece[] {
  const r = resolveLevel(p, levelId);
  return Object.values(r.walls).flatMap((rw) =>
    rw.layers.flatMap((l) =>
      l.bands.map((b, bandIndex) => ({
        wallId: rw.wallId,
        layerIndex: l.layerIndex,
        bandIndex,
        piece: bandPiece(rw, b, { priority: l.priority, core: l.core, layerIndex: l.layerIndex, bandIndex }),
      })),
    ),
  );
}
