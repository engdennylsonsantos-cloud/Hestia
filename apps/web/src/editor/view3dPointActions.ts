import { defaultView3DPointName, makeView3DPoint, view3DPointOf, type Id, type ProjectStore, type SheetView3DCamera } from '@hestia/model';
import { editor } from './controller.ts';
import { camera3DAtual, pedirCamera3D } from './vista3dAoVivo.ts';

/**
 * Ações do catálogo de pontos de vista 3D (decisão 0040): salvar a câmera atual, atualizar, renomear, excluir e voltar
 * ao 3D num ponto. Cada escrita é um comando com desfazer; a tela só chama (o teste roda com `ProjectStore` real).
 */

/** Recusa em pt-BR de uma ação, ou null quando gravou. */
export type Recusa = string | null;

/** Motivo padrão de falha, para nunca devolver um erro vazio à barra de status. */
const falha = (e: unknown, padrao: string): string => (e instanceof Error ? e.message : padrao);

/** Recado comum quando não há órbita viva de onde ler a câmera. */
const SEM_VISTA_3D = 'A vista 3D não está aberta. Abra o Modelo 3D para usar a câmera atual.';

/**
 * Salva a câmera da vista 3D viva como um ponto novo. Sem nome, usa o próximo "Vista 3D"/"Vista 3D 2"…; devolve o id
 * criado, ou a recusa em pt-BR (vista 3D fechada, nome vazio, câmera inválida).
 */
export function salvarPonto3DAction(store: ProjectStore, nome?: string): { id: Id } | { erro: string } {
  const camera = camera3DAtual();
  if (!camera) return { erro: SEM_VISTA_3D };
  try {
    const ponto = makeView3DPoint(camera, nome ?? defaultView3DPointName(store.project));
    store.exec({ type: 'addView3DPoint', point: ponto }, 'Salvar ponto de vista 3D');
    return { id: ponto.id };
  } catch (e) {
    return { erro: falha(e, 'Não foi possível salvar o ponto de vista 3D.') };
  }
}

/**
 * Grava a câmera da vista 3D viva no ponto (Revit: *Update View*). As pranchas que usam o ponto acompanham, porque
 * guardam só o `pointId`. Devolve a recusa, ou null quando gravou.
 */
export function atualizarPonto3DAction(store: ProjectStore, id: Id): Recusa {
  if (!view3DPointOf(store.project, id)) return 'Ponto de vista 3D inexistente.';
  const camera = camera3DAtual();
  if (!camera) return SEM_VISTA_3D;
  try {
    store.exec({ type: 'updateView3DPoint', id, patch: { camera } }, 'Atualizar ponto de vista 3D');
    return null;
  } catch (e) {
    return falha(e, 'Não foi possível atualizar o ponto de vista 3D.');
  }
}

/** Troca o nome do ponto (o modelo recusa nome vazio). Devolve a recusa, ou null quando gravou. */
export function renomearPonto3DAction(store: ProjectStore, id: Id, nome: string): Recusa {
  if (!view3DPointOf(store.project, id)) return 'Ponto de vista 3D inexistente.';
  try {
    store.exec({ type: 'updateView3DPoint', id, patch: { name: nome } }, 'Renomear ponto de vista 3D');
    return null;
  } catch (e) {
    return falha(e, 'Não foi possível renomear o ponto de vista 3D.');
  }
}

/**
 * Exclui o ponto do catálogo. O comando do modelo copia a câmera para as vistas de prancha que o usavam, então nenhuma
 * prancha fica em branco. Devolve a recusa, ou null quando gravou.
 */
export function excluirPonto3DAction(store: ProjectStore, id: Id): Recusa {
  if (!view3DPointOf(store.project, id)) return 'Ponto de vista 3D inexistente.';
  try {
    store.exec({ type: 'removeView3DPoint', id }, 'Excluir ponto de vista 3D');
    return null;
  } catch (e) {
    return falha(e, 'Não foi possível excluir o ponto de vista 3D.');
  }
}

/** Câmera do ponto, ou null quando o ponto não existe mais. */
export function cameraDoPonto3D(store: Pick<ProjectStore, 'project'>, id: Id): SheetView3DCamera | null {
  return view3DPointOf(store.project, id)?.camera ?? null;
}

/**
 * Leva a vista 3D à câmera do ponto: abre (ou ativa) a aba 3D e deixa a câmera pendente para a tela aplicar.
 * A leitura do projeto é por parâmetro para o teste não depender do controlador; a tela usa o projeto aberto.
 * Devolve a recusa, ou null quando o pedido foi feito.
 */
export function irParaPonto3DAction(id: Id, store: Pick<ProjectStore, 'project'> = editor.store): Recusa {
  const camera = cameraDoPonto3D(store, id);
  if (!camera) return 'Ponto de vista 3D inexistente.';
  pedirCamera3D(camera);
  return null;
}
