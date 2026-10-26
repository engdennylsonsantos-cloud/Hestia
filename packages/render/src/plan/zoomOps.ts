import { difference, offsetMulti, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { paperMmToPx } from '@hestia/model';
import { larguraEmPx } from './espessura.ts';
import type { FillOp, LabelOp, PlanDrawList, PlanOps, StrokeOp } from './types.ts';

/**
 * Resolução das medidas que dependem do zoom. A geometria do nível não guarda polígono, marcador nem rótulo resolvido com o
 * zoom: guarda a especificação (faixa em papel, deslocamento em pixels, medidas de rótulo em mm de papel). Estas funções a
 * convertem para o zoom corrente, com as mesmas contas de antes, e é por elas que o modo CPU, a plotagem e a conferência
 * obtêm a lista de desenho de um zoom. A cena da GPU aplica as mesmas funções só nos lotes que dependem do zoom.
 */

/** Largura da faixa de contorno, em metros, no zoom dado (espessura corrente da faixa dividida pelo zoom). */
export function larguraDaFaixa(f: Pick<FillOp, 'faixa'>, zoom: number): number {
  return larguraEmPx(f.faixa!, zoom) / zoom;
}

/** Faixa de contorno de uma região: a região menos o recuo dela pela largura da faixa. */
export function faixaDaRegiao(regiao: MultiPolygon, largura: number): MultiPolygon {
  return difference(regiao, offsetMulti(regiao, -largura));
}

/** Pontos deslocados: cada ponto vai a `base + deslocamento / zoom` (metros). */
export function deslocarPontos(pts: readonly Vec2[], desl: readonly Vec2[], zoom: number): Vec2[] {
  return pts.map((p, i) => {
    const d = desl[i]!;
    return { x: p.x + d.x / zoom, y: p.y + d.y / zoom };
  });
}

/** Polígonos deslocados (mesmo formato de `deslocamentoPx`). */
export function deslocarPoligonos(m: MultiPolygon, desl: readonly Vec2[][][], zoom: number): MultiPolygon {
  return m.map((poly, i) => poly.map((ring, j) => deslocarPontos(ring, desl[i]![j]!, zoom)));
}

/**
 * Preenchimento no zoom dado. Faixa de contorno vira a faixa da região (nula quando vazia: nada a desenhar); marcador sai
 * deslocado. O que não depende do zoom volta como veio (mesmo objeto).
 */
export function resolverPreenchimento(f: FillOp, zoom: number): FillOp | null {
  // Hachura com zoom mínimo ainda não visível: o preenchimento sai sem ela (a GPU a esconde com o mesmo critério).
  if (f.hatch?.zoomMin !== undefined) {
    const { hatch, ...semHachura } = f;
    if (zoom < hatch!.zoomMin!) return resolverPreenchimento(semHachura, zoom);
    const { zoomMin, ...hachura } = hatch!;
    void zoomMin;
    return resolverPreenchimento({ ...semHachura, hatch: hachura }, zoom);
  }
  if (!f.faixa && !f.deslocamentoPx) return f;
  const { faixa, deslocamentoPx, ...resto } = f;
  if (faixa) {
    const banda = faixaDaRegiao(f.polygons, larguraDaFaixa(f, zoom));
    return banda.length > 0 ? { ...resto, polygons: banda } : null;
  }
  return { ...resto, polygons: deslocarPoligonos(f.polygons, deslocamentoPx!, zoom) };
}

/** O traço aparece neste zoom? Sem `zoomMin`, sempre; com ele, a partir dele (como o shader decide). */
export const tracoVisivel = (s: Pick<StrokeOp, 'zoomMin'>, zoom: number): boolean => s.zoomMin === undefined || zoom >= s.zoomMin;

/** Traço no zoom dado: marcador deslocado em pixels; o resto volta como veio (a espessura de papel o desenho aplica). */
export function resolverTraco(s: StrokeOp, zoom: number): StrokeOp {
  if (!s.deslocamentoPx) return s;
  const { deslocamentoPx, ...resto } = s;
  return { ...resto, pts: deslocarPontos(s.pts, deslocamentoPx, zoom) };
}

/** Rótulo no zoom dado: corpo da fonte e deslocamento saem do papel (mm × zoom × escala, piso de 1 px). */
export function resolverRotulo(l: LabelOp, zoom: number): LabelOp {
  const pp = l.papel;
  if (!pp) return l;
  const { papel, ...resto } = l;
  void papel;
  const out: LabelOp = resto;
  if (pp.fontMm !== undefined) out.fontPx = paperMmToPx(pp.fontMm, zoom, pp.escala);
  if (pp.widthMm !== undefined) out.widthPx = paperMmToPx(pp.widthMm, zoom, pp.escala);
  if (pp.desvio) {
    const px = paperMmToPx(pp.desvio.mm, zoom, pp.escala);
    if (pp.desvio.ux !== undefined) out.dx = pp.desvio.ux * px;
    if (pp.desvio.uy !== undefined) out.dy = pp.desvio.uy * px;
  }
  return out;
}

/** Rótulos no zoom dado; a lista é a mesma (referência) quando nenhum rótulo depende do zoom. */
export function resolverRotulos(labels: readonly LabelOp[], zoom: number): LabelOp[] {
  let mudou = false;
  const out = labels.map((l) => {
    const r = resolverRotulo(l, zoom);
    if (r !== l) mudou = true;
    return r;
  });
  return mudou ? out : (labels as LabelOp[]);
}

/** Camada no zoom dado: faixas, marcadores e rótulos convertidos. A ordem dos itens é a mesma. */
export function resolverZoom(ops: PlanOps, zoom: number): PlanOps {
  const fills: FillOp[] = [];
  for (const f of ops.fills) {
    const r = resolverPreenchimento(f, zoom);
    if (r) fills.push(r);
  }
  const strokes: StrokeOp[] = [];
  for (const s of ops.strokes) if (tracoVisivel(s, zoom)) strokes.push(resolverTraco(s, zoom));
  return { fills, strokes, labels: resolverRotulos(ops.labels, zoom) };
}

/** Lista de desenho no zoom dado (a do modo CPU e da plotagem): as camadas já resolvidas, o fundo e a ordem de sempre. */
export function resolverLista(dl: PlanDrawList, zoom: number): PlanDrawList {
  const r = resolverZoom(dl, zoom);
  return { background: dl.background, fills: r.fills, strokes: r.strokes, labels: r.labels };
}
