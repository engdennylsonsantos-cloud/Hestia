import { RAMP_SLOPE_EPS, formatRampPercent, formatRampRatio } from '@hestia/model';

/** Tolerância do desnível (m): até ela o nível de topo está alcançado. */
export const RAMP_LEVEL_TOLERANCE = 0.005;

/** Texto fixo do estado em que o nível de topo foi alcançado. */
export const TEXTO_NIVEL_ALCANCADO = 'nível de topo alcançado';

/** Número com vírgula decimal e casas fixas. */
const numero = (valor: number, casas: number): string => Math.abs(valor).toFixed(casas).replace('.', ',');

/** Comprimento de rampa, 1 casa: `4,2 m`. */
const comprimento = (metros: number): string => `${numero(metros, 1)} m`;

/** Desnível, 2 casas: `0,35 m`. */
const desnivel = (metros: number): string => `${numero(metros, 2)} m`;

/** Comprimento de rampa equivalente ao desnível, na inclinação dada; vazio se a inclinação não é positiva. */
const trechoEquivalente = (metros: number, slope: number, sufixo: string): string => (slope > 0 ? ` (≈ ${comprimento(metros / slope)}${sufixo})` : '');

/**
 * Falta de desnível no modo inclinação (`falta` > 0, em m).
 * Ex.: `faltam 0,35 m de desnível (≈ 4,2 m de rampa)`.
 */
export function textoFaltaDesnivel(falta: number, slope: number): string {
  return `faltam ${desnivel(falta)} de desnível${trechoEquivalente(falta, slope, ' de rampa')}`;
}

/**
 * Sobra de desnível no modo inclinação (`passou` > 0, em m): a rampa termina antes do cursor.
 * Ex.: `passou 0,10 m (≈ 1,2 m): termina antes do cursor`.
 */
export function textoPassouDesnivel(passou: number, slope: number): string {
  return `passou ${desnivel(passou)}${trechoEquivalente(passou, slope, '')}: termina antes do cursor`;
}

/**
 * Resultado no modo comprimento: a inclinação final é a que sai do comprimento digitado.
 * `slopeMax` = máximo da norma (null = sem tabela); `faltaComprimento` (m) só aparece quando passa do máximo.
 * Ex.: `Resulta 9,40 % (1:10,6) · acima do máximo 8,33 % · faltam ≈ 1,3 m`.
 */
export function textoResultaInclinacao(slope: number, slopeMax: number | null, faltaComprimento: number): string {
  const resulta = `Resulta ${formatRampPercent(slope)} (${formatRampRatio(slope)})`;
  if (slopeMax === null) return resulta;
  if (slope <= slopeMax + RAMP_SLOPE_EPS) return `${resulta} · dentro da norma`;
  const falta = faltaComprimento > 0 ? ` · faltam ≈ ${comprimento(faltaComprimento)}` : '';
  return `${resulta} · acima do máximo ${formatRampPercent(slopeMax)}${falta}`;
}

/**
 * Rótulo do modo inclinação, com a inclinação de trabalho na frente.
 * `falta` é o desnível que sobra (> 0 falta, < 0 passou), com tolerância de `RAMP_LEVEL_TOLERANCE`.
 * Ex.: `8,33 % (1:12) · faltam 0,35 m de desnível (≈ 4,2 m de rampa)`.
 */
export function rotuloInclinacao(slope: number, falta: number): string {
  const prefixo = `${formatRampPercent(slope)} (${formatRampRatio(slope)}) · `;
  if (Math.abs(falta) <= RAMP_LEVEL_TOLERANCE) return `${prefixo}${TEXTO_NIVEL_ALCANCADO}`;
  if (falta > 0) return `${prefixo}${textoFaltaDesnivel(falta, slope)}`;
  return `${prefixo}${textoPassouDesnivel(-falta, slope)}`;
}
