import type { Ring } from '@hestia/geom';
import { worldToScreen, type Viewport } from '../viewport.ts';
import { DOT_PX, HATCH_PX, hatchSegments } from './hatch.ts';
import type { FillOp, PlanDrawList } from './types.ts';

function pathRings(ctx: CanvasRenderingContext2D, rings: Ring[], v: Viewport): void {
  for (const r of rings) {
    r.forEach((p, i) => {
      const s = worldToScreen(v, p);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
  }
}

/**
 * Hachura vetorial: as mesmas linhas e pontos da GPU, traçados em pixels de tela (sem padrão rasterizado).
 * `solid` é só a cor de preenchimento, então não entra aqui.
 */
function drawHatch(ctx: CanvasRenderingContext2D, f: FillOp, v: Viewport): void {
  const hatch = f.hatch;
  if (!hatch) return;
  const alpha = hatch.alpha ?? 1;
  if (hatch.kind === 'solid') {
    ctx.beginPath();
    for (const poly of f.polygons) pathRings(ctx, poly, v);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = hatch.color;
    ctx.fill('evenodd');
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = hatch.color;
  ctx.lineCap = 'butt';
  for (const kind of ['line', 'dot'] as const) {
    ctx.lineWidth = kind === 'line' ? HATCH_PX : DOT_PX;
    ctx.beginPath();
    for (const poly of f.polygons) {
      for (const s of hatchSegments(poly, hatch.kind)) {
        if ((s.dot === true) !== (kind === 'dot')) continue;
        const a = worldToScreen(v, s.a);
        const b = worldToScreen(v, s.b);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();
  }
}

function drawFill(ctx: CanvasRenderingContext2D, f: FillOp, v: Viewport): void {
  ctx.beginPath();
  for (const poly of f.polygons) pathRings(ctx, poly, v);
  ctx.globalAlpha = f.alpha;
  ctx.fillStyle = f.color;
  ctx.fill('evenodd');
  drawHatch(ctx, f, v);
}

/** Renderizador de planta em CPU (Canvas2D): usado só quando não há GPU disponível. */
export function drawPlanCpu(ctx: CanvasRenderingContext2D, dl: PlanDrawList, v: Viewport, dpr: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = dl.background;
  ctx.fillRect(0, 0, v.width, v.height);
  for (const f of dl.fills) drawFill(ctx, f, v);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const s of dl.strokes) {
    if (s.pts.length < 2) continue;
    ctx.beginPath();
    s.pts.forEach((p, i) => {
      const sp = worldToScreen(v, p);
      if (i === 0) ctx.moveTo(sp.x, sp.y);
      else ctx.lineTo(sp.x, sp.y);
    });
    if (s.closed) ctx.closePath();
    ctx.globalAlpha = s.alpha;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.widthPx;
    ctx.setLineDash(s.dash ?? []);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}
