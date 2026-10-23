import { union, type MultiPolygon } from '@hestia/geom';
import type { Id, Project } from '@hestia/model';
import type { LayerBand, ResolvedLayer, ResolvedWall } from './types.ts';
import { levelCutterSet, type SolidPiece } from './junctionNet.ts';
import { resolveJunction, type PlanarPiece, type ResolvedPrism } from './junctionPlanar.ts';

/**
 * Junção resolvida de um nível (decisão 0023 §3 e §10, P7b). Uma função única para planta, corte e 3D: cada camada de
 * piso e de laje sai com as partes em que ela existe, já recortadas pela camada que a vence (`resolveJunction`). Sem
 * sobreposição de elementos, nada é recortado e o desenho segue o original (`cut` falso).
 */

/** Partes de uma camada depois da junção: planta e faixa de cota (absoluta) em que ela existe. Vazio: camada vencida. */
export interface LayerParts {
  layerIndex: number;
  parts: ResolvedPrism[];
}

/** Piso ou laje com a junção resolvida. `cut` falso: nenhuma camada foi recortada, então vale o desenho original. */
export interface ElementJunction {
  cut: boolean;
  layers: LayerParts[];
  /** União, em planta, das partes de todas as camadas (a região que o elemento ocupa depois do corte). Vazia sem corte. */
  region: MultiPolygon;
}

/**
 * Junção de uma parede: partes resolvidas de cada faixa de cada camada (chave `bandKey`). Faixa ausente, ou parede sem
 * `cut`, vale a faixa inteira (como antes). Faixas com topo inclinado não entram: a cota delas não se recorta plano.
 */
export interface WallJunction {
  cut: boolean;
  bands: ReadonlyMap<string, ResolvedPrism[]>;
}

/** Junção do nível: piso e laje pelo id do elemento, paredes pelo id da parede (decisão 0023 §3, F1). */
export interface JunctionLevel {
  levelId: Id;
  elements: ReadonlyMap<Id, ElementJunction>;
  walls: ReadonlyMap<Id, WallJunction>;
}

/** Chave de uma faixa dentro de uma parede: camada e faixa de altura, como vêm de `ResolvedWall`. */
export const bandKey = (layerIndex: number, bandIndex: number): string => `${layerIndex}/${bandIndex}`;

/**
 * Entrada da junção: a peça no plano e a camada de origem. Para piso e laje, `layerIndex` é a camada do elemento; para
 * parede, `wall` leva a parede e a chave da faixa, e `flat` diz se a faixa tem cota constante (recortável).
 */
interface Tagged {
  piece: PlanarPiece;
  layerIndex: number;
  wall?: { id: Id; key: string; flat: boolean };
}

const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Peça plana de uma peça de sólido: a faixa de cota é a envolvente dos vértices. Membrana (espessura zero) fica de fora. */
function planarOf(sp: SolidPiece): PlanarPiece | null {
  const meta = sp.meta;
  if (!meta || sp.poly.length === 0) return null;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const poly of sp.poly) {
    for (const ring of poly) {
      for (const v of ring) {
        const [a, b] = sp.span(v);
        z0 = Math.min(z0, a);
        z1 = Math.max(z1, b);
      }
    }
  }
  if (!(z1 - z0 > 1e-9)) return null;
  return { meta: { kind: meta.kind, priority: meta.priority, core: meta.core }, poly: sp.poly, z0, z1, owner: meta.owner };
}

/** Assinatura do conteúdo das peças (camada, faixa, prioridade e contorno): muda quando o nível muda. */
function signature(tagged: readonly Tagged[]): string {
  return tagged
    .map(({ piece: t, layerIndex }) => {
      const poly = t.poly.map((p) => p.map((ring) => ring.map((v) => `${r6(v.x)},${r6(v.y)}`).join(' ')).join('/')).join('#');
      return `${t.owner}|${layerIndex}|${t.meta.kind}|${t.meta.priority}|${t.meta.core ? 1 : 0}|${r6(t.z0)}|${r6(t.z1)}|${poly}`;
    })
    .join('\n');
}

/** Cache por nível e por conteúdo (como o circuito de ambientes, decisão 0023 §11): nível não editado = mesmo resultado. */
const levelCache = new Map<Id, { sig: string; value: JunctionLevel }>();

/**
 * Junção resolvida do nível. Pisos e lajes com camadas recortadas pela de maior prioridade (`resolveJunction`); lajes
 * com caimento ficam de fora, porque a faixa inclinada não se recorta por aproximação plana (quantitativos já integram).
 * Paredes cortam pisos e lajes pela faixa de cada faixa de parede (o topo inclinado usa o ponto mais alto).
 */
export function junctionLevel(p: Project, levelId: Id): JunctionLevel {
  // Cortadores do nível e dos níveis que o alcançam (F1b). Laje com caimento fica de fora da junção.
  const tagged: Tagged[] = [];
  const cutters = levelCutterSet(p, levelId);
  for (const sp of [...cutters.floors, ...cutters.slabs, ...cutters.walls].flatMap((c) => c.pieces)) {
    const meta = sp.meta;
    if (!meta || (meta.kind === 'slab' && !sp.flat)) continue;
    const piece = planarOf(sp);
    if (!piece) continue;
    const layerIndex = meta.layerIndex ?? -1;
    tagged.push(
      meta.kind === 'wall'
        ? { piece, layerIndex, wall: { id: meta.owner, key: bandKey(layerIndex, meta.bandIndex ?? 0), flat: sp.flat } }
        : { piece, layerIndex },
    );
  }

  const sig = signature(tagged);
  const hit = levelCache.get(levelId);
  if (hit && hit.sig === sig) return hit.value;

  const res = resolveJunction(tagged.map((t) => t.piece));
  const elements = new Map<Id, ElementJunction>();
  const walls = new Map<Id, { cut: boolean; bands: Map<string, ResolvedPrism[]> }>();
  tagged.forEach(({ piece, layerIndex, wall }, i) => {
    const parts = res[i]!;
    const untouched = parts.length === 1 && parts[0]!.poly === piece.poly;
    if (wall) {
      const wj = walls.get(wall.id) ?? { cut: false, bands: new Map<string, ResolvedPrism[]>() };
      if (wall.flat) {
        if (!untouched) wj.cut = true;
        wj.bands.set(wall.key, parts);
      }
      walls.set(wall.id, wj);
      return;
    }
    const owner = piece.owner!;
    const el = elements.get(owner) ?? { cut: false, layers: [], region: [] };
    if (!untouched) el.cut = true;
    el.layers.push({ layerIndex, parts });
    elements.set(owner, el);
  });
  for (const el of elements.values()) {
    if (el.cut) el.region = union(...el.layers.flatMap((l) => l.parts.map((x) => x.poly)));
  }
  const value: JunctionLevel = { levelId, elements, walls };
  levelCache.set(levelId, { sig, value });
  return value;
}

/**
 * Partes de uma camada para o desenho: as resolvidas quando o elemento foi cortado e a camada está nele; senão `fallback`
 * (a camada inteira, como antes). Membrana e camada sem junção caem no `fallback`.
 */
export function layerPartsOf(el: ElementJunction | undefined, layerIndex: number, fallback: ResolvedPrism[]): ResolvedPrism[] {
  if (!el || !el.cut) return fallback;
  return el.layers.find((l) => l.layerIndex === layerIndex)?.parts ?? fallback;
}

/**
 * Faixas de uma camada de parede depois da junção com piso e laje, no formato de `LayerBand` (cota relativa à base da
 * parede). Faixa recortada vira as partes que sobram; sem corte, a própria faixa. Corte, 3D e planta usam esta função,
 * e quem desenha funde as faixas depois (`fuseBands`).
 */
export function wallLayerBandsAfterJunction(jl: JunctionLevel | undefined, rw: ResolvedWall, layer: ResolvedLayer): LayerBand[] {
  return layer.bands.flatMap((b, bandIndex) => {
    const parts = wallBandCut(jl, rw.wallId, layer.layerIndex, bandIndex);
    if (!parts) return [b];
    return parts.map((x) => ({ z0: x.z0 - rw.baseZ, z1: x.z1 - rw.baseZ, poly: x.poly }));
  });
}

/**
 * Partes de uma faixa de parede para o desenho (planta, corte e 3D): as resolvidas quando a parede foi recortada por piso
 * ou laje; senão `fallback` (a faixa inteira). Faixa com topo inclinado sempre cai no `fallback`.
 */
export function wallBandPartsOf(
  jl: JunctionLevel | undefined,
  wallId: Id,
  layerIndex: number,
  bandIndex: number,
  fallback: ResolvedPrism[],
): ResolvedPrism[] {
  return wallBandCut(jl, wallId, layerIndex, bandIndex) ?? fallback;
}

/** Partes recortadas de uma faixa de parede, ou `undefined` quando a faixa não foi recortada (vale a inteira). */
export function wallBandCut(jl: JunctionLevel | undefined, wallId: Id, layerIndex: number, bandIndex: number): ResolvedPrism[] | undefined {
  const wj = jl?.walls.get(wallId);
  if (!wj || !wj.cut) return undefined;
  return wj.bands.get(bandKey(layerIndex, bandIndex));
}
