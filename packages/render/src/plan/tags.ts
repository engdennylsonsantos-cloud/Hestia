import { levelFrames, pointAt } from '@hestia/engine';
import { openingsOfWall, paperMmToPx, wallType, type Id, type Project } from '@hestia/model';
import type { Vec2 } from '@hestia/geom';
import type { LabelOp } from './types.ts';
import type { PlanPaint } from './style.ts';

/** Medidas em mm de papel (anotação, decisão 0019). */
const TAG_TEXT_MM = 1.6;
const CHAR_W_MM = 1;
const PAD_MM = 0.9;
/** Deslocamento vertical da etiqueta em mm de papel (positivo sobe). */
const TAG_DY_MM = 1.2;

/** Maior trecho livre de [lo, hi] depois de tirar os intervalos bloqueados. */
function longestFree(lo: number, hi: number, blocked: Array<[number, number]>): [number, number] | null {
  const sorted = [...blocked].sort((x, y) => x[0] - y[0]);
  let best: [number, number] | null = null;
  let cursor = lo;
  const consider = (a: number, b: number): void => {
    if (b - a > 0 && (!best || b - a > best[1] - best[0])) best = [a, b];
  };
  for (const [s, e] of sorted) {
    if (s > cursor) consider(cursor, Math.min(s, hi));
    cursor = Math.max(cursor, e);
  }
  if (hi > cursor) consider(cursor, hi);
  return best;
}

/**
 * Etiqueta com o código do tipo em cada parede do nível (G4). A etiqueta vai ao ponto médio do maior trecho livre
 * do eixo, deslocado ao longo da parede para não cair sobre um vão (com folga do tamanho do texto). A fonte segue
 * a categoria 'anotação' (visibilidade e tamanho em mm de papel).
 */
export function wallTagLabels(p: Project, levelId: Id, zoom: number, paint: PlanPaint, scale: number, hidden?: ReadonlySet<Id>): LabelOp[] {
  const out: LabelOp[] = [];
  if (!paint.visible) return out;
  const mPerMm = scale / 1000;
  const fontPx = paperMmToPx(TAG_TEXT_MM, zoom, scale);
  const halfPad = PAD_MM * mPerMm;
  const chW = CHAR_W_MM * mPerMm;
  for (const f of levelFrames(p, levelId)) {
    if (hidden?.has(f.wall.id)) continue;
    const code = wallType(p, f.wall).code;
    if (!code) continue;
    const halfText = (code.length * chW) / 2 + halfPad;
    const blocked = openingsOfWall(p, f.wall.id).map((o): [number, number] => {
      const half = (p.openingTypes[o.typeId]?.width ?? 0) / 2;
      return [o.offset - half - halfText, o.offset + half + halfText];
    });
    const span = longestFree(0, f.length, blocked);
    if (!span) continue;
    const t = (span[0] + span[1]) / 2;
    out.push({ at: pointAt(f, t, f.sMid), text: code, dy: -paperMmToPx(TAG_DY_MM, zoom, scale), fontPx });
  }
  return out;
}

/** Rótulo de anotação (cota ou texto, decisão 0019): centrado em `at`, na fonte e na rotação do papel. */
export const noteLabel = (at: Vec2, text: string, fontPx: number, rotation: number): LabelOp => ({ at, text, fontPx, rotation, center: true });
