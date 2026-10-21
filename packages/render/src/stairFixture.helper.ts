import type { ResolvedStair, ResolvedStairRiser, ResolvedStairStep } from '@hestia/engine';
import { DEFAULT_STAIR_TYPES, type StairType } from '@hestia/model';
import type { MultiPolygon, Vec2 } from '@hestia/geom';

/** Helper de teste: escada reta resolvida por literal (o motor pode ainda não existir). Não entra no bundle. */
export interface StraightOpts {
  /** Nº total de espelhos (N). Padrão 10. */
  risers?: number;
  /** Profundidade do piso (m). Padrão 0,28. */
  tread?: number;
  /** Altura do espelho real (m). Padrão 0,175. */
  riserH?: number;
  /** Largura do lance (m). Padrão 1. */
  width?: number;
  /** Cota da base (m). Padrão 0. */
  baseZ?: number;
  /** Sobrescreve campos do tipo (ex.: estilo, espessuras). */
  type?: Partial<StairType>;
  issues?: ResolvedStair['issues'];
  id?: string;
}

/**
 * Escada reta que sobe em +y. Espelho k (1..N) em y = k·p, de x = 0 a W, entre z = (k−1)h e kh; degrau k (1..N−1)
 * entre os espelhos k e k+1, topo em kh (decisão 0011 §1, item 6). Base é o pé do primeiro espelho.
 */
export function straightStair(o: StraightOpts = {}): ResolvedStair {
  const N = o.risers ?? 10;
  const p = o.tread ?? 0.28;
  const h = o.riserH ?? 0.175;
  const W = o.width ?? 1;
  const base = o.baseZ ?? 0;
  const type: StairType = { ...DEFAULT_STAIR_TYPES[0]!, ...o.type };
  const steps: ResolvedStairStep[] = [];
  for (let k = 1; k <= N - 1; k++) {
    steps.push({
      componentIndex: 0,
      kind: 'tread',
      index: k,
      polygon: [
        { x: 0, y: k * p },
        { x: W, y: k * p },
        { x: W, y: (k + 1) * p },
        { x: 0, y: (k + 1) * p },
      ],
      z: base + k * h,
    });
  }
  const risers: ResolvedStairRiser[] = Array.from({ length: N }, (_, i) => {
    const k = i + 1;
    const a: Vec2 = { x: 0, y: k * p };
    const b: Vec2 = { x: W, y: k * p };
    return { componentIndex: 0, index: k, a, b, points: [a, b], z0: base + (k - 1) * h, z1: base + k * h };
  });
  const footprint: MultiPolygon = [
    [
      [
        { x: 0, y: p },
        { x: W, y: p },
        { x: W, y: N * p },
        { x: 0, y: N * p },
      ],
    ],
  ];
  return {
    id: o.id ?? 'st1',
    levelId: 'lv_0',
    topLevelId: 'lv_1',
    typeId: type.id,
    type,
    baseZ: base,
    topZ: base + N * h,
    riserCount: N,
    riserHeight: h,
    steps,
    risers,
    footprint,
    issues: o.issues ?? [],
  };
}
