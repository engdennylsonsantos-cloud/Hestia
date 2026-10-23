import { difference, union, type MultiPolygon } from '@hestia/geom';
import type { Id } from '@hestia/model';
import type { ResolvedPrism } from './junctionPlanar.ts';
import type { ElementJunction, JunctionLevel } from './junctionLevel.ts';
import { clusterOf } from './partialStructure.ts';
import { bandVolume } from './profile.ts';
import type { LayerBand, ResolvedLayer, ResolvedLevel, ResolvedWall } from './types.ts';

/**
 * Parede com a junção resolvida (decisão 0023 §10, P7c parte 2; decisão 0025 §9.1). Piso e laje já saem recortados pela camada
 * que vence (`junctionLevel`); aqui a parede faz o mesmo: cada camada perde a região que a camada vencedora ocupa, na
 * faixa de cota em que ela ocupa. O resultado é usado pelo desenho (planta, corte e 3D), então o desenhado bate com o
 * líquido dos quantitativos.
 *
 * Fica fora de `resolveLevel` de propósito: `junctionLevel` depende de `resolveLevel` (ciclo). Quem desenha chama
 * `cutLevelByJunction` com a junção já calculada e com cache por nível; sem sobreposição a parede volta como estava.
 *
 * Fora desta função (segue como antes): camada com topo ou base inclinados (perfil, P9), porque a faixa inclinada não
 * se recorta por aproximação plana; e a parede curva entra só pelo polígono.
 */

/** Plano de corte padrão de uma parede em `resolveLevel` (1,20 m acima da base; `PLAN_CUT` em resolve.ts). */
const PLAN_CUT = 1.2;
/** Tolerância (m) para faixas de cota e para sobras de volume. */
const EPS = 1e-6;

/** Onde a planta corta a parede: uma cota absoluta, ou `'outline'` para a projeção inteira (parede só de contorno). */
export type WallPlanCut = number | 'outline';

export interface WallCutOptions {
  /** Cota absoluta do plano de corte da vista. Sem ela, 1,20 m acima da base de cada parede (como `resolveLevel`). */
  planZ?: number;
  /** Paredes só de contorno (`outlineWalls` de `resolveLevel`): a projeção inteira, sem plano. */
  outline?: ReadonlySet<Id>;
}

/** Região em planta das partes cuja faixa de cota contém `z`; sem `z`, a união de todas (projeção). */
export function partsRegion(parts: readonly ResolvedPrism[], z?: number): MultiPolygon {
  const sel = z === undefined ? parts : parts.filter((x) => x.z0 - EPS <= z && z <= x.z1 + EPS);
  return sel.length ? union(...sel.map((x) => x.poly)) : [];
}

/**
 * Faixas planas de uma camada cortadas pelas partes. Cada parte já é a região que sobra numa sub-faixa de cota da faixa
 * original, então a faixa vira as partes que caem dentro dela (faixas distintas não se sobrepõem em cota).
 */
export function cutBands(rw: ResolvedWall, bands: readonly LayerBand[], parts: readonly ResolvedPrism[]): LayerBand[] {
  const out: LayerBand[] = [];
  for (const b of bands) {
    const a0 = rw.baseZ + b.z0;
    const a1 = rw.baseZ + b.z1;
    for (const p of parts) {
      const s0 = Math.max(a0, p.z0);
      const s1 = Math.min(a1, p.z1);
      if (s1 - s0 > EPS) out.push({ z0: s0 - rw.baseZ, z1: s1 - rw.baseZ, poly: p.poly });
    }
  }
  return out;
}

/**
 * Região que a camada perde no plano `z` (ou em toda a altura, sem `z`): a forma original das faixas que existem ali,
 * menos o que as partes ocupam. Os vãos já furam a forma original, então não são reabertos nem fechados aqui.
 */
function removedAt(rw: ResolvedWall, bands: readonly LayerBand[], parts: readonly ResolvedPrism[], z?: number): MultiPolygon {
  const rel = z === undefined ? undefined : z - rw.baseZ;
  const origin = bands.filter((b) => rel === undefined || (b.z0 - EPS <= rel && rel <= b.z1 + EPS)).map((b) => b.poly);
  if (origin.length === 0) return [];
  const orig = union(...origin);
  const kept = partsRegion(parts, z);
  return kept.length ? difference(orig, kept) : orig;
}

/**
 * Parede com as camadas recortadas pela junção. `plan` diz a cota da planta (`number`) ou que a parede é só contorno
 * (`'outline'`). Sem corte no elemento, ou sem volume perdido numa camada, a camada volta igual (mesma referência).
 */
export function cutWallByJunction(rw: ResolvedWall, el: ElementJunction | undefined, plan: WallPlanCut): ResolvedWall {
  if (!el || !el.cut) return rw;
  let changed = false;
  const layers = rw.layers.map((l): ResolvedLayer => {
    const parts = el.layers.find((x) => x.layerIndex === l.layerIndex)?.parts;
    if (!parts || l.bands.some((b) => b.slope)) return l;
    const bands = cutBands(rw, l.bands, parts);
    const lost = l.bands.reduce((s, b) => s + bandVolume(b), 0) - bands.reduce((s, b) => s + bandVolume(b), 0);
    if (Math.abs(lost) <= 1e-9) return l;
    const removed = removedAt(rw, l.bands, parts, plan === 'outline' ? undefined : plan);
    changed = true;
    return {
      ...l,
      bands,
      fragment: removed.length ? difference(l.fragment, removed) : l.fragment,
      cut: removed.length ? difference(l.cut, removed) : l.cut,
    };
  });
  return changed ? { ...rw, layers } : rw;
}

/** Memória por nível: a mesma vista (mesmo `ResolvedLevel`) e a mesma junção devolvem o mesmo nível cortado. */
const memo = new WeakMap<ResolvedLevel, Map<string, { jl: JunctionLevel; out: ResolvedLevel }>>();

function computeCut(level: ResolvedLevel, jl: JunctionLevel, opts: WallCutOptions): ResolvedLevel {
  const walls: Record<Id, ResolvedWall> = {};
  const changed = new Set<Id>();
  for (const [id, rw] of Object.entries(level.walls)) {
    const plan: WallPlanCut = opts.outline?.has(id) ? 'outline' : (opts.planZ ?? rw.baseZ + PLAN_CUT);
    const cut = cutWallByJunction(rw, jl.elements.get(id), plan);
    walls[id] = cut;
    if (cut !== rw) changed.add(id);
  }
  if (changed.size === 0) return level;
  // Só os conjuntos com parede cortada refazem região e silhueta (a mesma regra do pintor, em `partialStructure`).
  const clusters = level.clusters.map((c) => (c.wallIds.some((id) => changed.has(id)) ? clusterOf(c, walls) : c));
  return { levelId: level.levelId, walls, clusters };
}

/**
 * Nível com as paredes cortadas pela junção (P7c parte 2). Usado pela planta (com a cota do plano da vista), pelo corte e pelo
 * 3D. Mesma entrada, mesmo resultado (cache por nível e por opções). Não altera o modelo nem os quantitativos.
 */
export function cutLevelByJunction(level: ResolvedLevel, jl: JunctionLevel, opts: WallCutOptions = {}): ResolvedLevel {
  const key = `${opts.planZ ?? ''}|${opts.outline ? [...opts.outline].sort().join(',') : ''}`;
  const per = memo.get(level) ?? new Map<string, { jl: JunctionLevel; out: ResolvedLevel }>();
  const hit = per.get(key);
  if (hit && hit.jl === jl) return hit.out;
  const out = computeCut(level, jl, opts);
  per.set(key, { jl, out });
  memo.set(level, per);
  return out;
}
