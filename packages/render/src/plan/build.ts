/* eslint-disable max-lines */
import { add, boxOf, mul, norm, perp, pointInMulti, ringArea, sub, union, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { buildOpeningModel, cutLevelByJunction, frameOfWall, openingGeometry, type ResolvedFloor, type ResolvedLevel, type ResolvedRoof, type ResolvedRoom, type ResolvedSlab } from '@hestia/engine';
import { openingTypeById, dimensionPoints, isGeneric, levelDimensions, levelRoomSeparators, openingAngle2d, openingDetail2d, openingLeafPlan, openingPlanDisplay, openingShowSwing, openingSwingStyle, planAnnotationIds, planAnnotationsOf, projectGrids, wallsOnLevel, type AreaPlan, type AreaPlanAnnotations, type DetailLevel, type Id, type Material, type Project } from '@hestia/model';
import { resolveRooms } from '@hestia/engine';
import { areaPlanLegendOps, areaPlanRoomOps, areaPlanTableOps, areaPlanTagOps } from './areaPlan.ts';
import { aberturasDaParede, escadasDoNivel, juncaoDoNivel, paredesDoNivel, rampasDoNivel, telhadosDoNivel } from './resolucao.ts';
import type { Inference, PreviewItem } from '@hestia/tools';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import { thinStrokes } from './thin.ts';
import { gridStrokes } from './grid.ts';
import { gridOps } from './grids.ts';
import { sectionMarksOf } from './sectionMarks.ts';
import { belowFloorOps, type FloorOps } from './floors.ts';
import { floorAndSlabOps } from './surfaces.ts';
import { belowRoomOps, roomOps } from './rooms.ts';
import { ceilingFills } from './ceilings.ts';
import { roofEdgeColor, roofFills, roofFootprint, roofOps } from './roofs.ts';
import { belowStairOps, stairFills } from './stairs.ts';
import { belowRampOps, rampFills } from './ramps.ts';
import { joinDebugLabels } from './joinDebug.ts';
import { wallTagLabels } from './tags.ts';
import { openingTagLabels } from './openingTags.ts';
import { annotationsOfLevel, noteOps, roomSeparatorStrokes } from './notes.ts';
import { elementTagOps } from './tags.ts';
import { openingViewOps, wallOutlineOps, type PlanView } from './view.ts';
import { openingPlanDetail } from './symbols.ts';
import { espessuraDeCorte, espessuraDeProjecao, paintOps, surfaceColor, type PlanPaint, type PlanStyle } from './style.ts';
import { Limiares, type VistaComLimiares } from './limiares.ts';
import { tracoEm } from './marcadores.ts';
import { resolverZoom } from './zoomOps.ts';
import { planContext } from './planContext.ts';
import { areaPlanProfile, type FillOp, type LabelOp, type PlanDrawList, type PlanOps, type PlanTheme, type StrokeOp } from './types.ts';

import { buildPlanOverlay } from './planOverlay.ts';

export { buildPlanHoverOverlay, buildPlanLiveOverlay, buildPlanOverlay, buildPlanScreenOverlay, buildPlanSelectionOverlay } from './planOverlay.ts';
export { planBelowOf, underlayIdOf } from './planContext.ts';

export interface PlanInput {
  project: Project;
  levelId: Id;
  /**
   * Geometria do nível pelo padrão (sem intervalo de vista). A planta normal não a usa: refaz a geometria do nível com o
   * intervalo de vista (`planViewOf`). Só a planta de cobertura (`roofPlanMode`) a usa, como antes.
   */
  resolved: ResolvedLevel;
  below: ResolvedLevel | null;
  /** Pisos do nível abaixo (referência apagada, D4); sem ele, só as paredes do subpavimento aparecem. */
  belowFloors?: ResolvedFloor[];
  /** Lajes do nível abaixo, apagadas como os pisos (D1/D4); o app preenche, sem ele nada aparece. */
  belowSlabs?: ResolvedSlab[];
  /** Telhados do nível abaixo, apagados como as lajes (D4); sem eles, nada aparece. */
  belowRoofs?: ResolvedRoof[];
  /** Ambientes do nível abaixo, apagados como os pisos (D3); sem eles, nada aparece. */
  belowRooms?: ResolvedRoom[];
  /**
   * Planta de cobertura (D6): telhados do nível opacos (alpha 1) e os de `belowRoofs` também, só o preenchimento;
   * paredes só como contorno fino por cima; sem pisos, lajes ou aberturas; cota da cumeeira sempre visível. O app
   * liga o modo (ex.: uma vista "Cobertura"); sem ele a planta é a de sempre. Não usa o intervalo de vista.
   */
  roofPlanMode?: boolean;
  /** Planta de área: quando presente, o desenho é o da planta de área (sem pisos, cotas, aberturas ou cor por padrão). */
  areaPlan?: import('@hestia/model').AreaPlan;
  /** Rótulo em arraste (fantasma) da planta de área: segue o cursor em tempo real. */
  tagGhost?: { roomId: Id; at: Vec2 };
  /** Ambiente cujo rótulo está sendo arrastado: a geometria não o desenha (o fantasma desenha). */
  hideLabelRoomId?: Id;
  /**
   * Projeção da cobertura (decisão 0013 §2): contorno tracejado dos telhados que estão fora do intervalo de vista. Padrão
   * ligado; independe do topo. Não afeta a planta de cobertura.
   */
  showRoofProjection?: boolean;
  viewport: Viewport;
  theme: PlanTheme;
  dark: boolean;
  selection: Id[];
  hover: Id | null;
  preview: PreviewItem[];
  inference: Inference | null;
  showGrid: boolean;
  /**
   * Linhas finas só na tela (decisão 0015): todo traço sai com 1 px. Padrão desligado; a composição de pranchas, o PDF e
   * o DXF não passam a opção, então usam os pesos reais. Não lê o modelo: quem chama decide.
   */
  thinLines?: boolean;
}

const ringsOf = (m: MultiPolygon): Ring[] => m.flatMap((p) => p);

/** Espessura equivalente (2·área/perímetro) em metros: com o zoom, decide quanto detalhe vale a pena desenhar. */
function espessuraEquivalente(poly: Ring[]): number {
  const outer = poly[0];
  if (!outer) return 0;
  let per = 0;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i]!;
    const b = outer[(i + 1) % outer.length]!;
    per += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return per > 0 ? (2 * Math.abs(ringArea(outer))) / per : 0;
}

/** Zoom máximo da vista (px/m): acima dele nada muda, então o que só aparece além dele nunca é desenhado. */
const ZOOM_MAXIMO = 4000;

/** Zoom (px/m) em que uma região de espessura equivalente `emMetros` chega a `px` pixels; `Infinity` se ela não tem espessura. */
const zoomDaEspessura = (emMetros: number, px: number): number => (emMetros > 0 ? px / emMetros : Number.POSITIVE_INFINITY);

/**
 * Hachura de uma região de parede (decisão 0015 §2.2): no fino, sempre; nos demais, a partir de 40 px/m e com 5 px de
 * espessura equivalente. Com a hachura procedural, o zoom mínimo vai para o shader (`zoomMin`) e a geometria não muda com
 * o zoom: o fragmento some abaixo dele, e o `resolverZoom` faz o mesmo no caminho CPU.
 */
function hachuraDaRegiao(m: Material | undefined, espessura: number, fine: boolean, color: string): FillOp['hatch'] {
  if (!m || m.hatch === 'none') return undefined;
  if (fine) return { kind: m.hatch, color };
  const zoomMin = Math.max(40, zoomDaEspessura(espessura, 5));
  if (!(zoomMin <= ZOOM_MAXIMO)) return undefined;
  return { kind: m.hatch, color, zoomMin };
}

/**
 * Parte da seleção que a geometria do nível usa: as cotas do nível (decisão 0019), as linhas e regiões de detalhe, as
 * grades de eixos e as marcas de corte e elevação selecionadas mudam de cor (e espessura) com a seleção. A geometria
 * depende só desse subconjunto; o resto é da sobreposição. As linhas e regiões de detalhe ficam aqui porque o desenho
 * delas (com o realce 1,7×) é feito por `notes.ts` na geometria — sem elas, a seleção não chegava ao desenho (achado A2).
 */
export function planGeometrySelection(p: Project, levelId: Id, selection: readonly Id[], areaPlan?: Pick<AreaPlan, 'annotations'>): Id[] {
  if (selection.length === 0) return [];
  const level = p.levels.find((l) => l.id === levelId);
  const used = new Set<Id>([
    ...levelDimensions(p, levelId).map((d) => d.id),
    ...levelRoomSeparators(p, levelId).map((r) => r.id),
    ...p.views.map((v) => v.id),
    ...projectGrids(p).map((g) => g.id),
    ...(level?.detailLines ?? []).map((l) => l.id),
    ...(level?.detailRegions ?? []).map((r) => r.id),
    // Anotações da planta de área (cotas, textos, detalhes e etiquetas da vista): a seleção chega ao desenho por aqui.
    ...(areaPlan ? planAnnotationIds(areaPlan) : []),
  ]);
  return selection.filter((id) => used.has(id));
}

/**
 * Símbolos das aberturas do nível (portas e janelas), no estilo da categoria de cada uma: cortadas, tracejadas acima do
 * corte e leves abaixo. Compartilhado pela planta de piso e pela de área (que o liga pelo perfil), sem duplicar o
 * desenho. Cada símbolo leva o zoom aos limiares da geometria (ver `openingPlanDetail`).
 */
function openingSymbolStrokes(
  p: Project,
  levelId: Id,
  paint: PlanStyle['paint'],
  theme: PlanTheme,
  fillBase: string,
  detail: DetailLevel,
  zoom: number,
  limiares: Limiares,
  view: PlanView | null,
  oculto?: (q: Vec2) => boolean,
): StrokeOp[] {
  if (detail === 'coarse') return [];
  const out: StrokeOp[] = [];
  for (const w of paredesDoNivel(p, levelId)) {
    const f = frameOfWall(p, w.id);
    if (!f) continue;
    for (const o of aberturasDaParede(p, w.id)) {
      const g = openingGeometry(p, o, f);
      if (oculto?.(g.center)) continue;
      const type = openingTypeById(p, o.typeId);
      if (!type) continue;
      const pt = paint[g.kind];
      const model = buildOpeningModel(p, o, g, f);
      // O nível de detalhe pelo zoom entra nos limiares da geometria: o quadro só a refaz quando cruza 1 px = 0,012 m
      // ou 1 px = 0,004 m (ver `limiares.ts`), e a lista de desenho continua a mesma entre os limiares.
      const detail2d = openingPlanDetail(openingDetail2d(type), zoom, limiares);
      const cls = view?.cls.get(o.id);
      // A cota do corte é absoluta na vista; o modelo usa z local (soleira = 0, base da parede descontada). Fora do
      // corte (projeção), o símbolo mostra o vão inteiro e corta no meio do modelo.
      const cutLocal = view ? view.cutZ - (f.z?.z0 ?? 0) - g.sill : model.height / 2;
      const sym = openingViewOps(g, cls, theme, { cut: espessuraDeCorte(pt), proj: espessuraDeProjecao(pt) }, {
        model,
        detail: detail2d,
        angle: (openingAngle2d(type) * Math.PI) / 180,
        planDisplay: openingPlanDisplay(type),
        showSwing: openingShowSwing(type),
        swingStyle: openingSwingStyle(type),
        leafPlan: openingLeafPlan(type),
        cutZ: cls === undefined || cls === 'cut' ? cutLocal : model.height / 2,
      });
      out.push(...paintOps({ fills: [], strokes: sym, labels: [] }, pt, fillBase).strokes);
    }
  }
  return out;
}

/**
 * Geometria do nível (decisão 0013, D1–D6): pisos, lajes, ambientes, escadas, paredes, aberturas, telhados, forros,
 * cotas e etiquetas. Não depende de pan, de seleção (exceto as cotas), de cursor, de ferramenta nem da grade. O zoom só
 * entra nas decisões de detalhe (interface entre materiais), registradas em `limiares`; faixas, marcadores e
 * rótulos saem em papel e em pixels, e `resolverZoom` os converte (ver `zoomOps.ts`). A sobreposição fica em `buildPlanOverlay`.
 */
export function buildPlanGeometry(input: PlanInput): PlanOps {
  if (input.areaPlan) return buildAreaPlanGeometry(input, input.areaPlan);
  const { project: p, theme } = input;
  const limiares = new Limiares();
  const v: VistaComLimiares = { ...input.viewport, limiares };
  const fills: FillOp[] = [];
  const strokes: StrokeOp[] = [];
  const labels: LabelOp[] = [];
  const fillBase = input.dark ? theme.bg : '#ffffff';
  const fillT = input.dark ? 0.5 : 0.58;

  // Contexto do nível e da vista (o mesmo que a sobreposição usa): estilo, vista, geometria e ocultos.
  const { style, rp, view, up, geo, hidden, roofOff, roofHidden, stairs, ramps } = planContext(input);
  const { detail, paint } = style;
  // Arame: só contornos. Os preenchimentos de modelo somem (as faixas de contorno ficam); referências também.
  const wire = style.visual === 'wireframe';
  const surfaces = (fs: FillOp[]): FillOp[] => (wire ? [] : fs);
  // Operações de uma categoria: o estilo dela (arame, transparência, meio-tom) e, sem linhas, só superfícies.
  const addOps = (ops: FloorOps, pt: PlanPaint, withLines: boolean): void => {
    const o = paintOps(ops, pt, fillBase);
    fills.push(...o.fills);
    if (withLines) {
      strokes.push(...o.strokes);
      labels.push(...o.labels);
    }
  };

  // Nível de detalhe (H3, decisão 0015 §2.2): grosseiro = um contorno preenchido por cluster, sem camadas, hachura nem
  // símbolos; médio = como antes; fino = linhas de camada sempre e hachura mesmo em zoom baixo.
  const fine = detail === 'fine';
  // Planta de forro (decisão 0021): vista para cima. Sem o que está embaixo do nível (referências apagadas) e com forros.
  // Pavimento de baixo (referência) com as paredes cortadas pela junção dele, como a planta do nível.
  const below = up || !input.below ? null : cutLevelByJunction(input.below, juncaoDoNivel(p, input.below.levelId));

  // Telhados visíveis acima do plano de corte: a cobertura esconde as paredes por baixo. Elas voltam no fim, só como
  // contorno esmaecido; as linhas e os símbolos das paredes sob a cobertura não sobem por cima do telhado.
  const telhadosAcima = rp || !view ? [] : telhadosDoNivel(p, input.levelId).filter((r) => !roofHidden?.has(r.roofId) && view.cls.get(r.roofId) === 'projection-above');
  const coberturaAcima: MultiPolygon = telhadosAcima.length > 0 ? union(...telhadosAcima.map((r) => roofFootprint(r))) : [];
  const sobCobertura = (q: Vec2): boolean => coberturaAcima.length > 0 && pointInMulti(q, coberturaAcima);
  const meioDoTraco = (s: StrokeOp): Vec2 => {
    let x = 0;
    let y = 0;
    for (const q of s.pts) {
      x += q.x;
      y += q.y;
    }
    const n = s.pts.length || 1;
    return { x: x / n, y: y / n };
  };

  // Pavimento abaixo como subpiso apagado (referência): sem preenchimento no arame, linhas como antes.
  if (below) {
    for (const c of below.clusters) {
      if (!wire) fills.push({ polygons: c.silhouette, color: theme.underlay, alpha: 0.22 });
      if (!rp) for (const r of ringsOf(c.silhouette)) strokes.push({ pts: r, closed: true, widthPx: 1, color: theme.underlay, alpha: 0.7 });
    }
  }

  if (below && input.belowFloors) {
    const bf = belowFloorOps(input.belowFloors, theme);
    fills.push(...surfaces(bf.fills));
    if (!rp) strokes.push(...bf.strokes);
  }
  if (below && input.belowSlabs) {
    const bs = belowFloorOps(input.belowSlabs, theme);
    fills.push(...surfaces(bs.fills));
    if (!rp) strokes.push(...bs.strokes);
  }
  if (below && input.belowRooms) {
    const brm = belowRoomOps(input.belowRooms, theme);
    fills.push(...surfaces(brm.fills));
    if (!rp) strokes.push(...brm.strokes);
  }
  // Escadas do nível abaixo (decisão 0011 §1): apagadas, como as lajes de referência. As do nível, fora do intervalo, saem.
  if (below) {
    const bst = belowStairOps(escadasDoNivel(p, below.levelId), theme);
    fills.push(...surfaces(bst.fills));
    if (!rp) strokes.push(...bst.strokes);
    const brp = belowRampOps(rampasDoNivel(p, below.levelId), theme);
    fills.push(...surfaces(brp.fills));
    if (!rp) strokes.push(...brp.strokes);
  }
  if (below && input.belowRoofs) {
    if (rp) {
      // Telhados de baixo opacos: só o preenchimento; as linhas e cotas do nível de baixo não aparecem por cima.
      fills.push(...surfaces(roofOps(input.belowRoofs, p, theme, input.dark, detail, v, { planMode: true }).fills));
    } else {
      const br = belowFloorOps(
        input.belowRoofs.map((r) => ({ polygon: roofFootprint(r) })),
        theme,
      );
      fills.push(...surfaces(br.fills));
      strokes.push(...br.strokes);
    }
  }

  // Lajes e pisos pela cota da face superior (decisão 0023 §3): o mais alto desenha por último; pisos antes das paredes.
  for (const sf of floorAndSlabOps(p, input.levelId, theme, input.dark, detail, v, hidden, paint, style.scale)) addOps(sf.ops, sf.paint, !rp);
  // Ambientes sobre os pisos (preenchimento leve e etiqueta com nome, número e área) e sob as paredes (decisão 0018).
  addOps(roomOps(p, input.levelId, theme, input.dark, detail, style.scale, hidden, paint.room, input.hideLabelRoomId), paint.room, !rp);
  // Escadas do nível: depois dos pisos e lajes, antes das paredes (o degrau não cobre parede).
  addOps(stairFills(p, stairs, theme, input.dark, detail, v, view ? { cutZ: view.cutZ, topZ: view.topZ } : undefined, paint.stair, style.scale), paint.stair, !rp);
  // Rampas do nível: junto das escadas, com o mesmo estilo da categoria.
  addOps(rampFills(p, ramps, theme, input.dark, detail, v, view ? { cutZ: view.cutZ, topZ: view.topZ } : undefined, paint.stair, style.scale), paint.stair, !rp);
  // Forros: só na planta de forro (na planta baixa eles estão acima do topo e não saem).
  if (up) addOps(ceilingFills(p, input.levelId, theme, input.dark, detail, v, hidden, paint.floor, style.scale), paint.floor, true);

  // Paredes: conjuntos (silhueta e regiões por material) e contornos fora do corte, com o estilo da categoria parede.
  // Parede oculta pela categoria: a geometria do nível já sai vazia (ver `planViewOf`), e os conjuntos não entram.
  const wallOps: FloorOps = { fills: [], strokes: [], labels: [] };
  const clusters = rp || !paint.wall.visible ? [] : geo.clusters;
  for (const c of clusters) {
    if (detail === 'coarse') wallOps.fills.push({ polygons: c.silhouette, color: mix(theme.inkSoft, fillBase, 0.5), alpha: 1 });
    const regions = detail === 'coarse' ? [] : c.regions;
    for (const r of regions) {
      const m = p.materials[r.materialId];
      const color = surfaceColor(m?.color ?? '#999999', fillBase, fillT, paint.wall);
      const polys = r.polygons;
      const thick = Math.max(0, ...polys.map((poly) => espessuraEquivalente(poly)));
      const hatch = hachuraDaRegiao(m, thick, fine, mix(paint.wall.color ?? m?.color ?? '#999999', input.dark ? '#ffffff' : '#000000', 0.45));
      wallOps.fills.push({ polygons: polys, color, alpha: 1, hatch });
      // Linhas de interface entre materiais: só onde cabem sem virar mancha (fino: sempre). Linhas finas: peso de projeção.
      // O traço leva o zoom a partir do qual cabe (`zoomMin`) e o shader o esconde abaixo dele: a geometria não muda com o zoom.
      for (const poly of polys) {
        const zoomMin = fine ? undefined : zoomDaEspessura(espessuraEquivalente(poly), 1.6);
        if (zoomMin !== undefined && zoomMin > ZOOM_MAXIMO) continue;
        for (const ring of poly) wallOps.strokes.push({ pts: ring, closed: true, ...paint.wall.proj, color: mix(theme.ink, fillBase, 0.35), alpha: 1, ...(zoomMin !== undefined ? { zoomMin } : {}) });
      }
    }
    for (const ring of ringsOf(c.silhouette)) wallOps.strokes.push({ pts: ring, closed: true, ...paint.wall.cut, color: theme.ink, alpha: 1 });
  }
  // Paredes fora do corte (decisão 0013 §4): contorno; projeção acima tracejada, abaixo e "além" em linha clara.
  if (view) wallOps.strokes.push(...wallOutlineOps(view, theme, espessuraDeProjecao(paint.wall)));

  // Membranas (camadas de espessura zero): linha fina tracejada no limite entre camadas (só no fino, paredes cortadas).
  if (fine && !rp) {
    for (const [id, rw] of Object.entries(geo.walls)) {
      if (view?.cls.get(id) !== 'cut') continue;
      for (const m of rw.membranes) wallOps.strokes.push({ pts: m.pts, closed: false, ...paint.wall.proj, color: theme.inkSoft, alpha: 0.9, dash: [6, 3] });
    }
  }
  // Paredes sob um telhado acima do corte: o telhado cobre as linhas e os símbolos; o contorno esmaecido entra no fim.
  if (coberturaAcima.length > 0) wallOps.strokes = wallOps.strokes.filter((s) => !sobCobertura(meioDoTraco(s)));
  addOps(wallOps, paint.wall, true);

  // Pontas com "não unir": marcador laranja discreto, para a junção esquecida desligada não passar despercebida.
  for (const w of rp ? [] : paredesDoNivel(p, input.levelId)) {
    if (hidden?.has(w.id)) continue;
    for (const [off, pt] of [[w.noJoinStart, w.a], [w.noJoinEnd, w.b]] as const) {
      if (!off || sobCobertura(pt)) continue;
      // Anel de 5 px de raio e uma diagonal: marcadores em pixels ancorados na ponta (mesmo tamanho para qualquer zoom).
      const r = 5;
      const anel = Array.from({ length: 12 }, (_, i) => ({ x: Math.cos((i * Math.PI) / 6) * r, y: Math.sin((i * Math.PI) / 6) * r }));
      strokes.push({ ...tracoEm(pt, anel, true), widthPx: 1.4, color: theme.guide, alpha: 0.95 });
      strokes.push({ ...tracoEm(pt, [{ x: -r * 0.7, y: -r * 0.7 }, { x: r * 0.7, y: r * 0.7 }], false), widthPx: 1.4, color: theme.guide, alpha: 0.95 });
    }
  }

  // Símbolos das aberturas (fora do grosseiro): cortadas, tracejadas acima do corte, leves abaixo; as ocultas saem.
  // Cada um com o estilo da sua categoria (porta ou janela) e a espessura de corte ou de projeção.
  if (!rp) strokes.push(...openingSymbolStrokes(p, input.levelId, paint, theme, fillBase, detail, input.viewport.zoom, limiares, view, sobCobertura));

  // Telhados (D1): por cima das paredes e dos pisos (semitransparentes); as linhas notáveis saem por último.
  const rf = roofFills(p, input.levelId, theme, input.dark, detail, v, {
    planMode: rp,
    hidden: roofHidden,
    categoryHidden: roofOff,
    showProjection: input.showRoofProjection !== false,
    paint: paint.roof,
    classes: view?.cls,
    cutZ: view?.cutZ,
  }, style.scale);
  addOps(rf, paint.roof, true);
  // Planta de cobertura: as paredes voltam por cima dos telhados só como contorno fino.
  if (rp && paint.wall.visible) {
    for (const c of geo.clusters) for (const ring of ringsOf(c.silhouette)) strokes.push({ pts: ring, closed: true, ...paint.wall.proj, color: theme.inkSoft, alpha: 0.8 });
  }
  // Telhado acima do corte (projeção): o preenchimento quase opaco esconderia as paredes do nível. Os contornos finos,
  // tracejados e esmaecidos, voltam por cima só para o usuário localizar as paredes; a grade continua atrás dos
  // preenchimentos (não sobe com eles).
  if (!rp && view && paint.wall.visible && telhadosAcima.length > 0) {
    const cor = mix(roofEdgeColor(p, telhadosAcima[0]!, theme, input.dark, paint.roof), theme.ink, input.dark ? 0.55 : 0.25);
    const esp = espessuraDeProjecao(paint.roof);
    for (const w of Object.values(geo.walls)) {
      if (w.layers.length === 0) continue;
      // Só paredes que estão sob a cobertura (o meio do eixo cai na pegada do telhado).
      if (!sobCobertura({ x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 })) continue;
      // O contorno da parede é a união das camadas (um só traço por face), sem os preenchimentos.
      for (const ring of union(...w.layers.map((l) => l.cut)).flat()) strokes.push({ pts: ring, closed: true, ...esp, color: cor, alpha: 0.55, dash: [4, 2] });
    }
  }

  // Grades de eixos: por cima do modelo e por baixo das anotações; valem em todos os níveis (ver `grids.ts`).
  const grades = gridOps(p, style.scale, input.viewport.zoom, theme, input.selection);
  strokes.push(...grades.strokes);
  labels.push(...grades.labels);

  // Linhas de corte e elevação: aparecem em todas as plantas, porque o corte atravessa os níveis. Seguem a categoria
  // 'anotação' (visibilidade, cor e peso) e a escala da vista, com geometria em mm de papel.
  const marks = sectionMarksOf(p, theme, paint.annotation, style.scale, input.selection);
  fills.push(...marks.fills);
  strokes.push(...marks.strokes);
  labels.push(...marks.labels);

  // Cotas e textos do nível (decisão 0019), com o estilo da categoria 'anotação'.
  const notes = noteOps(p, input.levelId, paint.annotation, { ink: theme.ink, select: theme.select, paper: theme.bg, selection: input.selection }, style.scale, v);
  fills.push(...notes.fills);
  strokes.push(...notes.strokes);
  labels.push(...notes.labels);

  const tagged = elementTagOps(p, input.levelId, paint.annotation, style.scale);
  strokes.push(...tagged.strokes);
  labels.push(...tagged.labels);

  // Etiquetas de tipo (G4) seguem a categoria 'anotação' (visibilidade e mm de papel).
  if (p.settings.showTags) labels.push(...wallTagLabels(p, input.levelId, paint.annotation, style.scale, hidden));
  // Etiquetas de portas e janelas (Tag on Placement): desligadas por padrão, ligadas ao inserir.
  if (p.settings.showOpeningTags) labels.push(...openingTagLabels(p, input.levelId, paint.annotation, style.scale, hidden));
  if (p.settings.debugJoins) labels.push(...joinDebugLabels(p, input.levelId));

  // Objetos importados (viga, pilar, mobiliário...): na v1 só o contorno aproximado em planta, tracejado e fino.
  if (paint.generic.visible) {
    for (const e of Object.values(p.elements)) {
      if (!isGeneric(e) || e.levelId !== input.levelId || !e.outline?.length) continue;
      strokes.push({ pts: e.outline, closed: true, widthPx: 1, color: theme.inkSoft, alpha: 0.8, dash: [5, 3] });
    }
  }

  // Linhas finas (só na tela): os traços do modelo ficam com 1 px; o que vem depois (seleção, cursor, cotas temporárias,
  // pré-visualização e guias) mantém a largura própria.
  if (input.thinLines) thinStrokes(strokes);
  return { fills, strokes, labels, limiares: limiares.lista() };
}

/**
 * Planta de área (F) pelo MESMO motor da planta de piso, com o perfil `areaPlanProfile`: pisos, aberturas, cotas,
 * textos, detalhes, etiquetas, eixos e marcas de corte entram conforme os gráficos da vista. O padrão continua o de
 * sempre — paredes claras, diagonais de referência, etiquetas de ambiente, legenda e quadro, sem preenchimento quando não
 * há esquema de cores. As anotações são as da vista (`plan.annotations`) e, sem elas, as do nível.
 */
function buildAreaPlanGeometry(input: PlanInput, plan: AreaPlan): PlanOps {
  const { project: p, theme } = input;
  const { style, geo, hidden } = planContext(input);
  const profile = areaPlanProfile(plan);
  const scale = plan.scale > 0 ? plan.scale : style.scale;
  const fillBase = input.dark ? theme.bg : '#ffffff';
  const limiares = new Limiares();
  const v: VistaComLimiares = { ...input.viewport, limiares };
  const fills: FillOp[] = [];
  const strokes: StrokeOp[] = [];
  const labels: LabelOp[] = [];
  const resolved = resolveRooms(p, input.levelId);

  // Pavimento de referência (opção "mostrar o nível de baixo"): apagado, como na planta de piso.
  if (profile.underlay && input.below) {
    for (const c of input.below.clusters) {
      fills.push({ polygons: c.silhouette, color: theme.underlay, alpha: 0.22 });
      for (const ring of ringsOf(c.silhouette)) strokes.push({ pts: ring, closed: true, widthPx: 1, color: theme.underlay, alpha: 0.7 });
    }
    if (input.belowFloors) {
      const bf = belowFloorOps(input.belowFloors, theme);
      fills.push(...bf.fills);
      strokes.push(...bf.strokes);
    }
    if (input.belowSlabs) {
      const bs = belowFloorOps(input.belowSlabs, theme);
      fills.push(...bs.fills);
      strokes.push(...bs.strokes);
    }
    if (input.belowRooms) {
      const brm = belowRoomOps(input.belowRooms, theme);
      fills.push(...brm.fills);
      strokes.push(...brm.strokes);
    }
  }

  // Pisos e lajes, quando o perfil pede (a planta de área nasce sem eles).
  if (profile.floors) {
    const fs = floorAndSlabOps(p, input.levelId, theme, input.dark, style.detail, v, hidden, style.paint, scale);
    for (const s of fs) {
      fills.push(...s.ops.fills);
      strokes.push(...s.ops.strokes);
    }
  }

  // Ambientes: preenchimento (só com esquema), contorno e diagonais de referência.
  if (profile.rooms) {
    const roomPlan: AreaPlan = profile.referenceLines ? plan : { ...plan, graphics: { ...plan.graphics, referenceLines: 'never' } };
    const room = areaPlanRoomOps(p, roomPlan, theme, input.dark, scale, hidden, style.paint.room, resolved, new Set(input.selection));
    fills.push(...room.fills);
    strokes.push(...room.strokes);
  }

  // Paredes claras (padrão) ou normais, conforme o perfil.
  if (profile.walls !== 'hidden') {
    const light = profile.walls === 'light';
    const wallFill = mix(theme.inkSoft, fillBase, light ? 0.88 : 0.62);
    const wallLine = light ? theme.inkSoft : theme.ink;
    for (const c of geo.clusters) {
      fills.push({ polygons: c.silhouette, color: wallFill, alpha: 1 });
      for (const ring of ringsOf(c.silhouette)) strokes.push({ pts: ring, closed: true, widthPx: 1, papel: { mm: light ? 0.25 : 0.35, escala: scale }, color: wallLine, alpha: 1 });
    }
  }

  // Símbolos das aberturas, quando o perfil pede (mesma função da planta de piso).
  if (profile.openings) strokes.push(...openingSymbolStrokes(p, input.levelId, style.paint, theme, fillBase, style.detail, input.viewport.zoom, limiares, null));

  // Projeção da cobertura (desligada no perfil padrão de área).
  if (profile.roofProjection) {
    const rf = roofFills(p, input.levelId, theme, input.dark, style.detail, v, {
      hidden: undefined,
      showProjection: input.showRoofProjection !== false,
      paint: style.paint.roof,
    }, scale);
    fills.push(...rf.fills);
    strokes.push(...rf.strokes);
    labels.push(...rf.labels);
  }

  // Grades de eixos: por cima do modelo e por baixo das anotações (mesma função da planta de piso).
  if (profile.grids) {
    const grades = gridOps(p, scale, input.viewport.zoom, theme, input.selection);
    strokes.push(...grades.strokes);
    labels.push(...grades.labels);
  }

  // Linhas de corte e elevação (mesma função da planta de piso).
  if (profile.sectionMarks) {
    const marks = sectionMarksOf(p, theme, style.paint.annotation, scale, input.selection);
    fills.push(...marks.fills);
    strokes.push(...marks.strokes);
    labels.push(...marks.labels);
  }

  // Anotações da vista: as próprias da planta de área ou, sem elas, as do nível (sem somar as duas). O perfil filtra o
  // que entra; as linhas de separação de ambiente não são anotação de vista e saem abaixo, no desenho de sempre.
  const annotations: AreaPlanAnnotations = plan.annotations ? planAnnotationsOf(plan) : annotationsOfLevel(p, input.levelId);
  const visiveis: AreaPlanAnnotations = {
    dimensions: profile.dimensions ? annotations.dimensions : [],
    texts: profile.texts ? annotations.texts : [],
    detailLines: profile.detail ? annotations.detailLines : [],
    detailRegions: profile.detail ? annotations.detailRegions : [],
    tags: profile.tags ? annotations.tags : [],
  };
  const notes = noteOps(p, input.levelId, style.paint.annotation, { ink: theme.ink, select: theme.select, paper: theme.bg, selection: input.selection }, scale, v, visiveis);
  fills.push(...notes.fills);
  strokes.push(...notes.strokes);
  labels.push(...notes.labels);

  // Etiquetas de tipo de parede e de abertura (as de elemento já saíram em `noteOps`, com as anotações da vista).
  if (profile.tags && p.settings.showTags) labels.push(...wallTagLabels(p, input.levelId, style.paint.annotation, scale, hidden));
  if (profile.tags && p.settings.showOpeningTags) labels.push(...openingTagLabels(p, input.levelId, style.paint.annotation, scale, hidden));

  // Separador de ambiente e etiquetas de ambiente (por cima das paredes), legenda e quadro.
  strokes.push(...roomSeparatorStrokes(p, input.levelId, style.paint.annotation, input.dark ? '#9ca3af' : theme.inkSoft, new Set(input.selection), theme.select));
  const roomTags = areaPlanTagOps(p, plan, scale, hidden, resolved, input.hideLabelRoomId, input.dark);
  strokes.push(...roomTags.strokes);
  labels.push(...roomTags.labels);

  const legend = areaPlanLegendOps(p, plan, scale, theme, input.dark);
  fills.push(...legend.fills);
  strokes.push(...legend.strokes);
  labels.push(...legend.labels);

  const table = areaPlanTableOps(p, plan, scale, input.dark);
  fills.push(...table.fills);
  strokes.push(...table.strokes);
  labels.push(...table.labels);

  return { fills, strokes, labels, limiares: limiares.lista() };
}

/**
 * Lista de desenho completa (geometria, sobreposição e grade), na ordem de desenho de sempre. A planta de tela não a
 * usa: separa as camadas (ver `PlanFrame`). Continua para a plotagem, o modo CPU e os testes.
 */
export function buildPlanDrawList(input: PlanInput): PlanDrawList {
  const zoom = input.viewport.zoom;
  const g = resolverZoom(buildPlanGeometry(input), zoom);
  const o = resolverZoom(buildPlanOverlay(input), zoom);
  const grid = input.showGrid ? gridStrokes(input.viewport, input.theme) : [];
  return {
    background: input.theme.bg,
    fills: [...g.fills, ...o.fills],
    strokes: [...grid, ...g.strokes, ...o.strokes],
    labels: [...g.labels, ...o.labels],
  };
}

/** Caixa de todas as paredes do nível, para "enquadrar tudo". */
export function levelBox(p: Project, levelId: Id): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const pts = wallsOnLevel(p, levelId).flatMap((w) => [w.a, w.b]);
  if (!pts.length) return null;
  const b = boxOf(pts);
  const pad = 0.5;
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}

/**
 * Caixa para enquadrar a planta na vista: a de `levelBox` mais as cotas. A linha de cota fica deslocada das paredes
 * (`offset`), então sem ela o "Enquadrar" cortava as cotas da borda e deixava a barra de escala por cima delas.
 */
export function levelFrameBox(p: Project, levelId: Id): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const base = levelBox(p, levelId);
  const pts: Vec2[] = [];
  for (const d of levelDimensions(p, levelId)) {
    const { a, b } = dimensionPoints(p, d);
    const n = perp(norm(sub(b, a)));
    pts.push(a, b, add(a, mul(n, d.offset)), add(b, mul(n, d.offset)));
  }
  if (!pts.length) return base;
  if (base) pts.push({ x: base.minX, y: base.minY }, { x: base.maxX, y: base.maxY });
  const b = boxOf(pts);
  const pad = 0.5;
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}
