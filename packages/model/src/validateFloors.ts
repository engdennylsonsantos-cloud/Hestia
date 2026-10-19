import { boxOf, boxesOverlap, closestOnSegment, dist, intersection, intersectSegments, multiArea, pointInRing, type Box, type Ring, type Vec2 } from '@hestia/geom';
import { floorArea, floorPolygon } from './floor.ts';
import { isFloor, type Floor, type Project } from './types.ts';
import type { ValidationIssue } from './validate.ts';

/** Área líquida abaixo disso é zero (1 mm²). */
export const ZERO_AREA = 1e-6;
/** Sobreposição mínima entre dois pisos do mesmo nível para avisar (1 cm²). */
export const OVERLAP_MIN = 1e-4;
/** Distância (1 mm) para um vértice de furo contar como sobre o contorno. */
const ON_EDGE = 1e-3;

const label = (f: Floor): string => (f.mark ? `"${f.mark}" (${f.id})` : `"${f.id}"`);

/** Área em m² com vírgula decimal; abaixo de 1 dm² mostra cm². */
export function fmtArea(m2: number): string {
  return m2 < 0.01 ? `${Math.round(m2 * 1e4)} cm²` : `${m2.toFixed(2).replace('.', ',')} m²`;
}

/** Arestas não vizinhas que se tocam ou cruzam (vértice compartilhado entre arestas não vizinhas também conta). */
export function selfIntersects(ring: Ring): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (intersectSegments(ring[i]!, ring[(i + 1) % n]!, ring[j]!, ring[(j + 1) % n]!)) return true;
    }
  }
  return false;
}

/** Distância do ponto ao contorno (menor distância a qualquer aresta). */
const distToRing = (pt: Vec2, ring: Ring): number => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) best = Math.min(best, dist(pt, closestOnSegment(pt, ring[i]!, ring[(i + 1) % ring.length]!)));
  return best;
};

/**
 * Furo fora do contorno: algum vértice do furo cai fora do contorno, ou uma aresta do furo cruza uma aresta do
 * contorno em um ponto que não é vértice do furo (o vértice sobre a linha do contorno é permitido).
 */
export function holeOutside(boundary: Ring, hole: Ring): boolean {
  const inside = (pt: Vec2): boolean => pointInRing(pt, boundary) || distToRing(pt, boundary) < ON_EDGE;
  if (hole.some((v) => !inside(v))) return true;
  const n = hole.length;
  for (let i = 0; i < n; i++) {
    const a = hole[i]!;
    const b = hole[(i + 1) % n]!;
    for (let j = 0; j < boundary.length; j++) {
      const c = boundary[j]!;
      const d = boundary[(j + 1) % boundary.length]!;
      const x = intersectSegments(a, b, c, d);
      // Cruzamento em vértice do furo (encosto) não conta; qualquer outro cruzamento conta.
      if (x && !hole.some((v) => dist(v, x) < ON_EDGE)) return true;
    }
  }
  return false;
}

function floorIssuesOf(p: Project, f: Floor): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const name = label(f);
  const push = (severity: ValidationIssue['severity'], code: string, message: string): void => void out.push({ severity, code, message, elementId: f.id });
  if (f.boundary.length < 3) push('error', 'floor-few-points', `Piso ${name} tem ${f.boundary.length} ponto(s) no contorno; o mínimo é 3.`);
  f.holes.forEach((h, k) => {
    if (h.length < 3) push('error', 'floor-few-points', `Furo ${k + 1} do piso ${name} tem ${h.length} ponto(s); o mínimo é 3.`);
  });
  if (!p.floorTypes[f.typeId]) push('error', 'floor-type-missing', `Piso ${name} usa o tipo "${f.typeId}", que não existe no projeto.`);
  if (!p.levels.some((l) => l.id === f.levelId)) push('error', 'level-missing', `Piso ${name} está no nível "${f.levelId}", que não existe.`);
  if (f.boundary.length < 3) return out;

  if (selfIntersects(f.boundary)) push('error', 'floor-self-intersect', `O contorno do piso ${name} se cruza consigo mesmo.`);
  f.holes.forEach((h, k) => {
    if (h.length >= 3 && selfIntersects(h)) push('error', 'floor-self-intersect', `O furo ${k + 1} do piso ${name} se cruza consigo mesmo.`);
  });
  const area = floorArea(f);
  if (area <= ZERO_AREA) push('error', 'floor-zero-area', `Piso ${name} tem área líquida de ${fmtArea(area)}; precisa ser maior que zero.`);
  f.holes.forEach((h, k) => {
    if (h.length >= 3 && holeOutside(f.boundary, h)) push('error', 'floor-hole-outside', `O furo ${k + 1} do piso ${name} está fora do contorno.`);
  });
  return out;
}

/** Pares de pisos do mesmo nível com área em comum acima de 1 cm² (warning, com a área). Só pisos com contorno válido. */
function floorOverlaps(floors: Floor[]): ValidationIssue[] {
  const valid = floors.filter((f) => f.boundary.length >= 3 && !selfIntersects(f.boundary));
  const boxes = new Map<Floor, Box>(valid.map((f) => [f, boxOf(floorPolygon(f).flat())]));
  const out: ValidationIssue[] = [];
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i]!;
      const b = valid[j]!;
      if (a.levelId !== b.levelId || !boxesOverlap(boxes.get(a)!, boxes.get(b)!)) continue;
      const common = multiArea(intersection([floorPolygon(a)], [floorPolygon(b)]));
      if (common <= OVERLAP_MIN) continue;
      out.push({
        severity: 'warning',
        code: 'floor-overlap',
        message: `Pisos ${label(a)} e ${label(b)} se sobrepõem no mesmo nível: ${fmtArea(common)} em comum.`,
        elementId: a.id,
      });
    }
  }
  return out;
}

/** Problemas dos pisos do projeto: geometria, tipo, nível e sobreposição entre pisos do mesmo nível. */
export function floorIssues(p: Project): ValidationIssue[] {
  const floors = Object.values(p.elements).filter(isFloor);
  return [...floors.flatMap((f) => floorIssuesOf(p, f)), ...floorOverlaps(floors)];
}
