import { outlineElementsOfLevel, suggestOutlineBatch, type OutlineBatch } from '@hestia/engine';
import { isFloor, isSlab, type Floor, type Id, type Project, type ProjectStore, type Slab } from '@hestia/model';

/** Mensagem quando nenhum piso ou laje casa com um circuito de paredes (decisão 0023 §8.2c). */
export const NO_CIRCUIT_TEXT = 'O contorno não corresponde a nenhum circuito de paredes.';

/** O que sobrou depois de um vínculo: quantos foram vinculados e quantos ficaram como estavam. */
export interface LinkOutcome {
  vinculados: number;
  semCorrespondencia: number;
}

type LinkStore = Pick<ProjectStore, 'project' | 'transaction' | 'exec'>;

const m2 = (v: number): string => v.toFixed(2).replace('.', ',');

/** Variação percentual com sinal; abaixo de 0,05% sai como zero (sem sinal). */
const pctText = (v: number): string => (Math.abs(v) < 0.05 ? '0,0%' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')}%`);

/** Prévia de um vínculo (decisão 0023 §8.2b): uma frase para um elemento, uma frase agregada para vários. */
export function linkPreviewText(batch: OutlineBatch): string {
  const { areaAtual, areaDerivada, diferencia } = batch;
  const n = batch.vinculaveis.length;
  const k = batch.semCorrespondencia.length;
  const area = `${m2(areaAtual)} m² para ${m2(areaDerivada)} m² (${pctText(diferencia.pct)})`;
  if (n === 1 && k === 0) return `O contorno vai de ${area}. Vincular?`;
  const quem = `${n} ${n === 1 ? 'vinculável' : 'vinculáveis'}`;
  const nao = k > 0 ? `, ${k} sem correspondência` : '';
  return `${quem}${nao}. A área vai de ${area}. Vincular?`;
}

/** Texto de resultado para a barra de status. */
export function linkOutcomeText(o: LinkOutcome): string {
  if (o.vinculados === 0) return NO_CIRCUIT_TEXT;
  const noun = o.vinculados === 1 ? 'piso ou laje vinculado às paredes' : 'pisos e lajes vinculados às paredes';
  const resto = o.semCorrespondencia > 0 ? ` ${o.semCorrespondencia} sem correspondência, como estavam.` : '';
  return `${o.vinculados} ${noun}.${resto}`;
}

/** Prévia dos ids dados (só pisos e lajes): quem casa com um circuito de paredes e quanto a área muda. */
export function previewLinkOutlines(p: Project, ids: Id[]): OutlineBatch {
  return suggestOutlineBatch(p, ids.map((id) => p.elements[id]).filter((e): e is Floor | Slab => isFloor(e) || isSlab(e)));
}

/**
 * Grava a origem pelas paredes (modo e semente) e o contorno resultante em cada elemento vinculável, num único passo de
 * desfazer. Os furos manuais ficam como estão: o motor soma as ilhas de parede na resolução.
 */
export function applyOutlineBatch(store: LinkStore, label: string, batch: OutlineBatch): LinkOutcome {
  const outcome = { vinculados: batch.vinculaveis.length, semCorrespondencia: batch.semCorrespondencia.length };
  if (batch.vinculaveis.length === 0) return outcome;
  store.transaction(label, () => {
    for (const { id, suggestion } of batch.vinculaveis) {
      store.exec({ type: 'updateElements', ids: [id], patch: { outlineSource: suggestion.source, boundary: suggestion.polygon[0]! } });
    }
  });
  return outcome;
}

/** Vincula às paredes os pisos e lajes dados (um passo de desfazer). Sem correspondência, nada muda. */
export function linkOutlinesToWalls(store: LinkStore, ids: Id[]): LinkOutcome {
  return applyOutlineBatch(store, 'Vincular contorno às paredes', previewLinkOutlines(store.project, ids));
}

/** Vincula às paredes um piso ou laje (um passo de desfazer). Sem correspondência, nada muda. */
export function linkOutlineToWalls(store: LinkStore, id: Id): LinkOutcome {
  return linkOutlinesToWalls(store, [id]);
}

/** Vincula às paredes os pisos e lajes estáticos do nível, em lote (um passo de desfazer). */
export function linkAllOutlines(store: LinkStore, levelId: Id): LinkOutcome {
  const batch = suggestOutlineBatch(store.project, outlineElementsOfLevel(store.project, levelId));
  return applyOutlineBatch(store, 'Vincular pisos e lajes às paredes', batch);
}
