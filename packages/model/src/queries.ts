import { arcFromSagitta, dist } from '@hestia/geom';
import { isOpening, isWall, type Id, type Opening, type OpeningType, type Project, type Wall, type WallType } from './types.ts';

export const getWall = (p: Project, id: Id): Wall | undefined => {
  const e = p.elements[id];
  return isWall(e) ? e : undefined;
};

export const wallsOnLevel = (p: Project, levelId: Id): Wall[] =>
  Object.values(p.elements)
    .filter(isWall)
    .filter((w) => w.levelId === levelId)
    .sort((a, b) => a.order - b.order);

export const openingsOfWall = (p: Project, wallId: Id): Opening[] =>
  Object.values(p.elements).filter(isOpening).filter((o) => o.hostId === wallId);

export const wallType = (p: Project, w: Wall): WallType => {
  const t = p.wallTypes[w.typeId] ?? p.wallTypes[p.defaults.wallTypeId];
  if (!t) throw new Error(`Tipo de parede ausente: ${w.typeId}`);
  return t;
};

export const openingType = (p: Project, o: Opening): OpeningType => {
  const t = p.openingTypes[o.typeId];
  if (!t) throw new Error(`Tipo de abertura ausente: ${o.typeId}`);
  return t;
};

/** Arco do eixo, ou null se a parede for reta. */
export const wallArc = (w: Wall) => arcFromSagitta(w.a, w.b, w.sag);

/** Comprimento do eixo (comprimento de arco nas paredes curvas). */
export const wallLength = (w: Wall): number => wallArc(w)?.length ?? dist(w.a, w.b);

export const levelElevation = (p: Project, levelId: Id): number =>
  p.levels.find((l) => l.id === levelId)?.elevation ?? 0;

export const wallBaseElevation = (p: Project, w: Wall): number => levelElevation(p, w.levelId) + w.baseOffset;

export function wallTopElevation(p: Project, w: Wall): number {
  if (w.topLevelId) return levelElevation(p, w.topLevelId) + w.topOffset;
  return wallBaseElevation(p, w) + w.height;
}

export const wallHeight = (p: Project, w: Wall): number => Math.max(0.01, wallTopElevation(p, w) - wallBaseElevation(p, w));

export const openingSill = (t: OpeningType, o: Opening): number => o.sillOverride ?? t.sill;

/** Quantos elementos usam o tipo de parede. */
export const wallTypeUsage = (p: Project, typeId: Id): number =>
  Object.values(p.elements).filter((e) => isWall(e) && e.typeId === typeId).length;

export const materialUsage = (p: Project, materialId: Id): number => {
  let n = 0;
  for (const t of Object.values(p.wallTypes)) for (const l of t.layers) if (l.materialId === materialId) n++;
  for (const t of Object.values(p.openingTypes)) {
    if (t.frameMaterialId === materialId) n++;
    if (t.glassMaterialId === materialId) n++;
  }
  return n;
};
