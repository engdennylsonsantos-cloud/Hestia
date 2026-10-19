import { intersection, orientedRect, union, type MultiPolygon, type Polygon, type Ring, type Vec2 } from '@hestia/geom';
import { openingsOfWall, wallsOnLevel, type Id, type Project } from '@hestia/model';
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
  wallId: Id;
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

const rect = (t0: number, t1: number, z0: number, z1: number): Ring => [
  { x: t0, y: z0 },
  { x: t1, y: z0 },
  { x: t1, y: z1 },
  { x: t0, y: z1 },
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

export function computeSection(p: Project, line: SectionLine, levelIds: Id[] = p.levels.map((l) => l.id)): SectionResult {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const length = Math.hypot(dx, dy);
  const empty: SectionResult = { length, zMin: 0, zMax: 3, cut: [], silhouette: [], beyond: [], openings: [], levels: [] };
  if (length < 1e-6) return empty;
  const d = { x: dx / length, y: dy / length };
  const n = { x: -d.y, y: d.x };
  const cx = line.a.x + d.x * (length / 2) + n.x * (line.depth / 2);
  const cy = line.a.y + d.y * (length / 2) + n.y * (line.depth / 2);
  const slab: MultiPolygon = [[orientedRect(cx, cy, d.x, d.y, length / 2, line.depth / 2)]];

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
              list.push([rect(lo, hi, z0, z1)]);
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
            beyond.push({
              wallId: w.id,
              materialId: layer.materialId,
              layerIndex: layer.layerIndex,
              depth: Math.max(0, Math.min(...outer.map(dist))),
              polygons: [[rect(tMin, tMax, z0, z1)]],
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

  beyond.sort((x, y) => y.depth - x.depth || x.layerIndex - y.layerIndex);
  openings.sort((x, y) => y.depth - x.depth);
  const cut: SectionRegion[] = [...cutBy].map(([materialId, polys]) => ({ materialId, polygons: union(...polys.map((q): MultiPolygon => [q])) }));
  const silhouette = union(...cut.map((c) => c.polygons));
  const levels = p.levels.map((l) => ({ levelId: l.id, name: l.name, z: l.elevation }));
  if (!isFinite(zMin)) return { ...empty, levels };
  return { length, zMin, zMax, cut, silhouette, beyond, openings, levels };
}
