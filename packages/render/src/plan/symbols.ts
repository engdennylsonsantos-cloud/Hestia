import type { Vec2 } from '@hestia/geom';
import type { OpeningGeometry } from '@hestia/engine';
import type { PlanTheme, StrokeOp } from './types.ts';

const at = (c: Vec2, u: Vec2, n: Vec2, t: number, s: number): Vec2 => ({
  x: c.x + u.x * t + n.x * s,
  y: c.y + u.y * t + n.y * s,
});

function arc(center: Vec2, from: Vec2, to: Vec2, steps = 18): Vec2[] {
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  let a1 = Math.atan2(to.y - center.y, to.x - center.x);
  let d = a1 - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  a1 = a0 + d;
  const r = Math.hypot(from.x - center.x, from.y - center.y);
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
  }
  return pts;
}

/** Símbolo de planta da abertura: folha + arco (porta) ou três linhas (janela). */
export function openingSymbol(g: OpeningGeometry, theme: PlanTheme, widthPx = 1.2): StrokeOp[] {
  const out: StrokeOp[] = [];
  const line = (pts: Vec2[], closed = false, w = widthPx, alpha = 1): void => {
    out.push({ pts, closed, widthPx: w, color: theme.ink, alpha });
  };
  const hw = g.width / 2;
  const sMid = (g.sHi + g.sLo) / 2;
  if (g.kind === 'window') {
    const rel = (t: number, s: number): Vec2 => at(g.center, g.u, g.n, t, s - sMid);
    line([rel(-hw, g.sHi), rel(hw, g.sHi)]);
    line([rel(-hw, g.sLo), rel(hw, g.sLo)]);
    line([rel(-hw, sMid), rel(hw, sMid)], false, widthPx * 0.8);
    line([rel(-hw, g.sHi), rel(-hw, g.sLo)], false, widthPx * 1.4);
    line([rel(hw, g.sHi), rel(hw, g.sLo)], false, widthPx * 1.4);
    if (g.leaves === 2) line([rel(0, g.sHi), rel(0, g.sLo)], false, widthPx * 0.8);
    return out;
  }
  // Porta: a folha gira para o lado `swing` (+n por padrão); a dobradiça fica no lado `hinge`.
  const swing = g.flipFacing ? -1 : 1;
  const faceS = swing > 0 ? g.sHi : g.sLo;
  const rel = (t: number, s: number): Vec2 => at(g.center, g.u, g.n, t, s - sMid);
  const leafLen = g.leaves === 2 ? hw : g.width;
  const hinges = g.leaves === 2 ? [-1, 1] : [g.flipHand ? 1 : -1];
  for (const h of hinges) {
    const hingePt = rel(h * hw, faceS);
    const open = rel(h * hw, faceS + swing * leafLen);
    const closedPt = g.leaves === 2 ? rel(0, faceS) : rel(-h * hw, faceS);
    line([hingePt, open], false, widthPx * 1.3);
    out.push({ pts: arc(hingePt, open, closedPt), closed: false, widthPx: widthPx * 0.7, color: theme.inkSoft, alpha: 1 });
  }
  return out;
}
