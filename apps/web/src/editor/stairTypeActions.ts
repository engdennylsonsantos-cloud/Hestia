import { newId, stairTypeUsage, type Id, type Project, type ProjectStore, type StairType } from '@hestia/model';
import type { DeleteResult } from './typeActions.ts';

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Motivo pelo qual o tipo de escada não pode ser excluído (em uso ou único); null quando pode. */
export function stairTypeDeleteBlock(p: Project, typeId: Id): string | null {
  if (Object.keys(p.stairTypes).length <= 1) return 'É o único tipo de escada do projeto.';
  const uso = stairTypeUsage(p, typeId);
  if (uso > 0) return `Em uso por ${plural(uso, 'escada', 'escadas')}.`;
  return null;
}

/** Exclui o tipo de escada (o comando recusa se estiver em uso), devolvendo o erro em vez de lançá-lo. */
export function tryDeleteStairType(store: ProjectStore, typeId: Id): DeleteResult {
  try {
    store.exec({ type: 'deleteStairType', id: typeId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha desconhecida.' };
  }
}

/** Cópia do tipo de escada com id novo e nome "(cópia)". Devolve o id criado, ou null se o tipo não existe. */
export function duplicateStairType(store: ProjectStore, typeId: Id): Id | null {
  const src = store.project.stairTypes[typeId];
  if (!src) return null;
  const copy: StairType = { ...structuredClone(src), id: newId('stt'), name: `${src.name} (cópia)` };
  store.exec({ type: 'upsertStairType', stairType: copy }, 'Duplicar tipo de escada');
  return copy.id;
}

/** Renomeia o tipo de escada; nome vazio não é aceito. */
export function renameStairType(store: ProjectStore, typeId: Id, name: string): DeleteResult {
  const clean = name.trim();
  const src = store.project.stairTypes[typeId];
  if (!src) return { ok: false, error: 'Tipo inexistente.' };
  if (!clean) return { ok: false, error: 'Dê um nome ao tipo.' };
  store.exec({ type: 'upsertStairType', stairType: { ...src, name: clean } }, 'Renomear tipo de escada');
  return { ok: true };
}

/**
 * Validação do tipo antes de salvar: nome; medidas positivas (espelho, piso, largura, patamar, folga); e a espessura do
 * estilo escolhido (monolítico: profundidade estrutural; montado: piso e espelho). Devolve a 1ª mensagem, ou null.
 */
export function stairTypeError(t: Pick<StairType, 'name' | 'maxRiser' | 'minTread' | 'minRunWidth' | 'runStyle' | 'structuralDepth' | 'treadThickness' | 'riserThickness' | 'landingThickness' | 'minHeadroom' | 'nosing'>): string | null {
  if (!t.name.trim()) return 'Dê um nome ao tipo.';
  if (!(t.maxRiser > 0)) return 'O espelho máximo precisa ser maior que zero.';
  if (!(t.minTread > 0)) return 'O piso mínimo precisa ser maior que zero.';
  if (!(t.minRunWidth > 0)) return 'A largura mínima do lance precisa ser maior que zero.';
  if (!(t.minHeadroom > 0)) return 'A folga de cabeça precisa ser maior que zero.';
  if (!(t.landingThickness > 0)) return 'A espessura do patamar precisa ser maior que zero.';
  if (t.nosing < 0) return 'O nariz não pode ser negativo.';
  if (t.runStyle === 'monolithic' && !(t.structuralDepth > 0)) return 'Escada monolítica: a profundidade estrutural precisa ser maior que zero.';
  if (t.runStyle === 'assembled' && !(t.treadThickness > 0 && t.riserThickness > 0)) return 'Escada montada: a espessura do piso e do espelho precisa ser maior que zero.';
  return null;
}
