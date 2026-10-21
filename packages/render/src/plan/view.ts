import { difference, union, type MultiPolygon } from '@hestia/geom';
import { classifyLevelEntries, resolveLevel, type OpeningGeometry, type ResolvedLevel, type ViewClass } from '@hestia/engine';
import { levelElevation, viewRangeOf, wallsOnLevel, type Id, type Project, type ViewRange } from '@hestia/model';
import { openingSymbol } from './symbols.ts';
import type { PlanTheme, StrokeOp } from './types.ts';

/** Estados de parede que a planta desenha só como contorno (fora do corte, dentro do intervalo). */
type OutlineClass = 'projection-above' | 'projection-below' | 'beyond';

/** Contorno de paredes de um estado fora do corte: a área (já sem a parte sobre a silhueta cortada). */
interface OutlineShape {
  cls: OutlineClass;
  shape: MultiPolygon;
}

/**
 * Vista da planta de um nível (decisão 0013): o intervalo do nível (`viewRangeOf`), as cotas absolutas do corte e do
 * topo, o estado de cada elemento na vista e a geometria de planta resolvida com essas opções.
 */
export interface PlanView {
  range: ViewRange;
  /** Cota absoluta do plano de corte: elevação do nível mais `cut`. */
  cutZ: number;
  /** Cota absoluta do topo: elevação do nível mais `top`. */
  topZ: number;
  /** Estado de cada elemento do nível (paredes, aberturas, pisos, lajes, telhados e escadas). */
  cls: ReadonlyMap<Id, ViewClass>;
  /** Elementos fora do intervalo (`hidden`): não são desenhados. */
  hidden: ReadonlySet<Id>;
  /** Paredes fora do corte e dentro do intervalo: só contorno (projeção ou "além"). */
  outlineWalls: ReadonlySet<Id>;
  /** Contornos das paredes fora do corte, por estado (ver `wallOutlineOps`). */
  outlines: OutlineShape[];
  /** Geometria do nível para a planta, resolvida com o corte e as aberturas da vista. */
  geo: ResolvedLevel;
}

/** Uma vista por projeto e nível: o projeto é imutável (cada edição cria outro objeto), então o cache não envelhece. */
const memo = new WeakMap<Project, Map<Id, PlanView>>();

const OUTLINE_CLASSES: OutlineClass[] = ['projection-above', 'projection-below', 'beyond'];

function computePlanView(p: Project, levelId: Id): PlanView {
  const range = viewRangeOf(p, levelId);
  const elevation = levelElevation(p, levelId);
  const cutZ = elevation + range.cut;
  const cls = new Map<Id, ViewClass>();
  const hidden = new Set<Id>();
  const cutOpenings = new Set<Id>();
  const outlineWalls = new Set<Id>();
  // Mesma classificação de `openingsCrossingCut` (aberturas `cut`), numa só passada pelo nível.
  for (const e of classifyLevelEntries(p, levelId, range)) {
    cls.set(e.id, e.cls);
    if (e.cls === 'hidden') hidden.add(e.id);
    if (e.category === 'opening' && e.cls === 'cut') cutOpenings.add(e.id);
    if (e.category === 'wall' && e.cls !== 'cut' && e.cls !== 'hidden') outlineWalls.add(e.id);
  }
  const geo = resolveLevel(p, levelId, undefined, { cutZ, planOpenings: cutOpenings, outlineWalls });
  // Silhueta cortada: o contorno das paredes fora do corte não deve riscá-la.
  const cutSilhouette = union(...geo.clusters.map((c) => c.silhouette));
  const walls = wallsOnLevel(p, levelId);
  const outlines: OutlineShape[] = [];
  for (const c of OUTLINE_CLASSES) {
    const parts: MultiPolygon[] = [];
    for (const w of walls) {
      if (cls.get(w.id) !== c) continue;
      for (const l of geo.walls[w.id]?.layers ?? []) parts.push(l.fragment);
    }
    if (parts.length === 0) continue;
    let shape = union(...parts);
    if (cutSilhouette.length > 0) shape = difference(shape, cutSilhouette);
    outlines.push({ cls: c, shape });
  }
  return { range, cutZ, topZ: elevation + range.top, cls, hidden, outlineWalls, outlines, geo };
}

/** Vista da planta do nível (memorizada por projeto). */
export function planViewOf(p: Project, levelId: Id): PlanView {
  let byLevel = memo.get(p);
  if (!byLevel) {
    byLevel = new Map();
    memo.set(p, byLevel);
  }
  let view = byLevel.get(levelId);
  if (!view) {
    view = computePlanView(p, levelId);
    byLevel.set(levelId, view);
  }
  return view;
}

type OutlineStyle = Omit<StrokeOp, 'pts' | 'closed'>;

/**
 * Contorno das paredes fora do corte (decisão 0013 §4): projeção acima do corte tracejada e fina; abaixo do corte e
 * "além", linha fina clara (a "além", mais clara ainda). Sem preenchimento. A parte que cai sobre a silhueta cortada já
 * saiu em `computePlanView`.
 */
export function wallOutlineOps(view: PlanView, theme: PlanTheme): StrokeOp[] {
  const styles: Record<OutlineClass, OutlineStyle> = {
    'projection-above': { widthPx: 1, color: theme.inkSoft, alpha: 1, dash: [6, 3] },
    'projection-below': { widthPx: 1, color: theme.inkSoft, alpha: 0.8 },
    beyond: { widthPx: 1, color: theme.underlay, alpha: 0.9 },
  };
  const out: StrokeOp[] = [];
  for (const o of view.outlines) {
    for (const ring of o.shape.flat()) out.push({ pts: ring, closed: true, ...styles[o.cls] });
  }
  return out;
}

/**
 * Símbolo de uma abertura conforme o estado na vista (decisão 0013 §4). `cut`, ou sem classificação: símbolo normal.
 * `projection-above` (peitoril acima do corte): tracejado sobre a parede inteira. `projection-below` e `beyond`: símbolo
 * leve, na cor de traço secundária. `hidden`: nada.
 */
export function openingViewOps(g: OpeningGeometry, cls: ViewClass | undefined, theme: PlanTheme): StrokeOp[] {
  if (cls === 'hidden') return [];
  if (cls === 'projection-above') return openingSymbol(g, theme).map((s) => ({ ...s, dash: [6, 3] as [number, number] }));
  if (cls === 'projection-below' || cls === 'beyond') return openingSymbol(g, { ...theme, ink: theme.inkSoft });
  return openingSymbol(g, theme);
}
