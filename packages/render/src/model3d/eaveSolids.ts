import { add, closestOnSegment, difference, dist, intersection, mid, norm, offsetMulti, pointInMulti, sub, union, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { planeZ, roofThickness, type ResolvedRoof, type ResolvedRoofPlane } from '@hestia/engine';
import type { Id, Material, Project } from '@hestia/model';
import { mix } from '../plan/color.ts';
import { extrudePolygon, type SolidBatch } from './solids.ts';

/** Espessura da testeira (m). */
export const FASCIA_THICKNESS = 0.025;
/** Calha em U: 10 cm de largura e 8 cm de altura, paredes de 1 cm; a borda superior fica na face inferior da água. */
const GUTTER_W = 0.1;
const GUTTER_H = 0.08;
const GUTTER_WALL = 0.01;
/** Placa do forro (m). */
const SOFFIT_T = 0.01;
/** Folga (m) das faixas ao longo de cada aresta: cobre os cantos sem entrar nas empenas. */
const MARGIN = 0.01;
/** Folga (m) das faixas para dentro e para fora: só o suficiente para não deixar frestas (resolução do Clipper, 1 µm). */
const SIDE_MARGIN = 1e-5;
/** Afastamento (m) para dentro da aresta, para achar a água que a encosta. */
const EPS_IN = 1e-4;

export interface EaveSolids {
  batches: SolidBatch[];
  /** Materiais que não estão em `p.materials` (testeira escurecida): o chamador os consulta por id quando não os acha no projeto. */
  materials: Record<Id, Material>;
}

/** Aresta de beiral (linha 'eave'): segmento, direção para dentro do telhado e a água que a encosta por dentro. */
interface EaveEdge {
  a: Vec2;
  b: Vec2;
  inward: Vec2;
  plane: ResolvedRoofPlane;
}

const scale = (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k });

/** Arestas de beiral com a água que as encosta; aresta sem água por dentro é descartada. */
function eaveEdgesOf(r: ResolvedRoof): EaveEdge[] {
  return r.lines.flatMap((l): EaveEdge[] => {
    if (l.kind !== 'eave' || dist(l.a, l.b) < 1e-6) return [];
    const t = norm(sub(l.b, l.a));
    const left = { x: -t.y, y: t.x };
    const m = mid(l.a, l.b);
    for (const s of [1, -1]) {
      const inward = scale(left, s);
      const plane = r.planes.find((pl) => pointInMulti(add(m, scale(inward, EPS_IN)), pl.polygon));
      if (plane) return [{ a: l.a, b: l.b, inward, plane }];
    }
    return [];
  });
}

/** Contorno do telhado em planta (união das águas; os furos ficam como buracos). */
const outlineOf = (r: ResolvedRoof): MultiPolygon => union(...r.planes.map((pl) => pl.polygon));

/** Contorno deslocado d metros para dentro (d > 0) ou para fora (d < 0), com cantos em esquadria. */
const shrink = (outline: MultiPolygon, d: number): MultiPolygon => (d === 0 ? outline : offsetMulti(outline, -d));

/** Faixa de uma aresta entre f0 e f1 metros para dentro (negativo: para fora), estendida MARGIN nas pontas ao longo da aresta. */
function stripOf(e: EaveEdge, f0: number, f1: number): MultiPolygon {
  const d = norm(sub(e.b, e.a));
  const a = add(e.a, scale(d, -MARGIN));
  const b = add(e.b, scale(d, MARGIN));
  return [[[add(a, scale(e.inward, f0)), add(b, scale(e.inward, f0)), add(b, scale(e.inward, f1)), add(a, scale(e.inward, f1))]]];
}

/**
 * Região entre os contornos deslocados `from` e `to` (m, positivo para dentro), só junto das arestas de beiral. Como a
 * região vem de um contorno deslocado, os cantos saem em esquadria e sem sobreposição (o volume é área × altura).
 */
function bandOf(outline: MultiPolygon, edges: EaveEdge[], from: number, to: number): MultiPolygon {
  if (!edges.length) return [];
  const strips = union(...edges.map((e) => stripOf(e, from - SIDE_MARGIN, to + SIDE_MARGIN)));
  return intersection(difference(shrink(outline, from), shrink(outline, to)), strips);
}

/** Cota da face inferior da água no beiral, no ponto: a da aresta de beiral mais próxima (cada água é plana). */
function undersideAt(edges: EaveEdge[], T: number): (x: number, y: number) => number {
  return (x, y) => {
    const q = { x, y };
    let best = edges[0]!;
    let bd = Infinity;
    for (const e of edges) {
      const c = closestOnSegment(q, e.a, e.b);
      const d = dist(c, q);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return planeZ(best.plane, q) - T;
  };
}

/** Material da testeira: o da camada estrutural do tipo (ou a de topo, sem estrutural), escurecido 35 %. */
function fasciaMaterialOf(p: Project, r: ResolvedRoof): Material | undefined {
  const layers = p.roofTypes[r.typeId]?.layers ?? [];
  const id = (layers.find((l) => l.function === 'structure') ?? layers[0])?.materialId;
  const m = id ? p.materials[id] : undefined;
  return m ? { ...m, id: `${m.id}#testeira`, color: mix(m.color, '#000000', 0.35) } : undefined;
}

/** Lote do material `id`, criado na primeira vez. */
function batchOf(byMat: Map<Id, SolidBatch>, id: Id): SolidBatch {
  let b = byMat.get(id);
  if (!b) {
    b = { materialId: id, positions: [], normals: [], indices: [] };
    byMat.set(id, b);
  }
  return b;
}

/**
 * Acabamentos do beiral em 3D (C5), por telhado, ao longo das arestas de beiral (as que descem para fora):
 * - testeira (`eave.fascia`): faixa de 2,5 cm junto ao contorno, da face inferior da água para baixo por `fasciaHeight`,
 *   no material da camada estrutural escurecido;
 * - calha (`eave.gutter`): U de 10 × 8 cm para fora do contorno, com a borda superior na face inferior da água, em
 *   alumínio;
 * - forro (`eave.soffit`): placa horizontal de 1 cm sob o beiral, na cota do beiral menos a espessura, com largura
 *   = balanço médio menos a espessura do telhado (gesso).
 * Calha e forro não dependem da testeira. Sem nenhum acabamento, nada é gerado.
 */
export function buildEaveSolids(p: Project, roofs: ResolvedRoof[]): EaveSolids {
  const byMat = new Map<Id, SolidBatch>();
  const materials: Record<Id, Material> = {};
  for (const r of roofs) {
    const eave = r.eave;
    if (!eave || (!eave.fascia && !eave.gutter && !eave.soffit) || !r.planes.length) continue;
    const edges = eaveEdgesOf(r);
    if (!edges.length) continue;
    const outline = outlineOf(r);
    const T = roofThickness(r);
    const underside = undersideAt(edges, T);
    if (eave.fascia) {
      const m = fasciaMaterialOf(p, r);
      const id = m ? m.id : 'mat_madeira#testeira';
      if (m) materials[id] = m;
      const b = batchOf(byMat, id);
      const h = eave.fasciaHeight;
      for (const poly of bandOf(outline, edges, 0, FASCIA_THICKNESS)) extrudePolygon(b, poly, 0, 1, underside, (x, y) => underside(x, y) - h);
    }
    // Calha: três regiões do U (fundo entre as paredes, parede de fora e parede de dentro), todas a partir da cota do beiral.
    const eaveZ = r.eaveZ - T;
    if (eave.gutter) {
      const b = batchOf(byMat, 'mat_aluminio');
      const parts: Array<[MultiPolygon, number]> = [
        [bandOf(outline, edges, -(GUTTER_W - GUTTER_WALL), -GUTTER_WALL), GUTTER_WALL - GUTTER_H],
        [bandOf(outline, edges, -GUTTER_W, -(GUTTER_W - GUTTER_WALL)), 0],
        [bandOf(outline, edges, -GUTTER_WALL, 0), 0],
      ];
      for (const [region, dzTop] of parts) {
        for (const poly of region) extrudePolygon(b, poly, 0, 1, () => eaveZ + dzTop, () => eaveZ - GUTTER_H);
      }
    }
    if (eave.soffit) {
      const width = Math.max(0, (r.eaveOverhang ?? 0) - T);
      if (width > 0) {
        const b = batchOf(byMat, 'mat_gesso');
        for (const poly of bandOf(outline, edges, 0, width)) extrudePolygon(b, poly, 0, 1, () => eaveZ, () => eaveZ - SOFFIT_T);
      }
    }
  }
  return { batches: [...byMat.values()], materials };
}
