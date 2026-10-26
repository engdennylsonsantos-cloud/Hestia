import { dist, SLOPE_GAP_PX, SLOPE_HALF_PX, type SketchDraft, type SketchLoop, type SketchSeg, type Vec2 } from '@hestia/geom';
import { worldToScreen, type Viewport } from '../viewport.ts';
import { fmtPercent } from './roofs.ts';
import { poligonoEm, tracoEm } from './marcadores.ts';
import { edgeFrame, outwardNormal } from './sketchGeom.ts';
import type { FillOp, LabelOp, PlanTheme, StrokeOp } from './types.ts';

/**
 * Triângulo de inclinação por aresta efetiva do laço externo (só telhado). É um marcador em pixels de tela: os catetos
 * ficam sempre nos eixos da tela, afastado `SLOPE_GAP_PX` da aresta para fora do laço. Cheio quando a aresta define
 * inclinação; vazado quando não. O texto da inclinação sai ao lado, só nas arestas que definem.
 */

/** Vértices do triângulo em eixos de tela (y para baixo): ângulo reto em (-9, +9). */
const TRI_SCREEN: Vec2[] = [
  { x: -SLOPE_HALF_PX, y: -SLOPE_HALF_PX },
  { x: -SLOPE_HALF_PX, y: SLOPE_HALF_PX },
  { x: SLOPE_HALF_PX, y: SLOPE_HALF_PX },
];

/** Folga entre o centro do triângulo e o texto da inclinação, em pixels. */
const LABEL_GAP_PX = 14;

/** Uma aresta do laço externo com o seu triângulo. */
export interface SlopeMark {
  seg: SketchSeg;
  /** Meio da aresta, em metros: âncora do triângulo. */
  at: Vec2;
  /** Normal unitária para fora do laço, em eixos do mundo. */
  n: Vec2;
  /** Efetivo: a aresta própria ou, na falta, o padrão do rascunho. */
  defines: boolean;
  pct: number;
}

/** Triângulos de todas as arestas do laço externo. Os valores efetivos vêm do rascunho pelo id da aresta. */
export function slopeMarks(draft: SketchDraft, loop: SketchLoop): SlopeMark[] {
  const byId = new Map(draft.segs.map((s) => [s.id, s]));
  const out: SlopeMark[] = [];
  for (const loopSeg of loop.segs) {
    const seg = byId.get(loopSeg.id) ?? loopSeg;
    if (dist(seg.a, seg.b) < 1e-9) continue;
    const { at, t } = edgeFrame(seg);
    out.push({
      seg,
      at,
      n: outwardNormal(at, t, loop.ring),
      defines: seg.definesSlope ?? draft.defaults.definesSlope,
      pct: seg.slopePct ?? draft.defaults.slopePct,
    });
  }
  return out;
}

/** Centro do triângulo em pixels de tela: a âncora deslocada `SLOPE_GAP_PX` para fora (y da tela desce). */
export function triangleCenterPx(m: SlopeMark, view: Viewport): Vec2 {
  const s = worldToScreen(view, m.at);
  return { x: s.x + m.n.x * SLOPE_GAP_PX, y: s.y - m.n.y * SLOPE_GAP_PX };
}

/** Vértices do triângulo em pixels nos eixos do mundo (y para cima, como `deslocamentoPx`), já afastados para fora. */
export function slopeOffsets(n: Vec2): Vec2[] {
  return TRI_SCREEN.map((p) => ({ x: p.x + n.x * SLOPE_GAP_PX, y: -p.y + n.y * SLOPE_GAP_PX }));
}

/** Alinhamento do texto: do lado de fora do triângulo, para o texto não entrar nele. */
const alignOf = (n: Vec2): 'left' | 'center' | 'right' => (n.x > 0.5 ? 'left' : n.x < -0.5 ? 'right' : 'center');

export interface SlopeOps {
  fills: FillOp[];
  strokes: StrokeOp[];
  labels: LabelOp[];
}

/** Preenchimento ou contorno de cada triângulo, e o texto da inclinação nas arestas que a definem. */
export function slopeOps(marks: SlopeMark[], theme: PlanTheme): SlopeOps {
  const out: SlopeOps = { fills: [], strokes: [], labels: [] };
  for (const m of marks) {
    const offs = slopeOffsets(m.n);
    if (m.defines) {
      out.fills.push({ ...poligonoEm(m.at, offs), color: theme.roofFootprint, alpha: 1 });
      const beside = SLOPE_GAP_PX + LABEL_GAP_PX;
      out.labels.push({ at: m.at, text: fmtPercent(m.pct), dx: m.n.x * beside, dy: -m.n.y * beside, align: alignOf(m.n) });
    } else {
      out.strokes.push({ ...tracoEm(m.at, offs, true), widthPx: 1.5, color: theme.roofFootprint, alpha: 1 });
    }
  }
  return out;
}
