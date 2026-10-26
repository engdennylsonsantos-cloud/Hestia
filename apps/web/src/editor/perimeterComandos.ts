import type { PerimeterModifyKind, ToolId } from '@hestia/tools';

/**
 * Ferramentas da faixa que, com o modo de perímetro aberto, viram um comando de Modificar sobre as linhas do esboço
 * (`PerimeterTool.setModify`). Fora do modo continuam sendo as ferramentas normais do app. "Excluir" é uma ação da
 * faixa (ver `actions.ts`), não uma ferramenta, e entra pelo mesmo nome de comando.
 */
export const COMANDO_DO_ESBOCO: Partial<Record<ToolId, PerimeterModifyKind>> = {
  align: 'align',
  move: 'move',
  copy: 'copy',
  offset: 'offset',
  rotate: 'rotate',
  mirror: 'mirror',
  trim: 'trim',
  split: 'split',
  array: 'array',
};

/** Ferramentas de Modificar sem sentido no esboço: ficam desabilitadas na faixa, com este motivo no tooltip. */
export const SEM_ESBOCO: Partial<Record<ToolId, string>> = {
  parallel: 'Parede paralela usa uma parede do projeto: não se aplica às linhas do esboço.',
  rehost: 'Trocar hospedeiro usa um elemento do projeto: não se aplica às linhas do esboço.',
};

/** Motivo do tooltip dos botões que ainda não existem para o esboço (Escala, Fixar, Desafixar). */
export const SEM_ESBOCO_AINDA = 'Ainda não existe para as linhas do esboço.';

/** Dica do comando ligado, na barra de status (a barra de opções mostra o nome do comando). */
export const DICA_COMANDO: Record<PerimeterModifyKind, string> = {
  trim: 'Aparar/Estender: clique em duas linhas para formar o canto. Tab alterna o modo.',
  split: 'Dividir elemento: clique no ponto da linha onde ela será dividida. Tab alterna o modo.',
  offset: 'Deslocar: digite a distância ou clique do lado para onde deslocar.',
  move: 'Mover: escolha o ponto de origem e depois o de destino.',
  copy: 'Copiar: escolha o ponto de origem e depois o de destino.',
  rotate: 'Rotacionar: escolha o centro e depois o ângulo.',
  mirror: 'Espelhar: clique em dois pontos do eixo. Tab copia.',
  array: 'Matriz: escolha a linha a repetir e depois a distância.',
  align: 'Alinhar: clique na linha a alinhar e depois na linha de referência.',
  delete: 'Excluir: clique nas linhas a remover. Delete remove as selecionadas.',
};

/** Mensagem quando o comando não pode começar (o esboço não tem linhas que sirvam a ele). */
export const COMANDO_RECUSADO = 'Este comando não pode começar com as linhas atuais do esboço.';
