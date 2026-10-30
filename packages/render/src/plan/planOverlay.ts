import { orientedRect, union, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { frameOfWall, openingGeometry, wallEndCorners, type ResolvedLevel } from '@hestia/engine';
import { isOpening, isWall, type Id, type Project } from '@hestia/model';
import { floorSelectionOps } from './floors.ts';
import { ALCA_PX, quadradoEm } from './marcadores.ts';
import { slabSelectionOps } from './slabs.ts';
import { roomSelectionOps } from './rooms.ts';
import { ceilingSelectionOps } from './ceilings.ts';
import { roofSelectionOps } from './roofs.ts';
import { stairSelectionOps } from './stairs.ts';
import { rampSelectionOps } from './ramps.ts';
import { guideStrokes, previewOverlay, snapMarker, snapTooltipLabel } from './overlay.ts';
import { hiddenSelectionOps, planViewOf, type PlanView } from './view.ts';
import { planContext } from './planContext.ts';
import { labelGhostOps } from './areaPlan.ts';
import { annotationHighlightOps, drawnAnnotations } from './notes.ts';
import type { PlanInput } from './build.ts';
import type { FillOp, PlanOps } from './types.ts';

const ringsOf = (m: MultiPolygon): Ring[] => m.flatMap((p) => p);

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

/** Operações de uma sobreposição: uma lista neutra com preenchimentos, traços e rótulos. */
const vazio = (): PlanOps => ({ fills: [], strokes: [], labels: [] });

/** Anotações que a vista desenha (as da vista, ou as do nível) e a escala de papel em que o bloco do texto é medido. */
function anotacoesDaVista(input: PlanInput, escala: number): { annotations: ReturnType<typeof drawnAnnotations>; scale: number } {
  return { annotations: drawnAnnotations(input.project, input.levelId, input.areaPlan), scale: input.areaPlan && input.areaPlan.scale > 0 ? input.areaPlan.scale : escala };
}

/** Junta o destaque das anotações (caixa, alça do texto e realce do hover) à sobreposição. */
function comAnotacoes(out: PlanOps, input: PlanInput, escala: number, target: { selection: readonly Id[]; hover: Id | null }): void {
  const { annotations, scale } = anotacoesDaVista(input, escala);
  const h = annotationHighlightOps(input.project, input.levelId, scale, { select: input.theme.select, paper: input.theme.bg, hoverColor: input.theme.selectHover }, target, annotations);
  out.fills.push(...h.fills);
  out.strokes.push(...h.strokes);
  out.labels.push(...h.labels);
}

/**
 * Sobreposição de seleção e hover. Não depende do cursor, da pré-visualização nem da captura: mudar o cursor refaz só a
 * camada viva (`buildPlanLiveOverlay`), e mudar o hover refaz só a camada de hover (`buildPlanHoverOverlay`), sem tocar
 * nos destaques da seleção nem na geometria do nível.
 */
export function buildPlanSelectionOverlay(input: PlanInput): PlanOps {
  const { project: p, theme } = input;
  const { geo, hidden, up, roofHidden, stairs, view, style } = planContext(input);
  const selection = input.selection;
  const out = vazio();
  const add = (o: PlanOps): void => {
    out.fills.push(...o.fills);
    out.strokes.push(...o.strokes);
    out.labels.push(...o.labels);
  };

  // A planta de área é de análise/anotação: destaca e seleciona o modelo, mas não desenha alças de mover.
  const alcasDeModelo = input.areaPlan === undefined;
  // Seleção (pisos: destaque próprio; paredes e aberturas em elementHighlight).
  add(floorSelectionOps(p, input.levelId, selection, null, theme, input.viewport, hidden, alcasDeModelo));
  const rmsel = roomSelectionOps(p, input.levelId, selection, null, theme, hidden);
  out.fills.push(...rmsel.fills);
  out.strokes.push(...rmsel.strokes);
  add(slabSelectionOps(p, input.levelId, selection, null, theme, input.viewport, hidden, alcasDeModelo));
  if (up) add(ceilingSelectionOps(p, input.levelId, selection, null, theme, input.viewport, hidden, alcasDeModelo));
  add(roofSelectionOps(p, input.levelId, selection, null, theme, input.viewport, roofHidden, style.paint.roof, alcasDeModelo));
  add(stairSelectionOps(p, stairs, selection, null, theme, input.viewport, alcasDeModelo));
  if (selection.length) {
    out.fills.push(...elementHighlight(p, geo, selection, theme.select, 0.26, view));
    for (const id of selection) {
      const e = p.elements[id];
      if (!isWall(e) || hidden?.has(id)) continue;
      for (const ring of ringsOf(wallUnion(geo, id, view?.outlineWalls.has(id) === true))) out.strokes.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
      // Alças nas pontas do eixo e nos cantos visíveis (a ponta que se vê): é lá que o arrasto pega a parede.
      if (!alcasDeModelo) continue;
      const corners = wallEndCorners(p, e);
      for (const pt of [e.a, e.b, ...corners.a, ...corners.b] as Vec2[]) {
        const q = quadradoEm(pt, ALCA_PX);
        out.fills.push({ ...q.fill, color: '#ffffff', alpha: 1 });
        out.strokes.push({ ...q.traco, widthPx: 1.6, color: theme.select, alpha: 1 });
      }
    }
  }
  // Anotações (textos e cotas): caixa de seleção, alça do texto e realce leve do hover em camada própria.
  comAnotacoes(out, input, style.scale, { selection, hover: null });
  return out;
}

/** Sobreposição do alvo sob o cursor. Só o elemento em hover (o selecionado não se repete). */
export function buildPlanHoverOverlay(input: PlanInput): PlanOps {
  const { project: p, theme } = input;
  const { geo, hidden, up, roofHidden, stairs, ramps, view, style } = planContext(input);
  const hover = input.hover;
  if (!hover || input.selection.includes(hover)) return vazio();
  const out = vazio();
  const alcasDeModelo = input.areaPlan === undefined;
  const add = (o: PlanOps): void => {
    out.fills.push(...o.fills);
    out.strokes.push(...o.strokes);
    out.labels.push(...o.labels);
  };
  add(floorSelectionOps(p, input.levelId, [], hover, theme, input.viewport, hidden, alcasDeModelo));
  const rmsel = roomSelectionOps(p, input.levelId, [], hover, theme, hidden);
  out.fills.push(...rmsel.fills);
  out.strokes.push(...rmsel.strokes);
  add(slabSelectionOps(p, input.levelId, [], hover, theme, input.viewport, hidden, alcasDeModelo));
  if (up) add(ceilingSelectionOps(p, input.levelId, [], hover, theme, input.viewport, hidden, alcasDeModelo));
  add(roofSelectionOps(p, input.levelId, [], hover, theme, input.viewport, roofHidden, style.paint.roof, alcasDeModelo));
  add(stairSelectionOps(p, stairs, [], hover, theme, input.viewport, alcasDeModelo));
  add(rampSelectionOps(p, ramps, [], hover, theme, input.viewport, alcasDeModelo));
  out.fills.push(...elementHighlight(p, geo, [hover], theme.select, 0.16, view));
  comAnotacoes(out, input, style.scale, { selection: [], hover });
  return out;
}

/** Sobreposição viva da ferramenta: pré-visualização, guias, marcador de captura e o balão de inferência. */
export function buildPlanLiveOverlay(input: PlanInput): PlanOps {
  const { project: p, theme } = input;
  const { geo, view, style } = planContext(input);
  const out = vazio();
  const previa = previewOverlay(input.preview, theme, (ids) => elementHighlight(p, geo, ids, theme.accent, 0.2, view));
  out.fills.push(...previa.fills);
  out.strokes.push(...previa.strokes);
  out.labels.push(...previa.labels);
  if (input.inference) {
    out.strokes.push(...guideStrokes(input.inference.guides, theme));
    out.strokes.push(...snapMarker(input.inference, theme));
    const tip = snapTooltipLabel(input.inference, p);
    if (tip) out.labels.push(tip);
  }
  if (input.tagGhost) {
    const ghost = labelGhostOps(p, input.levelId, input.tagGhost, input.areaPlan?.scale ?? style.scale, input.areaPlan?.graphics.tagDefault.fields, input.dark);
    out.fills.push(...ghost.fills);
    out.strokes.push(...ghost.strokes);
    out.labels.push(...ghost.labels);
  }
  return out;
}

/**
 * Sobreposição da planta completa (modo CPU, plotagem e testes), na mesma ordem de desenho de sempre: destaques de
 * seleção e hover, pré-visualização e inferência. Na tela, as três partes são camadas separadas da cena (`PlanFrame`),
 * para uma não refazer as outras.
 */
export function buildPlanOverlay(input: PlanInput): PlanOps {
  const { project: p, theme, viewport: v } = input;
  const { geo, hidden, up, roofHidden, stairs, ramps, view, style } = planContext(input);
  const { selection, hover } = input;
  const out = vazio();
  const alcasDeModelo = input.areaPlan === undefined;
  const add = (o: PlanOps): void => {
    out.fills.push(...o.fills);
    out.strokes.push(...o.strokes);
    out.labels.push(...o.labels);
  };

  // Hover e seleção (pisos: destaque próprio; paredes e aberturas em elementHighlight).
  add(floorSelectionOps(p, input.levelId, selection, hover, theme, v, hidden, alcasDeModelo));
  const rmsel = roomSelectionOps(p, input.levelId, selection, hover, theme, hidden);
  out.fills.push(...rmsel.fills);
  out.strokes.push(...rmsel.strokes);
  add(slabSelectionOps(p, input.levelId, selection, hover, theme, v, hidden, alcasDeModelo));
  if (up) add(ceilingSelectionOps(p, input.levelId, selection, hover, theme, v, hidden, alcasDeModelo));
  add(roofSelectionOps(p, input.levelId, selection, hover, theme, v, roofHidden, style.paint.roof, alcasDeModelo));
  add(stairSelectionOps(p, stairs, selection, hover, theme, v, alcasDeModelo));
  add(rampSelectionOps(p, ramps, selection, hover, theme, v, alcasDeModelo));
  if (hover && !selection.includes(hover)) out.fills.push(...elementHighlight(p, geo, [hover], theme.select, 0.16, view));
  if (selection.length) {
    out.fills.push(...elementHighlight(p, geo, selection, theme.select, 0.26, view));
    for (const id of selection) {
      const e = p.elements[id];
      if (!isWall(e) || hidden?.has(id)) continue;
      for (const ring of ringsOf(wallUnion(geo, id, view?.outlineWalls.has(id) === true))) out.strokes.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
      if (!alcasDeModelo) continue;
      const corners = wallEndCorners(p, e);
      for (const pt of [e.a, e.b, ...corners.a, ...corners.b] as Vec2[]) {
        const q = quadradoEm(pt, ALCA_PX);
        out.fills.push({ ...q.fill, color: '#ffffff', alpha: 1 });
        out.strokes.push({ ...q.traco, widthPx: 1.6, color: theme.select, alpha: 1 });
      }
    }
  }

  // Anotações (textos e cotas): caixa de seleção, alça do texto e realce leve do hover.
  comAnotacoes(out, input, style.scale, { selection, hover });

  // Pré-visualização, guias e marcador de captura.
  add(previewOverlay(input.preview, theme, (ids) => elementHighlight(p, geo, ids, theme.accent, 0.2, view)));
  if (input.inference) {
    out.strokes.push(...guideStrokes(input.inference.guides, theme));
    out.strokes.push(...snapMarker(input.inference, theme));
    const tip = snapTooltipLabel(input.inference, p);
    if (tip) out.labels.push(tip);
  }
  return out;
}

/**
 * Sobreposição da tela: a de `buildPlanOverlay` mais o contorno fantasma dos selecionados que estão fora do intervalo de
 * vista (decisão 0013 §4). A planta não os desenha; o fantasma vai por último, como antes.
 */
export function buildPlanScreenOverlay(input: PlanInput): PlanOps {
  const o = buildPlanOverlay(input);
  const ghosts = hiddenSelectionOps(input.project, input.levelId, planViewOf(input.project, input.levelId), input.selection, input.theme);
  return ghosts.length ? { ...o, strokes: [...o.strokes, ...ghosts] } : o;
}
