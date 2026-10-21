import { difference, orientedRect, union, type MultiPolygon } from '@hestia/geom';
import {
  classifyLevelEntries,
  frameOfWall,
  openingGeometry,
  resolveFloors,
  resolveLevel,
  resolveRoofs,
  resolveSlabs,
  resolveStairsOnLevel,
  type OpeningGeometry,
  type ResolvedLevel,
  type ViewClass,
} from '@hestia/engine';
import { isOpening, isWall, levelElevation, viewRangeOf, wallsOnLevel, type Id, type Project, type ViewRange } from '@hestia/model';
import { roofFootprint } from './roofs.ts';
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

/**
 * Contorno fantasma dos elementos selecionados que estão fora do intervalo de vista (decisão 0013 §4). O aviso "Selecionar"
 * põe os ocultos na seleção, mas a planta não os desenha; aqui cada um ganha o contorno da sua categoria, sem
 * preenchimento e em tracejado fino na cor de seleção. Parede: o contorno inteiro (a geometria da vista não resolve as
 * ocultas, então elas são resolvidas à parte, como contorno); abertura: o vão sobre a parede; piso, laje, telhado e escada:
 * a pegada, a mesma que a planta usa para o destaque. Elementos visíveis ou de outro nível não entram.
 */
export function hiddenSelectionOps(p: Project, levelId: Id, view: PlanView, selection: readonly Id[], theme: PlanTheme): StrokeOp[] {
  const ids = selection.filter((id) => view.hidden.has(id));
  if (ids.length === 0) return [];
  // A planta chama esta função a cada quadro (pan, zoom, hover) enquanto há um oculto selecionado. O resultado depende
  // só da vista (um objeto por projeto e nível), dos ids e da cor: guarda-se por vista e o quadro seguinte reaproveita.
  const key = `${levelId}|${theme.select}|${ids.join(',')}`;
  const memoOf = ghostMemo.get(view) ?? new Map<string, StrokeOp[]>();
  ghostMemo.set(view, memoOf);
  const hit = memoOf.get(key);
  if (hit) return hit;
  const out = ghostOps(p, levelId, view, ids, theme);
  if (memoOf.size >= GHOST_MEMO_LIMIT) memoOf.delete(memoOf.keys().next().value as string);
  memoOf.set(key, out);
  return out;
}

/** Contornos fantasma por vista (ver `hiddenSelectionOps`): até `GHOST_MEMO_LIMIT` seleções por vista. */
const ghostMemo = new WeakMap<PlanView, Map<string, StrokeOp[]>>();
const GHOST_MEMO_LIMIT = 8;

/** Contorno fantasma dos ocultos `ids` (já filtrados): sem memo, ver `hiddenSelectionOps`. */
function ghostOps(p: Project, levelId: Id, view: PlanView, ids: Id[], theme: PlanTheme): StrokeOp[] {
  const style: OutlineStyle = { widthPx: 1, color: theme.select, alpha: 0.9, dash: [5, 3] };
  const out: StrokeOp[] = [];
  const addRings = (m: MultiPolygon): void => {
    for (const ring of m.flat()) out.push({ pts: ring, closed: true, ...style });
  };
  const wallIds = ids.filter((id) => isWall(p.elements[id]));
  if (wallIds.length > 0) {
    // Mesmo corte da vista; as ocultas entram como contorno (`outlineWalls`), então o `fragment` é a parede inteira.
    const geo = resolveLevel(p, levelId, undefined, { cutZ: view.cutZ, planOpenings: new Set<Id>(), outlineWalls: new Set<Id>(wallIds) });
    for (const id of wallIds) addRings(union(...(geo.walls[id]?.layers ?? []).map((l) => l.fragment)));
  }
  const footprints = new Map<Id, MultiPolygon>();
  for (const f of resolveFloors(p, levelId)) footprints.set(f.floorId, f.polygon);
  for (const s of resolveSlabs(p, levelId)) footprints.set(s.slabId, s.polygon);
  for (const r of resolveRoofs(p, levelId)) footprints.set(r.roofId, roofFootprint(r));
  for (const s of resolveStairsOnLevel(p, levelId)) footprints.set(s.id, s.footprint);
  for (const id of ids) {
    const e = p.elements[id];
    if (isOpening(e)) {
      const f = frameOfWall(p, e.hostId);
      if (!f) continue;
      const g = openingGeometry(p, e, f);
      out.push({ pts: orientedRect(g.center.x, g.center.y, g.u.x, g.u.y, g.width / 2, g.thickness / 2 + 0.02), closed: true, ...style });
      continue;
    }
    const m = footprints.get(id);
    if (m) addRings(m);
  }
  return out;
}
