import { closeGapsSafe, unionClipper, type MultiPolygon } from '@hestia/geom';
import { coreRange, wallType, type Id, type Layer, type PartialStructure, type Project, type WallType } from '@hestia/model';
import type { Region, ResolvedCluster, ResolvedLevel, ResolvedWall } from './types.ts';

/**
 * Exibição parcial de estrutura (decisão 0015 §2.5): devolve o nível com as camadas de parede filtradas (`noFinishes` sem
 * acabamento, `coreOnly` só o núcleo). Só desenho: não altera o modelo nem os quantitativos. `entire` devolve o mesmo objeto;
 * os outros modos devolvem um nível novo (o original fica intacto), com as paredes que não mudam reaproveitadas por referência.
 *
 * Regras (pela função da camada no tipo de parede, `packages/model/src/wallType.ts`):
 *  - `noFinishes`: sai toda camada de função `finish1`/`finish2`, onde estiver. Substrato (o reboco da biblioteca padrão),
 *    isolamento e membrana ficam. As faixas verticais (rodapé, barra) também saem: são acabamento e ficam fora da espessura.
 *  - `coreOnly`: fica só a faixa do núcleo, do primeiro ao último layer de estrutura (`coreRange`, inclusive). Sem estrutura
 *    no tipo, o núcleo é a parede inteira (definição do modelo), então nada sai. As faixas verticais também saem.
 *
 * A silhueta e as regiões de cada conjunto de paredes são recalculadas pela mesma regra de `resolve.ts` (união dos `cut`
 * das camadas restantes por material; silhueta = união das regiões). Os conjuntos sem paredes alteradas são reaproveitados.
 *
 * Limitação: as camadas que ficam mantêm o recorte que as camadas removidas faziam sobre elas (o pintor não é refeito, e a
 * silhueta é só a união dos cortes restantes). Com a prioridade padrão, `noFinishes` é exato: acabamento (4 e 5) não corta
 * nenhuma camada que fica (1 a 3). `coreOnly` é exato nas bibliotecas padrão (só estrutura no núcleo). Não é exato em dois
 * casos, ambos com entalhe no cruzamento: `priority` de camada que põe um acabamento acima da estrutura de outra parede, e
 * `coreOnly` com camada térmica dentro do núcleo cortada por substrato de fora do núcleo de outra parede. Corrigir exige
 * refazer o pintor sem as camadas removidas, o que é mudança em resolve.ts.
 */
export function applyPartialStructure(p: Project, level: ResolvedLevel, mode: PartialStructure): ResolvedLevel {
  if (mode === 'entire') return level;
  const walls: Record<Id, ResolvedWall> = {};
  for (const [id, rw] of Object.entries(level.walls)) walls[id] = partialWall(p, rw, mode);
  const clusters = level.clusters.map((c) => (c.wallIds.some((id) => walls[id] !== level.walls[id]) ? clusterOf(c, walls) : c));
  return { levelId: level.levelId, walls, clusters };
}

type PartialMode = Exclude<PartialStructure, 'entire'>;

/** Acabamento pela função (finish1/finish2). Substrato, isolamento e membrana não são acabamento. */
const isFinish = (l: Layer): boolean => l.function === 'finish1' || l.function === 'finish2';

/** Índices (no tipo de parede) das camadas que o modo mantém. */
export function keptLayerIndexes(t: WallType, mode: PartialMode): ReadonlySet<number> {
  const kept = new Set<number>();
  if (mode === 'noFinishes') {
    t.layers.forEach((l, i) => {
      if (!isFinish(l)) kept.add(i);
    });
  } else {
    const { first, last } = coreRange(t);
    for (let i = first; i <= last && i < t.layers.length; i++) kept.add(i);
  }
  return kept;
}

function partialWall(p: Project, rw: ResolvedWall, mode: PartialMode): ResolvedWall {
  const el = p.elements[rw.wallId];
  if (!el || el.kind !== 'wall') throw new Error(`Parede resolvida sem elemento no projeto: ${rw.wallId}`);
  const kept = keptLayerIndexes(wallType(p, el), mode);
  // Faixas verticais têm índice negativo e são acabamento: saem nos dois modos parciais.
  const keep = (i: number): boolean => i >= 0 && kept.has(i);
  const layers = rw.layers.filter((l) => keep(l.layerIndex));
  const membranes = rw.membranes.filter((m) => keep(m.layerIndex));
  if (layers.length === rw.layers.length && membranes.length === rw.membranes.length) return rw;
  return { ...rw, layers, membranes };
}

/** Região por material e silhueta do conjunto, com a mesma regra de `solveCluster` em resolve.ts. */
function clusterOf(c: ResolvedCluster, walls: Record<Id, ResolvedWall>): ResolvedCluster {
  const byMaterial = new Map<Id, MultiPolygon[]>();
  for (const wid of c.wallIds) {
    for (const l of walls[wid]?.layers ?? []) {
      if (l.cut.length) byMaterial.set(l.materialId, [...(byMaterial.get(l.materialId) ?? []), l.cut]);
    }
  }
  const regions: Region[] = [...byMaterial].map(([materialId, parts]) => ({ materialId, polygons: closeGapsSafe(unionClipper(...parts)) }));
  const silhouette = closeGapsSafe(unionClipper(...regions.map((r) => r.polygons)));
  return { wallIds: c.wallIds, regions, silhouette };
}
