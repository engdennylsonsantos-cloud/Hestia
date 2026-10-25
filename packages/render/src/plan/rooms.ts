import type { Vec2 } from '@hestia/geom';
import type { ResolvedRoom } from '@hestia/engine';
import { paperMmToPx, type DetailLevel, type Id, type Project } from '@hestia/model';
import { belowFloorOps, fmtArea, labelPoint, type FloorOps } from './floors.ts';
import { ambientesDoNivel } from './resolucao.ts';
import { surfaceColor, type PlanPaint } from './style.ts';
import type { PlanTheme } from './types.ts';

/** Cor padrão do ambiente (sem cor própria): cinza-azulado claro, mais escuro no tema escuro. */
const ROOM_DEFAULT = '#b8c4d4';

/** Altura do texto do ambiente na planta, em mm de papel (mesmo padrão das demais anotações). */
const ROOM_TEXT_MM = 1.6;

const empty = (): FloorOps => ({ fills: [], strokes: [], labels: [] });

/**
 * Etiqueta do ambiente: nome, número e área (m², 2 casas) no detalhe fino e médio; no grosso, só o nome (decisão
 * 0018 · D1). Número entre parênteses quando há.
 */
export function roomLabelText(r: ResolvedRoom, detail: DetailLevel): string {
  const name = r.name || (r.number ? `Ambiente ${r.number}` : 'Ambiente');
  if (detail === 'coarse') return name;
  const num = r.number ? ` (${r.number})` : '';
  return `${name}${num} · ${fmtArea(r.area, 2)}`;
}

/** Ponto da etiqueta: o centro do maior trecho interno do polígono (vale também para contornos em L). */
export const roomLabelAt = (r: ResolvedRoom): Vec2 | null => (r.polygon ? labelPoint([r.polygon]) : null);

/**
 * Ambientes do nível na planta (D1, E3): preenchimento leve com a cor do ambiente (ou o padrão do tema) e etiqueta no
 * centro. Ambiente sem circuito (`polygon` nulo) não é desenhado; a validação aponta o problema. Os ambientes ficam
 * sobre os pisos e sob as paredes.
 */
export function roomOps(
  p: Project,
  levelId: Id,
  theme: PlanTheme,
  dark: boolean,
  detail: DetailLevel,
  zoom: number,
  scale: number,
  hidden: ReadonlySet<Id> | undefined,
  paint: PlanPaint,
): FloorOps {
  const out = empty();
  const fontPx = paperMmToPx(ROOM_TEXT_MM, zoom, scale);
  const fillBase = dark ? theme.bg : '#ffffff';
  for (const r of ambientesDoNivel(p, levelId)) {
    if (!r.polygon || hidden?.has(r.roomId)) continue;
    const color = surfaceColor(r.color ?? ROOM_DEFAULT, fillBase, dark ? 0.6 : 0.78, paint);
    out.fills.push({ polygons: [r.polygon], color, alpha: 0.7 });
    const at = roomLabelAt(r);
    if (at) out.labels.push({ at, text: roomLabelText(r, detail), fontPx, tone: 'info' });
  }
  return out;
}

/**
 * Ambientes do nível abaixo, como referência apagada (D3): mesma linguagem dos pisos de referência (D4), só o contorno
 * e o preenchimento leve do tema, sem etiqueta. Ambiente sem circuito não entra.
 */
export function belowRoomOps(rooms: ResolvedRoom[], theme: PlanTheme): FloorOps {
  return belowFloorOps(
    rooms.flatMap((r) => (r.polygon ? [{ polygon: [r.polygon] }] : [])),
    theme,
  );
}

/** Destaque de seleção e de hover dos ambientes: azul translúcido e contorno de 2 px; sem circuito, não há destaque. */
export function roomSelectionOps(p: Project, levelId: Id, selection: Id[], hover: Id | null, theme: PlanTheme, hidden?: ReadonlySet<Id>): FloorOps {
  const out = empty();
  const sel = new Set(selection);
  for (const r of ambientesDoNivel(p, levelId)) {
    if (!r.polygon || hidden?.has(r.roomId)) continue;
    const isSel = sel.has(r.roomId);
    const isHover = !isSel && hover === r.roomId;
    if (!isSel && !isHover) continue;
    out.fills.push({ polygons: [r.polygon], color: theme.select, alpha: isSel ? 0.22 : 0.14 });
    if (!isSel) continue;
    for (const ring of r.polygon) out.strokes.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
  }
  return out;
}
