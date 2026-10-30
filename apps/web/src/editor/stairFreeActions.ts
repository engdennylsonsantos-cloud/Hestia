import { measureFreeStair, optimizeStair, regenStairFree, type StairFreeResult } from '@hestia/engine';
import { isStair, stairBaseZ, stairTopZ, type Id, type ProjectStore, type Stair } from '@hestia/model';

/** Grava o resultado de `regenStairFree` na escada: componentes, trajeto e patamares manuais, em UMA transação. */
export function applyStairFreeRegen(store: ProjectStore, id: Id, r: StairFreeResult, label = 'Editar escada'): void {
  store.transaction(label, () => {
    store.exec({
      type: 'updateElements',
      ids: [id],
      patch: { components: r.components, freePath: r.freePath, manualLandings: r.manualLandings },
    });
  });
}

/**
 * "Ajustar" da escada livre: `optimizeStair` escolhe N, h e piso dentro da norma do tipo a partir do trajeto e a escada
 * é regenerada em UMA transação "Ajustar escada". Devolve a mensagem "Ajustado: ..." ou o erro.
 */
export function adjustStairFree(store: ProjectStore, id: Id): { message: string } | { error: string } {
  const p = store.project;
  const stair = p.elements[id];
  if (!isStair(stair) || !stair.freePath || stair.freePath.length < 2) return { error: 'Escada livre inexistente.' };
  const type = p.stairTypes[stair.typeId];
  if (!type) return { error: 'Tipo de escada inexistente' };
  const H = stairTopZ(p, stair) - stairBaseZ(p, stair);
  if (!(H > 0)) return { error: 'O nível de topo não fica acima da base: nada a ajustar.' };
  const m = measureFreeStair(stair);
  if (!m) return { error: 'A escada não tem um lance válido para ajustar.' };
  const r = optimizeStair({ path: stair.freePath, H, type, width: m.width, landingDepth: m.width });
  if ('error' in r) return { error: r.error };
  const res = regenStairFree(stair, p, { freePath: r.path, fixed: r.fixed });
  if ('error' in res) return { error: res.error };
  applyStairFreeRegen(store, id, res, 'Ajustar escada');
  return { message: r.note };
}

/**
 * Grava campos de uma escada livre (níveis, deslocamentos, altura, tipo) e regenera o croqui na MESMA transação: a
 * escada com o patch é simulada num projeto novo (os resolvedores são memoizados por objeto de projeto). Erro do motor
 * não grava nada e volta como `{ error }`.
 */
export function patchStairFree(store: ProjectStore, id: Id, patch: Partial<Stair>, label = 'Editar escada'): { error: string } | null {
  const p = store.project;
  const stair = p.elements[id];
  if (!isStair(stair)) return { error: 'Escada inexistente.' };
  const atualizada = { ...stair, ...patch } as Stair;
  const projeto = { ...p, elements: { ...p.elements, [id]: atualizada } };
  const res = regenStairFree(atualizada, projeto, {});
  if ('error' in res) return { error: res.error };
  store.transaction(label, () => {
    store.exec({
      type: 'updateElements',
      ids: [id],
      patch: { ...patch, components: res.components, freePath: res.freePath, manualLandings: res.manualLandings },
    });
  });
  return null;
}
