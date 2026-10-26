/**
 * Comandos de Modificar que agem sobre as linhas do rascunho do perímetro. O botão do painel Modificar liga um
 * deles (`PerimeterTool.setModify`); sem comando ativo a ferramenta volta a selecionar linhas.
 */
export type PerimeterModifyKind =
  | 'trim' /** Aparar/Estender: dois cliques em linhas, forma o canto. Tab alterna: canto / aparar até limite / estender até limite. */
  | 'split' /** Dividir elemento: clique no ponto. Tab alterna: dividir / dividir com espaço (dois cliques). */
  | 'offset' /** Deslocar: distância digitada ou clique do lado; laço conectado mantém os cantos. */
  | 'move'
  | 'copy'
  | 'rotate'
  | 'mirror' /** Espelhar: dois pontos do eixo; copia por padrão com Tab. */
  | 'array'
  | 'align' /** Alinhar linha a uma referência. */
  | 'delete';

export const PERIMETER_MODIFY_LABEL: Record<PerimeterModifyKind, string> = {
  trim: 'Aparar/Estender',
  split: 'Dividir elemento',
  offset: 'Deslocar',
  move: 'Mover',
  copy: 'Copiar',
  rotate: 'Girar',
  mirror: 'Espelhar',
  array: 'Matriz',
  align: 'Alinhar',
  delete: 'Excluir',
};
