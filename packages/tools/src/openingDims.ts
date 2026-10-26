import type { Vec2 } from '@hestia/geom';
import type { WallFrame } from '@hestia/engine';
import { dimensionRefs, type PerpendicularWall } from './openingPlacement.ts';

/** Lado da cota selecionada para edição. */
export type OpeningDimSide = 'left' | 'right';

/** Modo da cota: do eixo ao eixo das perpendiculares ou da face do batente à face da perpendicular. */
export type OpeningDimMode = 'axis' | 'face';

/** Uma cota editável da abertura, já posicionada no mundo. */
export interface OpeningDimLine {
  side: OpeningDimSide;
  /** Traço da cota no mundo (do alvo fixo até a abertura). */
  a: Vec2;
  b: Vec2;
  /** Ponto onde o valor é mostrado. */
  at: Vec2;
  /** Medida em metros. */
  value: number;
  /** `t` do alvo fixo: eixo da perpendicular (axis) ou face dela (face). */
  refT: number;
  /** `t` da borda da abertura (`face`) ou do eixo dela (`axis`). */
  edgeT: number;
}

/** As duas cotas de uma abertura selecionada. */
export interface OpeningDimSet {
  mode: OpeningDimMode;
  center: number;
  width: number;
  length: number;
  left: OpeningDimLine;
  right: OpeningDimLine;
}

/** Intervalo ocupado por outra abertura na hospedeira, em `t`. */
export type OccupiedSpan = readonly [number, number];

const EPS = 1e-6;

/**
 * Duas cotas editáveis da abertura (eixo ao eixo ou face à face), com os mesmos alvos da prévia de colocação
 * (`dimensionRefs`). O `side` desloca o traço para o lado de fora da parede: +1 para o lado de `n`, −1 para o oposto.
 */
export function openingDimLines(
  frame: WallFrame,
  center: number,
  width: number,
  neighbors: PerpendicularWall[],
  mode: OpeningDimMode,
  side: 1 | -1,
): OpeningDimSet {
  const refs = dimensionRefs(center, width, frame.length, neighbors, mode);
  const sDim = side * (frame.thickness / 2 + 0.25);
  const point = (t: number): Vec2 => ({ x: frame.a.x + frame.u.x * t + frame.n.x * sDim, y: frame.a.y + frame.u.y * t + frame.n.y * sDim });
  const leftB = mode === 'face' ? refs.leftEdge : center;
  const rightA = mode === 'face' ? refs.rightEdge : center;
  return {
    mode,
    center,
    width,
    length: frame.length,
    left: {
      side: 'left',
      a: point(refs.leftT),
      b: point(leftB),
      at: point((refs.leftT + leftB) / 2),
      value: refs.leftValue,
      refT: refs.leftT,
      edgeT: leftB,
    },
    right: {
      side: 'right',
      a: point(rightA),
      b: point(refs.rightT),
      at: point((rightA + refs.rightT) / 2),
      value: refs.rightValue,
      refT: refs.rightT,
      edgeT: rightA,
    },
  };
}

/** Contexto da validação: perpendiculares, outras aberturas e a folga de 1 cm das pontas (a mesma da colocação). */
export interface OpeningDimContext {
  neighbors: PerpendicularWall[];
  occupied: readonly OccupiedSpan[];
}

/** Resultado da edição: o novo `offset` ou a mensagem que explica a recusa. */
export type OpeningDimResult = { offset: number } | { error: string };

/**
 * Move a abertura para a medida digitada numa das cotas. No modo `axis` a medida vai do eixo da perpendicular ao eixo
 * da abertura; no modo `face`, da face da perpendicular à borda do batente. A posição é validada contra as pontas da
 * parede, as perpendiculares e as outras aberturas. Função pura: não grava nada.
 */
export function editOpeningDim(set: OpeningDimSet, side: OpeningDimSide, value: number, context: OpeningDimContext): OpeningDimResult {
  if (!Number.isFinite(value) || value < 0) return { error: 'Medida inválida: digite uma distância em metros (ex.: 1,20).' };
  const line = set[side];
  const half = set.width / 2;
  const edge = line.refT + (side === 'left' ? value : -value);
  const offset = set.mode === 'face' ? edge + (side === 'left' ? half : -half) : edge;
  if (offset - half < 0.01 - EPS || offset + half > set.length - 0.01 + EPS) {
    return { error: 'A medida não cabe na parede: a abertura sairia do vão livre.' };
  }
  const lo = offset - half;
  const hi = offset + half;
  for (const n of context.neighbors) {
    const a = Math.min(n.faceLo, n.faceHi);
    const b = Math.max(n.faceLo, n.faceHi);
    if (lo < b - EPS && hi > a + EPS) return { error: 'A medida invade a parede perpendicular: escolha um valor menor.' };
  }
  for (const [a, b] of context.occupied) {
    if (lo < b - EPS && hi > a + EPS) return { error: 'A medida invade outra abertura da parede: escolha outro valor.' };
  }
  return { offset };
}
