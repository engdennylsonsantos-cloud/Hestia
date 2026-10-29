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

  // Seleção (pisos: destaque próprio; paredes e aberturas em elementHighlight).
  add(floorSelectionOps(p, input.levelId, selection, null, theme, input.viewport, hidden));
  const rmsel = roomSelectionOps(p, input.levelId, selection, null, theme, hidden);
  out.fills.push(...rmsel.fills);
  out.strokes.push(...rmsel.strokes);
  add(slabSelectionOps(p, input.levelId, selection, null, theme, input.viewport, hidden));
  if (up) add(ceilingSelectionOps(p, input.levelId, selection, null, theme, input.viewport, hidden));
  add(roofSelectionOps(p, input.levelId, selection, null, theme, input.viewport, roofHidden, style.paint.roof));
  add(stairSelectionOps(p, stairs, selection, null, theme, input.viewport));
  if (selection.length) {
    out.fills.push(...elementHighlight(p, geo, selection, theme.select, 0.26, view));
    for (const id of selection) {
      const e = p.elements[id];
      if (!isWall(e) || hidden?.has(id)) continue;
      for (const ring of ringsOf(wallUnion(geo, id, view?.outlineWalls.has(id) === true))) out.strokes.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
      // Alças nas pontas do eixo e nos cantos visíveis (a ponta que se vê): é lá que o arrasto pega a parede.
      const corners = wallEndCorners(p, e);
      for (const pt of [e.a, e.b, ...corners.a, ...corners.b] as Vec2[]) {
        const q = quadradoEm(pt, ALCA_PX);
        out.fills.push({ ...q.fill, color: '#ffffff', alpha: 1 });
        out.strokes.push({ ...q.traco, widthPx: 1.6, color: theme.select, alpha: 1 });
      }
    }
  }
  return out;
}

/** Sobreposição do alvo sob o cursor. Só o elemento em hover (o selecionado não se repete). */
export function buildPlanHoverOverlay(input: PlanInput): PlanOps {
  const { project: p, theme } = input;
  const { geo, hidden, up, roofHidden, stairs, ramps, view, style } = planContext(input);
  const hover = input.hover;
  if (!hover || input.selection.includes(hover)) return vazio();
  const out = vazio();
  const add = (o: PlanOps): void => {
    out.fills.push(...o.fills);
    out.strokes.push(...o.strokes);
    out.labels.push(...o.labels);
  };
  add(floorSelectionOps(p, input.levelId, [], hover, theme, input.viewport, hidden));
  const rmsel = roomSelectionOps(p, input.levelId, [], hover, theme, hidden);
  out.fills.push(...rmsel.fills);
  out.strokes.push(...rmsel.strokes);
  add(slabSelectionOps(p, input.levelId, [], hover, theme, input.viewport, hidden));
  if (up) add(ceilingSelectionOps(p, input.levelId, [], hover, theme, input.viewport, hidden));
  add(roofSelectionOps(p, input.levelId, [], hover, theme, input.viewport, roofHidden, style.paint.roof));
  add(stairSelectionOps(p, stairs, [], hover, theme, input.viewport));
  add(rampSelectionOps(p, ramps, [], hover, theme, input.viewport));
  out.fills.push(...elementHighlight(p, geo, [hover], theme.select, 0.16, view));
  return out;
}

/** Sobreposição viva da ferramenta: pré-visualização, guias, marcador de captura e o balão de inferência. */
export function buildPlanLiveOverlay(input: PlanInput): PlanOps {
  const { project: p, theme } = input;
  const { geo, view } = planContext(input);
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
  const add = (o: PlanOps): void => {
    out.fills.push(...o.fills);
    out.strokes.push(...o.strokes);
    out.labels.push(...o.labels);
  };

  // Hover e seleção (pisos: destaque próprio; paredes e aberturas em elementHighlight).
  add(floorSelectionOps(p, input.levelId, selection, hover, theme, v, hidden));
  const rmsel = roomSelectionOps(p, input.levelId, selection, hover, theme, hidden);
  out.fills.push(...rmsel.fills);
  out.strokes.push(...rmsel.strokes);
  add(slabSelectionOps(p, input.levelId, selection, hover, theme, v, hidden));
  if (up) add(ceilingSelectionOps(p, input.levelId, selection, hover, theme, v, hidden));
  add(roofSelectionOps(p, input.levelId, selection, hover, theme, v, roofHidden, style.paint.roof));
  add(stairSelectionOps(p, stairs, selection, hover, theme, v));
  add(rampSelectionOps(p, ramps, selection, hover, theme, v));
  if (hover && !selection.includes(hover)) out.fills.push(...elementHighlight(p, geo, [hover], theme.select, 0.16, view));
  if (selection.length) {
    out.fills.push(...elementHighlight(p, geo, selection, theme.select, 0.26, view));
    for (const id of selection) {
      const e = p.elements[id];
      if (!isWall(e) || hidden?.has(id)) continue;
      for (const ring of ringsOf(wallUnion(geo, id, view?.outlineWalls.has(id) === true))) out.strokes.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
      const corners = wallEndCorners(p, e);
      for (const pt of [e.a, e.b, ...corners.a, ...corners.b] as Vec2[]) {
        const q = quadradoEm(pt, ALCA_PX);
        out.fills.push({ ...q.fill, color: '#ffffff', alpha: 1 });
        out.strokes.push({ ...q.traco, widthPx: 1.6, color: theme.select, alpha: 1 });
      }
    }
  }

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
