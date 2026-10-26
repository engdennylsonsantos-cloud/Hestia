import { add, closestOnSegment, dist, mid, multiArea, norm, perp, pointInMulti, ringArea, sub, union, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { planeZ, type ResolvedRoof, type ResolvedRoofLayer } from '@hestia/engine';
import { boundaryKindsOf, edgeSlopesOf } from '@hestia/engine/src/roofShapes.ts';
import { isRoof, type DetailLevel, type Id, type Project, type Roof } from '@hestia/model';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import { fmtArea, labelPoint, outlineSelectionOps, SURFACE_TEXT_MM, type FloorOps } from './floors.ts';
import { zoomAtinge } from './limiares.ts';
import { poligonoEm, tracoEm } from './marcadores.ts';
import { slopeArrow } from './slabs.ts';
import { telhadosDoNivel } from './resolucao.ts';
import { defaultPaint, surfaceColor, type PlanPaint } from './style.ts';
import { arcoDoTelhado, ladosComSimbolo } from './roofsArco.ts';
import { espessurasDoTelhado } from './roofsTracos.ts';
import type { Espessura, PapelRotulo, PlanTheme, StrokeOp } from './types.ts';

const empty = (): FloorOps => ({ fills: [], strokes: [], labels: [] });

/** Luz de noroeste na planta (y para cima = norte): a água voltada para ela fica um tom mais clara. */
const LIGHT_NW: Vec2 = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };

/** Afastamento (m) para testar de que lado de uma divisa está cada água. */
const SIDE = 1e-5;

const scale = (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k });

/** Contorno do telhado em planta: união das águas (as divisas internas somem). */
export const roofFootprint = (r: ResolvedRoof): MultiPolygon => union(...r.planes.map((pl) => pl.polygon));

/** Área real de todas as águas (m²): a área em planta de cada água vezes √(1 + i²), com i = percent/100. */
export const roofRealArea = (r: ResolvedRoof): number => r.planes.reduce((s, pl) => s + multiArea(pl.polygon) * Math.sqrt(1 + (pl.percent / 100) ** 2), 0);

/** Percentual com vírgula decimal, como nas demais cotas da planta: "30 %", "27,5 %". */
export const fmtPercent = (p: number): string => `${String(Math.round(p * 10) / 10).replace('.', ',')} %`;

/** Cota absoluta com vírgula decimal, com sinal: "+5,70" (cota da cumeeira, D6). */
export const fmtElevation = (z: number): string => `+${z.toFixed(2).replace('.', ',')}`;

/** Tom da água: voltada para a luz de noroeste fica 6 % mais clara; a outra, 6 % mais escura (dá volume ao plano). */
export function waterTone(color: string, up: Vec2): string {
  const facing = -up.x * LIGHT_NW.x - up.y * LIGHT_NW.y;
  return facing >= 0 ? mix(color, '#ffffff', 0.06) : mix(color, '#000000', 0.06);
}

/** Camada de topo: a de menor `below`, a que se vê de cima. */
function topLayer(r: ResolvedRoof): ResolvedRoofLayer | undefined {
  return r.layers.reduce<ResolvedRoofLayer | undefined>((best, l) => (!best || l.below < best.below ? l : best), undefined);
}

/**
 * Desloca a etiqueta `mm` de papel para o lado da seta (perpendicular a ela, y da tela cresce para baixo), para não
 * cruzar a haste. A conversão em pixels, com o zoom e a escala, é feita no quadro (`resolverRotulo`).
 */
const beside = (u: Vec2, mm: number, escala: number): PapelRotulo => ({ escala, desvio: { mm, ux: -u.y, uy: -u.x } });

/** Deslocamento em pixels de tela de um vetor do mundo (y da tela cresce para baixo). */
const screenOffset = (w: Vec2, px: number): { dx: number; dy: number } => ({ dx: w.x * px, dy: -w.y * px });

/** Cota absoluta de uma divisa entre águas (cumeeira, espigão ou rincão) no ponto médio: a maior das águas que a encostam; null se nenhuma. */
export function ridgeElevation(r: ResolvedRoof, a: Vec2, b: Vec2): number | null {
  const m = mid(a, b);
  const n = perp(norm(sub(b, a)));
  const zs: number[] = [];
  for (const pl of r.planes) {
    if (pointInMulti(add(m, scale(n, SIDE)), pl.polygon) || pointInMulti(sub(m, scale(n, SIDE)), pl.polygon)) zs.push(planeZ(pl, m));
  }
  return zs.length ? Math.max(...zs) : null;
}

/** Cumeeira mais alta do telhado: ponto médio da linha 'ridge' de maior cota absoluta; null sem cumeeira. */
export function highestRidge(r: ResolvedRoof): { at: Vec2; z: number } | null {
  let best: { at: Vec2; z: number } | null = null;
  for (const ln of r.lines) {
    if (ln.kind !== 'ridge') continue;
    const z = ridgeElevation(r, ln.a, ln.b);
    if (z !== null && (!best || z > best.z)) best = { at: mid(ln.a, ln.b), z };
  }
  return best;
}

/** Aresta sem inclinação (empena, kind 'gable'): tracejado longo com um traço perpendicular (6 px de cada lado, marcador em pixels) no meio, na espessura de corte. */
function gableLineOps(a: Vec2, b: Vec2, theme: PlanTheme, espessura: Espessura): StrokeOp[] {
  const m = mid(a, b);
  const n = perp(norm(sub(b, a)));
  const half = 6;
  return [
    { pts: [a, b], closed: false, ...espessura, color: theme.ink, alpha: 1, dash: [12, 5] },
    { ...tracoEm(m, [scale(n, -half), scale(n, half)], false), ...espessura, color: theme.ink, alpha: 1 },
  ];
}

/**
 * Símbolo "define inclinação" de cada aresta do contorno (A11, como no Revit): triângulo no meio da aresta, apontando
 * para dentro. Cheio na cor de destaque quando a aresta define inclinação (com o percentual ao lado, para fora);
 * vazado e cinza quando não define. `espessura`: a da projeção do telhado (linha fina de anotação). O triângulo é um
 * marcador em pixels (4,5 px de meia base, 8 px de altura): tem o mesmo tamanho na tela para qualquer zoom. O percentual
 * vem de `edgeSlopesOf`, a mesma leitura do motor (forma e direção), e não da lista guardada: só vale o positivo.
 */
function defineSlopeOps(r: Roof, theme: PlanTheme, espessura: Espessura): FloorOps {
  const out = empty();
  const b = r.boundary;
  const ccw = ringArea(b) > 0;
  const slopes = edgeSlopesOf(r);
  const visivel = ladosComSimbolo(r);
  const w = 4.5;
  const h = 8;
  b.forEach((a, i) => {
    const c = b[(i + 1) % b.length]!;
    if (dist(a, c) < 1e-6 || !visivel[i]) return;
    const t = norm(sub(c, a));
    const left = perp(t);
    const inward = ccw ? left : scale(left, -1);
    const m = mid(a, c);
    const tri: Vec2[] = [scale(t, -w), scale(t, w), scale(inward, h)];
    const slope = slopes[i] ?? null;
    if (slope === null || slope <= 0) {
      out.strokes.push({ ...tracoEm(m, tri, true), ...espessura, color: theme.inkSoft, alpha: 1 });
      return;
    }
    out.fills.push({ ...poligonoEm(m, tri), color: theme.accent, alpha: 1 });
    out.labels.push({ at: m, text: fmtPercent(slope), ...screenOffset(scale(inward, -1), 14) });
  });
  return out;
}

/**
 * Contorno de um telhado selecionado: traço sólido de 2 px nas arestas que definem inclinação e tracejado nas empenas
 * (arestas sem inclinação). Os segmentos do anel são agrupados em corridas contínuas do mesmo tipo.
 */
function selectedRingOps(r: ResolvedRoof, roof: Roof, theme: PlanTheme): StrokeOp[] {
  // Empenas pelo tipo de cada aresta no motor (`boundaryKindsOf`), o mesmo critério das linhas de empena da planta.
  const kinds = boundaryKindsOf(roof);
  const gables: Array<[Vec2, Vec2]> = roof.boundary.flatMap((a, i): Array<[Vec2, Vec2]> => {
    const c = roof.boundary[(i + 1) % roof.boundary.length]!;
    return kinds[i] === 'gable' ? [[a, c]] : [];
  });
  const onGable = (p: Vec2, q: Vec2): boolean => {
    const m = mid(p, q);
    return gables.some(([a, c]) => dist(closestOnSegment(m, a, c), m) < 1e-6);
  };
  const out: StrokeOp[] = [];
  for (const ring of roofFootprint(r).flat()) {
    const n = ring.length;
    const gap = ring.map((p, i) => onGable(p, ring[(i + 1) % n]!));
    const s0 = gap.indexOf(true);
    if (s0 < 0) {
      out.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
      continue;
    }
    // Começa numa empena: as corridas seguintes não se partem no fim do anel.
    let k = 0;
    while (k < n) {
      const dashed = gap[(s0 + k) % n]!;
      const pts: Vec2[] = [ring[(s0 + k) % n]!];
      let j = k;
      while (j < n && gap[(s0 + j) % n] === dashed) {
        pts.push(ring[(s0 + j + 1) % n]!);
        j++;
      }
      out.push({ pts, closed: false, widthPx: 2, color: theme.select, alpha: 1, ...(dashed ? { dash: [10, 5] as [number, number] } : {}) });
      k = j;
    }
  }
  return out;
}

/** Telhado com pegada gravada e algum balanço positivo: só ele tem pegada a mostrar (rosa). */
const temBalanco = (roof: Roof): boolean => !!roof.footprint && roof.edgeOverhangs.some((o) => o > 0);

/**
 * Pegada tracejada de um telhado com balanço (rosa, espessura de projeção): o contorno desenhado pelo usuário, sem o
 * beiral. Sem balanço, o beiral já é a pegada e não há o que mostrar.
 */
function pegadaOps(roof: Roof, theme: PlanTheme, espessura: Espessura): StrokeOp[] {
  if (!temBalanco(roof)) return [];
  return [{ pts: roof.footprint!, closed: true, ...espessura, color: theme.roofFootprint, alpha: 1, dash: [6, 3] }];
}

/** Opções de desenho dos telhados (D6). */
export interface RoofOpsOptions {
  /**
   * Planta de cobertura: água opaca (alpha 1) e cota absoluta da cumeeira sempre visível, mesmo sem etiquetas ligadas.
   * A PlanInput liga por `roofPlanMode`.
   */
  planMode?: boolean;
  /** Telhados fora do intervalo de vista (decisão 0013): não têm águas desenhadas. */
  hidden?: ReadonlySet<Id>;
  /** Contorno tracejado dos telhados `hidden` (projeção da cobertura, opção independente do topo). */
  showProjection?: boolean;
  /** Telhados ocultos pela categoria da vista (decisão 0015 §2.4): saem também da projeção, que é só do intervalo. */
  categoryHidden?: ReadonlySet<Id>;
  /** Estilo da categoria telhado nesta vista (cores, pesos, transparência, meio-tom); padrão do Hestia se ausente. */
  paint?: PlanPaint;
}

/**
 * Telhados sobre a lista de águas (D1). Cada água tem a cor da camada de topo misturada com o papel (0,5 claro, 0,3
 * escuro) e um tom por orientação; o telhado é semitransparente (0,55; 0,8 no grosseiro) para ver as paredes por
 * baixo, e opaco na planta de cobertura. Fora do grosseiro: hachura em médio/fino com zoom suficiente, contorno do
 * beiral como faixa, cumeeira e espigão em traço, rincão tracejado, empena (aresta sem inclinação) tracejada e, por
 * água, seta de caimento (da subida para a descida) com o percentual; com balanço, a pegada tracejada rosa (`pegadaOps`).
 * A cumeeira mais alta leva a cota absoluta ("▲ +5,70") com etiquetas ligadas ou na planta de cobertura. Com etiquetas
 * ligadas, código e área real no centroide.
 */
export function roofOps(roofs: ResolvedRoof[], p: Project, theme: PlanTheme, dark: boolean, detail: DetailLevel, v: Viewport, opts: RoofOpsOptions = {}, scale = 100): FloorOps {
  const out = empty();
  const fillBase = dark ? theme.bg : '#ffffff';
  const coarse = detail === 'coarse';
  const fine = detail === 'fine';
  const planMode = opts.planMode === true;
  const alpha = planMode ? 1 : coarse ? 0.8 : 0.55;
  // Espessuras do telhado (decisão 0015 §2.1): cumeeira, espigão, rincão, beiral, empena e setas são de corte.
  const paint = opts.paint ?? defaultPaint('roof', v.zoom);
  const esp = espessurasDoTelhado(paint);
  for (const r of roofs) {
    const top = topLayer(r);
    const m = top ? p.materials[top.materialId] : undefined;
    const base = surfaceColor(m?.color ?? '#999999', fillBase, dark ? 0.3 : 0.5, paint);
    const hatch = m && m.hatch !== 'none' && !coarse && (fine || zoomAtinge(v, 40)) ? { kind: m.hatch, color: mix(paint.color ?? m.color, dark ? '#ffffff' : '#000000', 0.45) } : undefined;
    for (const pl of r.planes) out.fills.push({ polygons: pl.polygon, color: waterTone(base, pl.up), alpha, hatch });
    const model = p.elements[r.roofId];
    if (isRoof(model)) out.strokes.push(...pegadaOps(model, theme, esp.projecao));
    const foot = roofFootprint(r);
    if (!coarse) {
      out.fills.push({ polygons: foot, color: mix(theme.ink, fillBase, 0.35), alpha: 1, contour: true, faixa: esp.beiral });
      // Arestas internas de um arco (geratrizes entre facetas do mesmo trecho curvo) não são cumeeira nem espigão: saem.
      // Um trecho curvo leva uma seta e um percentual só, na faceta do meio (`comSinal`).
      const arco = arcoDoTelhado(p, r);
      for (const ln of r.lines) {
        if (ln.kind === 'eave' || arco.deArco(ln)) continue;
        if (ln.kind === 'gable') {
          out.strokes.push(...gableLineOps(ln.a, ln.b, theme, esp.empena));
          continue;
        }
        const espessura = ln.kind === 'ridge' ? esp.cumeeira : ln.kind === 'hip' ? esp.espigao : esp.rincao;
        const dash: [number, number] | undefined = ln.kind === 'valley' ? [6, 3] : undefined;
        out.strokes.push({ pts: [ln.a, ln.b], closed: false, ...espessura, color: theme.ink, alpha: 1, ...(dash ? { dash } : {}) });
      }
      for (const [k, pl] of r.planes.entries()) {
        const at = labelPoint(pl.polygon);
        if (!at || !arco.comSinal(k)) continue;
        const down = { x: -pl.up.x, y: -pl.up.y };
        // Seta de caimento em verde (tinta própria do caimento), na espessura de projeção.
        out.strokes.push(...slopeArrow(down, at, v, { ...theme, ink: theme.roofSlope }, esp.projecao));
        // Deslocamento lateral em mm de papel: 2 mm garantem que a etiqueta não cruze a haste da seta.
        out.labels.push({ at, text: fmtPercent(pl.percent), papel: { ...beside(down, 2.0, scale), fontMm: SURFACE_TEXT_MM } });
      }
    }
    if (planMode || p.settings.showTags) {
      const rd = highestRidge(r);
      // Deslocamento vertical da cota da cumeeira: equivalente a 12 px de tela no zoom/escala padrão.
      if (rd) out.labels.push({ at: rd.at, text: `▲ ${fmtElevation(rd.z)}`, papel: { escala: scale, fontMm: SURFACE_TEXT_MM, desvio: { mm: 1.2, uy: -1 } } });
    }
    if (p.settings.showTags) {
      const at = labelPoint(foot);
      const text = [p.roofTypes[r.typeId]?.code, fmtArea(roofRealArea(r), 1)].filter(Boolean).join(' · ');
      // Grosseiro: deslocamento leve acima (-10 px ≈ -1,0 mm). Fino: a seta de caimento tem 80 px de semilado;
      // deslocamento de -52 px ≈ -5,2 mm garante que a etiqueta fique acima dela.
      if (at) out.labels.push({ at, text, papel: { escala: scale, fontMm: SURFACE_TEXT_MM, desvio: { mm: coarse ? 1.0 : 5.2, uy: -1 } } });
    }
  }
  return out;
}

/**
 * Telhados do nível na planta (D1), antes das etiquetas e depois das paredes e aberturas. Os `hidden` (fora do intervalo
 * de vista) saem; com `showProjection`, cada um deixa o contorno do beiral tracejado (projeção da cobertura).
 */
export function roofFills(p: Project, levelId: Id, theme: PlanTheme, dark: boolean, detail: DetailLevel, v: Viewport, opts: RoofOpsOptions = {}, scale = 100): FloorOps {
  const all = telhadosDoNivel(p, levelId);
  const hidden = opts.hidden;
  const off = opts.categoryHidden;
  const out = roofOps(all.filter((r) => !hidden?.has(r.roofId)), p, theme, dark, detail, v, opts, scale);
  // Telhados ocultos: a pegada com balanço aparece também fora do intervalo; a projeção, só com a opção ligada.
  const proj = espessurasDoTelhado(opts.paint ?? defaultPaint('roof', v.zoom)).projecao;
  for (const r of all) {
    if (!hidden?.has(r.roofId) || off?.has(r.roofId)) continue;
    const model = p.elements[r.roofId];
    if (isRoof(model)) out.strokes.push(...pegadaOps(model, theme, proj));
    if (opts.showProjection === true) {
      // Projeção da cobertura fora do intervalo de vista: rosa tracejada com balanço (é a pegada projetada); sem balanço, tinta.
      const cor = isRoof(model) && temBalanco(model) ? theme.roofFootprint : theme.ink;
      for (const ring of roofFootprint(r).flat()) out.strokes.push({ pts: ring, closed: true, ...proj, color: cor, alpha: 0.9, dash: [6, 3] });
    }
  }
  return out;
}

/**
 * Destaque de seleção e de hover dos telhados (D1), no padrão das lajes; a área é a real. Telhado selecionado: contorno
 * sólido nas arestas com inclinação, tracejado nas empenas, e o símbolo "define inclinação" de cada aresta (A11).
 */
export function roofSelectionOps(
  p: Project,
  levelId: Id,
  selection: Id[],
  hover: Id | null,
  theme: PlanTheme,
  v: Viewport,
  hidden?: ReadonlySet<Id>,
  paint: PlanPaint = defaultPaint('roof', v.zoom),
): FloorOps {
  const roofs = telhadosDoNivel(p, levelId).filter((r) => !hidden?.has(r.roofId));
  const parts = roofs.map((r) => ({ id: r.roofId, polygon: roofFootprint(r), area: roofRealArea(r) }));
  const base = outlineSelectionOps(parts, selection, hover, !p.settings.showTags, theme, v);
  // O contorno de 2 px do destaque padrão é trocado pelo de `selectedRingOps` (sólido ou tracejado por aresta).
  const out: FloorOps = { fills: base.fills, strokes: base.strokes.filter((s) => !(s.closed && s.widthPx === 2)), labels: base.labels };
  const sel = new Set(selection);
  for (const r of roofs) {
    const roof = p.elements[r.roofId];
    if (!sel.has(r.roofId) || !isRoof(roof)) continue;
    out.strokes.push(...selectedRingOps(r, roof, theme));
    const sym = defineSlopeOps(roof, theme, espessurasDoTelhado(paint).projecao);
    out.fills.push(...sym.fills);
    out.strokes.push(...sym.strokes);
    out.labels.push(...sym.labels);
  }
  return out;
}
