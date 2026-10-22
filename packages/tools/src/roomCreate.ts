import { lineIntervals } from '@hestia/engine';
import { pointInPolygon, type Polygon, type Vec2 } from '@hestia/geom';
import { makeRoom, roomsOnLevel, type Id, type Project, type Room } from '@hestia/model';
import { makeId } from './base.ts';
import { enclosedRooms } from './enclosed.ts';

/** Próximo número sequencial do nível: a contagem de ambientes do nível + 1, pulando números já usados. */
export function nextRoomNumber(p: Project, levelId: Id): number {
  const rooms = roomsOnLevel(p, levelId);
  const used = new Set(rooms.map((r) => r.number));
  let n = rooms.length + 1;
  while (used.has(String(n))) n += 1;
  return n;
}

/** Ponto interior de um polígono (anel externo menos furos): meio do maior trecho na linha horizontal do meio da caixa. */
export function interiorPoint(poly: Polygon): Vec2 | null {
  const outer = poly[0];
  if (!outer || outer.length < 3) return null;
  const ys = outer.map((v) => v.y);
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  let best: [number, number] | null = null;
  for (const iv of lineIntervals(poly, { x: 0, y }, { x: 1, y: 0 }, { x: 0, y: 1 })) {
    if (!best || iv[1] - iv[0] > best[1] - best[0]) best = iv;
  }
  return best && best[1] - best[0] > 1e-6 ? { x: (best[0] + best[1]) / 2, y } : null;
}

/** Ambiente novo no nível, no ponto `at` (dentro do circuito), com nome "Ambiente N" e número N sequencial. */
export function roomDraft(p: Project, levelId: Id, at: Vec2): Omit<Room, 'order'> {
  const n = nextRoomNumber(p, levelId);
  return makeRoom({ id: makeId('rm'), levelId, name: `Ambiente ${n}`, number: String(n), point: at });
}

/**
 * Um ambiente para cada circuito fechado do nível que ainda não tem nenhum (o ponto de um ambiente existente cai
 * dentro do circuito). Os números seguem a sequência do nível. Devolve os ambientes novos, sem gravar nada.
 */
export function roomsForEnclosedCircuits(p: Project, levelId: Id): Omit<Room, 'order'>[] {
  const existing = roomsOnLevel(p, levelId);
  const out: Omit<Room, 'order'>[] = [];
  const numbers = new Set(existing.map((r) => r.number));
  for (const poly of enclosedRooms(p, levelId, 'finish')) {
    const covered = [...existing, ...out].some((r) => pointInPolygon(r.point, poly));
    const at = interiorPoint(poly);
    if (covered || !at) continue;
    let n = existing.length + out.length + 1;
    while (numbers.has(String(n))) n += 1;
    numbers.add(String(n));
    out.push(makeRoom({ id: makeId('rm'), levelId, name: `Ambiente ${n}`, number: String(n), point: at }));
  }
  return out;
}
