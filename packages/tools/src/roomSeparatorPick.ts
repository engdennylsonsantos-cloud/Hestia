import { dist, type Vec2 } from '@hestia/geom';
import { levelRoomSeparators, type Id, type Project, type RoomSeparator } from '@hestia/model';
import type { PreviewItem, ToolEnv } from './types.ts';

/** Alça de extremidade de uma linha de separação: `end` é a ponta `a` ou `b`. */
export interface RoomSeparatorGrip {
  id: Id;
  end: 'a' | 'b';
  at: Vec2;
}

/** Distância (m) do ponto ao segmento a→b. */
function distToSegment(q: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
  return dist(q, { x: a.x + dx * t, y: a.y + dy * t });
}

/** Linha de separação do nível sob o cursor (a mais próxima dentro de 4 px), ou null. */
export function pickRoomSeparatorAt(p: Project, levelId: Id, at: Vec2, mpp: number): RoomSeparator | null {
  const tol = 4 * mpp;
  let best: { d: number; r: RoomSeparator } | null = null;
  for (const r of levelRoomSeparators(p, levelId)) {
    const d = distToSegment(at, r.a, r.b);
    if (d <= tol && (!best || d < best.d)) best = { d, r };
  }
  return best ? best.r : null;
}

/** Alça (extremidade) de uma das linhas `ids` sob o cursor, ou null. Alça tem prioridade sobre a linha. */
export function roomSeparatorGripAt(p: Project, levelId: Id, ids: Id[], at: Vec2, mpp: number): RoomSeparatorGrip | null {
  const tol = 9 * mpp;
  for (const r of levelRoomSeparators(p, levelId)) {
    if (!ids.includes(r.id)) continue;
    if (dist(r.a, at) <= tol) return { id: r.id, end: 'a', at: r.a };
    if (dist(r.b, at) <= tol) return { id: r.id, end: 'b', at: r.b };
  }
  return null;
}

/** Ids das linhas de separação do nível dentro da seleção. */
export function selectedRoomSeparators(p: Project, levelId: Id, ids: Id[]): Id[] {
  return levelRoomSeparators(p, levelId).filter((r) => ids.includes(r.id)).map((r) => r.id);
}

/** Move as linhas (a e b) pelo vetor `d`, num único passo de desfazer. */
export function moveRoomSeparators(env: Pick<ToolEnv, 'project' | 'exec' | 'transaction' | 'levelId'>, ids: Id[], d: Vec2): void {
  const levelId = env.levelId();
  const lines = levelRoomSeparators(env.project(), levelId).filter((r) => ids.includes(r.id));
  if (!lines.length) return;
  env.transaction('Mover linha de separação', () => {
    for (const r of lines) {
      env.exec({ type: 'updateRoomSeparator', levelId, id: r.id, patch: { a: { x: r.a.x + d.x, y: r.a.y + d.y }, b: { x: r.b.x + d.x, y: r.b.y + d.y } } });
    }
  });
}

/** Move só uma extremidade (`end`) de uma linha para `to`. */
export function moveRoomSeparatorEnd(env: Pick<ToolEnv, 'project' | 'exec' | 'transaction' | 'levelId'>, id: Id, end: 'a' | 'b', to: Vec2): void {
  env.transaction('Mover extremidade da linha de separação', () => {
    env.exec({ type: 'updateRoomSeparator', levelId: env.levelId(), id, patch: { [end]: to } });
  });
}

/** Prévia das linhas de separação `ids` deslocadas pelo vetor d (tracejado). */
export function separatorGhostItems(p: Project, levelId: Id, ids: Id[], d: Vec2): PreviewItem[] {
  return levelRoomSeparators(p, levelId)
    .filter((r) => ids.includes(r.id))
    .map((r) => ({ kind: 'line' as const, a: { x: r.a.x + d.x, y: r.a.y + d.y }, b: { x: r.b.x + d.x, y: r.b.y + d.y }, dashed: true as const }));
}

/** Linhas de separação que Mover (não Copiar) leva junto: as selecionadas. */
export function movableSeparatorIds(env: Pick<ToolEnv, 'project' | 'levelId' | 'selection'>, copy: boolean): Id[] {
  return copy ? [] : selectedRoomSeparators(env.project(), env.levelId(), env.selection());
}
