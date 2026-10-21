import { dist, multiArea, type Vec2 } from '@hestia/geom';
import type { Id, StairRunStyle } from '@hestia/model';
import { pieceVolume, stairBody, type StairBodyPiece } from './stairBody.ts';
import type { ResolvedStair, ResolvedStairRiser, ResolvedStairStep } from './stairs.ts';

/** Quantitativos de um lance (componente de tipo lance, agrupado pelo índice do componente). */
export interface StairRunQuantity {
  componentIndex: number;
  treadCount: number;
  /** Largura do lance: menor espelho aparado (m). */
  width: number;
  /** Piso médio do lance (m) = área dos degraus ÷ (largura × nº de degraus). Exato no lance reto. */
  treadMean: number;
  /** Área em planta dos degraus do lance (m²). */
  treadArea: number;
}

/**
 * Quantitativos de uma escada, a partir da geometria resolvida. Unidades: m, m² e m³. O volume segue o estilo do tipo:
 * - monolítico: soma dos volumes das peças de `stairBody` (decisão 0012 §2): degraus e patamares, com o fundo liso ou
 *   escalonado e o corte pelo piso base. A chegada (`arrival`) fica sob a laje de cima e não entra no volume da escada.
 *   Escada com erro de croqui tem volume zero no monolítico;
 * - piso e espelho: degraus × espessura do piso + comprimento dos espelhos × altura do espelho × espessura do espelho
 *   + patamares × espessura do patamar.
 * O nariz não entra no volume (só 3D e quantitativo de nariz, quando houver).
 */
export interface StairQuantities {
  stairId: Id;
  typeId: Id;
  runStyle: StairRunStyle;
  /** Nº de espelhos (linhas de espelho de todos os lances). */
  riserCount: number;
  /** Altura real do espelho (m). */
  riserHeight: number;
  /** Nº de degraus (pisos entre espelhos, sem os patamares). */
  treadCount: number;
  /** Piso médio (m), média dos pisos de todos os lances ponderada pelo nº de degraus. */
  treadMean: number;
  /** Largura da escada: menor espelho aparado (m). */
  width: number;
  /** Área em planta da escada (m²). */
  planArea: number;
  /** Área em planta dos degraus (m²). */
  treadArea: number;
  /** Área em planta dos patamares (m²). */
  landingArea: number;
  /** Comprimento total dos espelhos, em planta (m). */
  riserLength: number;
  /** Volume do lance: monolítico = estrutura (m³); piso e espelho = pisos (m³). */
  volumeRun: number;
  /** Volume dos espelhos, só no estilo piso e espelho (m³). */
  volumeRisers: number;
  /** Volume dos patamares (m³). */
  volumeLandings: number;
  /** Volume total (m³). */
  volume: number;
  runs: StairRunQuantity[];
}

/** Comprimento de uma polilinha aberta. */
const polyLength = (pts: Vec2[]): number => pts.reduce((s, q, i) => (i === 0 ? 0 : s + dist(pts[i - 1]!, q)), 0);

/** Comprimento do espelho (em planta, seguindo o arco quando houver). */
const riserLen = (r: ResolvedStairRiser): number => (r.points.length >= 2 ? polyLength(r.points) : dist(r.a, r.b));

/** Área em planta de um conjunto de degraus ou patamares. */
const areaOf = (steps: ResolvedStairStep[]): number => steps.reduce((s, x) => s + multiArea([[x.polygon]]), 0);

/** Quantitativos de uma escada resolvida. Escada sem geometria (erro no croqui) sai com tudo zero. */
export function stairQuantities(s: ResolvedStair): StairQuantities {
  const treads = s.steps.filter((x) => x.kind === 'tread');
  const landings = s.steps.filter((x) => x.kind === 'landing');
  const treadArea = areaOf(treads);
  const landingArea = areaOf(landings);
  const riserLength = s.risers.reduce((acc, r) => acc + riserLen(r), 0);
  const width = s.risers.length ? Math.min(...s.risers.map(riserLen)) : 0;

  const indexes = [...new Set(treads.map((t) => t.componentIndex))].sort((a, b) => a - b);
  const runs = indexes.map<StairRunQuantity>((ci) => {
    const ts = treads.filter((t) => t.componentIndex === ci);
    const rs = s.risers.filter((r) => r.componentIndex === ci);
    const w = rs.length ? Math.min(...rs.map(riserLen)) : 0;
    const area = areaOf(ts);
    return { componentIndex: ci, treadCount: ts.length, width: w, treadArea: area, treadMean: w > 0 ? area / (w * ts.length) : 0 };
  });
  const treadCount = treads.length;
  const treadMean = treadCount ? runs.reduce((acc, r) => acc + r.treadMean * r.treadCount, 0) / treadCount : 0;

  const monolithic = s.type.runStyle === 'monolithic';
  // Monolítico: volume das peças de corpo (a chegada fica fora). Piso e espelho: espessuras do tipo.
  const body: StairBodyPiece[] = monolithic ? stairBody(s).pieces : [];
  const bodyVolume = (kind: StairBodyPiece['kind']): number =>
    body.reduce((acc, p) => (p.kind === kind ? acc + pieceVolume(p) : acc), 0);
  const volumeRun = monolithic ? bodyVolume('tread') : treadArea * s.type.treadThickness;
  const volumeRisers = monolithic ? 0 : riserLength * s.riserHeight * s.type.riserThickness;
  const volumeLandings = monolithic ? bodyVolume('landing') : landingArea * s.type.landingThickness;

  return {
    stairId: s.id,
    typeId: s.typeId,
    runStyle: s.type.runStyle,
    riserCount: s.riserCount,
    riserHeight: s.riserHeight,
    treadCount,
    treadMean,
    width,
    planArea: multiArea(s.footprint),
    treadArea,
    landingArea,
    riserLength,
    volumeRun,
    volumeRisers,
    volumeLandings,
    volume: volumeRun + volumeRisers + volumeLandings,
    runs,
  };
}
