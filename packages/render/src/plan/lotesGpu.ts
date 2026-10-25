import { triangulate, type Mesh2D, type Polygon, type Vec2 } from '@hestia/geom';
import type { Viewport } from '../viewport.ts';
import { DOT_PX, HATCH_PX, hatchSegments } from './hatch.ts';
import type { FillOp, StrokeOp } from './types.ts';

/**
 * Lote de uma camada da planta na GPU: os vértices (x, y, 0), os índices e a cor e o alfa do material. Lotes com a mesma
 * chave saem juntos numa malha só; a chave é `f|` (preenchimento), `h|` (hachura) ou `s|` (traço), com cor e alfa.
 */
export interface LoteGpu {
  key: string;
  color: string;
  alpha: number;
  pos: number[];
  idx: number[];
}

const triCache = new WeakMap<Polygon, Mesh2D>();
/** Triangulação do polígono, guardada por identidade: a mesma geometria não se triangula duas vezes. */
function tri(p: Polygon): Mesh2D {
  let m = triCache.get(p);
  if (!m) {
    m = triangulate(p);
    triCache.set(p, m);
  }
  return m;
}

/**
 * Lotes de uma camada, na ordem em que os itens aparecem: troca de lote só quando muda cor, alfa ou tipo. Sem triângulos
 * não há lote. A ordem devolvida é a de desenho (o `renderOrder` da malha é a posição no vetor).
 */
export function montarLotesCamada(fills: readonly FillOp[], strokes: readonly StrokeOp[], v: Viewport): LoteGpu[] {
  const lotes: LoteGpu[] = [];
  let cur: LoteGpu | null = null;
  const flush = (): void => {
    if (cur && cur.idx.length > 0) lotes.push(cur);
    cur = null;
  };
  const batchFor = (key: string, color: string, alpha: number): LoteGpu => {
    if (cur && cur.key === key) return cur;
    flush();
    cur = { key, color, alpha, pos: [], idx: [] };
    return cur;
  };
  const fillPolygon = (poly: Polygon, color: string, alpha: number): void => {
    const m = tri(poly);
    if (m.indices.length === 0) return;
    const b = batchFor(`f|${color}|${alpha}`, color, alpha);
    const base = b.pos.length / 3;
    for (let i = 0; i < m.positions.length; i += 2) b.pos.push(m.positions[i]!, m.positions[i + 1]!, 0);
    for (const k of m.indices) b.idx.push(base + k);
  };
  for (const f of fills) {
    for (const poly of f.polygons) fillPolygon(poly, f.color, f.alpha);
    if (!f.hatch) continue;
    const { kind, color } = f.hatch;
    const alpha = f.hatch.alpha ?? 1;
    if (kind === 'solid') {
      for (const poly of f.polygons) fillPolygon(poly, color, alpha);
      continue;
    }
    // Hachura vetorial: linhas de HATCH_PX (pontos de DOT_PX) recortadas ao contorno, com a mesma espessura em qualquer zoom.
    for (const poly of f.polygons) {
      for (const s of hatchSegments(poly, kind)) {
        const b = batchFor(`h|${color}|${alpha}`, color, alpha);
        quad(b, s.a, s.b, (s.dot ? DOT_PX : HATCH_PX) / v.zoom);
      }
    }
  }
  flush();

  for (const s of strokes) {
    const b = batchFor(`s|${s.color}|${s.alpha}`, s.color, s.alpha);
    const w = s.widthPx / v.zoom;
    const segs = s.dash ? dashSegments(s.pts, s.closed, s.dash[0] / v.zoom, s.dash[1] / v.zoom) : edges(s.pts, s.closed);
    for (const [p, q] of segs) quad(b, p, q, w);
  }
  flush();
  return lotes;
}

/** Arestas consecutivas de uma polilinha (fechada: mais a aresta de volta, se houver pontos suficientes). */
export function edges(pts: Vec2[], closed: boolean): Array<[Vec2, Vec2]> {
  const out: Array<[Vec2, Vec2]> = [];
  for (let i = 0; i < pts.length - 1; i++) out.push([pts[i]!, pts[i + 1]!]);
  if (closed && pts.length > 2) out.push([pts[pts.length - 1]!, pts[0]!]);
  return out;
}

/** Trechos ligados (traço de `dash`, espaço de `gap`) ao longo das arestas da polilinha. */
export function dashSegments(pts: Vec2[], closed: boolean, dash: number, gap: number): Array<[Vec2, Vec2]> {
  const out: Array<[Vec2, Vec2]> = [];
  let on = true;
  let left = dash;
  for (const [a, b] of edges(pts, closed)) {
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 1e-12) continue;
    const ux = (b.x - a.x) / L;
    const uy = (b.y - a.y) / L;
    let t = 0;
    while (t < L) {
      const step = Math.min(left, L - t);
      if (on) out.push([{ x: a.x + ux * t, y: a.y + uy * t }, { x: a.x + ux * (t + step), y: a.y + uy * (t + step) }]);
      t += step;
      left -= step;
      if (left <= 1e-12) {
        on = !on;
        left = on ? dash : gap;
      }
    }
  }
  return out;
}

/**
 * Traço de espessura `w` (metros) de `p` a `q`, com ponta de meia espessura em cada extremo. Vale para linhas inteiras,
 * tracejados e hachura: a ponta evita a falha de cobertura nos cantos de contornos tracejados.
 */
export function quad(b: LoteGpu, p: Vec2, q: Vec2, w: number): void {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-12) return;
  const ux = dx / L;
  const uy = dy / L;
  const h = w / 2;
  const nx = -uy * h;
  const ny = ux * h;
  const ax = p.x - ux * h;
  const ay = p.y - uy * h;
  const bx = q.x + ux * h;
  const by = q.y + uy * h;
  const base = b.pos.length / 3;
  b.pos.push(ax + nx, ay + ny, 0, ax - nx, ay - ny, 0, bx - nx, by - ny, 0, bx + nx, by + ny, 0);
  b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
