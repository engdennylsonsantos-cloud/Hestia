import type { Id, Project, ProjectStore } from '@hestia/model';
import { clipboardFrom, copyableIds as copyableIdsOf, idsOfType, pasteAlignedCommand, sameNameRoomIds, selectedTypeId, type ClipBuffer } from '@hestia/tools';
import { useUi } from './state.ts';

/** Contagens do buffer copiado (ausente em buffers antigos = nenhuma escada). */
const counts = (c: ClipBuffer): Counts => ({ walls: c.walls.length, floors: c.floors.length, slabs: c.slabs.length, roofs: c.roofs.length, stairs: c.stairs?.length ?? 0, rooms: c.rooms?.length ?? 0 });

/** Contagem por categoria do que foi copiado ou colado. */
interface Counts {
  walls: number;
  floors: number;
  slabs: number;
  roofs: number;
  stairs: number;
  rooms: number;
}

/** "2 parede(s), 1 piso, 1 laje e 1 escada": frase do status para o que foi copiado ou colado. */
function describe(c: Counts): string {
  const parts: string[] = [];
  if (c.walls) parts.push(`${c.walls} parede(s)`);
  if (c.floors) parts.push(`${c.floors} piso(s)`);
  if (c.slabs) parts.push(`${c.slabs} laje(s)`);
  if (c.roofs) parts.push(`${c.roofs} telhado(s)`);
  if (c.stairs) parts.push(`${c.stairs} escada(s)`);
  if (c.rooms) parts.push(`${c.rooms} ambiente(s)`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : (parts[0] ?? '');
}

/**
 * Copiar e colar alinhado (área de transferência em memória) e seleção por tipo ("Mesmo tipo").
 * Fica fora do controlador só para que ele apenas repasse as ações (limite de linhas por arquivo).
 */
export class Transfer {
  private clip: ClipBuffer | null = null;

  /** Já há algo copiado? (o buffer vive só na memória desta sessão) */
  hasClip(): boolean {
    return this.clip !== null;
  }

  /** Ids que Copiar levaria da seleção (paredes, pisos, lajes, telhados, escadas, rampas, ambientes e aberturas hospedadas). */
  copyableIds(p: Project, ids: readonly Id[]): Id[] {
    return copyableIdsOf(p, ids);
  }

  /** Copia as paredes selecionadas e as aberturas nelas. Sem parede, mantém o que já estava copiado. */
  copy(p: Project, ids: Id[]): boolean {
    const next = clipboardFrom(p, ids);
    if (!next) {
      useUi.setState({ status: 'Selecione paredes, pisos, lajes, telhados ou escadas para copiar.' });
      return false;
    }
    this.clip = next;
    useUi.setState({ status: `${describe(counts(next))} copiado(s). Ctrl+V cola alinhado no nível ativo.` });
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
    const pasted: Counts = { walls: r.wallIds.length, floors: r.floorIds.length, slabs: r.slabIds.length, roofs: r.roofIds.length, stairs: r.stairIds.length, rooms: r.roomIds.length };
    useUi.setState({ selection: [...r.wallIds, ...r.openingIds, ...r.floorIds, ...r.slabIds, ...r.roofIds, ...r.stairIds, ...r.roomIds], status: `${describe(pasted)} colado(s) no mesmo lugar. Ctrl+Z desfaz.` });
    return true;
  }

  /** Seleciona os elementos (paredes, aberturas, pisos, lajes, telhados e escadas) do nível com o tipo dado. Devolve quantos. */
  ofType(p: Project, levelId: Id, typeId: Id): number {
    const ids = idsOfType(p, levelId, typeId);
    useUi.setState({ selection: ids, status: ids.length ? `${ids.length} elemento(s) do mesmo tipo selecionado(s).` : 'Nenhum elemento deste tipo neste nível.' });
    return ids.length;
  }

  /** "Mesmo nome" (ambientes): seleciona todos os ambientes do nível com o nome dos ambientes selecionados. Devolve quantos. */
  sameName(p: Project, levelId: Id): number {
    const ids = sameNameRoomIds(p, levelId, useUi.getState().selection);
    useUi.setState({ selection: ids, status: ids.length ? `${ids.length} ambiente(s) com o mesmo nome selecionado(s).` : 'Selecione um ambiente primeiro: Mesmo nome seleciona os ambientes do nível com o mesmo nome (só ambientes).' });
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
