import type { SketchDraft, Vec2 } from '@hestia/geom';
import { alignSegToLine, deleteSegs, extendToBoundary, splitAt, splitBetween, trimExtendToCorner, trimToBoundary } from './perimeterModify.ts';
import type { PerimeterModifyKind } from './perimeterModifyKind.ts';
import { clearData, ghost, halo, lineAt, segById, type ModHost, type Step } from './perimeterToolModifyStep.ts';
import type { PointerInfo, PreviewItem } from './types.ts';

/** Mensagem quando a operação de aparar/estender não tem resultado, por modo. */
const TRIM_FAIL = [
  'Essas linhas não formam canto dentro do alcance.',
  'O limite não cruza essa linha por dentro.',
  'O limite não está à frente da ponta dessa linha.',
];

/** Dica do comando de linha (aparar/estender, dividir, alinhar, excluir), conforme o modo e o estágio. */
export function edgeHint(kind: PerimeterModifyKind, st: Step): string {
  if (kind === 'delete') return 'Excluir: clique na linha para tirá-la (Delete remove a seleção).';
  if (kind === 'align') return st.stage === 0 ? 'Alinhar: clique na linha de referência.' : 'Alinhar: clique na linha a alinhar.';
  if (kind === 'split') {
    if (st.mode === 0) return 'Dividir: clique no ponto da linha. Tab: dividir com espaço.';
    return st.stage === 0 ? 'Dividir com espaço: clique o primeiro ponto do trecho. Tab: dividir.' : 'Dividir com espaço: clique o segundo ponto, na mesma linha.';
  }
  if (kind !== 'trim') return '';
  if (st.mode === 0) {
    return st.stage === 0
      ? 'Aparar/Estender ao canto: clique na primeira linha. Tab: próximo modo.'
      : 'Canto: clique na segunda linha; cada linha fica do lado clicado.';
  }
  const what = st.mode === 1 ? 'Aparar até limite' : 'Estender até limite';
  return st.stage === 0 ? `${what}: clique no limite. Tab: próximo modo.` : `${what}: clique na linha a ajustar. Esc troca o limite.`;
}

/** Resultado de aparar/estender para a linha `id` clicada em `pick`, conforme o modo. */
function trimResult(d: SketchDraft, st: Step, id: string, pick: Vec2): SketchDraft | null {
  const first = st.ids[0]!;
  if (st.mode === 0) return trimExtendToCorner(d, first, st.pts[0]!, id, pick);
  return st.mode === 1 ? trimToBoundary(d, id, pick, first) : extendToBoundary(d, id, pick, first);
}

function trimClick(h: ModHost, st: Step, id: string, pick: Vec2): void {
  if (st.stage === 0) {
    st.ids = [id];
    st.pts = st.mode === 0 ? [pick] : [];
    st.stage = 1;
    return h.say(edgeHint('trim', st));
  }
  if (id === st.ids[0]) return h.say('Escolha outra linha.');
  const next = trimResult(h.draft(), st, id, pick);
  if (!next) return h.say(TRIM_FAIL[st.mode]!);
  h.commit(next);
  if (st.mode === 0) {
    clearData('trim', st);
    return h.say('Canto formado. Clique nas próximas duas linhas.');
  }
  // Até limite: o limite continua escolhido para a próxima linha.
  st.pts = [];
  h.say('Aparada. Clique na próxima linha, ou Esc troca o limite.');
}

function splitClick(h: ModHost, st: Step, id: string, pick: Vec2): void {
  const d = h.draft();
  if (st.mode === 0) {
    const next = splitAt(d, id, pick);
    if (!next) return h.say('Clique no meio da linha: nas pontas não há o que dividir.');
    h.commit(next);
    return h.say('Linha dividida. Clique noutra linha, ou Tab: dividir com espaço.');
  }
  if (st.stage === 0) {
    st.ids = [id];
    st.pts = [pick];
    st.stage = 1;
    return h.say(edgeHint('split', st));
  }
  if (id !== st.ids[0]) return h.say('Os dois pontos devem estar na mesma linha.');
  const next = splitBetween(d, id, st.pts[0]!, pick);
  if (!next) return h.say('Trecho pequeno demais, ou restaria nada da linha (use Excluir).');
  h.commit(next);
  clearData('split', st);
  h.say(`Trecho removido. ${edgeHint('split', st)}`);
}

/** Resultado de alinhar a linha `id` à referência escolhida no passo. */
function alignNext(d: SketchDraft, st: Step, id: string): SketchDraft | null {
  const ref = segById(d, st.ids[0]!);
  return ref ? alignSegToLine(d, id, ref.a, ref.b) : null;
}

function alignClick(h: ModHost, st: Step, id: string): void {
  if (st.stage === 0) {
    st.ids = [id];
    st.stage = 1;
    return h.say(edgeHint('align', st));
  }
  if (id === st.ids[0]) return h.say('Escolha outra linha: a referência já está alinhada a si mesma.');
  const next = alignNext(h.draft(), st, id);
  if (!next) return h.say('Só retas se alinham, e a linha não pode colapsar.');
  h.commit(next);
  clearData('align', st);
  h.say('Linha alinhada. Clique na próxima referência.');
}

function deleteClick(h: ModHost, id: string): void {
  const next = deleteSegs(h.draft(), [id]);
  if (!next) return h.say('Nada a excluir ali.');
  h.commit(next);
  h.say('Linha excluída. Clique noutra linha, ou Esc sai do comando.');
}

/** Clique num comando de linha. `p.raw` é o cursor; a linha é a que está sob ele. */
export function edgeClick(h: ModHost, kind: PerimeterModifyKind, st: Step, p: PointerInfo): void {
  const id = lineAt(h.draft(), p.raw, h.mpp());
  if (!id) return h.say('Clique numa linha do esboço.');
  if (kind === 'trim') return trimClick(h, st, id, p.raw);
  if (kind === 'split') return splitClick(h, st, id, p.raw);
  if (kind === 'align') return alignClick(h, st, id);
  deleteClick(h, id);
}

/** Prévia de um comando de linha com o cursor em `at`: realce da linha sob o cursor e o resultado da operação. */
export function edgePreview(h: ModHost, kind: PerimeterModifyKind, st: Step, at: Vec2): PreviewItem[] {
  const d = h.draft();
  const id = lineAt(d, at, h.mpp());
  const under = id ? halo(d, id) : [];
  if (kind === 'delete' || st.stage === 0) return under;
  const first = halo(d, st.ids[0]!);
  if (kind === 'trim') {
    return [...first, ...(id && id !== st.ids[0] ? ghost(d, trimResult(d, st, id, at)) : under)];
  }
  if (kind === 'align') return [...first, ...(id && id !== st.ids[0] ? ghost(d, alignNext(d, st, id)) : [])];
  // Dividir com espaço, no segundo ponto: o trecho sai, e o resto da linha fica.
  return [...first, { kind: 'point', at: st.pts[0]! }, ...ghost(d, splitBetween(d, st.ids[0]!, st.pts[0]!, at))];
}
