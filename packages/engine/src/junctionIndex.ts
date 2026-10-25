import { isFloor, isRoof, isSlab, isStair, type Element, type Project } from '@hestia/model';

/**
 * Horizontais do projeto (pisos, lajes, escadas e telhados) por snapshot, montados numa única passagem sobre
 * `p.elements`. Os cortadores de cada nível os leem inteiros, então sem este cache cada nível varreria o projeto.
 * A ordem é a de `Object.values(p.elements)`, a mesma das consultas de `@hestia/model`. (As aberturas por parede vêm do
 * índice de `openingsOfWall` no próprio `@hestia/model`.)
 */
const horizontaisPorProjeto = new WeakMap<Project, readonly Element[]>();

/** Horizontais do projeto inteiro, na ordem do projeto. Projeto novo (edição) monta outra lista. */
export function horizontaisDoProjeto(p: Project): readonly Element[] {
  const hit = horizontaisPorProjeto.get(p);
  if (hit) return hit;
  const lista = Object.values(p.elements).filter((e) => isFloor(e) || isSlab(e) || isStair(e) || isRoof(e));
  horizontaisPorProjeto.set(p, lista);
  return lista;
}
