import { boxOf, orientedRect, ringArea, union, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { cutLevelByJunction, frameOfWall, junctionLevel, openingGeometry, resolveRoofs, resolveStairsOnLevel, type ResolvedFloor, type ResolvedLevel, type ResolvedRoof, type ResolvedRoom, type ResolvedSlab } from '@hestia/engine';
import { isOpening, isWall, openingsOfWall, wallsOnLevel, type Id, type Project } from '@hestia/model';
import type { Inference, PreviewItem } from '@hestia/tools';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import { thinStrokes } from './thin.ts';
import { gridStrokes } from './grid.ts';
import { guideStrokes, previewOverlay, snapMarker, snapTooltipLabel } from './overlay.ts';
import { sectionMarksOf } from './sectionMarks.ts';
import { belowFloorOps, floorSelectionOps, type FloorOps } from './floors.ts';
import { slabSelectionOps } from './slabs.ts';
import { floorAndSlabOps } from './surfaces.ts';
import { belowRoomOps, roomOps, roomSelectionOps } from './rooms.ts';
import { ceilingFills, ceilingSelectionOps } from './ceilings.ts';
import { roofFills, roofFootprint, roofOps, roofSelectionOps } from './roofs.ts';
import { belowStairOps, stairFills, stairSelectionOps } from './stairs.ts';
import { joinDebugLabels } from './joinDebug.ts';
import { wallTagLabels } from './tags.ts';
import { noteOps } from './notes.ts';
import { openingViewOps, planViewOf, wallOutlineOps, type PlanView } from './view.ts';
import { paintOps, planStyleOf, surfaceColor, type PlanPaint } from './style.ts';
import type { FillOp, LabelOp, PlanDrawList, PlanTheme, StrokeOp } from './types.ts';

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

/** Espessura equivalente (2·área/perímetro) em pixels: decide quanto detalhe vale a pena desenhar. */
function thicknessPx(poly: Ring[], zoom: number): number {
  const outer = poly[0];
  if (!outer) return 0;
  let per = 0;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i]!;
    const b = outer[(i + 1) % outer.length]!;
    per += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return per > 0 ? ((2 * Math.abs(ringArea(outer))) / per) * zoom : 0;
}

/**
 * Forma da parede na planta: as camadas cortadas (`cut`) ou, para parede só de contorno, os fragmentos inteiros
 * (`fragment`, sem as aberturas).
 */
function wallUnion(geo: ResolvedLevel, id: Id, outline = false): MultiPolygon {
  const rw = geo.walls[id];
  if (!rw) return [];
  return outline ? union(...rw.layers.map((l) => l.fragment)) : union(...rw.layers.map((l) => l.cut));
}

function elementHighlight(p: Project, geo: ResolvedLevel, ids: Id[], color: string, alpha: number, view: PlanView | null): FillOp[] {
  const out: FillOp[] = [];
  for (const id of ids) {
    if (view?.hidden.has(id)) continue;
    const e = p.elements[id];
    if (isWall(e)) out.push({ polygons: wallUnion(geo, id, view?.outlineWalls.has(id) === true), color, alpha });
    else if (isOpening(e)) {
      const f = frameOfWall(p, e.hostId);
      if (!f) continue;
      const g = openingGeometry(p, e, f);
      out.push({ polygons: [[orientedRect(g.center.x, g.center.y, g.u.x, g.u.y, g.width / 2, g.thickness / 2 + 0.02)]], color, alpha });
    }
  }
  return out;
}

export function buildPlanDrawList(input: PlanInput): PlanDrawList {
  const { project: p, viewport: v, theme } = input;
  const fills: FillOp[] = [];
  const strokes: StrokeOp[] = [];
  const labels: LabelOp[] = [];
  const fillBase = input.dark ? theme.bg : '#ffffff';
  const fillT = input.dark ? 0.5 : 0.58;

  // Gráficos da vista do nível (decisão 0015): escala, detalhe, estilo visual e substituições por categoria, já em px.
  const style = planStyleOf(p, input.levelId, v.zoom);
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

  if (input.showGrid) strokes.push(...gridStrokes(v, theme));

  // Nível de detalhe (H3, decisão 0015 §2.2): grosseiro = um contorno preenchido por cluster, sem camadas, hachura nem
  // símbolos; médio = como antes; fino = linhas de camada sempre e hachura mesmo em zoom baixo.
  const fine = detail === 'fine';
  // Planta de cobertura (D6): sem traços por baixo nem paredes preenchidas; os telhados cobrem o que está embaixo.
  const rp = input.roofPlanMode === true;
  // Intervalo de vista do nível (decisão 0013): o que está fora dele não sai, e o corte da geometria é o da vista.
  // A planta de cobertura segue a geometria padrão, como antes.
  const view: PlanView | null = rp ? null : planViewOf(p, input.levelId);
  // Planta de forro (decisão 0021): vista para cima. Sem o que está embaixo do nível (referências apagadas) e com forros.
  const up = view?.range.direction === 'up';
  // Pavimento de baixo (referência) com as paredes cortadas pela junção dele, como a planta do nível.
  const below = up || !input.below ? null : cutLevelByJunction(input.below, junctionLevel(p, input.below.levelId));
  const geo: ResolvedLevel = view ? view.geo : input.resolved;
  const hidden = view?.hidden;
  // Telhados ocultos pela categoria (decisão 0015 §2.4): na planta de cobertura só eles são filtrados.
  const roofOff: ReadonlySet<Id> | undefined = view ? view.categoryHidden : paint.roof.visible ? undefined : new Set(resolveRoofs(p, input.levelId).map((r) => r.roofId));

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
  const stairs = resolveStairsOnLevel(p, input.levelId).filter((s) => !hidden?.has(s.id));
  if (below) {
    const bst = belowStairOps(resolveStairsOnLevel(p, below.levelId), theme);
    fills.push(...surfaces(bst.fills));
    if (!rp) strokes.push(...bst.strokes);
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
  addOps(roomOps(p, input.levelId, theme, input.dark, detail, v.zoom, style.scale, hidden, paint.room), paint.room, !rp);
  // Escadas do nível: depois dos pisos e lajes, antes das paredes (o degrau não cobre parede).
  addOps(stairFills(p, stairs, theme, input.dark, detail, v, view ? { cutZ: view.cutZ, topZ: view.topZ } : undefined, paint.stair, style.scale), paint.stair, !rp);
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
      const thick = Math.max(0, ...polys.map((poly) => thicknessPx(poly, v.zoom)));
      const hatchOn = m && m.hatch !== 'none' && (fine || (thick >= 5 && v.zoom >= 40));
      const hatch = hatchOn ? { kind: m.hatch, color: mix(paint.wall.color ?? m.color, input.dark ? '#ffffff' : '#000000', 0.45) } : undefined;
      wallOps.fills.push({ polygons: polys, color, alpha: 1, hatch });
      // Linhas de interface entre materiais: só onde cabem sem virar mancha (fino: sempre). Linhas finas: peso de projeção.
      for (const poly of polys) {
        if (!fine && thicknessPx(poly, v.zoom) < 1.6) continue;
        for (const ring of poly) wallOps.strokes.push({ pts: ring, closed: true, widthPx: paint.wall.projPx, color: mix(theme.ink, fillBase, 0.35), alpha: 1 });
      }
    }
    for (const ring of ringsOf(c.silhouette)) wallOps.strokes.push({ pts: ring, closed: true, widthPx: paint.wall.cutPx, color: theme.ink, alpha: 1 });
  }
  // Paredes fora do corte (decisão 0013 §4): contorno; projeção acima tracejada, abaixo e "além" em linha clara.
  if (view) wallOps.strokes.push(...wallOutlineOps(view, theme, paint.wall.projPx));

  // Membranas (camadas de espessura zero): linha fina tracejada no limite entre camadas (só no fino, paredes cortadas).
  if (fine && !rp) {
    for (const [id, rw] of Object.entries(geo.walls)) {
      if (view?.cls.get(id) !== 'cut') continue;
      for (const m of rw.membranes) wallOps.strokes.push({ pts: m.pts, closed: false, widthPx: paint.wall.projPx, color: theme.inkSoft, alpha: 0.9, dash: [6, 3] });
    }
  }
  addOps(wallOps, paint.wall, true);

  // Pontas com "não unir": marcador laranja discreto, para a junção esquecida desligada não passar despercebida.
  for (const w of rp ? [] : wallsOnLevel(p, input.levelId)) {
    if (hidden?.has(w.id)) continue;
    for (const [off, pt] of [[w.noJoinStart, w.a], [w.noJoinEnd, w.b]] as const) {
      if (!off) continue;
      const r = 5 / v.zoom;
      const ring: Vec2[] = Array.from({ length: 12 }, (_, i) => ({ x: pt.x + Math.cos((i * Math.PI) / 6) * r, y: pt.y + Math.sin((i * Math.PI) / 6) * r }));
      strokes.push({ pts: ring, closed: true, widthPx: 1.4, color: theme.guide, alpha: 0.95 });
      strokes.push({ pts: [{ x: pt.x - r * 0.7, y: pt.y - r * 0.7 }, { x: pt.x + r * 0.7, y: pt.y + r * 0.7 }], closed: false, widthPx: 1.4, color: theme.guide, alpha: 0.95 });
    }
  }

  // Símbolos das aberturas (fora do grosseiro): cortadas, tracejadas acima do corte, leves abaixo; as ocultas saem.
  // Cada um com o estilo da sua categoria (porta ou janela) e a espessura de corte ou de projeção.
  if (detail !== 'coarse' && !rp) {
    for (const w of wallsOnLevel(p, input.levelId)) {
      const f = frameOfWall(p, w.id);
      if (!f) continue;
      for (const o of openingsOfWall(p, w.id)) {
        const g = openingGeometry(p, o, f);
        const pt = paint[g.kind];
        const sym = openingViewOps(g, view?.cls.get(o.id), theme, { cutPx: pt.cutPx, projPx: pt.projPx });
        strokes.push(...paintOps({ fills: [], strokes: sym, labels: [] }, pt, fillBase).strokes);
      }
    }
  }

  // Telhados (D1): por cima das paredes e dos pisos (semitransparentes); as linhas notáveis saem por último.
  const roofHidden = view ? hidden : roofOff;
  const rf = roofFills(p, input.levelId, theme, input.dark, detail, v, {
    planMode: rp,
    hidden: roofHidden,
    categoryHidden: roofOff,
    showProjection: input.showRoofProjection !== false,
    paint: paint.roof,
  }, style.scale);
  addOps(rf, paint.roof, true);
  // Planta de cobertura: as paredes voltam por cima dos telhados só como contorno fino.
  if (rp && paint.wall.visible) {
    for (const c of geo.clusters) for (const ring of ringsOf(c.silhouette)) strokes.push({ pts: ring, closed: true, widthPx: paint.wall.projPx, color: theme.inkSoft, alpha: 0.8 });
  }

  // Linhas de corte e elevação: aparecem em todas as plantas, porque o corte atravessa os níveis. Seguem a categoria
  // 'anotação' (visibilidade, cor e peso) e a escala da vista, com geometria em mm de papel.
  const marks = sectionMarksOf(p, v, theme, paint.annotation, style.scale, input.selection);
  fills.push(...marks.fills);
  strokes.push(...marks.strokes);
  labels.push(...marks.labels);

  // Cotas e textos do nível (decisão 0019), com o estilo da categoria 'anotação'.
  const notes = noteOps(p, input.levelId, paint.annotation, { ink: theme.ink, select: theme.select, selection: input.selection }, v.zoom, style.scale);
  strokes.push(...notes.strokes);
  labels.push(...notes.labels);

  // Etiquetas de tipo (G4) seguem a categoria 'anotação' (visibilidade e mm de papel).
  if (p.settings.showTags) labels.push(...wallTagLabels(p, input.levelId, v.zoom, paint.annotation, style.scale, hidden));
  if (p.settings.debugJoins) labels.push(...joinDebugLabels(p, input.levelId));

  // Linhas finas (só na tela): os traços do modelo ficam com 1 px; o que vem depois (seleção, cursor, cotas temporárias,
  // pré-visualização e guias) mantém a largura própria.
  if (input.thinLines) thinStrokes(strokes);

  // Hover e seleção (pisos: destaque próprio; paredes e aberturas em elementHighlight).
  const fsel = floorSelectionOps(p, input.levelId, input.selection, input.hover, theme, v, hidden);
  fills.push(...fsel.fills);
  strokes.push(...fsel.strokes);
  labels.push(...fsel.labels);
  const rmsel = roomSelectionOps(p, input.levelId, input.selection, input.hover, theme, hidden);
  fills.push(...rmsel.fills);
  strokes.push(...rmsel.strokes);
  const lsel = slabSelectionOps(p, input.levelId, input.selection, input.hover, theme, v, hidden);
  fills.push(...lsel.fills);
  strokes.push(...lsel.strokes);
  labels.push(...lsel.labels);
  if (up) {
    const csel = ceilingSelectionOps(p, input.levelId, input.selection, input.hover, theme, v, hidden);
    fills.push(...csel.fills);
    strokes.push(...csel.strokes);
    labels.push(...csel.labels);
  }
  const rsel = roofSelectionOps(p, input.levelId, input.selection, input.hover, theme, v, roofHidden, paint.roof);
  fills.push(...rsel.fills);
  strokes.push(...rsel.strokes);
  labels.push(...rsel.labels);
  const ssel = stairSelectionOps(p, stairs, input.selection, input.hover, theme, v);
  fills.push(...ssel.fills);
  strokes.push(...ssel.strokes);
  labels.push(...ssel.labels);
  if (input.hover && !input.selection.includes(input.hover)) {
    fills.push(...elementHighlight(p, geo, [input.hover], theme.select, 0.16, view));
  }
  if (input.selection.length) {
    fills.push(...elementHighlight(p, geo, input.selection, theme.select, 0.26, view));
    for (const id of input.selection) {
      const e = p.elements[id];
      if (!isWall(e) || hidden?.has(id)) continue;
      for (const ring of ringsOf(wallUnion(geo, id, view?.outlineWalls.has(id) === true))) strokes.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
      if (input.selection.length === 1) {
        // Cota temporária: comprimento do eixo, como no Revit ao selecionar.
        const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
        labels.push({ at: { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 }, text: `${len.toFixed(3).replace('.', ',')} m`, dy: -12, tone: 'info' });
      }
      const half = 4.5 / v.zoom;
      for (const pt of [e.a, e.b]) {
        const sq: Vec2[] = [
          { x: pt.x - half, y: pt.y - half },
          { x: pt.x + half, y: pt.y - half },
          { x: pt.x + half, y: pt.y + half },
          { x: pt.x - half, y: pt.y + half },
        ];
        fills.push({ polygons: [[sq]], color: '#ffffff', alpha: 1 });
        strokes.push({ pts: sq, closed: true, widthPx: 1.6, color: theme.select, alpha: 1 });
      }
    }
  }

  // Pré-visualização, guias e marcador de captura.
  const ov = previewOverlay(input.preview, v, theme, (ids) => elementHighlight(p, geo, ids, theme.accent, 0.2, view));
  fills.push(...ov.fills);
  strokes.push(...ov.strokes);
  labels.push(...ov.labels);
  if (input.inference) {
    strokes.push(...guideStrokes(input.inference.guides, theme));
    strokes.push(...snapMarker(input.inference, v, theme));
    const tip = snapTooltipLabel(input.inference);
    if (tip) labels.push(tip);
  }
  return { background: theme.bg, fills, strokes, labels };
}

/** Caixa de todas as paredes do nível, para "enquadrar tudo". */
export function levelBox(p: Project, levelId: Id): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const pts = wallsOnLevel(p, levelId).flatMap((w) => [w.a, w.b]);
  if (!pts.length) return null;
  const b = boxOf(pts);
  const pad = 0.5;
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}
