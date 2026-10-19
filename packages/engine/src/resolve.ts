import {
  arcSample,
  boxOf,
  boxesOverlap,
  difference,
  expandBox,
  intersection,
  multiArea,
  orientedRect,
  closeGapsSafe,
  unionClipper,
  multiPoints,
  type Box,
  type MultiPolygon,
} from '@hestia/geom';
import {
  coreSpan,
  FUNCTION_PRIORITY,
  layerPriority,
  layerSpans,
  openingSill,
  openingType,
  openingsOfWall,
  wallBaseElevation,
  wallMaxHeight,
  wallsOnLevel,
  wallType,
  type Id,
  type Opening,
  type Project,
} from '@hestia/model';
import { buildFrame, normalAt, pointAt, sAtDepth, tangentAt, toLocal, type WallFrame } from './frame.ts';
import { computeEnds, joinStatus, type EndSpec, type WallEnds } from './joins.ts';
import { endPoint, layerQuad, membranesOf, withProfile } from './layerGeom.ts';
import { endReturns, insertMode, insertReturns } from './wrap.ts';
import type { LayerBand, OpeningGeometry, Region, ResolvedCluster, ResolvedLayer, ResolvedLevel, ResolvedWall } from './types.ts';

const MIN_AREA = 1e-9;
const EPS_Z = 1e-6;
const CLUSTER_PAD = 0.02;

interface Item {
  wallId: Id;
  layerIndex: number;
  materialId: Id;
  priority: number;
  order: number;
  /** Espessura do núcleo da parede: desempata camadas de mesma prioridade (a mais robusta domina). */
  coreT: number;
  /** Identificador estável dentro do cluster (chave de cache do pintor). */
  uid: number;
  /** Altura absoluta em que o item existe (camadas: a parede inteira; faixas: o intervalo da faixa). */
  z0: number;
  z1: number;
  /** Aparece na planta (a faixa só aparece se atravessar o plano de corte). */
  inPlan: boolean;
  thickness: number;
  shape: MultiPolygon;
  box: Box;
}

const ringsOfShape = (m: MultiPolygon): string => m.map((p) => p.map((r) => r.map((v) => `${round(v.x)},${round(v.y)}`).join(';')).join('|')).join('/');

/** Altura (relativa à base) do plano de corte da planta: faixas que não o atravessam não aparecem em planta. */
const PLAN_CUT = 1.2;

function flatT(f: WallFrame, which: 'a' | 'b', spec: EndSpec, sFace: number): number {
  if (spec.kind === 'flat') return spec.t;
  return toLocal(f, endPoint(f, which, spec, sFace)).t;
}

function buildItems(f: WallFrame, ends: WallEnds, freeEnds: Array<'a' | 'b'>, z: { z0: number; z1: number }): Item[] {
  const items: Item[] = [];
  const coreT = Math.round((coreSpan(f.type).to - coreSpan(f.type).from) * 1e6) / 1e6;
  const endWraps = new Map<number, MultiPolygon>();
  if (f.type.wrapEnds !== 'none') {
    for (const which of freeEnds) {
      for (const r of endReturns(f, which, f.type.wrapEnds)) endWraps.set(r.layerIndex, [...(endWraps.get(r.layerIndex) ?? []), ...r.poly]);
    }
  }
  const mk = (layerIndex: number, materialId: Id, priority: number, thickness: number, shape: MultiPolygon, z0: number, z1: number): void => {
    items.push({
      wallId: f.wall.id,
      layerIndex,
      materialId,
      priority,
      order: f.wall.order,
      coreT,
      uid: 0,
      z0,
      z1,
      inPlan: z0 <= z.z0 + PLAN_CUT + EPS_Z && z1 >= z.z0 + PLAN_CUT - EPS_Z,
      thickness,
      shape,
      box: boxOf(shape.flatMap((p) => p[0] ?? [])),
    });
  };
  for (const sp of layerSpans(f.type)) {
    if (sp.layer.thickness < 1e-6) continue;
    const ring = layerQuad(f, ends, sAtDepth(f, sp.from), sAtDepth(f, sp.to));
    let shape: MultiPolygon = [[ring]];
    for (const e of [ends.a, ends.b]) {
      if (e.kind === 'flat' && e.clip) shape = intersection(shape, [[e.clip]]);
    }
    if (shape.length === 0) continue;
    const wrap = endWraps.get(sp.index);
    if (wrap) shape = [...shape, ...wrap];
    mk(sp.index, sp.layer.materialId, layerPriority(sp.layer), sp.layer.thickness, shape, z.z0, z.z1);
  }
  // Faixas verticais (rodapé, barra de azulejo): fora da espessura da parede, com prioridade de acabamento.
  (f.type.strips ?? []).forEach((st, k) => {
    const z0 = z.z0 + Math.max(0, st.z0);
    const z1 = Math.min(z.z1, z.z0 + st.z1);
    if (z1 - z0 < EPS_Z || st.thickness < 1e-6) return;
    const sFace = st.side === 'exterior' ? f.sExt : f.sInt;
    const outward = st.side === 'exterior' ? f.sign : -f.sign;
    const ta = flatT(f, 'a', ends.a, sFace);
    const tb = flatT(f, 'b', ends.b, sFace);
    const ring = layerQuad(f, { a: { kind: 'flat', t: ta }, b: { kind: 'flat', t: tb } }, sFace, sFace + outward * st.thickness);
    mk(-(k + 1), st.materialId, FUNCTION_PRIORITY.finish2, st.thickness, [[ring]], z0, z1);
  });
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
    plan: t.plan,
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
  const it = items.map((i) => `${i.wallId}|${i.layerIndex}|${i.materialId}|${i.priority}|${i.order}|${round(i.z0)}:${round(i.z1)}:${i.inPlan ? 1 : 0}|${ringsOfShape(i.shape)}`);
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

const sigOf = (m: MultiPolygon): string => ringsOfShape(m);

/** Pontos de quebra vertical: bases, topos, limites das faixas e dos vãos de todas as paredes do cluster. */
function breakpoints(items: Item[], zr: Map<Id, ZRange>, opens: OpeningGeometry[]): number[] {
  const set = new Set<number>();
  const add = (z: number): void => void set.add(Math.round(z / EPS_Z) * EPS_Z);
  for (const r of zr.values()) {
    add(r.z0);
    add(r.z1);
  }
  for (const i of items) {
    add(i.z0);
    add(i.z1);
  }
  for (const g of opens) {
    const w = zr.get(g.hostId);
    if (!w) continue;
    for (const z of [w.z0 + g.sill, w.z0 + g.sill + g.height]) if (z > w.z0 + EPS_Z && z < w.z1 - EPS_Z) add(z);
  }
  return [...set].sort((a, b) => a - b);
}

type Returns = Map<string, Array<{ openingId: Id; poly: MultiPolygon }>>;

function solveCluster(items: Item[], opens: OpeningGeometry[], zr: Map<Id, ZRange>, returns: Returns): ClusterCore {
  const paintCache = new Map<string, Map<Item, MultiPolygon>>();
  const paintFor = (active: Item[]): Map<Item, MultiPolygon> => {
    const key = active.map((i) => i.uid).sort((x, y) => x - y).join(',');
    let m = paintCache.get(key);
    if (!m) {
      m = paint(active);
      paintCache.set(key, m);
    }
    return m;
  };
  const plan = paintFor(items.filter((i) => i.inPlan));
  // Retornos de acabamento não podem invadir paredes vizinhas (vão perto de um canto ou de um T).
  const clipReturn = (poly: MultiPolygon, wallId: Id, painted: Map<Item, MultiPolygon>): MultiPolygon => {
    const box = boxOf(multiPoints(poly));
    const subs: MultiPolygon[] = [];
    for (const i of items) {
      if (i.wallId === wallId || !boxesOverlap(i.box, box)) continue;
      const f = painted.get(i);
      if (f && f.length) subs.push(f);
    }
    return subs.length ? difference(poly, ...subs) : poly;
  };
  const layers = new Map<Id, ResolvedLayer[]>();
  const byMaterial = new Map<Id, MultiPolygon[]>();
  const bandsOf = new Map<Item, LayerBand[]>();

  // Faixas verticais: cada uma resolve a prioridade só entre os itens que existem naquela altura.
  const zs = breakpoints(items, zr, opens);
  for (let k = 0; k + 1 < zs.length; k++) {
    const za = zs[k]!;
    const zb = zs[k + 1]!;
    if (zb - za < EPS_Z) continue;
    const mid = (za + zb) / 2;
    const active = items.filter((i) => i.z0 <= za + EPS_Z && i.z1 >= zb - EPS_Z);
    if (active.length === 0) continue;
    const painted = paintFor(active);
    for (const it of active) {
      const frag = painted.get(it);
      if (!frag || frag.length === 0) continue;
      const w = zr.get(it.wallId)!;
      const holes = opens
        .filter((g) => g.hostId === it.wallId && mid > w.z0 + g.sill && mid < w.z0 + g.sill + g.height)
        .map(openingRect);
      let poly = holes.length ? difference(frag, ...holes) : frag;
      // Retorno do acabamento no vão: só nas faixas de altura que o vão atravessa.
      for (const r of returns.get(`${it.wallId}|${it.layerIndex}`) ?? []) {
        const g = opens.find((x) => x.openingId === r.openingId);
        if (g && mid > w.z0 + g.sill && mid < w.z0 + g.sill + g.height) poly = [...poly, ...clipReturn(r.poly, it.wallId, painted)];
      }
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
    const fragment = it.inPlan ? (plan.get(it) ?? []) : [];
    if (it.inPlan && fragment.length === 0) continue;
    let cut = fragment;
    if (fragment.length) {
      const rects = opens.filter((g) => g.hostId === it.wallId).map(openingRect);
      cut = rects.length ? difference(fragment, ...rects) : fragment;
      for (const r of returns.get(`${it.wallId}|${it.layerIndex}`) ?? []) cut = [...cut, ...clipReturn(r.poly, it.wallId, plan)];
    }
    const bands = bandsOf.get(it) ?? [];
    if (!fragment.length && bands.length === 0) continue;
    const arr = layers.get(it.wallId) ?? [];
    arr.push({ layerIndex: it.layerIndex, materialId: it.materialId, priority: it.priority, fragment, cut, bands });
    layers.set(it.wallId, arr);
    if (cut.length) byMaterial.set(it.materialId, [...(byMaterial.get(it.materialId) ?? []), cut]);
  }
  const regions: Region[] = [...byMaterial.entries()].map(([materialId, parts]) => ({ materialId, polygons: closeGapsSafe(unionClipper(...parts)) }));
  const silhouette = closeGapsSafe(unionClipper(...regions.map((r) => r.polygons)));
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
    const tol = p.settings?.joinTolerance;
    const freeOf = (f: WallFrame): Array<'a' | 'b'> =>
      (['a', 'b'] as const).filter((w) => {
        const k = joinStatus(frames, f.wall.id, w, tol).kind;
        return k === 'free' || k === 'disallowed';
      });
    const items = group.flatMap((f) => {
      const z0 = wallBaseElevation(p, f.wall);
      return buildItems(f, ends.get(f.wall.id)!, freeOf(f), { z0, z1: z0 + wallMaxHeight(p, f.wall) });
    });
    items.forEach((it, i) => {
      it.uid = i;
    });
    const returns: Returns = new Map();
    for (const f of group) {
      for (const o of openingsOfWall(p, f.wall.id)) {
        const ot = openingType(p, o);
        for (const r of insertReturns(f, o.offset, ot.width, insertMode(f.type, ot))) {
          const key = `${f.wall.id}|${r.layerIndex}`;
          returns.set(key, [...(returns.get(key) ?? []), { openingId: o.id, poly: r.poly }]);
        }
      }
    }
    const opens = group.flatMap((f) => openingsOfWall(p, f.wall.id).map((o) => openingGeometry(p, o, f)));
    const heights = new Map(group.map((f) => [f.wall.id, wallMaxHeight(p, f.wall)] as const));
    const zr = new Map(group.map((f) => [f.wall.id, { z0: wallBaseElevation(p, f.wall), z1: wallBaseElevation(p, f.wall) + wallMaxHeight(p, f.wall) }] as const));
    const retSig = [...returns].map(([k, v]) => `${k}=${v.map((x) => `${x.openingId}:${ringsOfShape(x.poly)}`).join('+')}`).join('\n');
    const key = `${clusterKey(items, opens)}\n--\n${[...zr].map(([k, v]) => `${k}:${round(v.z0)}:${round(v.z1)}`).join(',')}\n--\n${retSig}`;
    let core = cache.get(key);
    if (!core) {
      core = solveCluster(items, opens, zr, returns);
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
        layers: withProfile(core.layers.get(f.wall.id) ?? [], f),
        membranes: membranesOf(f, ends.get(f.wall.id)!),
      };
      out.walls[f.wall.id] = rw;
    }
  }
  return out;
}
