import type { Id, Project, ProjectStore } from '@hestia/model';
import { clipboardFrom, idsOfType, pasteAlignedCommand, selectedTypeId, type ClipBuffer } from '@hestia/tools';
import { useUi } from './state.ts';

/** "2 parede(s) e 1 piso": frase do status para o que foi copiado ou colado. */
function describe(walls: number, floors: number): string {
  const parts: string[] = [];
  if (walls) parts.push(`${walls} parede(s)`);
  if (floors) parts.push(`${floors} piso(s)`);
  return parts.join(' e ');
}

/**
 * Copiar e colar alinhado (área de transferência em memória) e seleção por tipo ("Mesmo tipo").
 * Fica fora do controlador só para que ele apenas repasse as ações (limite de linhas por arquivo).
 */
export class Transfer {
  private clip: ClipBuffer | null = null;

  /** Copia as paredes selecionadas e as aberturas nelas. Sem parede, mantém o que já estava copiado. */
  copy(p: Project, ids: Id[]): boolean {
    const next = clipboardFrom(p, ids);
    if (!next) {
      useUi.setState({ status: 'Selecione paredes para copiar.' });
      return false;
    }
    this.clip = next;
    useUi.setState({ status: `${describe(next.walls.length, next.floors.length)} copiado(s). Ctrl+V cola alinhado no nível ativo.` });
    return true;
  }

  /** Cola o copiado no nível, nas mesmas coordenadas, em um único passo de desfazer, e seleciona o resultado. */
  paste(store: ProjectStore, levelId: Id): boolean {
    if (!this.clip) {
      useUi.setState({ status: 'Nada copiado. Selecione paredes e use Ctrl+C.' });
      return false;
    }
    const r = pasteAlignedCommand(store.project, this.clip, levelId);
    if (!r) {
      useUi.setState({ status: 'Não há o que colar neste nível.' });
      return false;
    }
    store.exec(r.command, 'Colar alinhado');
    useUi.setState({ selection: [...r.wallIds, ...r.openingIds, ...r.floorIds], status: `${describe(r.wallIds.length, r.floorIds.length)} colado(s) no mesmo lugar. Ctrl+Z desfaz.` });
    return true;
  }

  /** Seleciona paredes e aberturas do nível com o tipo dado. Devolve quantas foram selecionadas. */
  ofType(p: Project, levelId: Id, typeId: Id): number {
    const ids = idsOfType(p, levelId, typeId);
    useUi.setState({ selection: ids, status: ids.length ? `${ids.length} elemento(s) do mesmo tipo selecionado(s).` : 'Nenhum elemento deste tipo neste nível.' });
    return ids.length;
  }

  /** "Mesmo tipo": seleciona todos do tipo da seleção atual (que precisa ser de um só tipo). */
  sameType(p: Project, levelId: Id): number {
    const r = selectedTypeId(p, useUi.getState().selection);
    if ('error' in r) {
      useUi.setState({ status: r.error });
      return 0;
    }
    return this.ofType(p, levelId, r.typeId);
  }
}

/** Área de transferência do editor (uma só, em memória). */
export const transfer = new Transfer();
