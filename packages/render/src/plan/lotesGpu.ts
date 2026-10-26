import { triangulate, type Mesh2D, type Polygon, type Vec2 } from '@hestia/geom';
import { DOT_PX, HATCH_PX, hatchSegments } from './hatch.ts';
import { kPapel } from './espessura.ts';
import { resolverPreenchimento, resolverTraco } from './zoomOps.ts';
import type { FillOp, PesoPapel, StrokeOp } from './types.ts';

/**
 * Atributos por vértice de um lote de traço (linhas e hachura). A espessura e o tracejado saem do shader, então a
 * geometria não depende do zoom. Por vértice: `ext` (ao longo, lado, largura em px, fator), `dir` (direção ux, uy e distância
 * ao início do traço, em metros) e `padrao` (traço e período, em px, e o zoom mínimo; período 0 é linha inteira e zoom
 * mínimo 0 é sempre visível).
 */
export interface TracoGpu {
  ext: number[];
  dir: number[];
  padrao: number[];
}

/**
 * Parâmetro do traço de papel que vale para o lote inteiro (é um uniform do material): o teto de largura em px que o
 * shader aplica depois do piso de 1 px. O fator, que varia de traço a traço (peso dentro de um símbolo), vai por vértice.
 */
export interface PapelLote {
  /** Largura máxima em px; `SEM_TETO` quando o traço não tem teto. */
  teto: number;
}

/** Teto de largura que nunca limita (traço sem teto). */
export const SEM_TETO = 1e9;

/**
 * Lote de uma camada da planta na GPU: os vértices (x, y, 0), os índices e a cor e o alfa do material. Lotes com a mesma
 * chave saem juntos numa malha só; a chave é `f|` (preenchimento), `h|` (hachura) ou `s|` (traço), com cor e alfa.
 * Lote de traço tem `traco`; o de preenchimento não.
 *
 * Lote dinâmico (`fonte`): guarda os itens que dependem do zoom (faixas de contorno e marcadores em pixels, ver
 * `zoomOps.ts`) e é montado de novo quando o zoom muda (`reexpandirLote`); os outros lotes não mudam com o zoom. Fica
 * sempre na lista, mesmo vazio, para a posição (a ordem de desenho) dos demais não mudar.
 */
export interface LoteGpu {
  key: string;
  /** Chave do material, quando difere da do lote (lotes dinâmicos usam o material do lote estático equivalente). */
  material?: string;
  color: string;
  alpha: number;
  pos: number[];
  idx: number[];
  traco?: TracoGpu;
  /** Traço em mm de papel: o `ext.z` é `kPapel` (ver `espessura.ts`) e o shader aplica o zoom com o piso de 1 px. */
  papel?: PapelLote;
  fonte?: { fills: FillOp[]; strokes: StrokeOp[] };
}

/** O item depende do zoom? Faixa de contorno e marcador em pixels, sim; o resto, não. */
const dinamicoFill = (f: FillOp): boolean => (f.faixa !== undefined || f.deslocamentoPx !== undefined) && f.hatch === undefined;
const dinamicoTraco = (s: StrokeOp): boolean => s.deslocamentoPx !== undefined;

/** Parâmetro de papel de um traço: sem teto quando não o declara. */
const papelDe = (p: PesoPapel): PapelLote => ({ teto: p.teto ?? SEM_TETO });
/** Sufixo de chave do traço de papel: igual ao de sempre (`|p`) quando não há teto. */
const sufixoPapel = (p: PapelLote): string => `|p${p.teto !== SEM_TETO ? `t${p.teto}` : ''}`;

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

/** Dá o lote em que entra uma geometria de chave `key` (o corrente, se for a mesma chave). */
type ParaLote = (key: string, color: string, alpha: number, tracado: boolean) => LoteGpu;

/** Acrescenta ao lote o preenchimento `f` (polígonos já resolvidos) e a hachura dele, se houver. */
function acrescentarPreenchimento(para: ParaLote, f: FillOp): void {
  const fillPolygon = (poly: Polygon, color: string, alpha: number): void => {
    const m = tri(poly);
    if (m.indices.length === 0) return;
    const b = para(`f|${color}|${alpha}`, color, alpha, false);
    const base = b.pos.length / 3;
    for (let i = 0; i < m.positions.length; i += 2) b.pos.push(m.positions[i]!, m.positions[i + 1]!, 0);
    for (const k of m.indices) b.idx.push(base + k);
  };
  for (const poly of f.polygons) fillPolygon(poly, f.color, f.alpha);
  if (!f.hatch) return;
  const { kind, color } = f.hatch;
  const alpha = f.hatch.alpha ?? 1;
  const zoomMin = f.hatch.zoomMin ?? 0;
  if (kind === 'solid') {
    for (const poly of f.polygons) fillPolygon(poly, color, alpha);
    return;
  }
  // Hachura vetorial: linhas de HATCH_PX (pontos de DOT_PX) recortadas ao contorno, em pixels de tela (sem zoom).
  for (const poly of f.polygons) {
    for (const s of hatchSegments(poly, kind)) {
      const b = para(`h|${color}|${alpha}`, color, alpha, true);
      quad(b, s.a, s.b, s.dot ? DOT_PX : HATCH_PX, 0, [0, 0], 1, zoomMin);
    }
  }
}

/** Acumulador de lotes: troca de lote só quando muda a chave; lote dinâmico guarda a fonte e fica mesmo vazio. */
class Lotes {
  readonly lista: LoteGpu[] = [];
  private cur: LoteGpu | null = null;
  flush(): void {
    if (this.cur && (this.cur.idx.length > 0 || this.cur.fonte)) this.lista.push(this.cur);
    this.cur = null;
  }

  /** Lote corrente de chave `key`, ou um novo. `papel` só vale para traço. */
  para(key: string, color: string, alpha: number, tracado: boolean, papel?: PapelLote): LoteGpu {
    if (this.cur && this.cur.key === key) return this.cur;
    this.flush();
    const novo: LoteGpu = { key, color, alpha, pos: [], idx: [] };
    if (tracado) novo.traco = { ext: [], dir: [], padrao: [] };
    if (papel) novo.papel = papel;
    this.cur = novo;
    return novo;
  }

  /** Lote dinâmico (um por sequência de itens de mesma chave); a geometria sai de `reexpandirLote`. */
  dinamico(key: string, material: string, color: string, alpha: number, tracado: boolean, papel?: PapelLote): LoteGpu {
    if (this.cur && this.cur.key === key) return this.cur;
    this.flush();
    const novo: LoteGpu = { key, material, color, alpha, pos: [], idx: [], fonte: { fills: [], strokes: [] } };
    if (tracado) novo.traco = { ext: [], dir: [], padrao: [] };
    if (papel) novo.papel = papel;
    this.cur = novo;
    return novo;
  }
}

/**
 * Lotes de uma camada, na ordem em que os itens aparecem: troca de lote só quando muda cor, alfa ou tipo. Sem triângulos
 * não há lote (exceto o dinâmico). A ordem devolvida é a de desenho (o `renderOrder` da malha é a posição no vetor). Os
 * lotes estáticos não dependem do zoom: a espessura dos traços (em pixels de tela) é aplicada no shader. Os itens que
 * dependem dele (faixas e marcadores) vão em lotes dinâmicos, montados aqui no `zoom` dado e refeitos por
 * `reexpandirLote`. Sem `zoom` (a lista já vem resolvida, por `resolverZoom`), não há lote dinâmico.
 */
export function montarLotesCamada(fills: readonly FillOp[], strokes: readonly StrokeOp[], zoom: number | null = null): LoteGpu[] {
  const lotes = new Lotes();
  const para: ParaLote = (key, color, alpha, tracado) => lotes.para(key, color, alpha, tracado);
  const dinamicos: LoteGpu[] = [];
  const dinamicoOuNada = zoom !== null;
  for (const f of fills) {
    if (dinamicoOuNada && dinamicoFill(f)) {
      const b = lotes.dinamico(`fd|${f.color}|${f.alpha}`, `f|${f.color}|${f.alpha}`, f.color, f.alpha, false);
      b.fonte!.fills.push(f);
      if (!dinamicos.includes(b)) dinamicos.push(b);
      continue;
    }
    acrescentarPreenchimento(para, f);
  }
  lotes.flush();

  for (const s of strokes) {
    const papel = s.papel !== undefined ? papelDe(s.papel) : undefined;
    const base = `s|${s.color}|${s.alpha}${papel ? sufixoPapel(papel) : ''}`;
    if (dinamicoOuNada && dinamicoTraco(s)) {
      const b = lotes.dinamico(`sd|${base.slice(2)}`, base, s.color, s.alpha, true, papel);
      b.fonte!.strokes.push(s);
      if (!dinamicos.includes(b)) dinamicos.push(b);
      continue;
    }
    tracar(lotes.para(base, s.color, s.alpha, true, papel), s);
  }
  lotes.flush();
  if (zoom !== null) for (const b of dinamicos) reexpandirLote(b, zoom);
  return lotes.lista;
}

/**
 * Refaz a geometria de um lote dinâmico no `zoom` dado: resolve cada item da fonte (faixa e marcador) e o acrescenta como
 * se fosse estático. A faixa que sai vazia não deixa triângulo; o lote continua na lista.
 */
export function reexpandirLote(lote: LoteGpu, zoom: number): void {
  const fonte = lote.fonte;
  if (!fonte) return;
  lote.pos = [];
  lote.idx = [];
  if (lote.traco) lote.traco = { ext: [], dir: [], padrao: [] };
  for (const f of fonte.fills) {
    const r = resolverPreenchimento(f, zoom);
    if (r) acrescentarPreenchimento(() => lote, r);
  }
  for (const s of fonte.strokes) tracar(lote, resolverTraco(s, zoom));
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
  const fator = s.papel?.fator ?? 1;
  let dist = 0;
  for (const [p, q] of edges(s.pts, s.closed)) dist = quad(b, p, q, ext, dist, padrao, fator, s.zoomMin ?? 0);
}

/**
 * Trecho de `p` a `q` como quad de quatro vértices (dois triângulos). Os vértices guardam o ponto de extremo, o lado e a
 * largura em pixels; o shader desloca cada um em tela (meia espessura para os lados e a ponta de meia espessura nos
 * extremos). `dist` é a distância ao início do traço até `p`, e `padrao` o tracejado (ver `padraoDoTracejado`).
 * Devolve a distância até `q`. Trecho de comprimento zero não gera vértice.
 */
export function quad(b: LoteGpu, p: Vec2, q: Vec2, widthPx: number, dist = 0, padrao: [number, number] = [0, 0], fator = 1, zoomMin = 0): number {
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
    t.ext.push(along, side, widthPx, fator);
    t.dir.push(ux, uy, d);
    t.padrao.push(padrao[0], padrao[1], zoomMin);
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
