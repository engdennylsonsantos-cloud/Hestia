import {
  arcSample,
  boxOf,
  boxesOverlap,
  difference,
  expandBox,
  intersectSegments,
  intersection,
  multiArea,
  orientedRect,
  ringArea,
  closeGaps,
  union,
  type Box,
  type MultiPolygon,
  type Ring,
  type Vec2,
} from '@hestia/geom';
import {
  coreSpan,
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
import { buildFrame, normalAt, pointAt, sAtDepth, tangentAt, toLocal, type WallFrame } from './frame.ts';
import { computeEnds, miterPoint, type EndSpec, type WallEnds } from './joins.ts';
import type { LayerBand, OpeningGeometry, Region, ResolvedCluster, ResolvedLayer, ResolvedLevel, ResolvedWall } from './types.ts';

const MIN_AREA = 1e-9;
const CLUSTER_PAD = 0.02;

interface Item {
  wallId: Id;
  layerIndex: number;
  materialId: Id;
  priority: number;
  order: number;
  /** Espessura do núcleo da parede: desempata camadas de mesma prioridade (a mais robusta domina). */
  coreT: number;
  shape: MultiPolygon;
  box: Box;
}

const ringsOfShape = (m: MultiPolygon): string => m.map((p) => p.map((r) => r.map((v) => `${round(v.x)},${round(v.y)}`).join(';')).join('|')).join('/');

/** Em paredes curvas, leva o ponto à circunferência da camada (os cortes usam a tangente: erro de milímetros). */
function onLayerCircle(f: WallFrame, p: Vec2, s: number): Vec2 {
  if (!f.arc) return p;
  const c = f.arc.center;
  const rho = f.arc.radius + f.arc.k * s;
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const l = Math.hypot(dx, dy);
  return l < 1e-9 ? p : { x: c.x + (dx / l) * rho, y: c.y + (dy / l) * rho };
}

function endPoint(f: WallFrame, which: 'a' | 'b', spec: EndSpec, s: number): Vec2 {
  if (spec.kind === 'flat') return pointAt(f, spec.t, s);
  const d = spec.self.sigma > 0 ? spec.self.sHi - s : s - spec.self.sLo;
  const p = miterPoint(spec.self, spec.other, Math.max(0, Math.min(d, spec.self.sHi - spec.self.sLo)));
  return p ? onLayerCircle(f, p, s) : pointAt(f, which === 'a' ? 0 : f.length, s);
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

/** Camada de parede curva: contorno com as bordas externa e interna amostradas ao longo do arco. */
function arcLayerRing(f: WallFrame, ends: WallEnds, lo: number, hi: number): Ring {
  const pa = [endPoint(f, 'a', ends.a, lo), endPoint(f, 'a', ends.a, hi)] as const;
  const pb = [endPoint(f, 'b', ends.b, lo), endPoint(f, 'b', ends.b, hi)] as const;
  const t = (p: Vec2): number => toLocal(f, p).t;
  const loPts = arcSample(f.arc!, t(pa[0]), t(pb[0]), lo);
  const hiPts = arcSample(f.arc!, t(pb[1]), t(pa[1]), hi);
  return [pa[0], ...loPts.slice(1, -1), pb[0], pb[1], ...hiPts.slice(1, -1), pa[1]];
}

function layerQuad(f: WallFrame, ends: WallEnds, s1: number, s2: number): Ring {
  const lo = Math.min(s1, s2);
  const hi = Math.max(s1, s2);
  if (f.arc) return arcLayerRing(f, ends, lo, hi);
  const quad = [endPoint(f, 'a', ends.a, lo), endPoint(f, 'b', ends.b, lo), endPoint(f, 'b', ends.b, hi), endPoint(f, 'a', ends.a, hi)];
  if (isSimple(quad)) return quad;
  return [pointAt(f, 0, lo), pointAt(f, f.length, lo), pointAt(f, f.length, hi), pointAt(f, 0, hi)];
}

function buildItems(f: WallFrame, ends: WallEnds): Item[] {
  const items: Item[] = [];
  for (const sp of layerSpans(f.type)) {
    if (sp.layer.thickness < 1e-6) continue;
    const ring = layerQuad(f, ends, sAtDepth(f, sp.from), sAtDepth(f, sp.to));
    let shape: MultiPolygon = [[ring]];
    for (const e of [ends.a, ends.b]) {
      if (e.kind === 'flat' && e.clip) shape = intersection(shape, [[e.clip]]);
    }
    if (shape.length === 0) continue;
    items.push({
      wallId: f.wall.id,
      layerIndex: sp.index,
      materialId: sp.layer.materialId,
      priority: layerPriority(sp.layer),
      order: f.wall.order,
      coreT: Math.round((coreSpan(f.type).to - coreSpan(f.type).from) * 1e6) / 1e6,
      shape,
      box: boxOf(shape.flatMap((p) => p[0] ?? [])),
    });
  }
  return items;
}

/** Algoritmo do pintor por prioridade (docs/05 §1): quem tem prioridade maior corta quem tem menor. */
function paint(items: Item[]): Map<Item, MultiPolygon> {
  const sorted = [...items].sort((x, y) => x.priority - y.priority || y.coreT - x.coreT || x.order - y.order || x.layerIndex - y.layerIndex);
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
    const pts = [f.sHi, f.sLo].flatMap((s) => [
      endPoint(f, 'a', e.a, s),
      endPoint(f, 'b', e.b, s),
      ...(f.arc ? arcSample(f.arc, 0, f.length, s, 0.05) : []),
    ]);
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
    u: tangentAt(f, o.offset),
    n: normalAt(f, o.offset),
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
  const it = items.map((i) => `${i.wallId}|${i.layerIndex}|${i.materialId}|${i.priority}|${i.order}|${ringsOfShape(i.shape)}`);
  const op = opens.map((g) => `${g.openingId}|${g.hostId}|${round(g.center.x)},${round(g.center.y)}|${round(g.width)}|${round(g.height)}|${round(g.sill)}|${round(g.u.x)},${round(g.u.y)}|${round(g.thickness)}`);
  return `${it.join('\n')}\n--\n${op.join('\n')}`;
}

interface ClusterCore {
  layers: Map<Id, ResolvedLayer[]>;
  regions: Region[];
  silhouette: MultiPolygon;
}

/** Altura absoluta (m) ocupada por uma parede. */
interface ZRange {
  z0: number;
  z1: number;
}

const EPS_Z = 1e-6;
const sigOf = (m: MultiPolygon): string => ringsOfShape(m);

/** Pontos de quebra vertical: bases, topos e limites dos vãos de todas as paredes do cluster. */
function breakpoints(zr: Map<Id, ZRange>, opens: OpeningGeometry[]): number[] {
  const set = new Set<number>();
  const add = (z: number): void => void set.add(Math.round(z / EPS_Z) * EPS_Z);
  for (const r of zr.values()) {
    add(r.z0);
    add(r.z1);
  }
  for (const g of opens) {
    const w = zr.get(g.hostId);
    if (!w) continue;
    for (const z of [w.z0 + g.sill, w.z0 + g.sill + g.height]) if (z > w.z0 + EPS_Z && z < w.z1 - EPS_Z) add(z);
  }
  return [...set].sort((a, b) => a - b);
}

function solveCluster(items: Item[], opens: OpeningGeometry[], zr: Map<Id, ZRange>): ClusterCore {
  const paintCache = new Map<string, Map<Item, MultiPolygon>>();
  const paintFor = (active: Set<Id>): Map<Item, MultiPolygon> => {
    const key = [...active].sort().join('|');
    let m = paintCache.get(key);
    if (!m) {
      m = paint(items.filter((i) => active.has(i.wallId)));
      paintCache.set(key, m);
    }
    return m;
  };
  const allWalls = new Set(items.map((i) => i.wallId));
  const plan = paintFor(allWalls);
  const layers = new Map<Id, ResolvedLayer[]>();
  const byMaterial = new Map<Id, MultiPolygon[]>();
  const bandsOf = new Map<Item, LayerBand[]>();

  // Faixas verticais: cada uma resolve a prioridade só entre as paredes que existem naquela altura.
  const zs = breakpoints(zr, opens);
  for (let k = 0; k + 1 < zs.length; k++) {
    const za = zs[k]!;
    const zb = zs[k + 1]!;
    if (zb - za < EPS_Z) continue;
    const mid = (za + zb) / 2;
    const active = new Set<Id>();
    for (const [id, r] of zr) if (r.z0 <= za + EPS_Z && r.z1 >= zb - EPS_Z) active.add(id);
    if (active.size === 0) continue;
    const painted = paintFor(active);
    for (const it of items) {
      if (!active.has(it.wallId)) continue;
      const frag = painted.get(it);
      if (!frag || frag.length === 0) continue;
      const w = zr.get(it.wallId)!;
      const holes = opens
        .filter((g) => g.hostId === it.wallId && mid > w.z0 + g.sill && mid < w.z0 + g.sill + g.height)
        .map(openingRect);
      const poly = holes.length ? difference(frag, ...holes) : frag;
      if (poly.length === 0) continue;
      const list = bandsOf.get(it) ?? [];
      const prev = list[list.length - 1];
      const rel0 = za - w.z0;
      const rel1 = zb - w.z0;
      if (prev && Math.abs(prev.z1 - rel0) < EPS_Z && (prev.poly === poly || sigOf(prev.poly) === sigOf(poly))) prev.z1 = rel1;
      else list.push({ z0: rel0, z1: rel1, poly });
      bandsOf.set(it, list);
    }
  }

  for (const it of items) {
    const fragment = plan.get(it)!;
    if (fragment.length === 0) continue;
    const rects = opens.filter((g) => g.hostId === it.wallId).map(openingRect);
    const cut = rects.length ? difference(fragment, ...rects) : fragment;
    const arr = layers.get(it.wallId) ?? [];
    arr.push({ layerIndex: it.layerIndex, materialId: it.materialId, priority: it.priority, fragment, cut, bands: bandsOf.get(it) ?? [] });
    layers.set(it.wallId, arr);
    byMaterial.set(it.materialId, [...(byMaterial.get(it.materialId) ?? []), cut]);
  }
  const regions: Region[] = [...byMaterial.entries()].map(([materialId, parts]) => ({ materialId, polygons: closeGaps(union(...parts)) }));
  const silhouette = closeGaps(union(...regions.map((r) => r.polygons)));
  for (const arr of layers.values()) arr.sort((a, b) => a.layerIndex - b.layerIndex);
  return { layers, regions, silhouette };
}

export type ResolveCache = Map<string, ClusterCore>;
const sharedCache: ResolveCache = new Map();
const CACHE_LIMIT = 400;

export function frameOfWall(p: Project, wallId: Id): WallFrame | null {
  const w = p.elements[wallId];
  if (!w || w.kind !== 'wall') return null;
  return buildFrame(w, wallType(p, w));
}

export function levelFrames(p: Project, levelId: Id): WallFrame[] {
  return wallsOnLevel(p, levelId)
    .map((w) => buildFrame(w, wallType(p, w)))
    .filter((f): f is WallFrame => f !== null);
}

export function resolveLevel(p: Project, levelId: Id, cache: ResolveCache = sharedCache): ResolvedLevel {
  const walls = wallsOnLevel(p, levelId);
  const frames = walls.map((w) => buildFrame(w, wallType(p, w))).filter((f): f is WallFrame => f !== null);
  const ends = computeEnds(frames, p.settings?.joinTolerance);
  const out: ResolvedLevel = { levelId, walls: {}, clusters: [] };
  for (const group of clusterWalls(frames, ends)) {
    const items = group.flatMap((f) => buildItems(f, ends.get(f.wall.id)!));
    const opens = group.flatMap((f) => openingsOfWall(p, f.wall.id).map((o) => openingGeometry(p, o, f)));
    const heights = new Map(group.map((f) => [f.wall.id, wallHeight(p, f.wall)] as const));
    const zr = new Map(group.map((f) => [f.wall.id, { z0: wallBaseElevation(p, f.wall), z1: wallBaseElevation(p, f.wall) + wallHeight(p, f.wall) }] as const));
    const key = `${clusterKey(items, opens)}\n--\n${[...zr].map(([k, v]) => `${k}:${round(v.z0)}:${round(v.z1)}`).join(',')}`;
    let core = cache.get(key);
    if (!core) {
      core = solveCluster(items, opens, zr);
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
      };
      out.walls[f.wall.id] = rw;
    }
  }
  return out;
}
