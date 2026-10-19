import { arcPointAt, pointInMulti, type Vec2 } from '@hestia/geom';
import { wallArc, wallBaseElevation, wallMaxHeight, type Project, type Wall } from '@hestia/model';
import { resolveAllFloors, type ResolvedFloor } from './floors.ts';

/** Cota absoluta da base e altura máxima de uma parede, já com os anexos a piso. */
export interface WallZ {
  /** Cota absoluta da base. */
  z0: number;
  /** Altura máxima (o perfil superior, quando há, define a maior altura). */
  height: number;
}

/** Folga mínima para uma parede anexada continuar com altura (1 cm). */
const MIN_HEIGHT = 0.01;

/** Ponto médio do eixo: no arco, o ponto do meio do comprimento do arco. */
function axisMid(w: Wall): Vec2 {
  const arc = wallArc(w);
  if (arc) return arcPointAt(arc, arc.length / 2);
  return { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
}

/**
 * Base e altura da parede (Revit: base e topo anexados ao piso, docs/paridade/pisos C1, decisão 0006 item 6).
 * Com `attachBottomToFloor`, a base vai para a face superior do piso do mesmo nível que cobre o ponto médio.
 * Com `attachTopToFloor`, o topo vai para a face inferior do piso do nível `topLevelId` que cobre esse ponto.
 * Entre vários pisos que cobrem, a base usa o mais alto e o topo o mais baixo.
 * Sem piso, ou se o ajuste deixasse a parede sem altura, o ajuste é ignorado. Parede com perfil superior não
 * recebe o topo anexado (o perfil já define o topo); a base anexada move o perfil junto. Sem os flags, devolve
 * exatamente a base e a altura do modelo.
 */
export function wallZRange(p: Project, w: Wall, floors: ResolvedFloor[] = resolveAllFloors(p)): WallZ {
  const base = wallBaseElevation(p, w);
  const height = wallMaxHeight(p, w);
  const profiled = Boolean(w.topProfile && w.sag === 0);
  const wantsBottom = w.attachBottomToFloor === true;
  const wantsTop = w.attachTopToFloor === true && w.topLevelId !== null && !profiled;
  if (!wantsBottom && !wantsTop) return { z0: base, height };
  const mid = axisMid(w);
  let z0 = base;
  let top = base + height;
  if (wantsBottom) {
    const tops = floors.filter((f) => f.levelId === w.levelId && pointInMulti(mid, f.polygon)).map((f) => f.topZ);
    if (tops.length > 0) {
      const z = Math.max(...tops);
      if (z < top - MIN_HEIGHT) z0 = z;
    }
  }
  if (wantsTop) {
    const bottoms = floors.filter((f) => f.levelId === w.topLevelId && pointInMulti(mid, f.polygon)).map((f) => f.bottomZ);
    if (bottoms.length > 0) {
      const z = Math.min(...bottoms);
      if (z > z0 + MIN_HEIGHT) top = z;
    }
  }
  if (z0 === base && top === base + height) return { z0: base, height };
  return { z0, height: profiled ? height : top - z0 };
}
