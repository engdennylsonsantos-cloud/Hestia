import type { Vec2 } from '@hestia/geom';
import { isRoom, type Id, type Project, type Room } from './types.ts';

type RoomInput = { id: Id; levelId: Id; name: string; number: string; point: Vec2 } & Partial<Omit<Room, 'order' | 'kind'>>;

/** Constrói um ambiente com os campos padrão; `order` é atribuído pelo comando addRoom. */
export function makeRoom(r: RoomInput): Omit<Room, 'order'> {
  return { kind: 'room', heightOffset: 0, floorFinish: '', wallFinish: '', ceilingFinish: '', ...r };
}

export const roomsOnLevel = (p: Project, levelId: Id): Room[] =>
  Object.values(p.elements)
    .filter(isRoom)
    .filter((r) => r.levelId === levelId)
    .sort((a, b) => a.order - b.order);

/** Pé-direito do ambiente: o campo `ceilingHeight` ou, ausente, a altura padrão de parede do projeto. */
export const roomCeilingHeight = (p: Project, r: Room): number => r.ceilingHeight ?? p.defaults.wallHeight;
