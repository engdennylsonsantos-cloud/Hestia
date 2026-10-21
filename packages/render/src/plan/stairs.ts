import { add, dist, lerp, mul, norm, perp, rotate, sub, type Vec2 } from '@hestia/geom';
import { sampleChain, type ResolvedStair, type ResolvedStairRiser } from '@hestia/engine';
import { isStair, type DetailLevel, type Id, type Project } from '@hestia/model';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import { labelPoint, outlineSelectionOps, type FloorOps } from './floors.ts';
import { riserPoints, risersInClimbOrder } from '../stairRisers.ts';
import type { PlanTheme, StrokeOp } from './types.ts';

/** Cota de corte da planta, em m acima da base do lance (convenção de planta: 1,20 m). */
export const STAIR_CUT_HEIGHT = 1.2;
/** Espessura (px) das linhas de espelho, do símbolo de corte e da seta. */
export const STAIR_RISER_WIDTH_PX = 1.4;
/** Traço (px) do tracejado dos degraus acima da cota de corte. */
export const STAIR_DASH: [number, number] = [6, 3];

const empty = (): FloorOps => ({ fills: [], strokes: [], labels: [] });

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
 * a cota `baseZ + STAIR_CUT_HEIGHT`. Null quando o lance não chega a essa cota (ou não tem dois espelhos).
 */
export function stairCut(s: ResolvedStair, risers: ResolvedStairRiser[], zoom: number): StairCut | null {
  const cutZ = s.baseZ + STAIR_CUT_HEIGHT;
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

/** Símbolo de corte: zigue-zague curto que cruza a caminhada na cota de corte (oito dentes). */
function cutSymbol(c: StairCut, zoom: number, color: string): StrokeOp {
  const teeth = 8;
  const amp = 4 / zoom;
  const pts: Vec2[] = [];
  for (let j = 0; j <= teeth; j++) {
    const s = -c.half + (2 * c.half * j) / teeth;
    pts.push(add(add(c.at, mul(c.across, s)), mul(c.walk, j % 2 === 0 ? -amp : amp)));
  }
  return { pts, closed: false, widthPx: STAIR_RISER_WIDTH_PX, color, alpha: 1 };
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

/** Seta de subida: a caminhada (explícita ou pelos pontos médios) com ponta de 7 px no último espelho. */
function climbArrow(pts: Vec2[], zoom: number, color: string): StrokeOp[] {
  if (pts.length < 2) return [];
  const tip = pts[pts.length - 1]!;
  const back = mul(norm(sub(tip, pts[pts.length - 2]!)), -1);
  const head = 7 / zoom;
  const wing = (a: number): Vec2 => add(tip, mul(rotate(back, a), head));
  const style = { widthPx: STAIR_RISER_WIDTH_PX, color, alpha: 0.9 };
  return [
    { pts, closed: false, ...style },
    { pts: [wing(Math.PI / 6), tip, wing(-Math.PI / 6)], closed: false, ...style },
  ];
}

/** Contorno de um degrau ou patamar: tracejado quando o topo fica acima da cota de corte. */
function outlineOps(s: ResolvedStair, polygon: Vec2[], z: number, color: string): StrokeOp {
  const above = z > s.baseZ + STAIR_CUT_HEIGHT + 1e-9;
  return { pts: polygon, closed: true, widthPx: 1, color, alpha: 1, ...(above ? { dash: STAIR_DASH } : {}) };
}

/** Desloca a etiqueta 16 px para um lado da seta (perpendicular ao primeiro trecho), para não cruzar a linha. */
const beside = (u: Vec2): { dx: number; dy: number } => ({ dx: -16 * u.y, dy: -16 * u.x });

/**
 * Escadas do nível na planta (decisão 0011 §1). Preenchimento dos degraus e patamares com a cor do material do tipo
 * (mesma regra dos pisos); contorno de cada degrau (tracejado acima da cota de corte); linha de cada espelho; símbolo
 * de corte e seta de subida "SOBE" pela caminhada (explícita, se válida, senão automática). No grosseiro, só o preenchimento do contorno. No fino,
 * número de cada degrau. Com etiquetas ligadas, o código do tipo no centroide.
 */
export function stairFills(p: Project, stairs: ResolvedStair[], theme: PlanTheme, dark: boolean, detail: DetailLevel, v: Viewport): FloorOps {
  const out = empty();
  const fillBase = dark ? theme.bg : '#ffffff';
  const lineColor = mix(theme.ink, fillBase, 0.35);
  for (const s of stairs) {
    const m = p.materials[s.type.materialId];
    const color = mix(m?.color ?? '#999999', fillBase, dark ? 0.42 : 0.74);
    if (detail === 'coarse') {
      out.fills.push({ polygons: s.footprint, color, alpha: 1 });
      continue;
    }
    for (const st of s.steps) {
      out.fills.push({ polygons: [[st.polygon]], color, alpha: 1 });
      out.strokes.push(outlineOps(s, st.polygon, st.z, lineColor));
    }
    const risers = risersInClimbOrder(s);
    for (const r of risers) out.strokes.push({ pts: riserPoints(r), closed: false, widthPx: STAIR_RISER_WIDTH_PX, color: theme.ink, alpha: 1 });
    const walk = climbWalk(p, s, risers);
    out.strokes.push(...climbArrow(walk, v.zoom, theme.ink));
    if (walk.length >= 2) {
      const u = norm(sub(walk[1]!, walk[0]!));
      out.labels.push({ at: walk[0]!, text: 'SOBE', ...beside(u) });
    }
    const cut = stairCut(s, risers, v.zoom);
    if (cut) out.strokes.push(cutSymbol(cut, v.zoom, theme.ink));
    if (detail === 'fine') {
      for (const st of s.steps) {
        if (st.kind !== 'tread') continue;
        const at = labelPoint([[st.polygon]]);
        if (at) out.labels.push({ at, text: String(st.index) });
      }
    }
    if (p.settings.showTags) {
      const at = labelPoint(s.footprint);
      if (at) out.labels.push({ at, text: s.type.code });
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
