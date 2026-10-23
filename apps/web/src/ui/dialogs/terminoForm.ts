import { TERMINO_MAX_CM, TERMINO_PRIORIDADE_MAX, TERMINO_PRIORIDADE_MIN, terminoAtePrioridade, type LayerLimiteExterno, type LayerTermino } from '@hestia/model';

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
export function formDoTermino(t: LayerTermino): { kind: TerminoKind; cmText: string } {  if (typeof t === 'object' && 'cm' in t) return { kind: 'cm', cmText: String(t.cm) };
  const n = terminoAtePrioridade(t);
  if (n !== null) return { kind: 'ate', cmText: String(n) };
  return { kind: t as TerminoKind, cmText: '0' };
}

/** Término a gravar a partir do seletor e do texto do campo. Devolve `{ erro }` quando o campo não é válido: deslocamento
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

/**
 * "Limite no perímetro externo" (decisão 0027): até onde a camada de piso ou de laje vai na borda da edificação,
 * independente do término nas paredes internas. `auto` = o contorno do elemento, como antes.
 */
export type LimiteExternoKind = 'auto' | 'parede' | 'nucleo';

export const LIMITE_EXTERNO_OPCOES: ReadonlyArray<{ value: LimiteExternoKind; label: string }> = [
  { value: 'auto', label: 'Contorno do elemento' },
  { value: 'parede', label: 'Até face ext. parede' },
  { value: 'nucleo', label: 'Até face ext. núcleo' },
];

/** Dica curta de cada opção do limite externo (decisão 0027). */
export const LIMITE_EXTERNO_AJUDA: Record<LimiteExternoKind, string> = {
  auto: 'A camada segue o contorno desenhado do elemento, como antes.',
  parede: 'Vai até a face externa da parede, atravessando o acabamento externo dela.',
  nucleo: 'Passa sob o acabamento externo e para na face externa do núcleo: o acabamento da parede fica contínuo por fora.',
};

/** Limite guardado na camada → opção do seletor. */
export const formDoLimiteExterno = (v: LayerLimiteExterno | undefined): LimiteExternoKind => v ?? 'auto';

/** Limite a gravar a partir do seletor (o contorno do elemento é a ausência do campo). */
export const limiteExternoDoForm = (kind: LimiteExternoKind): LayerLimiteExterno | undefined => (kind === 'auto' ? undefined : kind);
