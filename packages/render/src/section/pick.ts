import { boxOf, closestOnSegment, pointInMulti, type Box, type MultiPolygon, type Vec2 } from '@hestia/geom';
import type { SectionOrigin, SectionResult } from '@hestia/engine';
import type { GraphicsCategory, Id } from '@hestia/model';

/**
 * Seleção nos cortes e elevações (decisão 0016, seção "Seleção em cortes e elevações"). Trabalha só com o resultado
 * do motor: os polígonos visíveis (linha oculta já aplicada) e a origem de cada item. Não recalcula geometria.
 */

/** Elemento sob o ponto: o id do modelo e a categoria gráfica (parede, porta, janela, piso, laje, telhado, escada). */
export interface SectionPick {
  id: Id;
  kind: GraphicsCategory;
}

/** Item visível de um corte ou elevação, com os elementos que o originaram (o dono ou, no corte unido, as origens). */
export interface SectionItem {
  /** Distância do plano (0 no corte). */
  depth: number;
  /** Empate na mesma profundidade: corte (0), vão (1), além (2). Mesma ordem da oclusão no motor. */
  rank: number;
  polygons: MultiPolygon;
  /** Donos do item, na ordem de `sources` do motor. Vazio só se o motor não trouxer origem (não é pickable). */
  owners: SectionPick[];
  box: Box;
}

/** Ordem de empate da oclusão no motor (`OCCLUSION_RANK` em sectionOcclusion.ts): corte, vão, além. */
const RANK = { cut: 0, opening: 1, beyond: 2 } as const;

const CATEGORY_OF: Array<[keyof SectionOrigin, GraphicsCategory]> = [
  ['wallId', 'wall'],
  ['floorId', 'floor'],
  ['slabId', 'slab'],
  ['roofId', 'roof'],
  ['stairId', 'stair'],
];

/** Id e categoria de uma origem. A categoria de uma abertura vem do tipo (porta ou janela), não da origem. */
export function ownerOf(o: SectionOrigin, openingKind?: GraphicsCategory): SectionPick | null {
  if (o.openingId !== undefined) return { id: o.openingId, kind: openingKind ?? 'window' };
  for (const [field, kind] of CATEGORY_OF) {
    const id = o[field];
    if (id !== undefined) return { id, kind };
  }
  return null;
}

/**
 * Itens visíveis do corte, na ordem do picking: do mais perto ao mais longe (profundidade), e em empate corte antes de
 * vão antes do além. É a inversa da ordem de pintura de `buildSectionDrawList`, que pinta o mais longe por último...
 * não: pinta o mais longe primeiro e o corte por último; por isso aqui o corte vem primeiro.
 */
export function sectionItems(s: SectionResult): SectionItem[] {
  const items: Array<SectionItem & { order: number }> = [];
  const push = (item: Omit<SectionItem, 'box'>): void => {
    if (item.polygons.length === 0 || item.owners.length === 0) return;
    items.push({ ...item, box: boxOf(item.polygons.flatMap((p) => p.flatMap((r) => r))), order: items.length });
  };
  for (const r of s.cut) {
    const owners = r.sources.map((o) => ownerOf(o)).filter((o): o is SectionPick => o !== null);
    push({ depth: 0, rank: RANK.cut, polygons: r.polygons, owners: uniquePicks(owners) });
  }
  for (const o of s.openings) {
    push({ depth: o.depth, rank: RANK.opening, polygons: o.polygons, owners: [{ id: o.openingId, kind: o.kind === 'door' ? 'door' : 'window' }] });
  }
  for (const b of s.beyond) {
    const owner = ownerOf(b);
    push({ depth: b.depth, rank: RANK.beyond, polygons: b.polygons, owners: owner ? [owner] : [] });
  }
  items.sort((x, y) => x.depth - y.depth || x.rank - y.rank || x.order - y.order);
  return items.map(({ order: _order, ...item }) => item);
}

/** Donos sem repetição (por id e categoria), na ordem da primeira aparição. */
function uniquePicks(list: SectionPick[]): SectionPick[] {
  const seen = new Set<string>();
  return list.filter((o) => {
    const key = `${o.kind}|${o.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Distância do ponto à borda do multipolígono (zero se a borda passa por ele). */
function distanceToBoundary(p: Vec2, m: MultiPolygon): number {
  let best = Infinity;
  for (const poly of m) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!;
        const b = ring[(i + 1) % ring.length]!;
        const c = closestOnSegment(p, a, b);
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < best) best = d;
      }
    }
  }
  return best;
}

/**
 * Elemento sob o ponto (t, z) do corte ou da elevação. Testa os polígonos visíveis do mais perto ao mais longe:
 * primeiro o interior (o que está visível sob o ponto ganha), depois, se nada contém o ponto, a borda a `tolerance`
 * (unidades do desenho: o chamador converte 4 px com `4 / zoom`). Itens totalmente ocultos não entram (não são
 * pickable, intencional).
 *
 * Corte unido: um material pode unir várias origens num único polígono, e o motor não dá o polígono de cada uma.
 * Nesse caso o id é a primeira de `sources` (limitação documentada: a seleção pode apontar para a origem vizinha
 * do mesmo material).
 */
export function pickSection(s: SectionResult, point: Vec2, tolerance = 0): SectionPick | null {
  const items = sectionItems(s);
  const inside = items.find((it) => contains(it, point));
  if (inside) return inside.owners[0]!;
  if (tolerance <= 0) return null;
  const near = items.find((it) => {
    const b = it.box;
    if (point.x < b.minX - tolerance || point.x > b.maxX + tolerance || point.y < b.minY - tolerance || point.y > b.maxY + tolerance) return false;
    return distanceToBoundary(point, it.polygons) <= tolerance;
  });
  return near ? near.owners[0]! : null;
}

function contains(it: SectionItem, p: Vec2): boolean {
  const b = it.box;
  if (p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY) return false;
  return pointInMulti(p, it.polygons);
}
