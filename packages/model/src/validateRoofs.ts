import { boxOf, boxesOverlap, intersection, multiArea, ringArea, type Box, type MultiPolygon } from '@hestia/geom';
import { roofPolygon, roofPlanArea } from './roof.ts';
import { isRoof, type Project, type Roof } from './types.ts';
import type { ValidationIssue } from './validate.ts';
import { OVERLAP_MIN, ZERO_AREA, fmtArea, holeOutside, selfIntersects } from './validateFloors.ts';

/** Erro de módulo do vetor de direção (a direção tem que ser unitária). */
const DIR_TOLERANCE = 1e-3;
/** Percentual de inclinação máximo em módulo (300 %, ou seja, cerca de 71°). */
const MAX_PERCENT = 300;

const label = (r: Roof): string => (r.mark ? `"${r.mark}" (${r.id})` : `"${r.id}"`);

/** Motivo de inclinação inválida das formas com uma inclinação única (uma água, duas águas e quatro águas), ou null. */
function slopeProblem(r: Roof): string | null {
  if (r.shape !== 'shed' && r.shape !== 'gable' && r.shape !== 'hip') return null;
  if (!Number.isFinite(r.slopePercent)) return 'o percentual não é um número';
  if (r.slopePercent <= 0) return `o percentual ${r.slopePercent} precisa ser maior que zero`;
  if (r.slopePercent > MAX_PERCENT) return `o percentual ${r.slopePercent} passa de ${MAX_PERCENT} %`;
  return null;
}

/** Direção não unitária nas formas que a usam (uma água e duas águas), ou null. */
function dirProblem(r: Roof): string | null {
  if (r.shape !== 'shed' && r.shape !== 'gable') return null;
  if (![r.dir.x, r.dir.y].every(Number.isFinite)) return 'a direção não é um número finito';
  const len = Math.hypot(r.dir.x, r.dir.y);
  if (Math.abs(len - 1) > DIR_TOLERANCE) return `a direção não é unitária (comprimento ${len.toFixed(3).replace('.', ',')})`;
  return null;
}

/**
 * Inclinação por aresta: lista com o tamanho do contorno (todas as formas), e na forma 'edges' nenhuma aresta sem
 * inclinação (sem água) e cada inclinação que define dentro de (0, 300 %].
 */
function edgeProblems(r: Roof, name: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const push = (code: string, message: string): void => void out.push({ severity: 'error', code, message, elementId: r.id });
  const n = r.boundary.length;
  if (r.edgeSlopes.length !== n || r.edgeOverhangs.length !== n) {
    push('roof-edges-length', `Telhado ${name}: a lista de arestas (${r.edgeSlopes.length} inclinações, ${r.edgeOverhangs.length} balanços) não bate com o contorno (${n} arestas).`);
  }
  if (r.edgeSag) {
    if (r.edgeSag.length !== n) {
      push('roof-edge-sag-length', `Telhado ${name}: a lista de flechas (${r.edgeSag.length}) não bate com o contorno (${n} arestas).`);
    } else if (r.edgeSag.some((v, i) => !Number.isFinite(v) || Math.abs(v) > Math.hypot(r.boundary[(i + 1) % n]!.x - r.boundary[i]!.x, r.boundary[(i + 1) % n]!.y - r.boundary[i]!.y) / 2 + 1e-9)) {
      push('roof-edge-sag-invalid', `Telhado ${name}: a flecha de uma aresta passa de metade da corda ou não é um número finito.`);
    }
  }
  if (r.shape !== 'edges') return out;
  if (!r.edgeSlopes.some((s) => s !== null && s !== undefined)) {
    push('roof-all-flat', `Telhado ${name} é por arestas e nenhuma aresta define inclinação: sem água não há telhado.`);
  }
  r.edgeSlopes.forEach((s, i) => {
    if (s === null || s === undefined) return;
    if (!Number.isFinite(s) || s <= 0 || s > MAX_PERCENT) {
      push('roof-edge-slope-invalid', `Inclinação da aresta ${i + 1} do telhado ${name} inválida: ${s} % precisa estar entre 0 e ${MAX_PERCENT} %.`);
    }
  });
  return out;
}

/** Ângulo (graus) até o qual uma aresta conta como paralela à cumeeira de duas águas. */
const RIDGE_PARALLEL_DEG = 5;

/**
 * Cumeeira de duas águas ('gable') sem nenhuma aresta do contorno paralela a `dir` (± 5°): a cumeeira segue as arestas do
 * contorno, não a direção informada. Aviso, não erro: o telhado continua calculado. Só com direção unitária.
 */
function ridgeProblems(r: Roof, name: string): ValidationIssue[] {
  if (r.shape !== 'gable' || dirProblem(r)) return [];
  const sinTol = Math.sin((RIDGE_PARALLEL_DEG * Math.PI) / 180);
  const n = r.boundary.length;
  const parallel = r.boundary.some((a, i) => {
    const c = r.boundary[(i + 1) % n]!;
    const l = Math.hypot(c.x - a.x, c.y - a.y);
    return l > 1e-12 && Math.abs(((c.x - a.x) * r.dir.y - (c.y - a.y) * r.dir.x) / l) <= sinTol;
  });
  if (parallel) return [];
  return [
    {
      severity: 'warning',
      code: 'roof-ridge-off-edges',
      message: `Telhado ${name}: a cumeeira acompanha as arestas do contorno: nenhuma aresta é paralela à direção informada.`,
      elementId: r.id,
    },
  ];
}

/** Águas livres com polígono de menos de 3 pontos, área zero ou direção de subida nula. */
function planeProblems(r: Roof, name: string): ValidationIssue[] {
  if (r.shape !== 'free') return [];
  const out: ValidationIssue[] = [];
  const push = (code: string, message: string): void => void out.push({ severity: 'error', code, message, elementId: r.id });
  r.planes.forEach((pl, k) => {
    const water = `água livre ${k + 1} do telhado ${name}`;
    if (pl.polygon.length < 3) return push('roof-plane-degenerate', `A ${water} tem ${pl.polygon.length} ponto(s); o mínimo é 3.`);
    const area = Math.abs(ringArea(pl.polygon));
    if (area <= ZERO_AREA) return push('roof-plane-degenerate', `A ${water} tem área de ${fmtArea(area)}; precisa ser maior que zero.`);
    if (!(Math.hypot(pl.up.x, pl.up.y) > 1e-9)) push('roof-plane-degenerate', `A ${water} não tem direção de subida.`);
    if (!Number.isFinite(pl.percent) || Math.abs(pl.percent) > MAX_PERCENT) {
      push('roof-slope-invalid', `Inclinação da ${water} inválida: o percentual ${pl.percent} não é finito ou passa de ${MAX_PERCENT} %.`);
    }
  });
  return out;
}

function roofIssuesOf(p: Project, r: Roof): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const name = label(r);
  const push = (severity: ValidationIssue['severity'], code: string, message: string): void => void out.push({ severity, code, message, elementId: r.id });
  if (r.boundary.length < 3) push('error', 'roof-few-points', `Telhado ${name} tem ${r.boundary.length} ponto(s) no contorno; o mínimo é 3.`);
  r.holes.forEach((h, k) => {
    if (h.length < 3) push('error', 'roof-few-points', `Furo ${k + 1} do telhado ${name} tem ${h.length} ponto(s); o mínimo é 3.`);
  });
  if (!p.roofTypes[r.typeId]) push('error', 'roof-type-missing', `Telhado ${name} usa o tipo "${r.typeId}", que não existe no projeto.`);
  if (!p.levels.some((l) => l.id === r.levelId)) push('error', 'roof-level-missing', `Telhado ${name} está no nível "${r.levelId}", que não existe.`);
  const slope = slopeProblem(r);
  if (slope) push('error', 'roof-slope-invalid', `Inclinação do telhado ${name} inválida: ${slope}.`);
  const dir = dirProblem(r);
  if (dir) push('error', 'roof-slope-invalid', `Direção do telhado ${name} inválida: ${dir}.`);
  out.push(...planeProblems(r, name));
  out.push(...edgeProblems(r, name));
  if (r.boundary.length < 3) return out;

  if (selfIntersects(r.boundary)) push('error', 'roof-self-intersect', `O contorno do telhado ${name} se cruza consigo mesmo.`);
  r.holes.forEach((h, k) => {
    if (h.length >= 3 && selfIntersects(h)) push('error', 'roof-self-intersect', `O furo ${k + 1} do telhado ${name} se cruza consigo mesmo.`);
  });
  const area = roofPlanArea(r);
  if (area <= ZERO_AREA) push('error', 'roof-zero-area', `Telhado ${name} tem área em planta de ${fmtArea(area)}; precisa ser maior que zero.`);
  r.holes.forEach((h, k) => {
    if (h.length >= 3 && holeOutside(r.boundary, h)) push('error', 'roof-hole-outside', `O furo ${k + 1} do telhado ${name} está fora do contorno.`);
  });
  out.push(...ridgeProblems(r, name));
  return out;
}

/** Área comum (m²) de duas áreas; 0 quando as caixas nem se tocam. */
function commonArea(a: MultiPolygon, boxA: Box, b: MultiPolygon, boxB: Box): number {
  return boxesOverlap(boxA, boxB) ? multiArea(intersection(a, b)) : 0;
}

/** Telhados do mesmo nível com área em planta em comum acima de 1 cm² (warning). Só contornos válidos. */
function roofOverlaps(roofs: Roof[]): ValidationIssue[] {
  const shapes = roofs
    .filter((r) => r.boundary.length >= 3 && !selfIntersects(r.boundary))
    .map((r) => ({ r, poly: [roofPolygon(r)], box: boxOf(roofPolygon(r).flat()) }));
  const out: ValidationIssue[] = [];
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i]!;
      const b = shapes[j]!;
      if (a.r.levelId !== b.r.levelId) continue;
      const common = commonArea(a.poly, a.box, b.poly, b.box);
      if (common <= OVERLAP_MIN) continue;
      out.push({
        severity: 'warning',
        code: 'roof-overlap',
        message: `Telhados ${label(a.r)} e ${label(b.r)} se sobrepõem no mesmo nível: ${fmtArea(common)} em comum.`,
        elementId: a.r.id,
      });
    }
  }
  return out;
}

/** Problemas dos telhados do projeto: geometria, inclinação (única e por aresta), águas livres, tipo, nível, forma e sobreposição. */
export function roofIssues(p: Project): ValidationIssue[] {
  const roofs = Object.values(p.elements).filter(isRoof);
  return [...roofs.flatMap((r) => roofIssuesOf(p, r)), ...roofOverlaps(roofs)];
}
