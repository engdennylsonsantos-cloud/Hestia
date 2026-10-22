import { roomsForEnclosedCircuits } from '@hestia/tools';
import { editor } from './controller.ts';
import { useUi } from './state.ts';

/**
 * Cria um ambiente em cada circuito fechado do nível ativo que ainda não tem nenhum, num só passo de desfazer, e deixa
 * os novos selecionados. Devolve a quantidade criada (0 = nada a fazer) e a mensagem para a barra de status.
 */
export function addRoomsAllCircuits(): { count: number; message: string } {
  const p = editor.project;
  const levelId = useUi.getState().levelId;
  const rooms = roomsForEnclosedCircuits(p, levelId);
  if (rooms.length === 0) {
    const message = 'Todos os circuitos fechados já têm ambiente (ou não há circuito fechado neste nível).';
    useUi.setState({ status: message });
    return { count: 0, message };
  }
  editor.store.transaction('Ambientes em todos os circuitos', () => {
    for (const room of rooms) editor.store.exec({ type: 'addRoom', room });
  });
  useUi.setState({ selection: rooms.map((r) => r.id) });
  const message = `${rooms.length} ${rooms.length === 1 ? 'ambiente criado' : 'ambientes criados'} em circuitos fechados. Ctrl+Z desfaz.`;
  useUi.setState({ status: message });
  return { count: rooms.length, message };
}
