import { orientedRect, union, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { frameOfWall, openingGeometry, type ResolvedLevel } from '@hestia/engine';
import { isOpening, isWall, type Id, type Project } from '@hestia/model';
import { floorSelectionOps } from './floors.ts';
import { slabSelectionOps } from './slabs.ts';
import { roomSelectionOps } from './rooms.ts';
import { ceilingSelectionOps } from './ceilings.ts';
import { roofSelectionOps } from './roofs.ts';
import { stairSelectionOps } from './stairs.ts';
import { guideStrokes, previewOverlay, snapMarker, snapTooltipLabel } from './overlay.ts';
import { hiddenSelectionOps, planViewOf, type PlanView } from './view.ts';
import { planContext } from './planContext.ts';
import type { PlanInput } from './build.ts';
import type { FillOp, LabelOp, PlanOps, StrokeOp } from './types.ts';

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

/**
 * Sobreposição da planta: seleção, cursor, pré-visualização da ferramenta, guias, marcador de captura e o contorno
 * fantasma dos selecionados fora do intervalo de vista (decisão 0013 §4). Depende da seleção, do cursor e da ferramenta,
 * não da geometria: a cena a refaz sem tocar a geometria do nível (ver `PlanFrame`).
 */
export function buildPlanOverlay(input: PlanInput): PlanOps {
  const { project: p, viewport: v, theme } = input;
  const { geo, hidden, up, roofHidden, style, stairs, view } = planContext(input);
  const fills: FillOp[] = [];
  const strokes: StrokeOp[] = [];
  const labels: LabelOp[] = [];
  const add = (o: PlanOps): void => {
    fills.push(...o.fills);
    strokes.push(...o.strokes);
    labels.push(...o.labels);
  };

  // Hover e seleção (pisos: destaque próprio; paredes e aberturas em elementHighlight).
  add(floorSelectionOps(p, input.levelId, input.selection, input.hover, theme, v, hidden));
  const rmsel = roomSelectionOps(p, input.levelId, input.selection, input.hover, theme, hidden);
  fills.push(...rmsel.fills);
  strokes.push(...rmsel.strokes);
  add(slabSelectionOps(p, input.levelId, input.selection, input.hover, theme, v, hidden));
  if (up) add(ceilingSelectionOps(p, input.levelId, input.selection, input.hover, theme, v, hidden));
  add(roofSelectionOps(p, input.levelId, input.selection, input.hover, theme, v, roofHidden, style.paint.roof));
  add(stairSelectionOps(p, stairs, input.selection, input.hover, theme, v));
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
      for (const pt of [e.a, e.b] as Vec2[]) {
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
  add(previewOverlay(input.preview, v, theme, (ids) => elementHighlight(p, geo, ids, theme.accent, 0.2, view)));
  if (input.inference) {
    strokes.push(...guideStrokes(input.inference.guides, theme));
    strokes.push(...snapMarker(input.inference, v, theme));
    const tip = snapTooltipLabel(input.inference);
    if (tip) labels.push(tip);
  }
  return { fills, strokes, labels };
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
