import { newId, rampTypeIssue, rampTypeUsage, type Id, type Project, type ProjectStore, type RampType } from '@hestia/model';
import type { DeleteResult } from './typeActions.ts';

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Motivo pelo qual o tipo de rampa não pode ser excluído (em uso ou único); null quando pode. */
export function rampTypeDeleteBlock(p: Project, typeId: Id): string | null {
  if (Object.keys(p.rampTypes).length <= 1) return 'É o único tipo de rampa do projeto.';
  const uso = rampTypeUsage(p, typeId);
  if (uso > 0) return `Em uso por ${plural(uso, 'rampa', 'rampas')}.`;
  return null;
}

/** Exclui o tipo de rampa (o comando recusa se estiver em uso), devolvendo o erro em vez de lançá-lo. */
export function tryDeleteRampType(store: ProjectStore, typeId: Id): DeleteResult {
  try {
    store.exec({ type: 'deleteRampType', id: typeId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha desconhecida.' };
  }
}

/** Cópia do tipo de rampa com id novo e nome "(cópia)". Devolve o id criado, ou null se o tipo não existe. */
export function duplicateRampType(store: ProjectStore, typeId: Id): Id | null {
  const src = store.project.rampTypes[typeId];
  if (!src) return null;
  const copy: RampType = { ...structuredClone(src), id: newId('rmt'), name: `${src.name} (cópia)` };
  store.exec({ type: 'upsertRampType', rampType: copy }, 'Duplicar tipo de rampa');
  return copy.id;
}

/** Renomeia o tipo de rampa; nome vazio não é aceito. */
export function renameRampType(store: ProjectStore, typeId: Id, name: string): DeleteResult {
  const clean = name.trim();
  const src = store.project.rampTypes[typeId];
  if (!src) return { ok: false, error: 'Tipo inexistente.' };
  if (!clean) return { ok: false, error: 'Dê um nome ao tipo.' };
  store.exec({ type: 'upsertRampType', rampType: { ...src, name: clean } }, 'Renomear tipo de rampa');
  return { ok: true };
}

/** Validação do tipo antes de salvar: nome e as regras de `rampTypeIssue` (medidas e tabela de norma). */
export function rampTypeError(t: RampType): string | null {
  if (!t.name.trim()) return 'Dê um nome ao tipo.';
  return rampTypeIssue(t);
}
