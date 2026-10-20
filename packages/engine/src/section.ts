import { closestOnSegment, intersection, orientedRect, triangulate, union, type MultiPolygon, type Polygon, type Ring, type Vec2 } from '@hestia/geom';
import { openingsOfWall, wallsOnLevel, type Id, type Project } from '@hestia/model';
import { bandTopAt } from './profile.ts';
import { resolveFloors } from './floors.ts';
import { resolveSlabs, slabRiseAt } from './slabs.ts';
import { planeZ, resolveRoofs, type ResolvedRoof } from './roofs.ts';
import { frameOfWall, openingGeometry, resolveLevel } from './resolve.ts';

/**
 * Corte e elevação a partir da geometria já resolvida em faixas (bands).
 *
 * Convenção do desenho: x = distância ao longo da linha (a→b), y = cota (z absoluta). O observador olha para a
 * normal à esquerda da linha; assim x cresce para a direita. Uma elevação é o mesmo cálculo com a linha fora da
 * construção e `depth` grande, onde nada é cortado e tudo é projetado.
 */
export interface SectionLine {
  a: Vec2;
  b: Vec2;
  /** Profundidade visível além do plano de corte. */
  depth: number;
}

export interface SectionRegion {
  materialId: Id;
  /** Polígonos em (t, z). */
  polygons: MultiPolygon;
}

/** Elemento visto além do plano de corte; a lista vem ordenada do mais longe ao mais perto (pintor). */
export interface SectionBeyond {
  /** Parede de origem (ausente quando o item é uma camada de piso, que traz `floorId`, de laje, com `slabId`, ou de telhado, com `roofId`). */
  wallId?: Id;
  floorId?: Id;
  slabId?: Id;
  roofId?: Id;
  materialId: Id;
  layerIndex: number;
  /** Distância do plano de corte ao ponto mais próximo. */
  depth: number;
  polygons: MultiPolygon;
}

export interface SectionOpening {
  openingId: Id;
  kind: 'door' | 'window';
  t0: number;
  t1: number;
  z0: number;
  z1: number;
  depth: number;
  /** O plano de corte atravessa o vão. */
  cut: boolean;
}

export interface SectionLevelMark {
  levelId: Id;
  name: string;
  z: number;
}

export interface SectionResult {
  length: number;
  zMin: number;
  zMax: number;
  cut: SectionRegion[];
  silhouette: MultiPolygon;
  beyond: SectionBeyond[];
  openings: SectionOpening[];
  levels: SectionLevelMark[];
}

/** Retângulo (t0..t1, z0..z1); com `zb` diferente de `z1` o topo é inclinado (trapézio de `z1` em t0 a `zb` em t1). */
const rect = (t0: number, t1: number, z0: number, z1: number, zb = z1): Ring => [
  { x: t0, y: z0 },
  { x: t1, y: z0 },
  { x: t1, y: zb },
  { x: t0, y: z1 },
];

/** Camada de laje entre as cotas de base (b0 em t0, b1 em t1) e de topo (u0 em t0, u1 em t1): trapézio se inclinada. */
const slabQuad = (t0: number, t1: number, b0: number, b1: number, u0: number, u1: number): Ring => [
  { x: t0, y: b0 },
  { x: t1, y: b1 },
  { x: t1, y: u1 },
  { x: t0, y: u0 },
];

/** Intervalos de `t` em que a reta a + t·d (d unitário, n sua normal) está dentro do polígono (par-ímpar, serve a furos). */
export function lineIntervals(poly: Polygon, a: Vec2, d: Vec2, n: Vec2): Array<[number, number]> {
  const ts: number[] = [];
  for (const ring of poly) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!;
      const q = ring[(i + 1) % ring.length]!;
      const sp = (p.x - a.x) * n.x + (p.y - a.y) * n.y;
      const sq = (q.x - a.x) * n.x + (q.y - a.y) * n.y;
      if (sp <= 0 === sq <= 0) continue;
      const k = sp / (sp - sq);
      ts.push((p.x + (q.x - p.x) * k - a.x) * d.x + (p.y + (q.y - p.y) * k - a.y) * d.y);
    }
  }
  ts.sort((x, y) => x - y);
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < ts.length; i += 2) out.push([ts[i]!, ts[i + 1]!]);
  return out;
}

const EPS_T = 1e-6;

/** Eixo do corte: comprimento, direção `d`, normal `n` e a região de visão (`depth` além da linha). */
export function sectionFrame(line: SectionLine): { length: number; d: Vec2; n: Vec2; slab: MultiPolygon } {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const length = Math.hypot(dx, dy);
  const k = length || 1;
  const d = { x: dx / k, y: dy / k };
  const n = { x: -d.y, y: d.x };
  const cx = line.a.x + d.x * (length / 2) + n.x * (line.depth / 2);
  const cy = line.a.y + d.y * (length / 2) + n.y * (line.depth / 2);
  return { length, d, n, slab: [[orientedRect(cx, cy, d.x, d.y, length / 2, line.depth / 2)]] };
}

export function computeSection(p: Project, line: SectionLine, levelIds: Id[] = p.levels.map((l) => l.id)): SectionResult {
  const { length, d, n, slab } = sectionFrame(line);
  const empty: SectionResult = { length, zMin: 0, zMax: 3, cut: [], silhouette: [], beyond: [], openings: [], levels: [] };
  if (length < 1e-6) return empty;

  const cutBy = new Map<Id, Polygon[]>();
  const beyond: SectionBeyond[] = [];
  const openings: SectionOpening[] = [];
  let zMin = Infinity;
  let zMax = -Infinity;
  const dist = (v: Vec2): number => (v.x - line.a.x) * n.x + (v.y - line.a.y) * n.y;
  const along = (v: Vec2): number => (v.x - line.a.x) * d.x + (v.y - line.a.y) * d.y;
  const grow = (z0: number, z1: number): void => {
    zMin = Math.min(zMin, z0);
    zMax = Math.max(zMax, z1);
  };

  for (const levelId of levelIds) {
    const resolved = resolveLevel(p, levelId);
    // Pisos entram como as paredes: a linha corta cada camada (retângulo t×z) e a laje de visão mostra o resto.
    for (const f of resolveFloors(p, levelId)) {
      const inSlab = intersection(f.polygon, slab);
      for (const layer of f.layers) {
        for (const poly of f.polygon) {
          for (const [t0, t1] of lineIntervals(poly, line.a, d, n)) {
            const lo = Math.max(0, t0);
            const hi = Math.min(length, t1);
            if (hi - lo < EPS_T) continue;
            const list = cutBy.get(layer.materialId) ?? [];
            list.push([rect(lo, hi, layer.z0, layer.z1)]);
            cutBy.set(layer.materialId, list);
            grow(layer.z0, layer.z1);
          }
        }
        for (const sp of inSlab) {
          const outer = sp[0];
          if (!outer || outer.length < 3) continue;
          const ts = outer.map(along);
          const tMin = Math.max(0, Math.min(...ts));
          const tMax = Math.min(length, Math.max(...ts));
          if (tMax - tMin < EPS_T) continue;
          beyond.push({
            floorId: f.floorId,
            materialId: layer.materialId,
            layerIndex: layer.layerIndex,
            depth: Math.max(0, Math.min(...outer.map(dist))),
            polygons: [[rect(tMin, tMax, layer.z0, layer.z1)]],
          });
          grow(layer.z0, layer.z1);
        }
      }
    }
    // Lajes (D3): como os pisos, mas com inclinação; cada cota (base e topo) soma a subida no ponto da linha de corte.
    for (const sl of resolveSlabs(p, levelId)) {
      const inView = intersection(sl.polygon, slab);
      for (const layer of sl.layers) {
        for (const poly of sl.polygon) {
          for (const [t0, t1] of lineIntervals(poly, line.a, d, n)) {
            const lo = Math.max(0, t0);
            const hi = Math.min(length, t1);
            if (hi - lo < EPS_T) continue;
            const rl = slabRiseAt(sl.slope, { x: line.a.x + d.x * lo, y: line.a.y + d.y * lo });
            const rh = slabRiseAt(sl.slope, { x: line.a.x + d.x * hi, y: line.a.y + d.y * hi });
            const list = cutBy.get(layer.materialId) ?? [];
            list.push([slabQuad(lo, hi, layer.z0 + rl, layer.z0 + rh, layer.z1 + rl, layer.z1 + rh)]);
            cutBy.set(layer.materialId, list);
            grow(layer.z0 + Math.min(rl, rh), layer.z1 + Math.max(rl, rh));
          }
        }
        for (const sp of inView) {
          const outer = sp[0];
          if (!outer || outer.length < 3) continue;
          const ts = outer.map(along);
          const tMin = Math.max(0, Math.min(...ts));
          const tMax = Math.min(length, Math.max(...ts));
          if (tMax - tMin < EPS_T) continue;
          // Cota de cada extremo: a do vértice da laje que tem o menor e o maior t (trapézio entre as duas).
          const rl = slabRiseAt(sl.slope, outer[ts.indexOf(Math.min(...ts))]!);
          const rh = slabRiseAt(sl.slope, outer[ts.indexOf(Math.max(...ts))]!);
          beyond.push({
            slabId: sl.slabId,
            materialId: layer.materialId,
            layerIndex: layer.layerIndex,
            depth: Math.max(0, Math.min(...outer.map(dist))),
            polygons: [[slabQuad(tMin, tMax, layer.z0 + rl, layer.z0 + rh, layer.z1 + rl, layer.z1 + rh)]],
          });
          grow(layer.z0 + Math.min(rl, rh), layer.z1 + Math.max(rl, rh));
        }
      }
    }
    // Telhados (D3): como as lajes, por água e por camada (cada faixa segue a cota da água menos `below`).
    const rf = sectionOfRoofs(resolveRoofs(p, levelId), line);
    for (const c of rf.cut) cutBy.set(c.materialId, [...(cutBy.get(c.materialId) ?? []), c.polygon]);
    beyond.push(...rf.beyond);
    grow(rf.zMin, rf.zMax);
    for (const w of wallsOnLevel(p, levelId)) {
      const rw = resolved.walls[w.id];
      if (!rw) continue;
      for (const layer of rw.layers) {
        for (const band of layer.bands) {
          const z0 = rw.baseZ + band.z0;
          const z1 = rw.baseZ + band.z1;
          for (const poly of band.poly) {
            for (const [t0, t1] of lineIntervals(poly, line.a, d, n)) {
              const lo = Math.max(0, t0);
              const hi = Math.min(length, t1);
              if (hi - lo < EPS_T) continue;
              const list = cutBy.get(layer.materialId) ?? [];
              const at = (t: number): number => (band.slope ? rw.baseZ + bandTopAt(band, { x: line.a.x + d.x * t, y: line.a.y + d.y * t }) : z1);
              list.push([rect(lo, hi, z0, at(lo), at(hi))]);
              cutBy.set(layer.materialId, list);
              grow(z0, z1);
            }
          }
          for (const sp of intersection(band.poly, slab)) {
            const outer = sp[0];
            if (!outer || outer.length < 3) continue;
            const ts = outer.map(along);
            const tMin = Math.max(0, Math.min(...ts));
            const tMax = Math.min(length, Math.max(...ts));
            if (tMax - tMin < EPS_T) continue;
            const topAtVertex = (t: number): number => {
              if (!band.slope) return z1;
              const v = outer[ts.indexOf(t)] ?? outer[0]!;
              return rw.baseZ + bandTopAt(band, v);
            };
            beyond.push({
              wallId: w.id,
              materialId: layer.materialId,
              layerIndex: layer.layerIndex,
              depth: Math.max(0, Math.min(...outer.map(dist))),
              polygons: [[rect(tMin, tMax, z0, topAtVertex(Math.min(...ts)), topAtVertex(Math.max(...ts)))]],
            });
            grow(z0, z1);
          }
        }
      }
      const f = frameOfWall(p, w.id);
      if (!f) continue;
      for (const o of openingsOfWall(p, w.id)) {
        const g = openingGeometry(p, o, f);
        const foot = orientedRect(g.center.x, g.center.y, g.u.x, g.u.y, g.width / 2, g.thickness / 2);
        const crossing = lineIntervals([foot], line.a, d, n).some(([t0, t1]) => t1 > 0 && t0 < length);
        if (!crossing && intersection([[foot]], slab).length === 0) continue;
        const ts = foot.map(along);
        const t0 = Math.max(0, Math.min(...ts));
        const t1 = Math.min(length, Math.max(...ts));
        if (t1 - t0 < EPS_T) continue;
        const z0 = rw.baseZ + g.sill;
        openings.push({ openingId: o.id, kind: g.kind, t0, t1, z0, z1: z0 + g.height, depth: Math.max(0, Math.min(...foot.map(dist))), cut: crossing });
      }
    }
  }

  // Telhado: as camadas projetam na mesma área (a face é inclinada), então a de cima (índice menor) desenha por último.
  beyond.sort((x, y) => y.depth - x.depth || (x.roofId || y.roofId ? y.layerIndex - x.layerIndex : x.layerIndex - y.layerIndex));
  openings.sort((x, y) => y.depth - x.depth);
  const cut: SectionRegion[] = [...cutBy].map(([materialId, polys]) => ({ materialId, polygons: union(...polys.map((q): MultiPolygon => [q])) }));
  const silhouette = union(...cut.map((c) => c.polygons));
  const levels = p.levels.map((l) => ({ levelId: l.id, name: l.name, z: l.elevation }));
  if (!isFinite(zMin)) return { ...empty, levels };
  return { length, zMin, zMax, cut, silhouette, beyond, openings, levels };
}

/** Telhado no corte (D3): quadriláteros da linha de corte por material e, além do plano, as faixas por camada. */
export interface RoofSection {
  cut: Array<{ materialId: Id; polygon: Polygon }>;
  beyond: SectionBeyond[];
  /** Cotas extremas (Infinity/-Infinity sem telhado na linha). */
  zMin: number;
  zMax: number;
}

/** Envoltória convexa (cadeia monótona), anel anti-horário; com menos de 3 vértices, pontos colineares. */
function convexHull(pts: Vec2[]): Ring {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const chain = (seq: Vec2[]): Vec2[] => {
    const h: Vec2[] = [];
    for (const q of seq) {
      while (h.length >= 2 && cross(h[h.length - 2]!, h[h.length - 1]!, q) <= 0) h.pop();
      h.push(q);
    }
    h.pop();
    return h;
  };
  return [...chain(s), ...chain([...s].reverse())];
}

/**
 * Corte esquadro (Revit: Rafter Cut 'square') no beiral: a base da camada recua ao longo da água, de modo que o corte
 * fica perpendicular ao plano. Com G = % / 100 e T a espessura vertical da camada, o deslocamento ao longo da subida é
 * s = G·T/(1+G²); o comprimento do corte (perpendicular ao plano) é T·cos θ. Para 100 % e T = 10 cm: s = 5,00 cm e
 * corte de 7,07 cm.
 */
export function squareCutRun(percent: number, thickness: number): number {
  const g = percent / 100;
  return (g * thickness) / (1 + g * g);
}

/**
 * Telhados no corte e na elevação (D3), como as lajes. Por água e por camada, a faixa vertical de cada ponto p vai de
 * top(p) − below − thickness a top(p) − below. No corte, a linha dá intervalos de t dentro da água e cada faixa é um
 * quadrilátero (topo e base são lineares em t). Além do plano, cada triângulo da água projeta-se em (t, z) com
 * seis pontos (topo e base); a envoltória convexa de cada um e a união delas é a silhueta da camada (exata para
 * águas convexas, que é o caso das formas predefinidas).
 */
export function sectionOfRoofs(roofs: ResolvedRoof[], line: SectionLine): RoofSection {
  const out: RoofSection = { cut: [], beyond: [], zMin: Infinity, zMax: -Infinity };
  const { length, d, n, slab } = sectionFrame(line);
  if (length < 1e-6) return out;
  const along = (v: Vec2): number => (v.x - line.a.x) * d.x + (v.y - line.a.y) * d.y;
  const dist = (v: Vec2): number => (v.x - line.a.x) * n.x + (v.y - line.a.y) * n.y;
  const at = (t: number): Vec2 => ({ x: line.a.x + d.x * t, y: line.a.y + d.y * t });
  for (const r of roofs) {
    const layers = r.layers.filter((l) => l.thickness > 1e-9);
    // Corte esquadro só nas extremidades sobre uma aresta de beiral (linha 'eave'); prumo (padrão) não muda nada.
    const square = r.rafterCut === 'square';
    const eaves = r.lines.filter((l) => l.kind === 'eave');
    const onEave = (v: Vec2): boolean => square && eaves.some((l) => Math.hypot(closestOnSegment(v, l.a, l.b).x - v.x, closestOnSegment(v, l.a, l.b).y - v.y) < 1e-6);
    for (const pl of r.planes) {
      const cuts = pl.polygon
        .flatMap((poly) => lineIntervals(poly, line.a, d, n))
        .map(([t0, t1]): [number, number] => [Math.max(0, t0), Math.min(length, t1)])
        .filter(([lo, hi]) => hi - lo >= EPS_T);
      const view = intersection(pl.polygon, slab);
      for (const l of layers) {
        const top = (v: Vec2): number => planeZ(pl, v) - l.below;
        const G = pl.percent / 100;
        const run = square ? squareCutRun(pl.percent, l.thickness) : 0;
        // Cosseno entre a seção e a subida da água: no corte esquadro, a base desloca s / cos ao longo da seção.
        const c = d.x * pl.up.x + d.y * pl.up.y;
        for (const [lo, hi] of cuts) {
          const u0 = top(at(lo));
          const u1 = top(at(hi));
          let bl: Vec2 = { x: lo, y: u0 - l.thickness };
          let br: Vec2 = { x: hi, y: u1 - l.thickness };
          if (square && Math.abs(c) > 1e-9) {
            const k = run / c;
            if (c > 0 && lo + k < hi && onEave(at(lo))) bl = { x: lo + k, y: top(at(lo + k)) - l.thickness };
            if (c < 0 && hi + k > lo && onEave(at(hi))) br = { x: hi + k, y: top(at(hi + k)) - l.thickness };
          }
          out.cut.push({ materialId: l.materialId, polygon: [[bl, br, { x: hi, y: u1 }, { x: lo, y: u0 }]] });
          out.zMin = Math.min(out.zMin, u0 - l.thickness, u1 - l.thickness);
          out.zMax = Math.max(out.zMax, u0, u1);
        }
        const parts: MultiPolygon[] = [];
        let depth = Infinity;
        for (const piece of view) {
          const outer = piece[0];
          if (!outer || outer.length < 3) continue;
          depth = Math.min(depth, ...outer.map(dist));
          const mesh = triangulate(piece);
          for (let i = 0; i < mesh.indices.length; i += 3) {
            const pts = [0, 1, 2].flatMap((k) => {
              const j = mesh.indices[i + k]!;
              const v = { x: mesh.positions[2 * j]!, y: mesh.positions[2 * j + 1]! };
              // Corte esquadro no beiral: a base recua s ao longo da subida (projeta-se em s·cos e sobe G·s).
              const base = square && onEave(v) ? { x: along(v) + run * c, y: top(v) + G * run - l.thickness } : { x: along(v), y: top(v) - l.thickness };
              return [{ x: along(v), y: top(v) }, base];
            });
            const hull = convexHull(pts);
            if (hull.length >= 3) parts.push([[hull]]);
          }
        }
        if (!parts.length) continue;
        const polygons = union(...parts);
        out.beyond.push({ roofId: r.roofId, materialId: l.materialId, layerIndex: l.layerIndex, depth: Math.max(0, depth), polygons });
        for (const ring of polygons.flat()) {
          for (const v of ring) {
            out.zMin = Math.min(out.zMin, v.y);
            out.zMax = Math.max(out.zMax, v.y);
          }
        }
      }
    }
  }
  return out;
}
