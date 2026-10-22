import { TERMINO_MAX_CM, TERMINO_PRIORIDADE_MAX, TERMINO_PRIORIDADE_MIN, terminoAtePrioridade, type LayerTermino } from '@hestia/model';

/**
 * Formulário do "Término nas paredes" (decisão 0023 §2, P8; decisão 0025): seletor de seis opções e, conforme a opção,
 * um campo numérico (prioridade 1 a 9 ou deslocamento em cm). Rótulos com até 22 caracteres (densidade da UI).
 */

export type TerminoKind = 'auto' | 'face' | 'nucleo' | 'passa' | 'ate' | 'cm';

export const TERMINO_OPCOES: ReadonlyArray<{ value: TerminoKind; label: string }> = [
  { value: 'auto', label: 'Automático' },
  { value: 'face', label: 'Até a face de acab.' },
  { value: 'nucleo', label: 'Até o núcleo da parede' },
  { value: 'passa', label: 'Passa por baixo' },
  { value: 'ate', label: 'Até a prioridade ≤ N' },
  { value: 'cm', label: 'Deslocamento (cm)' },
];

/** Dica curta de cada opção do seletor (decisão 0025). */
export const TERMINO_AJUDA: Record<TerminoKind, string> = {
  auto: 'Padrão: o núcleo do piso vai até o núcleo da parede; as demais camadas param na face de acabamento.',
  face: 'Para na face de acabamento da parede: o piso não entra na parede.',
  nucleo: 'Avança sob o acabamento da parede e para no núcleo (estrutura).',
  passa: 'Passa por baixo da parede: a parede não recorta esta camada.',
  ate: 'Para na primeira camada da parede com prioridade igual ou maior. Número de 1 a 9; menor número, prioridade maior.',
  cm: 'Positivo avança sobre a parede; negativo recua, a partir da face de acabamento.',
};

/** Tipo e texto do campo de um término guardado (o texto é a prioridade ou o deslocamento). */
export function formDoTermino(t: LayerTermino): { kind: TerminoKind; cmText: string } {
  if (typeof t === 'object' && 'cm' in t) return { kind: 'cm', cmText: String(t.cm) };
  const n = terminoAtePrioridade(t);
  if (n !== null) return { kind: 'ate', cmText: String(n) };
  return { kind: t as TerminoKind, cmText: '0' };
}

/**
 * Término a gravar a partir do seletor e do texto do campo. Devolve `{ erro }` quando o campo não é válido: deslocamento
 * entre −30 e +30 cm (aceita vírgula decimal) ou prioridade inteira de 1 a 9. O automático vira `undefined`.
 */
export function terminoDoForm(kind: TerminoKind, text: string): { termino: LayerTermino | undefined } | { erro: string } {
  if (kind === 'ate') {
    const n = Number(text.trim());
    if (text.trim() === '' || !Number.isInteger(n) || n < TERMINO_PRIORIDADE_MIN || n > TERMINO_PRIORIDADE_MAX) {
      return { erro: `Informe um número de ${TERMINO_PRIORIDADE_MIN} a ${TERMINO_PRIORIDADE_MAX}` };
    }
    return { termino: { ate: { prioridade: n } } };
  }
  if (kind !== 'cm') return { termino: kind === 'auto' ? undefined : kind };
  const n = Number(text.trim().replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(n) || Math.abs(n) > TERMINO_MAX_CM) return { erro: `Entre −${TERMINO_MAX_CM} e ${TERMINO_MAX_CM} cm` };
  return { termino: { cm: Math.round(n * 10) / 10 } };
}
