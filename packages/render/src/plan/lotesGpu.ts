import { triangulate, type Mesh2D, type Polygon, type Vec2 } from '@hestia/geom';
import { DOT_PX, HATCH_PX, hatchSegments } from './hatch.ts';
import { kPapel } from './espessura.ts';
import type { FillOp, StrokeOp } from './types.ts';

/**
 * Atributos por vértice de um lote de traço (linhas e hachura). A espessura e o tracejado saem do shader, então a
 * geometria não depende do zoom. Por vértice: `ext` (ao longo, lado, largura em px), `dir` (direção ux, uy e distância
 * ao início do traço, em metros) e `padrao` (traço e período, em px; período 0 é linha inteira).
 */
export interface TracoGpu {
  ext: number[];
  dir: number[];
  padrao: number[];
}

/**
 * Lote de uma camada da planta na GPU: os vértices (x, y, 0), os índices e a cor e o alfa do material. Lotes com a mesma
 * chave saem juntos numa malha só; a chave é `f|` (preenchimento), `h|` (hachura) ou `s|` (traço), com cor e alfa.
 * Lote de traço tem `traco`; o de preenchimento não.
 */
export interface LoteGpu {
  key: string;
  color: string;
  alpha: number;
  pos: number[];
  idx: number[];
  traco?: TracoGpu;
  /** Traço em mm de papel: o `ext.z` é `kPapel` (ver `espessura.ts`) e o shader aplica o zoom com o piso de 1 px. */
  papel?: true;
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
 * não há lote. A ordem devolvida é a de desenho (o `renderOrder` da malha é a posição no vetor). Não depende do zoom:
 * a espessura dos traços (em pixels de tela) é aplicada no shader.
 */
export function montarLotesCamada(fills: readonly FillOp[], strokes: readonly StrokeOp[]): LoteGpu[] {
  const lotes: LoteGpu[] = [];
  let cur: LoteGpu | null = null;
  const flush = (): void => {
    if (cur && cur.idx.length > 0) lotes.push(cur);
    cur = null;
  };
  const batchFor = (key: string, color: string, alpha: number, tracado: boolean, papel = false): LoteGpu => {
    if (cur && cur.key === key) return cur;
    flush();
    if (!tracado) cur = { key, color, alpha, pos: [], idx: [] };
    else cur = papel ? { key, color, alpha, pos: [], idx: [], traco: { ext: [], dir: [], padrao: [] }, papel: true } : { key, color, alpha, pos: [], idx: [], traco: { ext: [], dir: [], padrao: [] } };
    return cur;
  };
  const fillPolygon = (poly: Polygon, color: string, alpha: number): void => {
    const m = tri(poly);
    if (m.indices.length === 0) return;
    const b = batchFor(`f|${color}|${alpha}`, color, alpha, false);
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
    // Hachura vetorial: linhas de HATCH_PX (pontos de DOT_PX) recortadas ao contorno, em pixels de tela (sem zoom).
    for (const poly of f.polygons) {
      for (const s of hatchSegments(poly, kind)) {
        const b = batchFor(`h|${color}|${alpha}`, color, alpha, true);
        quad(b, s.a, s.b, s.dot ? DOT_PX : HATCH_PX);
      }
    }
  }
  flush();

  for (const s of strokes) {
    const papel = s.papel !== undefined;
    const b = batchFor(papel ? `s|${s.color}|${s.alpha}|p` : `s|${s.color}|${s.alpha}`, s.color, s.alpha, true, papel);
    tracar(b, s);
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

/** Período do tracejado em pixels (traço e período), ou [0, 0] se a linha é inteira. */
export function padraoDoTracejado(dash: [number, number] | undefined): [number, number] {
  if (!dash || dash[0] <= 0 || dash[1] <= 0) return [0, 0];
  return [dash[0], dash[0] + dash[1]];
}

/** Traço de uma polilinha (inteira ou tracejada): cada aresta vira um quad, com a distância acumulada ao início. */
function tracar(b: LoteGpu, s: StrokeOp): void {
  const padrao = padraoDoTracejado(s.dash);
  // Com `papel`, o vértice leva a espessura em unidades de mundo por zoom (o shader põe o zoom e o piso de 1 px).
  const ext = s.papel ? kPapel(s.papel) : s.widthPx;
  let dist = 0;
  for (const [p, q] of edges(s.pts, s.closed)) dist = quad(b, p, q, ext, dist, padrao);
}

/**
 * Trecho de `p` a `q` como quad de quatro vértices (dois triângulos). Os vértices guardam o ponto de extremo, o lado e a
 * largura em pixels; o shader desloca cada um em tela (meia espessura para os lados e a ponta de meia espessura nos
 * extremos). `dist` é a distância ao início do traço até `p`, e `padrao` o tracejado (ver `padraoDoTracejado`).
 * Devolve a distância até `q`. Trecho de comprimento zero não gera vértice.
 */
export function quad(b: LoteGpu, p: Vec2, q: Vec2, widthPx: number, dist = 0, padrao: [number, number] = [0, 0]): number {
  const t = b.traco;
  if (!t) throw new Error('quad: o lote precisa ser de traço');
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-12) return dist;
  const ux = dx / L;
  const uy = dy / L;
  const base = b.pos.length / 3;
  // Ordem dos vértices: (extremo, ao longo, lado), a mesma da geometria antiga em metros.
  const corners: Array<[Vec2, number, number, number]> = [
    [p, -1, 1, dist],
    [p, -1, -1, dist],
    [q, 1, -1, dist + L],
    [q, 1, 1, dist + L],
  ];
  for (const [pt, along, side, d] of corners) {
    b.pos.push(pt.x, pt.y, 0);
    t.ext.push(along, side, widthPx);
    t.dir.push(ux, uy, d);
    t.padrao.push(padrao[0], padrao[1]);
  }
  b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  return dist + L;
}

/**
 * Trechos ligados (traço de `dash`, espaço de `gap`) ao longo das arestas da polilinha, em metros. Referência do tracejado
 * antigo (quads recortados por zoom): o shader faz o mesmo recorte pelo padrão em pixels, sem refazer a geometria.
 */
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
