import type { Vec2 } from '@hestia/geom';
import { frameOfWall, pointAt, tangentAt, toLocal, type WallFrame } from '@hestia/engine';
import { wallsOnLevel, type Id, type Project } from '@hestia/model';
import { wallCrossings } from './infer.ts';
import type { ToolOptions } from './types.ts';

/** Parede perpendicular que encosta na hospedeira, com o eixo e as faces medidos em `t` da hospedeira. */
export interface PerpendicularWall {
  wallId: Id;
  /** `t` do eixo da perpendicular (o cruzamento com o eixo da hospedeira, ou o pé do seu topo). */
  axisT: number;
  /** Faces da perpendicular, em `t` da hospedeira: a abertura não pode invadir esta faixa. */
  faceLo: number;
  faceHi: number;
  /** Sistema de coordenadas da perpendicular: dele saem os planos (eixo, faces, núcleo) para as cotas. */
  frame: WallFrame;
  /** Ponto do mundo em que ela encosta na hospedeira (cruzamento dos eixos ou o topo que toca a face). */
  point: Vec2;
}

/** Trecho livre da hospedeira entre as faces das paredes perpendiculares (ou as pontas da parede). */
export interface FreeSpan {
  lo: number;
  hi: number;
}

const PERP_TOL = 0.05;
const EPS = 1e-6;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const unique = (values: number[]): number[] => {
  const out: number[] = [];
  for (const v of values) if (!out.some((x) => Math.abs(x - v) <= EPS)) out.push(v);
  return out;
};

/**
 * Paredes perpendiculares que encostam na hospedeira. O eixo pode cruzar o eixo da hospedeira (T ou cruz) ou
 * terminar na face dela; nos dois casos as faces da perpendicular são medidas em `t` da hospedeira.
 */
export function perpendicularNeighbors(p: Project, hostId: Id, levelId: Id): PerpendicularWall[] {
  const host = frameOfWall(p, hostId);
  if (!host) return [];
  const out: PerpendicularWall[] = [];
  for (const wall of wallsOnLevel(p, levelId)) {
    if (wall.id === hostId) continue;
    const other = frameOfWall(p, wall.id);
    if (!other) continue;
    const ts: number[] = [];
    const points = new Map<number, Vec2>();
    for (const pt of wallCrossings(host.wall, wall)) {
      const loc = toLocal(host, pt);
      if (loc.t >= -PERP_TOL && loc.t <= host.length + PERP_TOL) {
        ts.push(clamp(loc.t, 0, host.length));
        points.set(clamp(loc.t, 0, host.length), pt);
      }
    }
    // Parede que termina na face da hospedeira (sem cruzar o eixo): o topo é o ponto de encosto.
    if (ts.length === 0) {
      for (const end of [wall.a, wall.b]) {
        const loc = toLocal(host, end);
        if (loc.t < -PERP_TOL || loc.t > host.length + PERP_TOL) continue;
        if (Math.abs(loc.s) <= host.thickness / 2 + other.thickness / 2 + 0.02) {
          ts.push(clamp(loc.t, 0, host.length));
          points.set(clamp(loc.t, 0, host.length), end);
        }
      }
    }
    for (const t of unique(ts)) {
      // Perpendicular à tangente da hospedeira NO ponto de encosto (na curva a tangente inicial não serve).
      const hu = tangentAt(host, t);
      if (Math.abs(hu.x * other.u.x + hu.y * other.u.y) > PERP_TOL) continue;
      // Projeção da normal da perpendicular sobre o eixo da hospedeira: converte s em t (paredes perpendiculares).
      const k = hu.x * other.n.x + hu.y * other.n.y;
      const a = other.sHi * k;
      const b = other.sLo * k;
      out.push({ wallId: wall.id, axisT: t, faceLo: t + Math.min(a, b), faceHi: t + Math.max(a, b), frame: other, point: points.get(t) ?? pointAt(host, t, 0) });
    }
  }
  return out;
}

/** Trechos livres entre as faces das perpendiculares, limitados às pontas da hospedeira. */
export function freeSpans(neighbors: PerpendicularWall[], length: number): FreeSpan[] {
  const blocked = neighbors
    .map((n) => ({ lo: clamp(Math.min(n.faceLo, n.faceHi), 0, length), hi: clamp(Math.max(n.faceLo, n.faceHi), 0, length) }))
    .filter((b) => b.hi - b.lo > EPS)
    .sort((a, b) => a.lo - b.lo);
  const out: FreeSpan[] = [];
  let cursor = 0;
  for (const b of blocked) {
    if (b.lo > cursor + EPS) out.push({ lo: cursor, hi: b.lo });
    cursor = Math.max(cursor, b.hi);
  }
  if (length > cursor + EPS) out.push({ lo: cursor, hi: length });
  return out;
}

/** Trecho livre que contém `offset`; null se o ponto cai dentro de uma parede perpendicular. */
export function freeSpanAt(neighbors: PerpendicularWall[], length: number, offset: number): FreeSpan | null {
  return freeSpans(neighbors, length).find((s) => offset >= s.lo - EPS && offset <= s.hi + EPS) ?? null;
}

/** A abertura `[offset − largura/2, offset + largura/2]` invade a faixa de alguma perpendicular. */
export function overlapsPerpendicular(neighbors: PerpendicularWall[], offset: number, width: number): boolean {
  const lo = offset - width / 2;
  const hi = offset + width / 2;
  return neighbors.some((n) => {
    const a = Math.min(n.faceLo, n.faceHi);
    const b = Math.max(n.faceLo, n.faceHi);
    return lo < b - EPS && hi > a + EPS;
  });
}

/** Lado do cursor em relação ao eixo da parede (+1 = lado de `n`). Mantém o lado anterior dentro da histerese. */
export function sideWithHysteresis(s: number, previous: 1 | -1, band: number): 1 | -1 {
  if (Math.abs(s) <= band) return previous;
  return s < 0 ? -1 : 1;
}

/** Sentido de abertura (flipFacing) a partir do lado do cursor e das opções (modo manual usa `openingFlipFacing`). */
export function facingForCursor(side: 1 | -1, options: ToolOptions): boolean {
  if (options.openingFacingMode === 'fixed') return options.openingFlipFacing ?? false;
  const toward = options.openingToward === 'away' ? -side : side;
  return toward < 0;
}

/** Converte a posição do cursor (centro, dobradiça ou trinco) para o centro da abertura. */
export function anchorCenter(cursorOffset: number, width: number, flipHand: boolean, anchor: ToolOptions['openingAnchor']): number {
  const hand = flipHand ? 1 : -1;
  switch (anchor ?? 'center') {
    case 'hinge':
      return cursorOffset - hand * (width / 2);
    case 'latch':
      return cursorOffset + hand * (width / 2);
    default:
      return cursorOffset;
  }
}

/** Centro da abertura cabendo inteira na parede (a mesma folga de 1 cm do posicionamento). */
export function clampOpeningCenter(offset: number, width: number, length: number, fallback: number): number {
  const half = width / 2;
  if (length < width + 0.02) return fallback;
  return clamp(offset, half + 0.01, length - half - 0.01);
}

/** Cota temporária: traço `a → b` e o rótulo no meio. `value` já em metros. */
export interface TemporaryDimension {
  a: Vec2;
  b: Vec2;
  at: Vec2;
  value: number;
}

/**
 * Referências das duas cotas de uma abertura já colocada: o `t` do alvo fixo (eixo da perpendicular no modo `axis` ou
 * face dela no modo `face`) e a medida até a abertura. É a conta que a prévia da colocação e as cotas editáveis usam;
 * fica aqui para não haver duas regras de cota.
 */
export interface DimensionRefs {
  leftEdge: number;
  rightEdge: number;
  leftT: number;
  rightT: number;
  leftValue: number;
  rightValue: number;
}

/** Referências das cotas laterais da abertura (ver `DimensionRefs`). */
export function dimensionRefs(
  center: number,
  width: number,
  length: number,
  neighbors: PerpendicularWall[],
  mode: NonNullable<ToolOptions['openingDimMode']>,
): DimensionRefs {
  const leftEdge = center - width / 2;
  const rightEdge = center + width / 2;
  if (mode === 'face') {
    const leftT = Math.max(0, ...neighbors.filter((n) => n.faceHi <= leftEdge + EPS).map((n) => n.faceHi));
    const rightT = Math.min(length, ...neighbors.filter((n) => n.faceLo >= rightEdge - EPS).map((n) => n.faceLo));
    return { leftEdge, rightEdge, leftT, rightT, leftValue: Math.max(0, leftEdge - leftT), rightValue: Math.max(0, rightT - rightEdge) };
  }
  const leftT = Math.max(0, ...neighbors.filter((n) => n.axisT < center - EPS).map((n) => n.axisT));
  const rightT = Math.min(length, ...neighbors.filter((n) => n.axisT > center + EPS).map((n) => n.axisT));
  return { leftEdge, rightEdge, leftT, rightT, leftValue: Math.max(0, center - leftT), rightValue: Math.max(0, rightT - center) };
}

/**
 * Duas cotas da abertura para as paredes perpendiculares vizinhas (ou as pontas da parede, se não houver):
 * do eixo da abertura ao eixo da perpendicular (`axis`) ou da borda da abertura à face (`face`). O traço fica
 * deslocado para o lado do cursor (`side`).
 */
export function temporaryDimensions(
  frame: WallFrame,
  center: number,
  width: number,
  neighbors: PerpendicularWall[],
  mode: NonNullable<ToolOptions['openingDimMode']>,
  side: 1 | -1,
): TemporaryDimension[] {
  const length = frame.length;
  const sDim = side * (frame.thickness / 2 + 0.25);
  const point = (t: number): Vec2 => ({ x: frame.a.x + frame.u.x * t + frame.n.x * sDim, y: frame.a.y + frame.u.y * t + frame.n.y * sDim });
  const refs = dimensionRefs(center, width, length, neighbors, mode);
  const leftA = point(refs.leftT);
  const leftB = point(mode === 'face' ? refs.leftEdge : center);
  const rightA = point(mode === 'face' ? refs.rightEdge : center);
  const rightB = point(refs.rightT);
  return [
    { a: leftA, b: leftB, at: point((refs.leftT + (mode === 'face' ? refs.leftEdge : center)) / 2), value: refs.leftValue },
    { a: rightA, b: rightB, at: point(((mode === 'face' ? refs.rightEdge : center) + refs.rightT) / 2), value: refs.rightValue },
  ];
}

/** Valor de cota em metros com vírgula e duas casas (ex.: `2,26`). */
export function formatMeters(v: number): string {
  return v.toFixed(2).replace('.', ',');
}
