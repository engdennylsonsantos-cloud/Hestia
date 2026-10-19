import { applyTransform, dist, dot, type Transform, type Vec2 } from '@hestia/geom';
import { frameOfWall } from '@hestia/engine';
import { isOpening, isWall, newId, type Id, type Project } from '@hestia/model';
import { connectedEnds } from './pick.ts';
import type { PreviewItem, ToolEnv } from './types.ts';

/** Paredes dentro da seleção (aberturas selecionadas acompanham o anfitrião). */
export const selectedWalls = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isWall(p.elements[id]));
export const selectedOpenings = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isOpening(p.elements[id]));

/** Mapa de novos IDs para copiar paredes e as aberturas hospedadas nelas. */
export function makeIdMap(p: Project, wallIds: Id[]): Record<Id, Id> {
  const map: Record<Id, Id> = {};
  for (const id of wallIds) map[id] = newId('w');
  for (const e of Object.values(p.elements)) {
    if (isOpening(e) && wallIds.includes(e.hostId)) map[e.id] = newId(e.kind === 'door' ? 'd' : 'j');
  }
  return map;
}

/** Fantasmas das paredes selecionadas sob uma transformação (pré-visualização de mover/girar/espelhar). */
export function ghostBands(p: Project, wallIds: Id[], t: Transform): PreviewItem[] {
  const out: PreviewItem[] = [];
  for (const id of wallIds) {
    const f = frameOfWall(p, id);
    if (!f) continue;
    const a = applyTransform(t, f.a);
    const b = applyTransform(t, f.b);
    out.push({ kind: 'wallBand', a, b, thickness: f.thickness, sMid: t.kind === 'mirror' ? -f.sMid : f.sMid });
  }
  return out;
}

/**
 * Move paredes. Paredes não selecionadas que terminam num ponto movido acompanham a extremidade
 * (como no Revit: o vizinho se estica), tudo num único passo de desfazer.
 */
export function moveWalls(env: ToolEnv, wallIds: Id[], d: Vec2, follow = true): void {
  const p = env.project();
  const exclude = new Set(wallIds);
  const followers = new Map<Id, { a?: Vec2; b?: Vec2 }>();
  if (follow) {
    for (const id of wallIds) {
      const w = p.elements[id];
      if (!isWall(w)) continue;
      for (const pt of [w.a, w.b]) {
        for (const c of connectedEnds(p, env.levelId(), pt, exclude)) {
          const other = p.elements[c.wallId];
          if (!isWall(other)) continue;
          const cur = followers.get(c.wallId) ?? {};
          const old = c.end === 'a' ? other.a : other.b;
          cur[c.end] = { x: old.x + d.x, y: old.y + d.y };
          followers.set(c.wallId, cur);
        }
      }
    }
  }
  env.transaction('Mover', () => {
    env.exec({ type: 'transform', ids: wallIds, transform: { kind: 'translate', d } });
    for (const [id, ends] of followers) env.exec({ type: 'setWallEnds', id, ...ends });
  });
}

/** Desliza aberturas ao longo da parede anfitriã. */
export function slideOpenings(env: ToolEnv, openingIds: Id[], d: Vec2): void {
  const p = env.project();
  env.transaction('Mover abertura', () => {
    for (const id of openingIds) {
      const o = p.elements[id];
      if (!isOpening(o)) continue;
      const f = frameOfWall(p, o.hostId);
      if (!f) continue;
      env.exec({ type: 'updateElements', ids: [id], patch: { offset: o.offset + dot(d, f.u) } });
    }
  });
}

export function copyWalls(env: ToolEnv, wallIds: Id[], t: Transform): Id[] {
  const p = env.project();
  const idMap = makeIdMap(p, wallIds);
  env.exec({ type: 'transform', ids: wallIds, transform: t, copy: { idMap } });
  return wallIds.map((id) => idMap[id]!).filter(Boolean);
}

export const lengthOf = (a: Vec2, b: Vec2): number => dist(a, b);
