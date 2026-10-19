import { newId, type Id, type Project, type ProjectStore, type SlabType } from '@hestia/model';
import { floorTypeError, instancesOfType, type DeleteResult } from './typeActions.ts';

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Lajes que usam o tipo (em todos os níveis). */
export const slabTypeUsage = (p: Project, typeId: Id): number => instancesOfType(p, 'slab', typeId).length;

/** Motivo pelo qual o tipo de laje não pode ser excluído (em uso ou único); null quando pode. */
export function slabTypeDeleteBlock(p: Project, typeId: Id): string | null {
  if (Object.keys(p.slabTypes).length <= 1) return 'É o único tipo de laje do projeto.';
  const uso = slabTypeUsage(p, typeId);
  if (uso > 0) return `Em uso por ${plural(uso, 'laje', 'lajes')}.`;
  return null;
}

/** Exclui o tipo de laje (o comando recusa se estiver em uso), devolvendo o erro em vez de lançá-lo. */
export function tryDeleteSlabType(store: ProjectStore, typeId: Id): DeleteResult {
  try {
    store.exec({ type: 'deleteSlabType', id: typeId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha desconhecida.' };
  }
}

/** Cópia do tipo de laje com id novo e nome "(cópia)". Devolve o id criado, ou null se o tipo não existe. */
export function duplicateSlabType(store: ProjectStore, typeId: Id): Id | null {
  const src = store.project.slabTypes[typeId];
  if (!src) return null;
  const copy: SlabType = { ...structuredClone(src), id: newId('ls'), name: `${src.name} (cópia)` };
  store.exec({ type: 'upsertSlabType', slabType: copy }, 'Duplicar tipo de laje');
  return copy.id;
}

/** Renomeia o tipo de laje; nome vazio não é aceito. */
export function renameSlabType(store: ProjectStore, typeId: Id, name: string): DeleteResult {
  const clean = name.trim();
  const src = store.project.slabTypes[typeId];
  if (!src) return { ok: false, error: 'Tipo inexistente.' };
  if (!clean) return { ok: false, error: 'Dê um nome ao tipo.' };
  store.exec({ type: 'upsertSlabType', slabType: { ...src, name: clean } }, 'Renomear tipo de laje');
  return { ok: true };
}

/** Mesma regra das camadas do piso: ao menos uma camada, espessura positiva (só membrana pode ser zero), nome. */
export const slabTypeError = (t: Pick<SlabType, 'name' | 'layers'>): string | null => floorTypeError(t);

/** Tipo de laje das opções ao abrir um projeto: mantém o escolhido se existir no projeto, senão o primeiro. */
export const keptSlabType = (p: Project, current: Id): Id => (p.slabTypes[current] ? current : (Object.keys(p.slabTypes)[0] ?? current));
