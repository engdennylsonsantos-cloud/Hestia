import { cross, dist, dot, pointInMulti, sub, type Vec2 } from '@hestia/geom';
import {
  isOpening,
  isSlab,
  isWall,
  slabRiseAt,
  terminoOf,
  type Project,
  type Slab,
  type ValidationIssue,
  type Wall,
} from '@hestia/model';
import { resolveAllFloors } from './floors.ts';
import { resolveAllRoofs } from './roofs.ts';
import { resolveAllSlabs, type ResolvedSlab } from './slabs.ts';
import { wallZRange } from './wallZ.ts';

/** Tolerância de comprimento (m): 1 mm. */
const EPS = 1e-3;
/** Ângulo máximo entre dois eixos para serem "praticamente colineares" (1°). */
const COLLINEAR_ANGLE = (1 * Math.PI) / 180;
/** Distância lateral máxima entre eixos colineares (1 cm). */
const COLLINEAR_OFFSET = 0.01;

const fmt = (m: number): string => m.toFixed(2).replace('.', ',');
const label = (e: { id: string; mark: string }): string => (e.mark ? `"${e.mark}" (${e.id})` : `"${e.id}"`);

/**
 * Avisos do projeto que dependem da geometria resolvida (decisão 0028):
 * - `abertura-fora-da-parede`: o offset somado à largura do tipo passa do eixo da parede.
 * - `parede-topo-desnivelado`: duas paredes retas, colineares e do mesmo nível têm topos diferentes.
 * - `parede-dentro-da-laje`: a faixa de cota da parede cruza uma camada de laje com término `passa`, que continua
 *   sob a parede e pode contar o mesmo trecho duas vezes.
 * O motor calcula; a interface junta. A validação do modelo (`validateProject`) não é alterada.
 */
export function projectIssues(p: Project): ValidationIssue[] {
  const floors = resolveAllFloors(p);
  const slabs = resolveAllSlabs(p);
  const roofs = resolveAllRoofs(p);
  return [...openingOutside(p), ...wallTopIssues(p, floors, slabs, roofs), ...wallInsideSlab(p, floors, slabs)];
}

/** Abertura cujo `offset + largura` passa do comprimento do eixo da parede (1 mm de folga). */
function openingOutside(p: Project): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const e of Object.values(p.elements)) {
    if (!isOpening(e)) continue;
    const host = p.elements[e.hostId];
    const type = p.openingTypes[e.typeId];
    if (!isWall(host) || !type) continue;
    const L = dist(host.a, host.b);
    const end = e.offset + type.width;
    if (e.offset >= -EPS && end <= L + EPS) continue;
    out.push({
      severity: 'warning',
      code: 'abertura-fora-da-parede',
      message: `Abertura ${label(e)} está fora da parede ${label(host)}: offset ${fmt(e.offset)} m + largura ${fmt(type.width)} m = ${fmt(end)} m, mas o eixo tem ${fmt(L)} m.`,
      elementId: e.id,
      ids: [e.id, host.id],
    });
  }
  return out;
}

/** Parede reta com topo uniforme, já resolvido (piso, laje ou telhado anexados). */
interface WallTop {
  wall: Wall;
  u: Vec2;
  length: number;
  top: number;
}

/**
 * Topo resolvido da parede, ou null quando o topo não é uma cota única: parede curva, perfil superior editado, topo
 * anexado ao telhado (o perfil segue a água) ou topo anexado a piso/laje que cobre só parte do eixo (perfil em degraus).
 */
function straightTop(p: Project, w: Wall, floors: ReturnType<typeof resolveAllFloors>, slabs: ResolvedSlab[], roofs: ReturnType<typeof resolveAllRoofs>): WallTop | null {
  if (w.sag !== 0 || w.topProfile !== null || w.attachTopToRoof === true) return null;
  const z = wallZRange(p, w, floors, slabs, roofs);
  if (z.profile) return null;
  const length = dist(w.a, w.b);
  if (length < EPS) return null;
  return { wall: w, u: { x: (w.b.x - w.a.x) / length, y: (w.b.y - w.a.y) / length }, length, top: z.z0 + z.height };
}

/** As duas paredes estão no mesmo nível, são colineares (1° e 1 cm) e se sobrepõem ou se tocam ao longo do eixo. */
function collinearPair(a: WallTop, b: WallTop): boolean {
  if (a.wall.levelId !== b.wall.levelId) return false;
  if (Math.abs(cross(a.u, b.u)) > Math.sin(COLLINEAR_ANGLE)) return false;
  for (const q of [b.wall.a, b.wall.b]) {
    if (Math.abs(cross(a.u, sub(q, a.wall.a))) > COLLINEAR_OFFSET) return false;
  }
  const at = (q: Vec2): number => dot(sub(q, a.wall.a), a.u);
  const lo = Math.min(at(b.wall.a), at(b.wall.b));
  const hi = Math.max(at(b.wall.a), at(b.wall.b));
  return Math.min(a.length, hi) - Math.max(0, lo) >= -EPS;
}

/** Paredes colineares e do mesmo nível com topos diferentes (mais de 1 mm). */
function wallTopIssues(p: Project, floors: ReturnType<typeof resolveAllFloors>, slabs: ResolvedSlab[], roofs: ReturnType<typeof resolveAllRoofs>): ValidationIssue[] {
  const tops = Object.values(p.elements)
    .filter(isWall)
    .map((w) => straightTop(p, w, floors, slabs, roofs))
    .filter((t): t is WallTop => t !== null);
  const out: ValidationIssue[] = [];
  for (let i = 0; i < tops.length; i++) {
    for (let j = i + 1; j < tops.length; j++) {
      const a = tops[i]!;
      const b = tops[j]!;
      if (!collinearPair(a, b) || Math.abs(a.top - b.top) <= EPS) continue;
      const levelName = p.levels.find((l) => l.id === a.wall.levelId)?.name ?? a.wall.levelId;
      out.push({
        severity: 'warning',
        code: 'parede-topo-desnivelado',
        message: `Paredes ${label(a.wall)} e ${label(b.wall)} estão alinhadas no nível "${levelName}", mas os topos estão desnivelados: ${fmt(a.top)} m e ${fmt(b.top)} m.`,
        elementId: a.wall.id,
        ids: [a.wall.id, b.wall.id],
      });
    }
  }
  return out;
}

/** Camada de laje com término `passa` (a camada continua sob a parede, sem recorte). */
interface PassaLayer {
  slab: Slab;
  resolved: ResolvedSlab;
  layerIndex: number;
  polygon: ResolvedSlab['layers'][number]['polygon'];
}

/** Paredes cuja faixa de cota cruza uma camada `passa` que cobre o eixo: o trecho comum pode ser contado duas vezes. */
function wallInsideSlab(p: Project, floors: ReturnType<typeof resolveAllFloors>, slabs: ResolvedSlab[]): ValidationIssue[] {
  const layers: PassaLayer[] = [];
  for (const r of slabs) {
    const slab = p.elements[r.slabId];
    if (!isSlab(slab)) continue;
    const type = p.slabTypes[slab.typeId];
    if (!type) continue;
    r.layers.forEach((layer, i) => {
      if (terminoOf(type.layers[i]!) !== 'passa') return;
      layers.push({ slab, resolved: r, layerIndex: i, polygon: layer.polygon });
    });
  }
  if (layers.length === 0) return [];

  const out: ValidationIssue[] = [];
  for (const w of Object.values(p.elements).filter(isWall)) {
    const z = wallZRange(p, w, floors, slabs);
    const top = z.z0 + z.height;
    const L = dist(w.a, w.b);
    if (top - z.z0 < EPS || L < EPS) continue;
    // Cinco amostras do eixo bastam: a camada `passa` cobre a parede inteira ou não cobre.
    const samples: Vec2[] = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ x: w.a.x + (w.b.x - w.a.x) * t, y: w.a.y + (w.b.y - w.a.y) * t }));
    const best = new Map<string, { layer: PassaLayer; overlap: number }>();
    for (const layer of layers) {
      let overlap = 0;
      for (const q of samples) {
        if (!pointInMulti(q, layer.polygon)) continue;
        const rise = slabRiseAt(layer.resolved.slope, q);
        const z0 = layer.resolved.layers[layer.layerIndex]!.z0 + rise;
        const z1 = layer.resolved.layers[layer.layerIndex]!.z1 + rise;
        overlap = Math.max(overlap, Math.min(top, z1) - Math.max(z.z0, z0));
      }
      if (overlap <= EPS) continue;
      const cur = best.get(layer.slab.id);
      if (!cur || overlap > cur.overlap) best.set(layer.slab.id, { layer, overlap });
    }
    for (const { layer, overlap } of best.values()) {
      out.push({
        severity: 'warning',
        code: 'parede-dentro-da-laje',
        message: `Parede ${label(w)} está dentro da laje ${label(layer.slab)} (camada ${layer.layerIndex + 1}, término "passa"): o trecho comum de ${fmt(overlap)} m pode ser contado duas vezes.`,
        elementId: w.id,
        ids: [w.id, layer.slab.id],
      });
    }
  }
  return out;
}
