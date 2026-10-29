/** Dígitos, separadores decimais e operadores aceitos sempre no campo numérico. */
const DIGITO_OU_OPERADOR = /^[0-9.,+\-*/()]$/;

/** Letras e símbolos de unidade: `cm`, `mm`, `ft`, `in`, `5'6"`, `45°`, `5%`. */
const CARACTERE_DE_UNIDADE = /^[a-z'"°%²³ ]$/i;

/**
 * Aceita um caractere no campo numérico das ferramentas. Dígitos e operadores entram sempre; letras, aspas e
 * símbolos de unidade só depois do primeiro caractere. Assim a primeira letra continua disparando os atalhos
 * (WA, DR, …) enquanto a ferramenta espera um valor, e o sufixo de unidade não é descartado no meio da medida.
 */
export function aceitaCaractereNumerico(k: string, digitado: string): boolean {
  if (k.length !== 1) return false;
  if (DIGITO_OU_OPERADOR.test(k)) return true;
  return digitado.length > 0 && CARACTERE_DE_UNIDADE.test(k);
}
