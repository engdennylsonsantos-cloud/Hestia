import type { Id } from '@hestia/model';

/**
 * Seleção depois de um clique na vista 3D (sem arrasto), como na planta. Sem Shift/Ctrl, o elemento clicado substitui a
 * seleção. Com Shift/Ctrl, entra nela ou sai dela. Clique no vazio limpa a seleção, exceto com Shift/Ctrl (que a mantêm).
 */
export function selectionAfterClick(current: readonly Id[], hit: Id | null, additive: boolean): Id[] {
  if (hit === null) return additive ? [...current] : [];
  if (!additive) return [hit];
  return current.includes(hit) ? current.filter((id) => id !== hit) : [...current, hit];
}
