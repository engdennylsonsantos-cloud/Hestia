import { applyTransform, dist, dot, type Transform, type Vec2 } from '@hestia/geom';
import { frameOfWall } from '@hestia/engine';
import { isFloor, isOpening, isRamp, isRoof, isRoom, isSlab, isStair, isWall, newId, sectionLabelOf, sectionPoints, viewIdsIn, viewTransformCommands, type Id, type Project } from '@hestia/model';
import { followingEnds, MIN_WALL_LENGTH } from './pick.ts';
import { selectedStairs } from './stairPick.ts';
import { ghostStairItems } from './stairPreview.ts';
import { selectedRamps } from './rampPick.ts';
import { ghostRampItems } from './rampPreview.ts';
import { selectedFloors } from './floorPick.ts';
import { selectedSlabs } from './slabPick.ts';
import { selectedRoofs } from './roofPick.ts';
import { selectedRooms } from './roomPick.ts';
import type { PreviewItem, ToolEnv } from './types.ts';

/** Paredes dentro da seleção (aberturas selecionadas acompanham o anfitrião). */
export const selectedWalls = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isWall(p.elements[id]));
export const selectedOpenings = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isOpening(p.elements[id]));
/** Paredes, pisos, lajes e telhados: o que o comando 'transform' move, gira, espelha e copia (aberturas seguem o anfitrião). */
export const selectedMovables = (p: Project, ids: Id[]): Id[] => [...selectedWalls(p, ids), ...selectedFloors(p, ids), ...selectedSlabs(p, ids), ...selectedRoofs(p, ids), ...selectedStairs(p, ids), ...selectedRamps(p, ids), ...selectedRooms(p, ids)];

/** Vistas de corte/elevação dentro da seleção. Elas transformam junto com os elementos. */
export const selectedViews = (p: Project, ids: Id[]): Id[] => viewIdsIn(p, ids);

/** Fantasmas das marcas de corte/elevação sob mover/girar/espelhar. */
export function ghostViews(p: Project, ids: Id[], t: Transform): PreviewItem[] {
  const out: PreviewItem[] = [];
  for (const id of viewIdsIn(p, ids)) {
    const v = p.views.find((x) => x.id === id);
    if (!v) continue;
    const pts = sectionPoints(p, v);
    out.push({ kind: 'sectionLine', a: applyTransform(t, pts.a), b: applyTransform(t, pts.b), dashed: true, label: sectionLabelOf(v), elevation: v.kind === 'elevation' });
  }
  return out;
}

/** Move, gira, espelha ou copia vistas num único passo de desfazer; devolve os ids das cópias. */
export function transformViews(env: ToolEnv, ids: Id[], t: Transform, copy = false): Id[] {
  const cmds = viewTransformCommands(env.project(), ids, t, copy);
  if (!cmds.length) return [];
  const created = cmds.flatMap((c) => (c.type === 'addView' ? [c.view.id] : []));
  env.transaction(copy ? 'Copiar vista' : 'Mover vista', () => {
    for (const c of cmds) env.exec(c);
  });
  return created;
}

/** Mapa de novos IDs para copiar paredes, pisos e as aberturas hospedadas nas paredes copiadas. */
export function makeIdMap(p: Project, ids: Id[]): Record<Id, Id> {
  const map: Record<Id, Id> = {};
  for (const id of ids) {
    const e = p.elements[id];
    if (isWall(e)) map[id] = newId('w');
    else if (isFloor(e)) map[id] = newId('f');
    else if (isSlab(e)) map[id] = newId('l');
    else if (isRoof(e)) map[id] = newId('t');
    else if (isStair(e)) map[id] = newId('st');
    else if (isRamp(e)) map[id] = newId('rp');
    else if (isRoom(e)) map[id] = newId('rm');
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
    const st = p.elements[id];
    if (isStair(st)) {
      out.push(...ghostStairItems(st, t));
      continue;
    }
    if (isRamp(st)) {
      out.push(...ghostRampItems(st, t));
      continue;
    }
    const fl = p.elements[id];
    // Ambiente: o contorno é derivado do circuito, então o fantasma é o ponto interior movido.
    if (isRoom(fl)) {
      out.push({ kind: 'point', at: applyTransform(t, fl.point) });
      continue;
    }
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
  transformWalls(env, wallIds, { kind: 'translate', d }, 'Mover', follow, invert);
}

/**
 * Mover, girar ou espelhar paredes (`t`). Com `follow` (padrão), a parede não selecionada que termina numa
 * extremidade movida é esticada até o novo ponto dela; as ferramentas passam `follow = !disjoin` conforme a opção
 * "Desconectar" (ligada, a vizinha fica onde está e a ponta movida se solta). Um passo de desfazer, com o rótulo.
 */
export function transformWalls(env: ToolEnv, wallIds: Id[], t: Transform, label: string, follow = true, invert = false): void {
  const p = env.project();
  const exclude = new Set(wallIds);
  const followers = new Map<Id, { a?: Vec2; b?: Vec2 }>();
  const released = new Set<Id>();
  if (follow) {
    for (const id of wallIds) {
      const w = p.elements[id];
      if (!isWall(w)) continue;
      for (const pt of [w.a, w.b]) {
        // Novo ponto da extremidade movida: é onde a parede vizinha tem de terminar.
        const to = applyTransform(t, pt);
        for (const c of followingEnds(p, env.levelId(), pt, exclude, invert)) {
          const other = p.elements[c.wallId];
          if (!isWall(other)) continue;
          const far = c.end === 'a' ? other.b : other.a;
          // Vizinha degenerada (girar/mover até a outra ponta): solta a ponta em vez de sumir com a parede.
          if (dist(far, to) < MIN_WALL_LENGTH) {
            released.add(c.wallId);
            continue;
          }
          const cur = followers.get(c.wallId) ?? {};
          cur[c.end] = to;
          followers.set(c.wallId, cur);
        }
      }
    }
  }
  env.transaction(label, () => {
    env.exec({ type: 'transform', ids: wallIds, transform: t });
    for (const [id, ends] of followers) env.exec({ type: 'setWallEnds', id, ...ends });
  });
  if (released.size) env.say(`${label}: uma parede ligada ficaria com comprimento zero; a ponta foi solta em vez de esticá-la.`);
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
