import { ProjectStore, isOpening, isWall, wallTypeUsage, type Element, type Id, type Project } from '@hestia/model';

/** Tipos que o navegador de projeto lista: parede, porta e janela. */
export type TypeKind = 'wall' | 'door' | 'window';

export interface TypeChoice {
  id: Id;
  name: string;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const otherLevels = (n: number): string => (n === 1 ? '1 em outro nível' : `${n} em outros níveis`);

/** Nível de um elemento: a parede tem o seu; a abertura herda o da parede anfitriã. */
export function levelOfElement(p: Project, e: Element): Id | undefined {
  if (isWall(e)) return e.levelId;
  const host = p.elements[e.hostId];
  return isWall(host) ? host.levelId : undefined;
}

function usesType(e: Element, kind: TypeKind, typeId: Id): boolean {
  if (kind === 'wall') return isWall(e) && e.typeId === typeId;
  return isOpening(e) && e.kind === kind && e.typeId === typeId;
}

/** Ids de todos os elementos que usam o tipo, em todos os níveis. */
export function instancesOfType(p: Project, kind: TypeKind, typeId: Id): Id[] {
  return Object.values(p.elements)
    .filter((e) => usesType(e, kind, typeId))
    .map((e) => e.id);
}

/** Separa as instâncias do nível atual das de outros níveis. */
export function splitByLevel(p: Project, ids: Id[], levelId: Id): { here: Id[]; elsewhere: number } {
  const here: Id[] = [];
  let elsewhere = 0;
  for (const id of ids) {
    const e = p.elements[id];
    if (!e) continue;
    if (levelOfElement(p, e) === levelId) here.push(id);
    else elsewhere++;
  }
  return { here, elsewhere };
}

/**
 * Plano de "Selecionar todas as instâncias": seleciona só as do nível atual (sem trocar de nível)
 * e descreve no status quantas ficaram em outros níveis.
 */
export function selectAllPlan(p: Project, kind: TypeKind, typeId: Id, levelId: Id, typeName: string): { ids: Id[]; status: string } {
  const all = instancesOfType(p, kind, typeId);
  if (all.length === 0) return { ids: [], status: `Nenhuma instância de «${typeName}» no projeto.` };
  const { here, elsewhere } = splitByLevel(p, all, levelId);
  if (here.length === 0) return { ids: [], status: `Nenhuma instância neste nível; ${otherLevels(elsewhere)}.` };
  const extra = elsewhere > 0 ? `, ${otherLevels(elsewhere)}` : '';
  return { ids: here, status: `${plural(here.length, 'instância', 'instâncias')} neste nível${extra}.` };
}

/** Tipos que podem substituir `typeId`: outros tipos de parede, ou de porta/janela do mesmo tipo. */
export function compatibleTypes(p: Project, kind: TypeKind, typeId: Id): TypeChoice[] {
  const list =
    kind === 'wall'
      ? Object.values(p.wallTypes).filter((t) => t.id !== typeId)
      : Object.values(p.openingTypes).filter((t) => t.kind === kind && t.id !== typeId);
  return list.map((t) => ({ id: t.id, name: t.name }));
}

/**
 * Substitui o tipo em todas as instâncias (todos os níveis) com UM comando `updateElements`,
 * dentro de uma transação: um único passo de desfazer. Devolve quantas instâncias foram trocadas.
 */
export function replaceType(store: ProjectStore, kind: TypeKind, fromId: Id, toId: Id): number {
  if (!compatibleTypes(store.project, kind, fromId).some((t) => t.id === toId)) throw new Error('Tipo de destino incompatível.');
  const ids = instancesOfType(store.project, kind, fromId);
  if (ids.length === 0) return 0;
  store.transaction('Substituir tipo', () => {
    store.exec({ type: 'updateElements', ids, patch: { typeId: toId } });
  });
  return ids.length;
}

export function replaceStatus(count: number, toName: string): string {
  return `${plural(count, 'instância substituída', 'instâncias substituídas')} por «${toName}».`;
}

/** Motivo pelo qual o tipo de parede não pode ser excluído; null quando pode. */
export function wallTypeDeleteBlock(p: Project, typeId: Id): string | null {
  if (p.defaults.wallTypeId === typeId) return 'É o tipo padrão do projeto.';
  const uso = wallTypeUsage(p, typeId);
  if (uso > 0) return `Em uso por ${plural(uso, 'parede', 'paredes')}.`;
  return null;
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

/** Exclui o tipo de parede pelo comando `deleteWallType`, devolvendo o erro em vez de lançá-lo. */
export function tryDeleteWallType(store: ProjectStore, typeId: Id): DeleteResult {
  try {
    store.exec({ type: 'deleteWallType', id: typeId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha desconhecida.' };
  }
}
