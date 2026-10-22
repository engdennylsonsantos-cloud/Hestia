import { union, type MultiPolygon } from '@hestia/geom';
import type { Id, Project } from '@hestia/model';
import { resolveFloors } from './floors.ts';
import { floorLayerPiece, slabLayerPiece, wallCutters, type SolidPiece } from './junctionNet.ts';
import { resolveJunction, type PlanarPiece, type ResolvedPrism } from './junctionPlanar.ts';
import { resolveSlabs } from './slabs.ts';

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

/** Junção do nível: piso e laje pelo id do elemento. Paredes entram só como cortadoras (ver `junctionLevel`). */
export interface JunctionLevel {
  levelId: Id;
  elements: ReadonlyMap<Id, ElementJunction>;
}

/** Entrada da junção: a peça no plano e a camada de origem (-1 para parede, que não tem camada resolvida aqui). */
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
  return { meta: { kind: meta.kind, priority: meta.priority, core: meta.core, ...(meta.explicit ? { explicit: true } : {}) }, poly: sp.poly, z0, z1, owner: meta.owner };
}

/** Assinatura do conteúdo das peças (camada, faixa, prioridade e contorno): muda quando o nível muda. */
function signature(tagged: readonly Tagged[]): string {
  return tagged
    .map(({ piece: t, layerIndex }) => {
      const poly = t.poly.map((p) => p.map((ring) => ring.map((v) => `${r6(v.x)},${r6(v.y)}`).join(' ')).join('/')).join('#');
      return `${t.owner}|${layerIndex}|${t.meta.kind}|${t.meta.priority}|${t.meta.core ? 1 : 0}|${t.meta.explicit ? 1 : 0}|${r6(t.z0)}|${r6(t.z1)}|${poly}`;
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
  for (const cut of wallCutters(p, levelId)) for (const sp of cut.pieces) add(sp, -1);

  const sig = signature(tagged);
  const hit = levelCache.get(levelId);
  if (hit && hit.sig === sig) return hit.value;

  const res = resolveJunction(tagged.map((t) => t.piece));
  const elements = new Map<Id, ElementJunction>();
  tagged.forEach(({ piece, layerIndex }, i) => {
    if (layerIndex < 0) return;
    const owner = piece.owner!;
    const el = elements.get(owner) ?? { cut: false, layers: [], region: [] };
    const parts = res[i]!;
    const untouched = parts.length === 1 && parts[0]!.poly === piece.poly;
    if (!untouched) el.cut = true;
    el.layers.push({ layerIndex, parts });
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
  return el.layers.find((l) => l.layerIndex === layerIndex)?.parts ?? fallback;
}
