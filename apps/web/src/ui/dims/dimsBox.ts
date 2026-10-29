/** Largura mínima do campo de cota em pixels (o valor antigo fixo). */
export const LARGURA_MINIMA_CAMPO = 62;

/** Pixels por caractere na fonte mono de 11 px do campo, com folga para o preenchimento. */
const POR_CARACTERE = 7;

/**
 * Largura do campo de cota: no mínimo 62 px e cresce com o texto para não cortar valores longos de pés e
 * polegadas (ex.: `24' 11 3/16"`). `texto` é o que o campo mostra, com ou sem o símbolo da unidade.
 */
export function larguraDoCampo(texto: string): number {
  return Math.max(LARGURA_MINIMA_CAMPO, texto.length * POR_CARACTERE + 12);
}
