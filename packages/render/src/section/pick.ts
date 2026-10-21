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

/** Item visível de um corte ou elevação, com os elementos que o originaram. */
export interface SectionItem {
  /** Distância do plano (0 no corte). */
  depth: number;
  /** Empate na mesma profundidade: corte (0), vão (1), além (2). Mesma ordem da oclusão no motor. */
  rank: number;
  polygons: MultiPolygon;
  /** Donos do item: um para parede, piso, laje, telhado, escada e vão; no corte unido, as origens de `sources`. */
  owners: SectionPick[];
  box: Box;
}

/** Ordem de empate da oclusão no motor (`OCCLUSION_RANK` em sectionOcclusion.ts): corte, vão, além. */
const RANK = { cut: 0, opening: 1, beyond: 2 } as const;

const OWNER_FIELDS: Array<[Exclude<keyof SectionOrigin, 'openingId'>, GraphicsCategory]> = [
  ['wallId', 'wall'],
  ['floorId', 'floor'],
  ['slabId', 'slab'],
  ['roofId', 'roof'],
  ['stairId', 'stair'],
];

/** Dono de uma origem do motor (parede, piso, laje, telhado ou escada); null se a origem não traz id. */
export function ownerOf(o: SectionOrigin): SectionPick | null {
  for (const [field, kind] of OWNER_FIELDS) {
    const id = o[field];
    if (id !== undefined) return { id, kind };
  }
  return null;
}

/**
 * Itens visíveis do corte, na ordem do picking: do mais perto ao mais longe (profundidade); em empate, corte antes de
 * vão e vão antes do além; por fim, a ordem da lista do motor. É a ordem de oclusão do motor, então o que está na
 * frente vem primeiro (a pintura faz o inverso: o mais longe primeiro e o corte por último).
 */
export function sectionItems(s: SectionResult): SectionItem[] {
  const items: Array<SectionItem & { order: number }> = [];
  const push = (depth: number, rank: number, polygons: MultiPolygon, owners: SectionPick[]): void => {
    if (polygons.length === 0 || owners.length === 0) return;
    items.push({ depth, rank, polygons, owners, box: boxOf(polygons.flatMap((p) => p.flatMap((r) => r))), order: items.length });
  };
  for (const r of s.cut) {
    const owners = uniquePicks(r.sources.map(ownerOf).filter((o): o is SectionPick => o !== null));
    push(0, RANK.cut, r.polygons, owners);
  }
  for (const o of s.openings) push(o.depth, RANK.opening, o.polygons, [{ id: o.openingId, kind: o.kind === 'door' ? 'door' : 'window' }]);
  for (const b of s.beyond) {
    const owner = ownerOf(b);
    push(b.depth, RANK.beyond, b.polygons, owner ? [owner] : []);
  }
  items.sort((x, y) => x.depth - y.depth || x.rank - y.rank || x.order - y.order);
  return items;
}

/** Donos sem repetição (por categoria e id), na ordem da primeira aparição. */
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
        const c = closestOnSegment(p, ring[i]!, ring[(i + 1) % ring.length]!);
        best = Math.min(best, Math.hypot(p.x - c.x, p.y - c.y));
      }
    }
  }
  return best;
}

/** Interior de um item: caixa envolvente primeiro (barato), depois o teste exato com furos. */
function containsPoint(it: SectionItem, p: Vec2): boolean {
  const b = it.box;
  if (p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY) return false;
  return pointInMulti(p, it.polygons);
}

/**
 * Elemento sob o ponto (t, z) do corte ou da elevação. Duas passagens sobre os itens visíveis, cada uma do mais perto
 * ao mais longe: primeiro o interior (o que está visível sob o ponto ganha); se nenhum contém o ponto, a borda a
 * `tolerance` (unidades do desenho: o chamador converte os 4 px com `4 / zoom`). Itens totalmente ocultos não entram:
 * não são selecionáveis, intencional.
 *
 * Corte unido: o motor une por material e não dá o polígono de cada origem, então, com várias origens, o id é a
 * primeira de `sources` (limitação documentada na decisão 0016).
 */
export function pickSection(s: SectionResult, point: Vec2, tolerance = 0): SectionPick | null {
  const items = sectionItems(s);
  const inside = items.find((it) => containsPoint(it, point));
  if (inside) return inside.owners[0]!;
  if (tolerance <= 0) return null;
  const near = items.find((it) => {
    const b = it.box;
    if (point.x < b.minX - tolerance || point.x > b.maxX + tolerance || point.y < b.minY - tolerance || point.y > b.maxY + tolerance) return false;
    return distanceToBoundary(point, it.polygons) <= tolerance;
  });
  return near ? near.owners[0]! : null;
}
