import { isOpening, type Id, type Opening } from '@hestia/model';
import { editor } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';

const fmt = (m: number): string => m.toFixed(2).replace('.', ',');

/**
 * Mensagem da barra de status para as aberturas que a edição deslocou para caber na parede (o comando recorta a posição
 * na borda da parede). `before` é a posição pedida; `after`, a que ficou. Null quando nenhuma se moveu.
 */
export function movedOpeningsMessage(moves: Array<{ before: number; after: number }>): string | null {
  const moved = moves.filter((m) => Math.abs(m.after - m.before) > 1e-6);
  if (moved.length === 0) return null;
  if (moved.length === 1) return `A abertura foi deslocada para caber: ${fmt(moved[0]!.before)} → ${fmt(moved[0]!.after)} m.`;
  return `${moved.length} aberturas foram deslocadas para caber na parede.`;
}

/**
 * Edita aberturas num só comando e avisa na barra de status quando alguma foi deslocada para caber (troca de tipo mais
 * largo, ou distância fora da parede). O recorte continua o mesmo; só deixa de ser silencioso.
 */
export function patchOpenings(ids: Id[], patch: Partial<Opening>): void {
  const wanted = ids.map((id) => {
    const e = editor.project.elements[id];
    if (!isOpening(e)) return null;
    return 'offset' in patch && patch.offset !== undefined ? patch.offset : e.offset;
  });
  editor.store.exec({ type: 'updateElements', ids, patch });
  const moves: Array<{ before: number; after: number }> = [];
  ids.forEach((id, i) => {
    const e = editor.project.elements[id];
    const want = wanted[i];
    if (isOpening(e) && want !== null && want !== undefined) moves.push({ before: want, after: e.offset });
  });
  const msg = movedOpeningsMessage(moves);
  if (msg) useUi.setState({ status: msg });
}
