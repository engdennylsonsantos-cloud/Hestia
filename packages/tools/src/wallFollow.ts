import { add, applyTransform, cross, dist, dot, mul, norm, perp, sub, type Transform, type Vec2 } from '@hestia/geom';
import { isWall, type Command, type Id, type Project, type Wall } from '@hestia/model';
import { areParallel } from './dims/parallel.ts';
import { followingEnds, joinTol, MIN_WALL_LENGTH } from './pick.ts';
import { wallsOnLevel } from '@hestia/model';

/** Novas pontas das paredes não movidas que acompanham as movidas (a que termina no ponto movido se estica até o novo ponto). */
export interface WallFollowPlan {
  followers: Map<Id, { a?: Vec2; b?: Vec2 }>;
  /** Vizinhas que ficariam com comprimento zero: a ponta é solta em vez de esticada. */
  released: Set<Id>;
  /** Vizinhas que o chamador pediu para não esticar (ver `skip`). */
  skipped: Set<Id>;
}

/**
 * Planeja o que acontece com as paredes ligadas às extremidades das paredes `wallIds` quando `t` é aplicada a elas.
 * Fonte única do "mover com extremidades conectadas" (Mover, Copiar, cotas): a vizinha termina no novo ponto da
 * extremidade movida. `skip(vizinha, movida)` recusa esticar uma vizinha (fica onde está e é contada em `skipped`).
 */
export function planWallFollowers(
  p: Project,
  levelId: Id,
  wallIds: Id[],
  t: Transform,
  invert = false,
  skip?: (neighbor: Wall, moved: Wall) => boolean,
): WallFollowPlan {
  const plan: WallFollowPlan = { followers: new Map(), released: new Set(), skipped: new Set() };
  const exclude = new Set(wallIds);
  for (const id of wallIds) {
    const w = p.elements[id];
    if (!isWall(w)) continue;
    for (const pt of [w.a, w.b]) {
      // Novo ponto da extremidade movida: é onde a parede vizinha tem de terminar.
      const to = applyTransform(t, pt);
      for (const c of followingEnds(p, levelId, pt, exclude, invert)) {
        const other = p.elements[c.wallId];
        if (!isWall(other)) continue;
        if (skip?.(other, w)) {
          plan.skipped.add(c.wallId);
          continue;
        }
        const far = c.end === 'a' ? other.b : other.a;
        // Vizinha degenerada (girar/mover até a outra ponta): solta a ponta em vez de sumir com a parede.
        if (dist(far, to) < MIN_WALL_LENGTH) {
          plan.released.add(c.wallId);
          continue;
        }
        const cur = plan.followers.get(c.wallId) ?? {};
        cur[c.end] = to;
        plan.followers.set(c.wallId, cur);
      }
    }
  }
  return plan;
}

/** Comandos que ajustam as pontas planejadas. */
export function followerCommands(plan: WallFollowPlan): Command[] {
  return [...plan.followers].map(([id, ends]): Command => ({ type: 'setWallEnds', id, ...ends }));
}

/**
 * Pontas de paredes que encostam no MEIO da parede movida (junção em T: a haste termina no corpo da outra). A haste
 * estica ou encurta ao longo do próprio eixo até a nova linha da parede movida. Haste paralela a ela não tem onde
 * chegar e fica de fora (`skipped`); a que ficaria curta demais é solta (`released`).
 */
function planTeeFollowers(p: Project, levelId: Id, moved: Wall, d: Vec2, plan: WallFollowPlan, exclude: Set<Id>): void {
  const tol = joinTol(p);
  const u = norm(sub(moved.b, moved.a));
  const length = dist(moved.a, moved.b);
  const origin = add(moved.a, d);
  for (const other of wallsOnLevel(p, levelId)) {
    if (exclude.has(other.id)) continue;
    for (const end of ['a', 'b'] as const) {
      const pt = other[end];
      const r = sub(pt, moved.a);
      const t = dot(r, u);
      if (t <= tol || t >= length - tol || Math.abs(cross(r, u)) > tol) continue;
      const far = end === 'a' ? other.b : other.a;
      const e = norm(sub(pt, far));
      const k = cross(e, u);
      if (Math.abs(k) < 1e-9) {
        plan.skipped.add(other.id);
        continue;
      }
      const to = add(pt, mul(e, cross(sub(origin, pt), u) / k));
      if (dist(far, to) < MIN_WALL_LENGTH) {
        plan.released.add(other.id);
        continue;
      }
      plan.followers.set(other.id, { ...plan.followers.get(other.id), [end]: to });
    }
  }
}

/**
 * Comandos que transladam as paredes por `d` mantendo as junções (as vizinhas esticam ou encurtam), para as cotas
 * temporárias. Vizinha alinhada com a movida (colinear ou paralela) não estica quando o deslocamento sai do eixo dela:
 * ficaria torta, então fica onde está e a mensagem avisa que a junção se abriu.
 */
export function translateWallsJoined(p: Project, levelId: Id, wallIds: Id[], d: Vec2): { commands: Command[]; note?: string } {
  const offAxis = (w: Wall): boolean => Math.abs(dot(d, perp(norm(sub(w.b, w.a))))) > 1e-9;
  const skip = (neighbor: Wall, moved: Wall): boolean => areParallel(moved.a, moved.b, neighbor.a, neighbor.b) && offAxis(neighbor);
  const plan = planWallFollowers(p, levelId, wallIds, { kind: 'translate', d }, false, skip);
  const exclude = new Set(wallIds);
  for (const id of wallIds) {
    const w = p.elements[id];
    if (isWall(w)) planTeeFollowers(p, levelId, w, d, plan, exclude);
  }
  const commands: Command[] = [{ type: 'transform', ids: wallIds, transform: { kind: 'translate', d } }, ...followerCommands(plan)];
  const notes: string[] = [];
  if (plan.skipped.size) notes.push('Uma parede alinhada com a movida não foi esticada: a junção com ela se abriu.');
  if (plan.released.size) notes.push('Uma parede ligada ficaria com comprimento zero; a ponta foi solta em vez de esticá-la.');
  return notes.length ? { commands, note: notes.join(' ') } : { commands };
}
