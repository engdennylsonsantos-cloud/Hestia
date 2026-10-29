/**
 * Escritor de texto STEP (ISO 10303-21) para o IFC4, sem dependências. Cada entidade vira uma linha `#n=TIPO(...);` com ids
 * sequenciais a partir de #1, na ordem em que é criada: a mesma entrada dá o mesmo texto (determinismo).
 */

/** Referência a outra entidade: `#n`. */
export const ref = (id: number): string => `#${id}`;

/** Atributo omitido (`$`). */
export const OMIT = '$';

/** Enumeração IFC: `.NAME.`. */
export const en = (name: string): string => `.${name}.`;

/** Lista STEP: `(a,b,c)`. */
export const list = (items: readonly string[]): string => `(${items.join(',')})`;

/**
 * Real STEP com ponto decimal e 6 casas (1 µm, em metros). Zero negativo e resíduos abaixo de 5e-7 saem como zero, para o
 * texto não depender do sinal de um zero numérico.
 */
export function num(v: number): string {
  if (!Number.isFinite(v)) throw new Error(`Valor não finito no IFC: ${v}`);
  const x = Math.abs(v) < 5e-7 ? 0 : v;
  return x.toFixed(6);
}

/**
 * Texto STEP entre apóstrofos. Apóstrofo dobra e barra vira `\\`. Caractere fora do ASCII imprimível vai em UTF-16 dentro
 * de `\X2\ ... \X0\` (a forma que o IFC usa para acentos e símbolos: "Térreo" sai como `T\X2\00E9\X0\rreo`).
 */
export function stepString(s: string): string {
  let out = '';
  let wide = false;
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 && code < 127) {
      if (wide) {
        out += '\\X0\\';
        wide = false;
      }
      out += ch === "'" ? "''" : ch === '\\' ? '\\\\' : ch;
    } else {
      if (!wide) {
        out += '\\X2\\';
        wide = true;
      }
      for (let i = 0; i < ch.length; i++) out += ch.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
    }
  }
  if (wide) out += '\\X0\\';
  return `'${out}'`;
}

/** Inteiro STEP. */
export const int = (v: number): string => String(Math.trunc(v));

/** Escritor de entidades: `add` devolve o id da entidade criada. */
export class StepWriter {
  private readonly lines: string[] = [];
  private next = 1;

  /** Cria a entidade `TIPO(args)` e devolve o seu id. */
  add(type: string, args: readonly string[]): number {
    const id = this.next++;
    this.lines.push(`#${id}=${type}(${args.join(',')});`);
    return id;
  }

  /** Linhas STEP já escritas, na ordem de criação (localizar uma entidade pelo GlobalId depois de criada). */
  get written(): readonly string[] {
    return this.lines;
  }

  /** Texto completo do arquivo: cabeçalho, seção DATA com as entidades e o rodapé. */
  text(opts: { fileName: string; timestamp: string }): string {
    const head = [
      'ISO-10303-21;',
      'HEADER;',
      "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
      `FILE_NAME(${stepString(opts.fileName)},${stepString(opts.timestamp)},(''),(''),'Hestia','Hestia','');`,
      "FILE_SCHEMA(('IFC4'));",
      'ENDSEC;',
      'DATA;',
    ];
    return [...head, ...this.lines, 'ENDSEC;', 'END-ISO-10303-21;', ''].join('\n');
  }
}
