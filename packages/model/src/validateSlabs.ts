import { machineNumber, boxOf, boxesOverlap, intersection, multiArea, type Box, type MultiPolygon, type Polygon, type Vec2 } from '@hestia/geom';
import { floorPolygon, floorTypeThickness } from './floor.ts';
import { levelElevation } from './queries.ts';
import { slabArea, slabPolygon, slabRiseAt, slabTypeThickness } from './slab.ts';
import { isFloor, isSlab, type Floor, type Project, type Slab } from './types.ts';
import type { ValidationIssue } from './validate.ts';
import { OVERLAP_MIN, ZERO_AREA, fmtArea, holeOutside, selfIntersects } from './validateFloors.ts';
import { unitsOf } from './units.ts';

/** Erro de módulo do vetor de direção da inclinação (a direção tem que ser unitária). */
const DIR_TOLERANCE = 1e-3;
/** Percentual de inclinação máximo em módulo (100 % = 45°). */
const MAX_PERCENT = 100;

const label = (e: { id: string; mark: string }): string => (e.mark ? `"${e.mark}" (${e.id})` : `"${e.id}"`);

/** Motivo de inclinação inválida, ou null. Sem inclinação não há o que validar. */
function slopeProblem(s: Slab): string | null {
  const sl = s.slope;
  if (!sl) return null;
  if (![sl.origin.x, sl.origin.y, sl.dir.x, sl.dir.y].every(Number.isFinite)) return 'origem ou direção não são números finitos';
  const len = Math.hypot(sl.dir.x, sl.dir.y);
  if (Math.abs(len - 1) > DIR_TOLERANCE) return `a direção não é unitária (comprimento ${machineNumber(len, 3)})`;
  if (!Number.isFinite(sl.percent) || Math.abs(sl.percent) > MAX_PERCENT) return `o percentual ${sl.percent} está fora de -100 a 100`;
  return null;
}

function slabIssuesOf(p: Project, s: Slab): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const name = label(s);
  const push = (code: string, message: string): void => void out.push({ severity: 'error', code, message, elementId: s.id });
  if (s.boundary.length < 3) push('slab-few-points', `Laje ${name} tem ${s.boundary.length} ponto(s) no contorno; o mínimo é 3.`);
  s.holes.forEach((h, k) => {
    if (h.length < 3) push('slab-few-points', `Furo ${k + 1} da laje ${name} tem ${h.length} ponto(s); o mínimo é 3.`);
  });
  if (!p.slabTypes[s.typeId]) push('slab-type-missing', `Laje ${name} usa o tipo "${s.typeId}", que não existe no projeto.`);
  if (!p.levels.some((l) => l.id === s.levelId)) push('slab-level-missing', `Laje ${name} está no nível "${s.levelId}", que não existe.`);
  const slope = slopeProblem(s);
  if (slope) push('slab-slope-invalid', `Inclinação da laje ${name} inválida: ${slope}.`);
  if (s.boundary.length < 3) return out;

  if (selfIntersects(s.boundary)) push('slab-self-intersect', `O contorno da laje ${name} se cruza consigo mesmo.`);
  s.holes.forEach((h, k) => {
    if (h.length >= 3 && selfIntersects(h)) push('slab-self-intersect', `O furo ${k + 1} da laje ${name} se cruza consigo mesmo.`);
  });
  const area = slabArea(s);
  if (area <= ZERO_AREA) push('slab-zero-area', `Laje ${name} tem área líquida de ${fmtArea(area, unitsOf(p))}; precisa ser maior que zero.`);
  s.holes.forEach((h, k) => {
    if (h.length >= 3 && holeOutside(s.boundary, h)) push('slab-hole-outside', `O furo ${k + 1} da laje ${name} está fora do contorno.`);
  });
  return out;
}

/** Sobreposição (metros quadrados) acima de 1 cm quadrado entre duas formas do mesmo nível; 0 quando as caixas nem se tocam. */
function commonArea(a: MultiPolygon, boxA: Box, b: MultiPolygon, boxB: Box): number {
  return boxesOverlap(boxA, boxB) ? multiArea(intersection(a, b)) : 0;
}

/** Lajes do mesmo nível com área em comum acima de 1 cm quadrado (warning). Só lajes com contorno válido. */
function slabOverlaps(slabs: Slab[], units: ReturnType<typeof unitsOf>): ValidationIssue[] {
  const shapes = slabs
    .filter((s) => s.boundary.length >= 3 && !selfIntersects(s.boundary))
    .map((s) => ({ s, poly: [slabPolygon(s)], box: boxOf(slabPolygon(s).flat()) }));
  const out: ValidationIssue[] = [];
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i]!;
      const b = shapes[j]!;
      if (a.s.levelId !== b.s.levelId) continue;
      const common = commonArea(a.poly, a.box, b.poly, b.box);
      if (common <= OVERLAP_MIN) continue;
      out.push({
        severity: 'warning',
        code: 'slab-overlap',
        message: `Lajes ${label(a.s)} e ${label(b.s)} se sobrepõem no mesmo nível: ${fmtArea(common, units)} em comum.`,
        elementId: a.s.id,
      });
    }
  }
  return out;
}

/** Folga de cota (1 mm) para o volume em comum entre laje e piso contar. */
const Z_TOLERANCE = 1e-3;

/**
 * Altura do volume em comum entre a laje e o piso num pedaço da interseção em planta. A laje tem a faixa [B + r, T + r]
 * em cada ponto (r = subida da inclinação, afim em p) e o piso a faixa fixa [fb, ft]. A sobreposição vertical é côncava
 * em r, então o máximo fica num dos extremos de r no pedaço ou num ponto de quebra (onde uma face cruza a outra).
 */
function verticalOverlap(piece: Polygon, slope: Slab['slope'], slabTop: number, slabBottom: number, floorTop: number, floorBottom: number): number {
  const rise = (q: Vec2): number => slabRiseAt(slope, q);
  const rs = piece.flat().map(rise);
  const rMin = Math.min(...rs);
  const rMax = Math.max(...rs);
  const overlap = (r: number): number => Math.min(slabTop + r, floorTop) - Math.max(slabBottom + r, floorBottom);
  const breaks = [rMin, rMax, floorTop - slabTop, floorBottom - slabBottom].filter((r) => r >= rMin && r <= rMax);
  return Math.max(...breaks.map(overlap));
}

/**
 * Laje e piso do mesmo nível que se sobrepõem em volume (warning): interseção em planta acima de 1 cm quadrado e faixas de
 * cota que se cruzam. O piso sobre a laje, encostado na face superior, não avisa. Pares com tipo ausente não entram.
 */
function slabFloorOverlaps(p: Project, slabs: Slab[], floors: Floor[]): ValidationIssue[] {
  const slabShapes = slabs
    .filter((s) => s.boundary.length >= 3 && !selfIntersects(s.boundary) && p.slabTypes[s.typeId])
    .map((s) => ({ s, poly: [slabPolygon(s)], box: boxOf(slabPolygon(s).flat()) }));
  const floorShapes = floors
    .filter((f) => f.boundary.length >= 3 && !selfIntersects(f.boundary) && p.floorTypes[f.typeId])
    .map((f) => ({ f, poly: [floorPolygon(f)], box: boxOf(floorPolygon(f).flat()) }));
  const out: ValidationIssue[] = [];
  for (const a of slabShapes) {
    const slabTop = levelElevation(p, a.s.levelId) + a.s.heightOffset;
    const slabBottom = slabTop - slabTypeThickness(p.slabTypes[a.s.typeId]!);
    for (const b of floorShapes) {
      if (a.s.levelId !== b.f.levelId) continue;
      if (!boxesOverlap(a.box, b.box)) continue;
      const floorTop = levelElevation(p, b.f.levelId) + b.f.heightOffset;
      const floorBottom = floorTop - floorTypeThickness(p.floorTypes[b.f.typeId]!);
      const common = intersection(a.poly, b.poly);
      const hit = common.filter((piece) => verticalOverlap(piece, a.s.slope, slabTop, slabBottom, floorTop, floorBottom) > Z_TOLERANCE);
      const area = multiArea(hit);
      if (area <= OVERLAP_MIN) continue;
      out.push({
        severity: 'warning',
        code: 'slab-floor-overlap',
        message:
          `Laje ${label(a.s)} e piso ${label(b.f)} se sobrepõem no mesmo nível: ${fmtArea(area, unitsOf(p))} em comum. ` +
          'Se o piso é o acabamento sobre a laje, ajuste o deslocamento do piso para que a face inferior dele fique sobre a face superior da laje.',
        elementId: a.s.id,
      });
    }
  }
  return out;
}

/** Tolerância (1 cm) entre a face inferior do piso e a laje para o aviso de concreto em dobro (decisão 0023 §4). */
const STRUCTURE_TOLERANCE = 0.01;

/**
 * Piso com camada de função Estrutura cuja face inferior toca ou entra na laje do mesmo nível, com a mesma área em
 * planta (warning). O concreto da laje e o da camada estrutural do piso ficam contados duas vezes. O aviso não
 * bloqueia; a saída é um tipo de piso de acabamento (`ft_acab`), que não tem camada estrutural.
 */
function floorStructureOverSlab(p: Project, slabs: Slab[], floors: Floor[]): ValidationIssue[] {
  const slabShapes = slabs
    .filter((s) => s.boundary.length >= 3 && !selfIntersects(s.boundary) && p.slabTypes[s.typeId])
    .map((s) => ({ s, poly: [slabPolygon(s)], box: boxOf(slabPolygon(s).flat()) }));
  const out: ValidationIssue[] = [];
  for (const f of floors) {
    const type = p.floorTypes[f.typeId];
    if (!type || !type.layers.some((l) => l.function === 'structure')) continue;
    if (f.boundary.length < 3 || selfIntersects(f.boundary)) continue;
    const floorPoly = [floorPolygon(f)];
    const floorBox = boxOf(floorPolygon(f).flat());
    const floorBottom = levelElevation(p, f.levelId) + f.heightOffset - floorTypeThickness(type);
    for (const a of slabShapes) {
      if (a.s.levelId !== f.levelId || !boxesOverlap(a.box, floorBox)) continue;
      const slabTop = levelElevation(p, a.s.levelId) + a.s.heightOffset;
      const slabBottom = slabTop - slabTypeThickness(p.slabTypes[a.s.typeId]!);
      const common = intersection(a.poly, floorPoly);
      // Com laje inclinada a faixa da laje muda em planta: a faixa testada vai de B + r mínimo a T + r máximo.
      const rises = common.flat(2).map((q) => slabRiseAt(a.s.slope, q));
      if (rises.length === 0) continue;
      const lo = slabBottom + Math.min(...rises);
      const hi = slabTop + Math.max(...rises) + STRUCTURE_TOLERANCE;
      if (floorBottom < lo - Z_TOLERANCE || floorBottom > hi + Z_TOLERANCE) continue;
      const area = multiArea(common);
      if (area <= OVERLAP_MIN) continue;
      out.push({
        severity: 'warning',
        code: 'piso-estrutura-sobre-laje',
        message:
          `Piso ${label(f)} tem camada estrutural e a face inferior dele está sobre a laje ${label(a.s)} (${fmtArea(area, unitsOf(p))} em comum): ` +
          'o concreto está contado duas vezes (piso e laje); use um tipo de piso de acabamento.',
        elementId: f.id,
      });
    }
  }
  return out;
}

/** Problemas das lajes do projeto: geometria, inclinação, tipo, nível, sobreposição entre lajes e entre laje e piso. */
export function slabIssues(p: Project): ValidationIssue[] {
  const elements = Object.values(p.elements);
  const slabs = elements.filter(isSlab);
  const floors = elements.filter(isFloor);
  return [
    ...slabs.flatMap((s) => slabIssuesOf(p, s)),
    ...slabOverlaps(slabs, unitsOf(p)),
    ...slabFloorOverlaps(p, slabs, floors),
    ...floorStructureOverSlab(p, slabs, floors),
  ];
}
