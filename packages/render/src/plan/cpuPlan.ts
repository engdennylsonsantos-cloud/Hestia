import type { Ring } from '@hestia/geom';
import { worldToScreen, type Viewport } from '../viewport.ts';
import type { FillOp, PlanDrawList } from './types.ts';

const patternCache = new Map<string, CanvasPattern | null>();

function hatchPattern(ctx: CanvasRenderingContext2D, kind: string, color: string): CanvasPattern | null {
  const key = `${kind}|${color}`;
  if (patternCache.has(key)) return patternCache.get(key) ?? null;
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const g = c.getContext('2d');
  if (!g) return null;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 1;
  g.beginPath();
  // `solid` (alumínio, telha metálica): o padrão é só a cor da hachura, cobrindo a célula inteira (decisão 0015 §2.8).
  if (kind === 'solid') g.fillRect(0, 0, 8, 8);
  if (kind === 'diagonal' || kind === 'cross') {
    g.moveTo(0, 8);
    g.lineTo(8, 0);
    g.moveTo(-1, 1);
    g.lineTo(1, -1);
    g.moveTo(7, 9);
    g.lineTo(9, 7);
  }
  if (kind === 'cross') {
    g.moveTo(0, 0);
    g.lineTo(8, 8);
  }
  g.stroke();
  if (kind === 'dots') g.fillRect(3, 3, 1.5, 1.5);
  // `gesso` (forro, D3): tracejado leve, um traço horizontal por célula.
  if (kind === 'gesso') g.fillRect(0, 3, 5, 1);
  const pat = ctx.createPattern(c, 'repeat');
  patternCache.set(key, pat);
  return pat;
}

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

function drawFill(ctx: CanvasRenderingContext2D, f: FillOp, v: Viewport): void {
  ctx.beginPath();
  for (const poly of f.polygons) pathRings(ctx, poly, v);
  ctx.globalAlpha = f.alpha;
  ctx.fillStyle = f.color;
  ctx.fill('evenodd');
  if (f.hatch) {
    const pat = hatchPattern(ctx, f.hatch.kind, f.hatch.color);
    if (pat) {
      ctx.globalAlpha = f.hatch.alpha ?? 1;
      ctx.fillStyle = pat;
      ctx.fill('evenodd');
    }
  }
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
