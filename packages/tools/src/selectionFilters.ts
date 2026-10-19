import { isOpening, isWall, type Id, type Project } from '@hestia/model';

/** Categorias de filtro: paredes, portas e janelas. */
export type ElementCategory = 'walls' | 'doors' | 'windows';

/** Parede ou abertura pertence ao nível? Abertura pertence ao nível da parede que a hospeda. */
function onLevel(p: Project, id: Id, levelId: Id): boolean {
  const e = p.elements[id];
  if (isWall(e)) return e.levelId === levelId;
  if (isOpening(e)) {
    const host = p.elements[e.hostId];
    return isWall(host) && host.levelId === levelId;
  }
  return false;
}

/** Todas as paredes e aberturas do nível que usam o tipo `typeId`. */
export function idsOfType(p: Project, levelId: Id, typeId: Id): Id[] {
  return Object.values(p.elements)
    .filter((e) => (isWall(e) || isOpening(e)) && e.typeId === typeId && onLevel(p, e.id, levelId))
    .map((e) => e.id);
}

/** Todos os elementos de uma categoria no nível. */
export function idsOfCategory(p: Project, levelId: Id, category: ElementCategory): Id[] {
  return Object.values(p.elements)
    .filter((e) => {
      if (category === 'walls') return isWall(e) && onLevel(p, e.id, levelId);
      if (category === 'doors') return isOpening(e) && e.kind === 'door' && onLevel(p, e.id, levelId);
      return isOpening(e) && e.kind === 'window' && onLevel(p, e.id, levelId);
    })
    .map((e) => e.id);
}

/**
 * Tipo dos elementos selecionados. Devolve erro em texto se a seleção está vazia ou mistura tipos.
 * Ids que não são paredes nem aberturas são ignorados.
 */
export function selectedTypeId(p: Project, ids: Id[]): { typeId: Id } | { error: string } {
  const types = new Set<Id>();
  for (const id of ids) {
    const e = p.elements[id];
    if (isWall(e) || isOpening(e)) types.add(e.typeId);
  }
  if (types.size === 0) return { error: 'Selecione uma parede ou abertura primeiro.' };
  if (types.size > 1) return { error: 'A seleção tem mais de um tipo. Selecione elementos de um só tipo.' };
  return { typeId: [...types][0]! };
}
