import { TERMINO_MAX_CM, type LayerTermino } from '@hestia/model';

/** Formulário do "Término na junção" (decisão 0023 §2, P8): seletor de quatro opções e, no deslocamento, um campo em cm. */

export type TerminoKind = 'auto' | 'nucleo' | 'face' | 'cm';

export const TERMINO_OPCOES: ReadonlyArray<{ value: TerminoKind; label: string }> = [
  { value: 'auto', label: 'Automático' },
  { value: 'nucleo', label: 'Até o núcleo' },
  { value: 'face', label: 'Até a face de acabamento' },
  { value: 'cm', label: 'Deslocamento em cm' },
];

/** Tipo e texto do campo de um término guardado (o texto só importa para o deslocamento). */
export function formDoTermino(t: LayerTermino): { kind: TerminoKind; cmText: string } {
  if (typeof t === 'object') return { kind: 'cm', cmText: String(t.cm) };
  return { kind: t, cmText: '0' };
}

/**
 * Término a gravar a partir do seletor e do texto em cm. Devolve `{ erro }` quando o deslocamento não é um número
 * entre −30 e +30 (aceita vírgula decimal). O automático vira `undefined`: a chave sai da camada.
 */
export function terminoDoForm(kind: TerminoKind, cmText: string): { termino: LayerTermino | undefined } | { erro: string } {
  if (kind !== 'cm') return { termino: kind === 'auto' ? undefined : kind };
  const n = Number(cmText.trim().replace(',', '.'));
  if (cmText.trim() === '' || !Number.isFinite(n) || Math.abs(n) > TERMINO_MAX_CM) return { erro: `Entre −${TERMINO_MAX_CM} e ${TERMINO_MAX_CM} cm` };
  return { termino: { cm: Math.round(n * 10) / 10 } };
}
