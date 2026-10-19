import {
  boxOf,
  boxesOverlap,
  difference,
  expandBox,
  intersectSegments,
  intersection,
  multiArea,
  orientedRect,
  ringArea,
  union,
  type Box,
  type MultiPolygon,
  type Ring,
  type Vec2,
} from '@hestia/geom';
import {
  layerPriority,
  layerSpans,
  openingSill,
  openingType,
  openingsOfWall,
  wallBaseElevation,
  wallHeight,
  wallsOnLevel,
  wallType,
  type Id,
  type Opening,
  type Project,
} from '@hestia/model';
import { buildFrame, pointAt, sAtDepth, type WallFrame } from './frame.ts';
import { computeEnds, miterPoint, type EndSpec, type WallEnds } from './joins.ts';
import type { OpeningGeometry, OpeningPiece, Region, ResolvedCluster, ResolvedLayer, ResolvedLevel, ResolvedWall } from './types.ts';

const MIN_AREA = 1e-9;
const CLUSTER_PAD = 0.02;

interface Item {
  wallId: Id;
  layerIndex: number;
  materialId: Id;
  priority: number;
  order: number;
  shape: MultiPolygon;
  box: Box;
}

function endPoint(f: WallFrame, which: 'a' | 'b', spec: EndSpec, s: number): Vec2 {
  if (spec.kind === 'flat') return pointAt(f, spec.t, s);
  const d = spec.self.sigma > 0 ? spec.self.sHi - s : s - spec.self.sLo;
  const p = miterPoint(spec.self, spec.other, Math.max(0, Math.min(d, spec.self.sHi - spec.self.sLo)));
  return p ?? pointAt(f, which === 'a' ? 0 : f.length, s);
}

function isSimple(q: Ring): boolean {
  return Math.abs(ringArea(q)) >= MIN_AREA && !crossing(q);
}

/** Quadrilátero com arestas opostas cruzadas = camada "torcida" por esquadro mal condicionado. */
function crossing(q: Ring): boolean {
  const hit = (i: number, j: number): boolean => {
    const p = intersectSegments(q[i]!, q[(i + 1) % 4]!, q[j]!, q[(j + 1) % 4]!);
    if (!p) return false;
    // Tocar num vértice compartilhado não é cruzamento.
    return !q.some((v) => Math.abs(v.x - p.x) < 1e-9 && Math.abs(v.y - p.y) < 1e-9);
  };
  return hit(0, 2) || hit(1, 3);
}

function layerQuad(f: WallFrame, ends: WallEnds, s1: number, s2: number): Ring {
  const lo = Math.min(s1, s2);
  const hi = Math.max(s1, s2);
  const quad = [endPoint(f, 'a', ends.a, lo), endPoint(f, 'b', ends.b, lo), endPoint(f, 'b', ends.b, hi), endPoint(f, 'a', ends.a, hi)];
  if (isSimple(quad)) return quad;
  return [pointAt(f, 0, lo), pointAt(f, f.length, lo), pointAt(f, f.length, hi), pointAt(f, 0, hi)];
}

function buildItems(f: WallFrame, ends: WallEnds): Item[] {
  const items: Item[] = [];
  for (const sp of layerSpans(f.type)) {
    if (sp.layer.thickness < 1e-6) continue;
    const ring = layerQuad(f, ends, sAtDepth(f, sp.from), sAtDepth(f, sp.to));
    items.push({
      wallId: f.wall.id,
      layerIndex: sp.index,
      materialId: sp.layer.materialId,
      priority: layerPriority(sp.layer),
      order: f.wall.order,
      shape: [[ring]],
      box: boxOf(ring),
    });
  }
  return items;
}

/** Algoritmo do pintor por prioridade (docs/05 §1): quem tem prioridade maior corta quem tem menor. */
function paint(items: Item[]): Map<Item, MultiPolygon> {
  const sorted = [...items].sort((x, y) => x.priority - y.priority || x.order - y.order || x.layerIndex - y.layerIndex);
  const result = new Map<Item, MultiPolygon>();
  const higher: Item[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j]!.priority === sorted[i]!.priority) j++;
    const group = sorted.slice(i, j);
    const accepted: Item[] = [];
    for (const it of group) {
      const subs: MultiPolygon[] = [];
      for (const h of higher) if (boxesOverlap(h.box, it.box)) subs.push(h.shape);
      // Mesma prioridade: o mais antigo vence, então a camada nova não duplica a área do canto.
      for (const g of accepted) if (g.wallId !== it.wallId && boxesOverlap(g.box, it.box)) subs.push(g.shape);
      const vis = subs.length ? difference(it.shape, ...subs) : it.shape;
      result.set(it, vis.filter((p) => multiArea([p]) > MIN_AREA));
      accepted.push(it);
    }
    higher.push(...group);
    i = j;
  }
  return result;
}

function clusterWalls(frames: WallFrame[], ends: Map<string, WallEnds>): WallFrame[][] {
  const boxes = frames.map((f) => {
    const e = ends.get(f.wall.id)!;
    const pts = [f.sHi, f.sLo].flatMap((s) => [endPoint(f, 'a', e.a, s), endPoint(f, 'b', e.b, s)]);
    return expandBox(boxOf(pts), CLUSTER_PAD);
  });
  const parent = frames.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r]!;
    return r;
  };
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      if (boxesOverlap(boxes[i]!, boxes[j]!)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, WallFrame[]>();
  frames.forEach((f, i) => {
    const k = find(i);
    groups.set(k, [...(groups.get(k) ?? []), f]);
  });
  return [...groups.values()];
}

export function openingGeometry(p: Project, o: Opening, f: WallFrame): OpeningGeometry {
  const t = openingType(p, o);
  return {
    openingId: o.id,
    hostId: o.hostId,
    kind: o.kind,
    center: pointAt(f, o.offset, f.sMid),
    u: f.u,
    n: f.n,
    width: t.width,
    height: t.height,
    sill: openingSill(t, o),
    thickness: f.thickness,
    sHi: f.sHi,
    sLo: f.sLo,
    leaves: t.leaves,
    flipHand: o.flipHand,
    flipFacing: o.flipFacing,
    offset: o.offset,
  };
}

const openingRect = (g: OpeningGeometry): MultiPolygon => [
  [orientedRect(g.center.x, g.center.y, g.u.x, g.u.y, g.width / 2, g.thickness / 2 + 0.02)],
];

const round = (n: number): number => Math.round(n * 1e6) / 1e6;

function clusterKey(items: Item[], opens: OpeningGeometry[]): string {
  const it = items.map((i) => `${i.wallId}|${i.layerIndex}|${i.materialId}|${i.priority}|${i.order}|${i.shape[0]![0]!.map((v) => `${round(v.x)},${round(v.y)}`).join(';')}`);
  const op = opens.map((g) => `${g.openingId}|${g.hostId}|${round(g.center.x)},${round(g.center.y)}|${round(g.width)}|${round(g.height)}|${round(g.sill)}|${round(g.u.x)},${round(g.u.y)}|${round(g.thickness)}`);
  return `${it.join('\n')}\n--\n${op.join('\n')}`;
}

interface ClusterCore {
  layers: Map<Id, ResolvedLayer[]>;
  pieces: Map<Id, OpeningPiece[]>;
  regions: Region[];
  silhouette: MultiPolygon;
}

function solveCluster(items: Item[], opens: OpeningGeometry[], heights: Map<Id, number>): ClusterCore {
  const painted = paint(items);
  const layers = new Map<Id, ResolvedLayer[]>();
  const pieces = new Map<Id, OpeningPiece[]>();
  const byMaterial = new Map<Id, MultiPolygon[]>();
  for (const it of items) {
    const fragment = painted.get(it)!;
    if (fragment.length === 0) continue;
    const mine = opens.filter((g) => g.hostId === it.wallId);
    const rects = mine.map(openingRect);
    const cut = rects.length ? difference(fragment, ...rects) : fragment;
    const H = heights.get(it.wallId) ?? 2.8;
    const list = pieces.get(it.wallId) ?? [];
    mine.forEach((g, i) => {
      const inside = intersection(fragment, rects[i]!);
      if (inside.length === 0) return;
      const mk = (z0: number, z1: number): OpeningPiece => ({ openingId: g.openingId, layerIndex: it.layerIndex, materialId: it.materialId, poly: inside, z0, z1 });
      if (g.sill > 1e-3) list.push(mk(0, Math.min(g.sill, H)));
      if (g.sill + g.height < H - 1e-3) list.push(mk(g.sill + g.height, H));
    });
    pieces.set(it.wallId, list);
    const arr = layers.get(it.wallId) ?? [];
    arr.push({ layerIndex: it.layerIndex, materialId: it.materialId, priority: it.priority, fragment, cut });
    layers.set(it.wallId, arr);
    byMaterial.set(it.materialId, [...(byMaterial.get(it.materialId) ?? []), cut]);
  }
  const regions: Region[] = [...byMaterial.entries()].map(([materialId, parts]) => ({ materialId, polygons: union(...parts) }));
  const silhouette = union(...regions.map((r) => r.polygons));
  for (const arr of layers.values()) arr.sort((a, b) => a.layerIndex - b.layerIndex);
  return { layers, pieces, regions, silhouette };
}

export type ResolveCache = Map<string, ClusterCore>;
const sharedCache: ResolveCache = new Map();
const CACHE_LIMIT = 400;

export function frameOfWall(p: Project, wallId: Id): WallFrame | null {
  const w = p.elements[wallId];
  if (!w || w.kind !== 'wall') return null;
  return buildFrame(w, wallType(p, w));
}

export function resolveLevel(p: Project, levelId: Id, cache: ResolveCache = sharedCache): ResolvedLevel {
  const walls = wallsOnLevel(p, levelId);
  const frames = walls.map((w) => buildFrame(w, wallType(p, w))).filter((f): f is WallFrame => f !== null);
  const ends = computeEnds(frames);
  const out: ResolvedLevel = { levelId, walls: {}, clusters: [] };
  for (const group of clusterWalls(frames, ends)) {
    const items = group.flatMap((f) => buildItems(f, ends.get(f.wall.id)!));
    const opens = group.flatMap((f) => openingsOfWall(p, f.wall.id).map((o) => openingGeometry(p, o, f)));
    const heights = new Map(group.map((f) => [f.wall.id, wallHeight(p, f.wall)] as const));
    const key = `${clusterKey(items, opens)}\n--\n${[...heights].map(([k, v]) => `${k}:${round(v)}`).join(',')}`;
    let core = cache.get(key);
    if (!core) {
      core = solveCluster(items, opens, heights);
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
      cache.set(key, core);
    }
    const cluster: ResolvedCluster = { wallIds: group.map((f) => f.wall.id), regions: core.regions, silhouette: core.silhouette };
    out.clusters.push(cluster);
    for (const f of group) {
      const rw: ResolvedWall = {
        wallId: f.wall.id,
        a: f.a,
        b: f.b,
        u: f.u,
        n: f.n,
        length: f.length,
        sHi: f.sHi,
        sLo: f.sLo,
        baseZ: wallBaseElevation(p, f.wall),
        height: heights.get(f.wall.id)!,
        layers: core.layers.get(f.wall.id) ?? [],
        pieces: core.pieces.get(f.wall.id) ?? [],
      };
      out.walls[f.wall.id] = rw;
    }
  }
  return out;
}
