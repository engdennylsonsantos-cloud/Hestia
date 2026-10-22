import { multiArea, union, type MultiPolygon } from '@hestia/geom';
import type { Id, Project } from '@hestia/model';
import { resolveFloors } from './floors.ts';
import { adjacentLevelIds, floorLayerPiece, slabLayerPiece, wallLayerPieces, type SolidPiece } from './junctionNet.ts';
import { resolveJunction, zOverlaps, type PlanarPiece, type ResolvedPrism } from './junctionPlanar.ts';
import { resolveSlabs } from './slabs.ts';

/**
 * Junção resolvida de um nível (decisão 0023 §3 e §10, P7b e P7c). Uma função única para planta, corte, 3D e
 * quantitativos: cada camada de piso, de laje e de parede sai com as partes em que ela existe, já recortadas pela
 * camada que a vence (`resolveJunction`). Os níveis adjacentes entram como cortadores (P7c): a laje do nível de cima
 * que atravessa a parede do térreo, e a parede do térreo que sobe até a laje. Sem sobreposição, nada é recortado e o
 * desenho segue o original (`cut` falso).
 */

/** Partes de uma camada depois da junção: planta e faixa de cota (absoluta) em que ela existe. Vazio: camada vencida. */
export interface LayerParts {
  layerIndex: number;
  parts: ResolvedPrism[];
}

/** Piso, laje ou parede com a junção resolvida. `cut` falso: nenhuma camada foi recortada, então vale o desenho original. */
export interface ElementJunction {
  cut: boolean;
  layers: LayerParts[];
  /** União, em planta, das partes de todas as camadas (a região que o elemento ocupa depois do corte). Vazia sem corte. */
  region: MultiPolygon;
}

/** Junção do nível: piso, laje e parede pelo id do elemento (ver `junctionLevel`). */
export interface JunctionLevel {
  levelId: Id;
  elements: ReadonlyMap<Id, ElementJunction>;
}

/** Entrada da junção: a peça no plano e a camada de origem (-1 para peça de nível adjacente, que só corta). */
interface Tagged {
  piece: PlanarPiece;
  layerIndex: number;
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
      return `${t.external ? 'x' : ''}${t.owner}|${layerIndex}|${t.meta.kind}|${t.meta.priority}|${t.meta.core ? 1 : 0}|${r6(t.z0)}|${r6(t.z1)}|${poly}`;
    })
    .join('\n');
}

/** Cache por nível e por conteúdo (como o circuito de ambientes, decisão 0023 §11): nível não editado = mesmo resultado. */
const levelCache = new Map<Id, { sig: string; value: JunctionLevel }>();

/** Volume (m³) das partes de uma camada: área em planta vezes a altura de cada parte. */
const volumeOfParts = (parts: readonly ResolvedPrism[]): number => parts.reduce((s, x) => s + multiArea(x.poly) * (x.z1 - x.z0), 0);

/**
 * A camada perdeu volume? Compara o volume antes e depois (tolerância 1e-9 m³), não a identidade do polígono: o
 * `difference` que não tira nada devolve geometria nova com a mesma área, e isso não é corte (P7c, `cut` falso).
 */
const lostVolume = (t: PlanarPiece, parts: readonly ResolvedPrism[]): boolean =>
  Math.abs(multiArea(t.poly) * (t.z1 - t.z0) - volumeOfParts(parts)) > 1e-9;

/**
 * Peças de um nível adjacente que podem cortar as do nível (P7c): parede do nível × piso e laje vizinhos cuja faixa de
 * cota se cruza com alguma parede; piso ou laje do nível × paredes vizinhas cuja faixa se cruza com algum deles. Piso ×
 * piso e laje × laje entre níveis não entram (a junção entre níveis é só de parede).
 */
function adjacentPieces(p: Project, levelId: Id, own: readonly PlanarPiece[]): PlanarPiece[] {
  const out: PlanarPiece[] = [];
  const ownWalls = own.filter((t) => t.meta.kind === 'wall');
  const ownHorizontal = own.filter((t) => t.meta.kind !== 'wall');
  for (const id of adjacentLevelIds(p, levelId)) {
    for (const rf of resolveFloors(p, id)) {
      for (const l of rf.layers) {
        const piece = planarOf(floorLayerPiece(rf, l));
        if (piece && ownWalls.some((w) => zOverlaps(w, piece))) out.push({ ...piece, external: true });
      }
    }
    for (const rs of resolveSlabs(p, id)) {
      if (rs.slope) continue;
      for (const l of rs.layers) {
        const piece = planarOf(slabLayerPiece(rs, l));
        if (piece && ownWalls.some((w) => zOverlaps(w, piece))) out.push({ ...piece, external: true });
      }
    }
    for (const { piece: sp } of wallLayerPieces(p, id)) {
      const piece = planarOf(sp);
      if (piece && ownHorizontal.some((h) => zOverlaps(h, piece))) out.push({ ...piece, external: true });
    }
  }
  return out;
}

/**
 * Junção resolvida do nível. Pisos, lajes e paredes com camadas recortadas pela de maior prioridade (`resolveJunction`),
 * com os elementos dos níveis adjacentes como cortadores (P7c, só o que cruza a cota). Lajes com caimento ficam de fora,
 * porque a faixa inclinada não se recorta por aproximação plana (quantitativos já integram).
 */
export function junctionLevel(p: Project, levelId: Id): JunctionLevel {
  const tagged: Tagged[] = [];
  const add = (sp: SolidPiece, layerIndex: number): void => {
    const piece = planarOf(sp);
    if (piece) tagged.push({ piece, layerIndex });
  };
  for (const rf of resolveFloors(p, levelId)) {
    for (const l of rf.layers) add(floorLayerPiece(rf, l), l.layerIndex);
  }
  for (const rs of resolveSlabs(p, levelId)) {
    if (rs.slope) continue;
    for (const l of rs.layers) add(slabLayerPiece(rs, l), l.layerIndex);
  }
  for (const { layerIndex, piece } of wallLayerPieces(p, levelId)) add(piece, layerIndex);
  const own = tagged.map((t) => t.piece);
  for (const piece of adjacentPieces(p, levelId, own)) tagged.push({ piece, layerIndex: -1 });

  const sig = signature(tagged);
  const hit = levelCache.get(levelId);
  if (hit && hit.sig === sig) return hit.value;

  const res = resolveJunction(tagged.map((t) => t.piece));
  const elements = new Map<Id, ElementJunction>();
  tagged.forEach(({ piece, layerIndex }, i) => {
    if (layerIndex < 0 || piece.external) return;
    const owner = piece.owner!;
    const el = elements.get(owner) ?? { cut: false, layers: [], region: [] };
    const parts = res[i]!;
    if (lostVolume(piece, parts)) el.cut = true;
    // Parede tem uma faixa por altura: as faixas de uma camada se somam nas partes dela.
    const layer = el.layers.find((l) => l.layerIndex === layerIndex);
    if (layer) layer.parts.push(...parts);
    else el.layers.push({ layerIndex, parts: [...parts] });
    elements.set(owner, el);
  });
  for (const el of elements.values()) {
    if (el.cut) el.region = union(...el.layers.flatMap((l) => l.parts.map((x) => x.poly)));
  }
  const value: JunctionLevel = { levelId, elements };
  levelCache.set(levelId, { sig, value });
  return value;
}

/**
 * Partes de uma camada para o desenho: as resolvidas quando o elemento foi cortado e a camada está nele; senão `fallback`
 * (a camada inteira, como antes). Membrana e camada sem junção caem no `fallback`.
 */
export function layerPartsOf(el: ElementJunction | undefined, layerIndex: number, fallback: ResolvedPrism[]): ResolvedPrism[] {
  if (!el || !el.cut) return fallback;
  const hit = el.layers.filter((l) => l.layerIndex === layerIndex);
  return hit.length ? hit.flatMap((l) => l.parts) : fallback;
}
