import { boxOf, closestOnSegment, dist, intersection, multiArea, pointInPolygon, polygonArea, type Box, type Polygon, type Vec2 } from '@hestia/geom';
import { isFloor, isSlab, type Floor, type Id, type OutlineSource, type Project, type Slab } from '@hestia/model';
import { enclosedRooms, outerPerimeter } from './enclosed.ts';

/** Sobreposição mínima (interseção sobre união) para um modo casar com o contorno atual (decisão 0023 §8.2). */
export const OUTLINE_MATCH_MIN = 0.95;

/** Modos testados, na ordem de preferência em caso de empate exato. */
const MODES: OutlineSource['mode'][] = ['walls-finish', 'walls-core', 'perimeter'];

/**
 * Origem sugerida para um piso ou laje estático: modo e semente que reproduzem o contorno gravado. `polygon` é o contorno
 * resultante (anel externo, furos manuais e ilhas de parede), o mesmo que o motor devolve depois de vincular.
 */
export interface OutlineSuggestion {
  source: OutlineSource;
  polygon: Polygon;
  /** Área (m²) do contorno gravado, líquida de furos. */
  areaAtual: number;
  /** Área (m²) do contorno que o vínculo produz. */
  areaDerivada: number;
  diferencia: { m2: number; pct: number };
  /** Interseção sobre união entre o contorno gravado e o derivado (0 a 1). */
  confianca: number;
}

/** Candidato de um modo: semente, anel do circuito (externo e ilhas) e contorno final com os furos manuais. */
interface Candidate {
  seed: Vec2;
  ring: Polygon;
  final: Polygon;
  iou: number;
}

/** Distância do ponto à borda do polígono (todos os anéis, externo e furos). */
function distToPolygon(q: Vec2, poly: Polygon): number {
  let d = Infinity;
  for (const r of poly) {
    for (let i = 0; i < r.length; i++) d = Math.min(d, dist(q, closestOnSegment(q, r[i]!, r[(i + 1) % r.length]!)));
  }
  return d;
}

/**
 * Ponto interior do polígono mais afastado da borda (grade sobre a caixa do anel externo, mais o centroide dos vértices).
 * É a semente guardada: fica dentro do circuito, longe das paredes, e não cai num furo. Null se nenhum ponto cai dentro.
 */
export function interiorPoint(poly: Polygon, steps = 32): Vec2 | null {
  const box: Box = boxOf(poly[0]!);
  const ring = poly[0]!;
  const centro = { x: ring.reduce((s, v) => s + v.x, 0) / ring.length, y: ring.reduce((s, v) => s + v.y, 0) / ring.length };
  const grade: Vec2[] = [centro];
  for (let i = 1; i < steps; i++) {
    for (let j = 1; j < steps; j++) {
      grade.push({ x: box.minX + ((box.maxX - box.minX) * i) / steps, y: box.minY + ((box.maxY - box.minY) * j) / steps });
    }
  }
  let best: { q: Vec2; d: number } | null = null;
  for (const q of grade) {
    if (!pointInPolygon(q, poly)) continue;
    const d = distToPolygon(q, poly);
    if (!best || d > best.d) best = { q, d };
  }
  return best?.q ?? null;
}

/** Caixas que se tocam (filtro barato antes da interseção). */
const boxesTouch = (a: Vec2[], b: Vec2[]): boolean => {
  const x = boxOf(a);
  const y = boxOf(b);
  return x.minX <= y.maxX && y.minX <= x.maxX && x.minY <= y.maxY && y.minY <= x.maxY;
};

/** Interseção sobre união de dois polígonos com furos. */
function iouOf(a: Polygon, b: Polygon): number {
  const inter = multiArea(intersection([a], [b]));
  const uniao = polygonArea(a) + polygonArea(b) - inter;
  return uniao > 0 ? inter / uniao : 0;
}

/** Candidatos de um modo: um por circuito de paredes (ou o perímetro externo que contém a semente). */
function candidatesFor(p: Project, el: Floor | Slab, mode: OutlineSource['mode'], target: Polygon): Candidate[] {
  const out: Candidate[] = [];
  const withManualHoles = (ring: Polygon): Polygon => [ring[0]!, ...el.holes, ...ring.slice(1)];
  if (mode === 'perimeter') {
    const seed = interiorPoint(target);
    const ring = seed ? outerPerimeter(p, el.levelId, seed) : null;
    if (seed && ring) out.push({ seed, ring: [ring], final: withManualHoles([ring]), iou: 0 });
    return out;
  }
  for (const room of enclosedRooms(p, el.levelId, mode === 'walls-core' ? 'core' : 'finish')) {
    if (!boxesTouch(room[0]!, target[0]!)) continue;
    const seed = interiorPoint(room);
    if (seed) out.push({ seed, ring: room, final: withManualHoles(room), iou: 0 });
  }
  return out;
}

/** Melhor candidato de um modo (maior sobreposição com o contorno gravado), ou null. */
function bestForMode(p: Project, el: Floor | Slab, mode: OutlineSource['mode'], target: Polygon): Candidate | null {
  let best: Candidate | null = null;
  for (const c of candidatesFor(p, el, mode, target)) {
    c.iou = iouOf(target, c.final);
    if (!best || c.iou > best.iou) best = c;
  }
  return best;
}

/**
 * Procura, para um piso ou laje estático, o modo e a semente que reproduzem o contorno gravado (decisão 0023 §8.2a).
 * Testa `walls-finish`, `walls-core` e `perimeter`; entre os modos com sobreposição de pelo menos 95%, escolhe o de menor
 * diferença de área. Devolve null quando nenhum chega lá (por exemplo, contorno de croqui livre). Não altera o projeto.
 */
export function suggestOutlineSource(p: Project, el: Floor | Slab): OutlineSuggestion | null {
  const target: Polygon = [el.boundary, ...el.holes];
  const areaAtual = polygonArea(target);
  if (!(areaAtual > 0)) return null;
  let best: OutlineSuggestion | null = null;
  for (const mode of MODES) {
    const c = bestForMode(p, el, mode, target);
    if (!c || c.iou < OUTLINE_MATCH_MIN) continue;
    const areaDerivada = polygonArea(c.final);
    const m2 = areaDerivada - areaAtual;
    if (best && Math.abs(best.diferencia.m2) <= Math.abs(m2)) continue;
    best = {
      source: { mode, seed: c.seed, linked: true },
      polygon: c.final,
      areaAtual,
      areaDerivada,
      diferencia: { m2, pct: (m2 / areaAtual) * 100 },
      confianca: c.iou,
    };
  }
  return best;
}

/** Resultado de tentar vincular um conjunto de pisos e lajes de uma vez (prévia agregada, decisão 0023 §8.2b). */
export interface OutlineBatch {
  /** Elementos com sugestão, na ordem dada. */
  vinculaveis: { id: Id; suggestion: OutlineSuggestion }[];
  /** Elementos sem circuito de paredes que case com o contorno. */
  semCorrespondencia: Id[];
  /** Soma das áreas atuais e derivadas dos vinculáveis. */
  areaAtual: number;
  areaDerivada: number;
  diferencia: { m2: number; pct: number };
}

/** Sugestão em lote: aplica `suggestOutlineSource` a cada piso ou laje, separando os que casam dos que não casam. */
export function suggestOutlineBatch(p: Project, els: (Floor | Slab)[]): OutlineBatch {
  const vinculaveis: OutlineBatch['vinculaveis'] = [];
  const semCorrespondencia: Id[] = [];
  for (const el of els) {
    const suggestion = suggestOutlineSource(p, el);
    if (suggestion) vinculaveis.push({ id: el.id, suggestion });
    else semCorrespondencia.push(el.id);
  }
  const areaAtual = vinculaveis.reduce((s, v) => s + v.suggestion.areaAtual, 0);
  const areaDerivada = vinculaveis.reduce((s, v) => s + v.suggestion.areaDerivada, 0);
  const m2 = areaDerivada - areaAtual;
  return { vinculaveis, semCorrespondencia, areaAtual, areaDerivada, diferencia: { m2, pct: areaAtual > 0 ? (m2 / areaAtual) * 100 : 0 } };
}

/** Pisos e lajes de um nível, na ordem do projeto; `apenasEstaticos` deixa de fora os já vinculados às paredes. */
export function outlineElementsOfLevel(p: Project, levelId: Id, apenasEstaticos = true): (Floor | Slab)[] {
  return Object.values(p.elements)
    .filter((e): e is Floor | Slab => (isFloor(e) || isSlab(e)) && e.levelId === levelId && (!apenasEstaticos || !e.outlineSource?.linked));
}
