import { arcFromSagitta, arcLocal, arcPointAt, dist, dot, norm, sub, type Arc, type Vec2 } from '@hestia/geom';
import { openingTypeById } from './openingNominal.ts';
import { wallLength } from './queries.ts';
import { isOpening, type Opening, type Project, type Id, type Wall } from './types.ts';

const EPS = 1e-6;
const SAME_DIRECTION = 1e-9;

/** Pontas propostas para uma parede; o que falta fica como está. */
export interface WallEndsPatch {
  a?: Vec2;
  b?: Vec2;
  sag?: number;
}

interface Ends {
  a: Vec2;
  b: Vec2;
  sag: number;
}

const endsOf = (wall: Wall, patch: WallEndsPatch): Ends => ({
  a: patch.a ?? wall.a,
  b: patch.b ?? wall.b,
  sag: patch.sag ?? wall.sag,
});

const arcOf = (ends: Ends): Arc | null => arcFromSagitta(ends.a, ends.b, ends.sag);

function axisLength(ends: Ends): number {
  const arc = arcOf(ends);
  return arc ? arc.length : dist(ends.a, ends.b);
}

function axisPoint(ends: Ends, t: number): Vec2 {
  const arc = arcOf(ends);
  if (arc) return arcPointAt(arc, t);
  const u = norm(sub(ends.b, ends.a));
  return { x: ends.a.x + u.x * t, y: ends.a.y + u.y * t };
}

function axisProject(ends: Ends, p: Vec2): number {
  const arc = arcOf(ends);
  if (arc) return arcLocal(arc, p).t;
  return dot(sub(p, ends.a), norm(sub(ends.b, ends.a)));
}

function sameDirection(from: Ends, to: Ends): boolean {
  const u0 = norm(sub(from.b, from.a));
  const u1 = norm(sub(to.b, to.a));
  return Math.hypot(u1.x - u0.x, u1.y - u0.y) <= SAME_DIRECTION;
}

/**
 * Novo `offset` de uma abertura hospedada depois de mudar as pontas da parede.
 *
 * Regra do dono: esticar/encurtar não move a abertura no mundo; transladar/girar a parede inteira leva a abertura
 * junto. Como `offset` é a distância ao longo do eixo desde `a`, a compensação é:
 * - comprimento igual (translação/giro): `offset` não muda (movimento rígido preserva a distância a `a`);
 * - só `b` mudou: `offset` não muda (preserva a distância à ponta fixa `a`);
 * - só `a` mudou: `offset` cresce o mesmo que o comprimento (preserva a distância à ponta fixa `b`);
 * - as duas pontas mudaram e o comprimento mudou: com a mesma direção, projeta a posição antiga no novo eixo; com
 *   direção diferente, mantém `offset` (a abertura acompanha o giro de `a`).
 * A parede curva usa o comprimento de arco, que é o próprio parâmetro de `offset`.
 */
export function openingOffsetAfterEnds(wall: Wall, offset: number, patch: WallEndsPatch): number {
  const before = endsOf(wall, {});
  const after = endsOf(wall, patch);
  const beforeLength = axisLength(before);
  const afterLength = axisLength(after);
  if (beforeLength < EPS || afterLength < EPS) return offset;
  const movedA = dist(before.a, after.a) > EPS;
  const movedB = dist(before.b, after.b) > EPS;
  if (Math.abs(afterLength - beforeLength) <= EPS) return offset;
  if (movedA && !movedB) return offset + (afterLength - beforeLength);
  if (!movedA && movedB) return offset;
  if (movedA && movedB) {
    if (!sameDirection(before, after)) return offset;
    return axisProject(after, axisPoint(before, offset));
  }
  // Nenhuma ponta mudou: só a flecha mudou o comprimento. Mantém a distância à ponta `a`, como no giro.
  return offset;
}

/** Lê de um patch de parede só o que muda as pontas (mesma leitura de `endsFromCommands`). */
export function wallEndsPatchOf(patch: Partial<Wall>): WallEndsPatch {
  const out: WallEndsPatch = {};
  if (patch.a !== undefined) out.a = patch.a;
  if (patch.b !== undefined) out.b = patch.b;
  if (patch.sag !== undefined) out.sag = patch.sag;
  return out;
}

/** `true` se o patch mexe em pontas/flecha (aí as aberturas precisam ser recompensadas). */
export function changesWallEnds(patch: Partial<Wall>): boolean {
  return patch.a !== undefined || patch.b !== undefined || patch.sag !== undefined;
}

/** Garante que a abertura continue dentro da parede depois de qualquer edição. */
export function clampOffset(p: Project, o: Opening, wall: Wall): number {
  const t = openingTypeById(p, o.typeId);
  const half = (t?.width ?? 0.8) / 2;
  const l = wallLength(wall);
  return Math.max(Math.min(half, l / 2), Math.min(o.offset, l - Math.min(half, l / 2)));
}

/** Compensa o `offset` de todas as aberturas da parede antes de aplicar as pontas novas (usado pelos comandos). */
export function rehostOpenings(p: Project, before: Wall, after: Wall, patch: WallEndsPatch): void {
  const offsets = new Map<Id, number>();
  for (const e of Object.values(p.elements)) {
    if (isOpening(e) && e.hostId === before.id) offsets.set(e.id, openingOffsetAfterEnds(before, e.offset, patch));
  }
  for (const [id, offset] of offsets) {
    const o = p.elements[id];
    if (o && isOpening(o)) o.offset = clampOffset(p, { ...o, offset }, after);
  }
}
