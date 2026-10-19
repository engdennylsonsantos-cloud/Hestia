import type { Vec2 } from '@hestia/geom';
import type { Id, JoinConfig, Wall } from './types.ts';

/** Revit: o encosto (butt) é a junção padrão (docs/05 §9). */
export const DEFAULT_JOIN: JoinConfig = { kind: 'butt', flip: false };

type WallInput = { id: Id; typeId: Id; levelId: Id; a: Vec2; b: Vec2 } & Partial<Omit<Wall, 'order' | 'kind'>>;

/** Constrói uma parede com todos os campos padrão; `order` é atribuído pelo comando addWall. */
export function makeWall(w: WallInput): Omit<Wall, 'order'> {
  return {
    kind: 'wall',
    baseOffset: 0,
    topLevelId: null,
    height: 2.8,
    topOffset: 0,
    attachBottomToFloor: false,
    attachTopToFloor: false,
    attachTopToRoof: false,
    locationLine: 'wallCenter',
    flipped: false,
    noJoinStart: false,
    noJoinEnd: false,
    joinStart: DEFAULT_JOIN,
    joinEnd: DEFAULT_JOIN,
    sag: 0,
    topProfile: null,
    mark: '',
    comments: '',
    ...w,
  };
}
