import { applyTransform, dist, dot, type Transform, type Vec2 } from '@hestia/geom';
import { frameOfWall } from '@hestia/engine';
import { isFloor, isOpening, isRoof, isSlab, isWall, newId, type Id, type Project } from '@hestia/model';
import { followingEnds } from './pick.ts';
import { selectedFloors } from './floorPick.ts';
import { selectedSlabs } from './slabPick.ts';
import { selectedRoofs } from './roofPick.ts';
import type { PreviewItem, ToolEnv } from './types.ts';

/** Paredes dentro da seleção (aberturas selecionadas acompanham o anfitrião). */
export const selectedWalls = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isWall(p.elements[id]));
export const selectedOpenings = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isOpening(p.elements[id]));
/** Paredes, pisos, lajes e telhados: o que o comando 'transform' move, gira, espelha e copia (aberturas seguem o anfitrião). */
export const selectedMovables = (p: Project, ids: Id[]): Id[] => [...selectedWalls(p, ids), ...selectedFloors(p, ids), ...selectedSlabs(p, ids), ...selectedRoofs(p, ids)];

/** Mapa de novos IDs para copiar paredes, pisos e as aberturas hospedadas nas paredes copiadas. */
export function makeIdMap(p: Project, ids: Id[]): Record<Id, Id> {
  const map: Record<Id, Id> = {};
  for (const id of ids) {
    const e = p.elements[id];
    if (isWall(e)) map[id] = newId('w');
    else if (isFloor(e)) map[id] = newId('f');
    else if (isSlab(e)) map[id] = newId('l');
    else if (isRoof(e)) map[id] = newId('t');
  }
  for (const e of Object.values(p.elements)) {
    if (isOpening(e) && ids.includes(e.hostId)) map[e.id] = newId(e.kind === 'door' ? 'd' : 'j');
  }
  return map;
}

/** Fantasmas das paredes e pisos selecionados sob uma transformação (pré-visualização de mover/girar/espelhar). */
export function ghostBands(p: Project, wallIds: Id[], t: Transform): PreviewItem[] {
  const out: PreviewItem[] = [];
  for (const id of wallIds) {
    const fl = p.elements[id];
    if (isFloor(fl) || isSlab(fl) || isRoof(fl)) {
      out.push({ kind: 'polygon', ring: fl.boundary.map((q) => applyTransform(t, q)), dashed: true });
      continue;
    }
    const f = frameOfWall(p, id);
    if (!f) continue;
    const a = applyTransform(t, f.a);
    const b = applyTransform(t, f.b);
    const sag = f.wall.sag;
    out.push({ kind: 'wallBand', a, b, thickness: f.thickness, sMid: t.kind === 'mirror' ? -f.sMid : f.sMid, sag: t.kind === 'mirror' ? -sag : sag });
  }
  return out;
}

/**
 * Move paredes. Num canto simples, a parede não selecionada que termina no ponto movido acompanha a extremidade
 * (como no Revit: o vizinho se estica); em nó de 3 ou mais paredes ela fica (ver `followingEnds`). Um passo de desfazer.
 */
export function moveWalls(env: ToolEnv, wallIds: Id[], d: Vec2, follow = true, invert = false): void {
  const p = env.project();
  const exclude = new Set(wallIds);
  const followers = new Map<Id, { a?: Vec2; b?: Vec2 }>();
  if (follow) {
    for (const id of wallIds) {
      const w = p.elements[id];
      if (!isWall(w)) continue;
      for (const pt of [w.a, w.b]) {
        for (const c of followingEnds(p, env.levelId(), pt, exclude, invert)) {
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

/** Copia paredes e/ou pisos (ids de ambos) com as aberturas hospedadas; devolve os novos ids de paredes e pisos. */
export function copyWalls(env: ToolEnv, ids: Id[], t: Transform): Id[] {
  const p = env.project();
  const idMap = makeIdMap(p, ids);
  env.exec({ type: 'transform', ids, transform: t, copy: { idMap } });
  return ids.map((id) => idMap[id]!).filter(Boolean);
}

export const lengthOf = (a: Vec2, b: Vec2): number => dist(a, b);
