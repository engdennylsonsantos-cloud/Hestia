import { add, arcFromSagitta, arcSample, dist, mul, norm, sub, type Vec2 } from '@hestia/geom';
import { gridTypeOf, projectGrids, type Grid, type GridLinePattern, type GridType, type Id, type Project } from '@hestia/model';
import { espessuraDePapel } from './espessura.ts';
import type { LabelOp, PlanTheme, StrokeOp } from './types.ts';

/**
 * Grades de eixos na planta (Revit: Grid). Todas as medidas de papel (traço, pontas, bolha e texto) saem em mm e na escala
 * da vista; a geometria está em metros, então a grade tem o mesmo tamanho de papel em qualquer zoom. Traços e rótulos
 * entram na geometria do nível (por cima do modelo, por baixo das anotações) e valem em todos os níveis.
 */

/** Padrão do traço-ponto em mm de papel: traço longo, vão, pontinho, vão (o do Revit, aproximado). */
const DASH_MM = 12;
const GAP_MM = 3;
const DOT_MM = 0.6;
/** Teto de pedaços por traço: acima disso o traço sai contínuo, para não virar milhares de operações. */
const MAX_PEDACOS = 4000;
const BOLHA_LADOS = 32;

export interface GridOps {
  strokes: StrokeOp[];
  labels: LabelOp[];
}

const entre = (p: Vec2, q: Vec2, t: number): Vec2 => (t <= 0 ? p : t >= 1 ? q : { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });

/** Comprimento do polígono aberto (m). */
export function comprimento(pts: readonly Vec2[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1]!, pts[i]!);
  return s;
}

/** Trecho do polígono entre as distâncias `a` e `b` (m) ao longo dele, com os vértices que ficam no meio. */
export function trecho(pts: readonly Vec2[], a: number, b: number): Vec2[] {
  const out: Vec2[] = [];
  const push = (q: Vec2): void => {
    const last = out[out.length - 1];
    if (!last || last.x !== q.x || last.y !== q.y) out.push(q);
  };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1]!;
    const q = pts[i]!;
    const l = dist(p, q);
    if (l > 0 && acc + l >= a && acc <= b) {
      push(entre(p, q, Math.min(1, Math.max(0, (a - acc) / l))));
      push(entre(p, q, Math.min(1, Math.max(0, (b - acc) / l))));
    }
    acc += l;
  }
  return out;
}

/**
 * Pedaços que o padrão desenha ao longo do polígono: traço (`dash`) ou traço-ponto (`dashdot`), em mm de papel; `solid` é o
 * polígono inteiro. Cada pedaço vira um traço próprio, então o padrão acompanha a curva e o multissegmento.
 */
export function pedacos(pts: readonly Vec2[], pattern: GridLinePattern, mmM: number): Vec2[][] {
  const total = comprimento(pts);
  if (pattern === 'solid' || total === 0) return [[...pts]];
  const ciclo = pattern === 'dashdot' ? [DASH_MM, GAP_MM, DOT_MM, GAP_MM] : [DASH_MM, GAP_MM];
  const passo = ciclo.reduce((x, y) => x + y, 0) * mmM;
  if ((total / passo) * ciclo.length > MAX_PEDACOS) return [[...pts]];
  const out: Vec2[][] = [];
  let s = 0;
  for (let i = 0; s < total; i++) {
    const l = ciclo[i % ciclo.length]! * mmM;
    // Os traços pares (traço e pontinho) são desenhados; os vãos (ímpares) ficam em branco.
    if (i % 2 === 0) {
      const piece = trecho(pts, s, Math.min(total, s + l));
      if (piece.length >= 2) out.push(piece);
    }
    s += l;
  }
  return out;
}

/** Eixo da grade em planta: o arco amostrado (2 pontos com flecha) ou os próprios pontos. */
export function eixoDaGrade(g: Pick<Grid, 'points' | 'sag'>): Vec2[] {
  if (g.points.length === 2 && g.sag !== 0) {
    const arc = arcFromSagitta(g.points[0]!, g.points[1]!, g.sag);
    if (arc) return arcSample(arc, 0, arc.length);
  }
  return g.points.map((q) => ({ x: q.x, y: q.y }));
}

/** Direção para fora do eixo na ponta: início (`fim` falso) ou fim. Unitária. */
function saidaDaPonta(eixo: readonly Vec2[], fim: boolean): Vec2 {
  const n = eixo.length;
  return fim ? norm(sub(eixo[n - 1]!, eixo[n - 2]!)) : norm(sub(eixo[0]!, eixo[1]!));
}

const circulo = (c: Vec2, r: number): Vec2[] => Array.from({ length: BOLHA_LADOS }, (_, i) => ({ x: c.x + Math.cos((i * 2 * Math.PI) / BOLHA_LADOS) * r, y: c.y + Math.sin((i * 2 * Math.PI) / BOLHA_LADOS) * r }));

/**
 * Uma grade: as pontas (ou a linha inteira, com 'continuous'), o centro (com 'custom') e as bolhas ligadas. As pontas têm
 * `endLengthMm` de papel a partir de cada extremo (sem passar da metade do eixo). A bolha fica afastada da ponta no sentido
 * da linha, com o raio dela, e toca a ponta; o nome sai centrado nela. `color` null = tinta do tema; selecionada = cor de
 * seleção.
 */
export function gradeOps(g: Grid, t: GridType, scale: number, zoom: number, theme: PlanTheme, selected: boolean): GridOps {
  const eixo = eixoDaGrade(g);
  const mmM = scale / 1000;
  const total = comprimento(eixo);
  const cor = (c: string | null): string => (selected ? theme.select : c ?? theme.ink);
  const pontas = Math.min(t.endLengthMm * mmM, total / 2);
  const strokes: StrokeOp[] = [];
  const tracos = (pts: readonly Vec2[], mm: number, pattern: GridLinePattern, color: string): StrokeOp[] =>
    pedacos(pts, pattern, mmM)
      .filter((pc) => pc.length >= 2)
      .map((pc): StrokeOp => ({ pts: pc, closed: false, ...espessuraDePapel(mm, zoom, scale), color, alpha: 1 }));

  if (t.centerSegment === 'continuous') {
    strokes.push(...tracos(eixo, t.weightMm, t.pattern, cor(t.color)));
  } else {
    strokes.push(...tracos(trecho(eixo, 0, pontas), t.weightMm, t.pattern, cor(t.color)));
    strokes.push(...tracos(trecho(eixo, total - pontas, total), t.weightMm, t.pattern, cor(t.color)));
    if (t.centerSegment === 'custom' && total - 2 * pontas > 0) {
      strokes.push(...tracos(trecho(eixo, pontas, total - pontas), t.centerWeightMm, t.centerPattern, cor(t.centerColor)));
    }
  }

  const labels: LabelOp[] = [];
  const r = (t.bubbleDiameterMm / 2) * mmM;
  const ligadas: Array<[boolean, boolean]> = [[g.bubbleStart, false], [g.bubbleEnd, true]];
  for (const [ligada, fim] of ligadas) {
    if (!ligada) continue;
    const tip = fim ? eixo[eixo.length - 1]! : eixo[0]!;
    const c = add(tip, mul(saidaDaPonta(eixo, fim), r));
    strokes.push({ pts: circulo(c, r), closed: true, ...espessuraDePapel(t.weightMm, zoom, scale), color: cor(t.color), alpha: 1 });
    labels.push({ at: c, text: g.name, center: true, papel: { escala: scale, fontMm: t.bubbleTextMm } });
  }
  return { strokes, labels };
}

/**
 * Todas as grades do projeto na escala da vista. Grade cujo tipo sumiu não sai (o modelo recusa esse caso, mas o arquivo
 * pode trazê-lo). `selection` marca as grades selecionadas (realce na cor de seleção).
 */
export function gridOps(p: Project, scale: number, zoom: number, theme: PlanTheme, selection: readonly Id[] = []): GridOps {
  const out: GridOps = { strokes: [], labels: [] };
  for (const g of projectGrids(p)) {
    const t = gridTypeOf(p, g.typeId);
    if (!t) continue;
    const o = gradeOps(g, t, scale, zoom, theme, selection.includes(g.id));
    out.strokes.push(...o.strokes);
    out.labels.push(...o.labels);
  }
  return out;
}
