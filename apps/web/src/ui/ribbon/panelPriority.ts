import { P_CLIPBOARD, P_CREATE, P_GEOMETRY, P_MEASURE, P_MODIFY, P_PROPS, P_SELECT, P_VIEW_MOD } from './panelsShared.ts';

/** Painéis genéricos da aba contextual: são os primeiros a ir para o botão suspenso quando falta largura. */
const GENERICOS = new Set([P_CLIPBOARD.id, P_GEOMETRY.id, P_VIEW_MOD.id, P_CREATE.id, P_MEASURE.id]);
const NORMAIS = new Set([P_PROPS.id, P_MODIFY.id]);

/** Prioridade de recolhimento de um painel: Selecionar e os do assunto (Editar perímetro etc.) ficam; os genéricos saem antes. */
export function prioridadeDoPainel(id: string): number {
  if (id === P_SELECT.id) return 3;
  if (GENERICOS.has(id)) return -1;
  if (NORMAIS.has(id)) return 1;
  return 2;
}
