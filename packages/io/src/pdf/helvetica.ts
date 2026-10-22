/**
 * Fonte padrão do PDF (Helvetica, codificação WinAnsi). Larguras da AFM padrão para ASCII (32 a 126), usadas só para
 * centralizar textos; letras acentuadas usam a largura da letra base; o resto usa 556.
 */
const ASCII_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // espaço ... /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, // 0 ... 9
  278, 278, 584, 584, 584, 556, 1015, // : ... @
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, // A ... Z
  278, 278, 278, 469, 556, 333, // [ ... `
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, // a ... z
  334, 260, 334, 584, // { | } ~
];

/** Substituições de caracteres fora do Latin-1 para o WinAnsi (travessão, aspas, reticências, ponto médio). */
const WINANSI_EXTRA: Record<string, number> = {
  '€': 0x80,
  '…': 0x85,
  '–': 0x96,
  '—': 0x97,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
};

/** Código WinAnsi de um caractere (Latin-1 e as extras acima); fora disso, `?`. */
export function winAnsiCode(ch: string): number {
  const c = ch.codePointAt(0) ?? 63;
  if (c >= 0x20 && c <= 0x7e) return c;
  if (c >= 0xa0 && c <= 0xff) return c;
  if (ch === '−') return 0x2d; // sinal de menos (U+2212) sai como hífen
  return WINANSI_EXTRA[ch] ?? 63;
}

/** Largura de um caractere em milésimos de em. */
export function charWidth(ch: string): number {
  const c = ch.codePointAt(0) ?? 0;
  if (c >= 32 && c <= 126) return ASCII_WIDTHS[c - 32]!;
  const base = ch.normalize('NFD').charAt(0);
  const b = base.codePointAt(0) ?? 0;
  if (b >= 32 && b <= 126) return ASCII_WIDTHS[b - 32]!;
  return 556;
}

/** Largura do texto em mm, para o tamanho `sizeMm` (altura do corpo, como no CAD). */
export function textWidthMm(text: string, sizeMm: number): number {
  let em = 0;
  for (const ch of text) em += charWidth(ch);
  return (em / 1000) * sizeMm;
}

/** Texto como string de PDF entre parênteses, com os caracteres escapados e em WinAnsi. */
export function pdfString(text: string): string {
  let out = '(';
  for (const ch of text) {
    const code = winAnsiCode(ch);
    if (ch === '(' || ch === ')' || ch === '\\') out += `\\${ch}`;
    else if (code >= 0x20 && code <= 0x7e) out += String.fromCharCode(code);
    else out += `\\${code.toString(8).padStart(3, '0')}`;
  }
  return `${out})`;
}
