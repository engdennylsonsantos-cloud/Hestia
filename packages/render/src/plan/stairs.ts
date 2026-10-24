import { add, difference, dist, intersection, lerp, mul, multiArea, norm, perp, pointInMulti, rotate, sub, union, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { sampleChain, spiralParamsOf, type ResolvedStair, type ResolvedStairRiser, type ResolvedStairStep, type SpiralParams } from '@hestia/engine';
import { isStair, paperMmToPx, type DetailLevel, type Id, type Project } from '@hestia/model';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import { labelPoint, outlineSelectionOps, type FloorOps } from './floors.ts';
import { riserPoints, risersInClimbOrder } from '../stairRisers.ts';
import { defaultPaint, surfaceColor, type PlanPaint } from './style.ts';
import type { PlanTheme, StrokeOp } from './types.ts';

/**
 * Cota de corte padrão, em m acima da base do lance (1,20 m, como o corte padrão do intervalo de vista). A planta usa a
 * cota absoluta da vista (`StairView`); sem ela, vale esta, relativa à base de cada escada.
 */
export const STAIR_CUT_HEIGHT = 1.2;

/** Cotas absolutas da vista para as escadas (decisão 0013 §4): plano de corte e topo do intervalo. */
export interface StairView {
  cutZ: number;
  topZ: number;
}

/** Traço (px) do tracejado dos degraus acima da cota de corte. */
export const STAIR_DASH: [number, number] = [6, 3];

/** Rótulos da escada em mm de papel, no mesmo padrão das anotações (decisão 0019). */
const STAIR_TEXT_MM = 1.6;
const STAIR_TAG_MM = 1.6;
const STAIR_SOBE_OFFSET_MM = 2.35;

const empty = (): FloorOps => ({ fills: [], strokes: [], labels: [] });

/**
 * Número visível do degrau na planta (decisão 0011 §1 item 6): o espelho que ele alcança, `k = round((zTopo − baseZ) / h)`.
 * É contínuo na escada: o `index` do motor reinicia em cada lance, e o 1º degrau depois de um patamar segue o último
 * espelho anterior (o patamar não recebe rótulo, mas ocupa esse número). Usa a cota, não a contagem, então um lance
 * com erro de croqui ainda conta os seus espelhos. Sem altura real do espelho, vale o índice do lance.
 */
export function treadNumber(s: ResolvedStair, st: ResolvedStairStep): number {
  if (!(s.riserHeight > 0)) return st.index;
  return Math.round((st.z - s.baseZ) / s.riserHeight);
}

/** Ponto a meio comprimento da polilinha (ponto médio do espelho). */
export function polyMid(pts: Vec2[]): Vec2 {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1]!, pts[i]!);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const L = dist(a, b);
    if (L > 0 && acc + L >= total / 2) return lerp(a, b, (total / 2 - acc) / L);
    acc += L;
  }
  return pts[pts.length - 1] ?? { x: 0, y: 0 };
}

/** Ponto de corte na caminhada (entre pontos médios de espelhos) em que ela passa pela cota de corte. */
export interface StairCut {
  at: Vec2;
  /** Sentido da caminhada no ponto (unitário). */
  walk: Vec2;
  /** Sentido do corte, perpendicular à caminhada. */
  across: Vec2;
  /** Meia-largura do símbolo (m): meia largura do lance mais um pequeno avanço de cada lado. */
  half: number;
}

const chord = (r: ResolvedStairRiser): number => dist(r.a, r.b);

/**
 * Corte da planta: o primeiro trecho da caminhada automática (pontos médios dos espelhos em ordem de subida) que cruza
 * a cota `cutZ` (absoluta; por padrão `baseZ + STAIR_CUT_HEIGHT`). Null quando o lance não chega a essa cota (ou não
 * tem dois espelhos): o símbolo de corte só aparece onde o plano cruza a escada.
 */
export function stairCut(s: ResolvedStair, risers: ResolvedStairRiser[], zoom: number, cutZ: number = s.baseZ + STAIR_CUT_HEIGHT): StairCut | null {
  const mids = risers.map((r) => polyMid(riserPoints(r)));
  for (let i = 0; i + 1 < risers.length; i++) {
    const h0 = (risers[i]!.z0 + risers[i]!.z1) / 2;
    const h1 = (risers[i + 1]!.z0 + risers[i + 1]!.z1) / 2;
    if (!(h1 > h0 && h0 <= cutZ && cutZ <= h1)) continue;
    const walkVec = sub(mids[i + 1]!, mids[i]!);
    if (dist(mids[i + 1]!, mids[i]!) < 1e-9) return null;
    const walk = norm(walkVec);
    const width = (chord(risers[i]!) + chord(risers[i + 1]!)) / 2;
    return { at: lerp(mids[i]!, mids[i + 1]!, (cutZ - h0) / (h1 - h0)), walk, across: perp(walk), half: width / 2 + 8 / zoom };
  }
  return null;
}

/** Símbolo de corte: zigue-zague curto que cruza a caminhada na cota de corte (oito dentes), na espessura `widthPx`. */
function cutSymbol(c: StairCut, zoom: number, color: string, widthPx: number): StrokeOp {
  const teeth = 8;
  const amp = 4 / zoom;
  const pts: Vec2[] = [];
  for (let j = 0; j <= teeth; j++) {
    const s = -c.half + (2 * c.half * j) / teeth;
    pts.push(add(add(c.at, mul(c.across, s)), mul(c.walk, j % 2 === 0 ? -amp : amp)));
  }
  return { pts, closed: false, widthPx, color, alpha: 1 };
}

/**
 * Caminhada da seta de subida, do primeiro ao último espelho, por lance: a caminhada explícita do lance (quando tem)
 * ou os pontos médios dos espelhos em ordem de subida. Um lance só tem espelhos resolvidos quando o croqui é válido
 * (o motor valida a caminhada), então a explícita usada aqui já foi aceita. Lances sem espelho resolvido não entram.
 */
export function climbWalk(p: Project, s: ResolvedStair, risers: ResolvedStairRiser[]): Vec2[] {
  const model = p.elements[s.id];
  const components = isStair(model) ? model.components : [];
  const byComponent = new Map<number, ResolvedStairRiser[]>();
  for (const r of risers) byComponent.set(r.componentIndex, [...(byComponent.get(r.componentIndex) ?? []), r]);
  const out: Vec2[] = [];
  for (const [ci, rs] of [...byComponent].sort((x, y) => x[0] - y[0])) {
    const c = components[ci];
    const explicit = c?.kind === 'run' && c.path.length > 0 ? sampleChain(c.path) : [];
    const walk = explicit.length >= 2 ? explicit : rs.map((r) => polyMid(riserPoints(r)));
    out.push(...walk);
  }
  return out;
}

/** Seta de subida: a caminhada (explícita ou pelos pontos médios) com ponta de 7 px no último espelho, na espessura `widthPx`. */
function climbArrow(pts: Vec2[], zoom: number, color: string, widthPx: number): StrokeOp[] {
  if (pts.length < 2) return [];
  const tip = pts[pts.length - 1]!;
  const back = mul(norm(sub(tip, pts[pts.length - 2]!)), -1);
  const head = 7 / zoom;
  const wing = (a: number): Vec2 => add(tip, mul(rotate(back, a), head));
  const style = { widthPx, color, alpha: 0.9 };
  return [
    { pts, closed: false, ...style },
    { pts: [wing(Math.PI / 6), tip, wing(-Math.PI / 6)], closed: false, ...style },
  ];
}

/** Contorno de um degrau ou patamar (linha fina, `widthPx`): tracejado quando o topo fica acima da cota de corte. */
function outlineOps(polygon: Vec2[], z: number, color: string, cutZ: number, widthPx: number): StrokeOp {
  const above = z > cutZ + 1e-9;
  return { pts: polygon, closed: true, widthPx, color, alpha: 1, ...(above ? { dash: STAIR_DASH } : {}) };
}

/** Desloca a etiqueta para um lado da seta (perpendicular ao primeiro trecho), para não cruzar a linha. */
const beside = (u: Vec2, px: number): { dx: number; dy: number } => ({ dx: -px * u.y, dy: -px * u.x });

/** Lados do círculo do poste de caracol (decisão 0014 §1 item 9): entre 24 e 48. Planta e DXF usam o mesmo. */
export const SPIRAL_POST_SIDES = 48;
/** Fração do vão radial (de `rInner` a `rOuter`) em que o rótulo de uma volta de cima se põe quando coincide com a de baixo. */
const SPIRAL_LABEL_FRACTION = 0.3;
const EPS = 1e-9;
/** Área (m²) abaixo da qual uma sobreposição é um traço, não uma região (ruído do recorte). */
const SLIVER = 1e-7;

/** Anel do poste de caracol: círculo de raio `r` em `c`, com `SPIRAL_POST_SIDES` vértices. */
export function spiralPostRing(c: Vec2, r: number): Vec2[] {
  return Array.from({ length: SPIRAL_POST_SIDES }, (_, i) => {
    const t = (2 * Math.PI * i) / SPIRAL_POST_SIDES;
    return { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) };
  });
}

/**
 * Parâmetros do caracol de cada lance da escada, pelo índice do componente (`StairRun.spiral`). Vazio para escada sem
 * caracol. Lê o modelo, não o croqui: o croqui resolvido não guarda o metadado.
 */
export function spiralByComponent(p: Project, s: ResolvedStair): Map<number, SpiralParams> {
  const out = new Map<number, SpiralParams>();
  const model = p.elements[s.id];
  if (!isStair(model)) return out;
  model.components.forEach((c, i) => {
    const sp = c.kind === 'run' ? spiralParamsOf(c) : undefined;
    if (sp) out.set(i, sp);
  });
  return out;
}

/** Degraus e patamares de baixo (cota ≤ corte), em planta: o que a volta de cima não pode cobrir (memo por escada e corte). */
const coverMemo = new WeakMap<ResolvedStair, { cutZ: number; cover: MultiPolygon }>();
function lowerCover(s: ResolvedStair, cutZ: number): MultiPolygon {
  const hit = coverMemo.get(s);
  if (hit && hit.cutZ === cutZ) return hit.cover;
  const lower: MultiPolygon[] = s.steps.filter((st) => st.z <= cutZ + EPS).map((st) => [[st.polygon]]);
  const cover = lower.length > 0 ? union(...lower) : [];
  coverMemo.set(s, { cutZ, cover });
  return cover;
}

/**
 * Preenchimento de um degrau acima do corte. Fora da área de baixo, é o degrau inteiro. Sobre a volta de baixo, sai só o
 * que sobra (ou nada, se ela cobre tudo): a volta de cima não pinta por cima da de baixo. Null = sem preenchimento.
 */
function aboveFill(ring: Ring, cover: MultiPolygon): MultiPolygon | null {
  if (cover.length === 0) return [[ring]];
  if (multiArea(intersection([[ring]], cover)) <= SLIVER) return [[ring]];
  const rest = difference([[ring]], cover);
  return multiArea(rest) > SLIVER ? rest : null;
}

/**
 * Ponto do rótulo de um degrau. Num caracol, um degrau cujo centro cai sobre um degrau de cota mais baixa (voltas
 * sobrepostas em planta) põe o rótulo dentro do próprio setor, mais perto da borda interna, para não coincidir com o de
 * baixo. Fora disso, é o centro do degrau (`labelPoint`), como nos demais lances.
 */
function treadLabelAt(st: ResolvedStairStep, steps: ResolvedStairStep[], spirals: ReadonlyMap<number, SpiralParams>): Vec2 | null {
  const at = labelPoint([[st.polygon]]);
  const sp = spirals.get(st.componentIndex);
  if (!at || !sp) return at;
  const covered = steps.some((o) => o !== st && o.z < st.z - EPS && pointInMulti(at, [[o.polygon]]));
  if (!covered) return at;
  const ang = Math.atan2(at.y - sp.center.y, at.x - sp.center.x);
  const rho = sp.rInner + SPIRAL_LABEL_FRACTION * (sp.rOuter - sp.rInner);
  return { x: sp.center.x + rho * Math.cos(ang), y: sp.center.y + rho * Math.sin(ang) };
}

/**
 * Poste de cada caracol da escada (decisão 0014 §1 item 9): círculo de raio `rInner` com contorno. Só o estilo `post` tem
 * preenchimento (material do poste); o monolítico e o demais mostram só o contorno. Acima da cota de corte (base do lance),
 * tracejado e sem preenchimento, como os degraus.
 */
function postOps(p: Project, s: ResolvedStair, spirals: ReadonlyMap<number, SpiralParams>, cutZ: number, fillBase: string, dark: boolean, lineColor: string, paint: PlanPaint): FloorOps {
  const out = empty();
  const above = s.baseZ > cutZ + EPS;
  const pm = p.materials[s.type.postMaterialId];
  const color = surfaceColor(pm?.color ?? '#999999', fillBase, dark ? 0.42 : 0.74, paint);
  for (const sp of spirals.values()) {
    const ring = spiralPostRing(sp.center, sp.rInner);
    if (!above && s.type.runStyle === 'post') out.fills.push({ polygons: [[ring]], color, alpha: 1 });
    out.strokes.push(outlineOps(ring, s.baseZ, lineColor, cutZ, paint.projPx));
  }
  return out;
}

/**
 * Escadas do nível na planta (decisão 0011 §1). Preenchimento dos degraus e patamares com a cor do material do tipo
 * (mesma regra dos pisos); contorno de cada degrau (tracejado acima da cota de corte); linha de cada espelho; símbolo
 * de corte e seta de subida "SOBE" pela caminhada (explícita, se válida, senão automática). No grosseiro, só o preenchimento do contorno. No fino,
 * número de cada degrau (`treadNumber`: contínuo na escada, o espelho que o degrau alcança). Com etiquetas ligadas, o código do tipo no centroide.
 *
 * Com `view` (intervalo de vista, decisão 0013 §4), a cota de corte é a da vista e o que está acima do topo não sai:
 * degrau ou espelho com topo acima de `view.topZ` é omitido. Sem `view`, vale a cota de 1,20 m de cada escada e não há topo.
 *
 * Caracol (decisão 0014 §1 item 9): as voltas sobrepõem-se em planta. Degrau acima do corte não pinta sobre a volta de
 * baixo (`aboveFill`); o rótulo de cima sai para dentro do setor (`treadLabelAt`) e, acima do corte, em tom claro
 * (`tone: 'soft'`); o poste é um círculo (`postOps`).
 */
export function stairFills(
  p: Project,
  stairs: ResolvedStair[],
  theme: PlanTheme,
  dark: boolean,
  detail: DetailLevel,
  v: Viewport,
  view?: StairView,
  paint: PlanPaint = defaultPaint('stair', v.zoom),
  scale = 100,
): FloorOps {
  const out = empty();
  const fontPx = paperMmToPx(STAIR_TEXT_MM, v.zoom, scale);
  const tagFontPx = paperMmToPx(STAIR_TAG_MM, v.zoom, scale);
  const besidePx = paperMmToPx(STAIR_SOBE_OFFSET_MM, v.zoom, scale);
  const fillBase = dark ? theme.bg : '#ffffff';
  const lineColor = mix(theme.ink, fillBase, 0.35);
  for (const s of stairs) {
    const cutZ = view?.cutZ ?? s.baseZ + STAIR_CUT_HEIGHT;
    const topZ = view?.topZ ?? Infinity;
    if (s.baseZ > topZ + 1e-9) continue;
    const steps = s.steps.filter((st) => st.z <= topZ + 1e-9);
    const m = p.materials[s.type.materialId];
    const color = surfaceColor(m?.color ?? '#999999', fillBase, dark ? 0.42 : 0.74, paint);
    const spirals = spiralByComponent(p, s);
    const post = postOps(p, s, spirals, cutZ, fillBase, dark, lineColor, paint);
    if (detail === 'coarse') {
      if (steps.length === 0 && s.steps.length > 0) continue;
      const footprint = steps.length === s.steps.length ? s.footprint : union(...steps.map((st) => [[st.polygon]]));
      out.fills.push({ polygons: footprint, color, alpha: 1 });
      out.fills.push(...post.fills);
      continue;
    }
    // Só o caracol tem voltas sobrepostas em planta: o recorte pela volta de baixo é feito só nele.
    const cover = spirals.size > 0 ? lowerCover(s, cutZ) : [];
    for (const st of steps) {
      const fill = st.z > cutZ + EPS ? aboveFill(st.polygon, cover) : [[st.polygon]];
      if (fill) out.fills.push({ polygons: fill, color, alpha: 1 });
      out.strokes.push(outlineOps(st.polygon, st.z, lineColor, cutZ, paint.projPx));
    }
    out.fills.push(...post.fills);
    out.strokes.push(...post.strokes);
    const risers = risersInClimbOrder(s).filter((r) => r.z1 <= topZ + 1e-9);
    for (const r of risers) out.strokes.push({ pts: riserPoints(r), closed: false, widthPx: paint.cutPx, color: theme.ink, alpha: 1 });
    const walk = climbWalk(p, s, risers);
    out.strokes.push(...climbArrow(walk, v.zoom, theme.ink, paint.cutPx));
    if (walk.length >= 2) {
      const u = norm(sub(walk[1]!, walk[0]!));
      out.labels.push({ at: walk[0]!, text: 'SOBE', ...beside(u, besidePx), fontPx });
    }
    const cut = stairCut(s, risers, v.zoom, cutZ);
    if (cut) out.strokes.push(cutSymbol(cut, v.zoom, theme.ink, paint.cutPx));
    if (detail === 'fine') {
      // Só os degraus dentro do topo da vista: os de cima não saem, nem o rótulo (decisão 0013 §4).
      for (const st of steps) {
        if (st.kind !== 'tread') continue;
        const at = treadLabelAt(st, steps, spirals);
        if (at) out.labels.push({ at, text: String(treadNumber(s, st)), fontPx, ...(st.z > cutZ + EPS ? { tone: 'soft' as const } : {}) });
      }
    }
    if (p.settings.showTags) {
      const at = labelPoint(s.footprint);
      if (at) out.labels.push({ at, text: s.type.code, fontPx: tagFontPx });
    }
  }
  return out;
}

/** Escadas do nível abaixo, apagadas como os pisos e lajes de referência (D4): só o preenchimento e o contorno. */
export function belowStairOps(stairs: ResolvedStair[], theme: PlanTheme): FloorOps {
  const out = empty();
  for (const s of stairs) {
    out.fills.push({ polygons: s.footprint, color: theme.underlay, alpha: 0.22 });
    for (const st of s.steps) out.strokes.push({ pts: st.polygon, closed: true, widthPx: 1, color: theme.underlay, alpha: 0.7 });
  }
  return out;
}

/** Destaque de seleção e de hover das escadas, no padrão dos pisos e lajes (contorno da pegada). */
export function stairSelectionOps(p: Project, stairs: ResolvedStair[], selection: Id[], hover: Id | null, theme: PlanTheme, v: Viewport): FloorOps {
  const parts = stairs.map((s) => ({ id: s.id, polygon: s.footprint }));
  return outlineSelectionOps(parts, selection, hover, !p.settings.showTags, theme, v);
}
