/**
 * Leitor de texto STEP (ISO 10303-21), o formato dos arquivos IFC. Sem dependências: um tokenizador que percorre a string
 * uma vez e guarda cada entidade como uma lista de parâmetros tipados. Tolerante de propósito — o que não interessa fica
 * opaco, e o importador decide depois o que sabe ler.
 *
 * Cuidados que o formato exige e que já custaram caro em outros leitores:
 * - espaço em volta do `=` (`#1 = IFCPROJECT(...)`) é comum;
 * - comentários `/* ... *\/` no meio do arquivo;
 * - textos com apóstrofo dobrado (`''`), `\\` e os escapes `\X2\hhhh...\X0\`, `\X4\`, `\X\hh` e `\S\c`;
 * - parâmetro derivado (`*`), omitido (`$`) e valores tipados (`IFCLENGTHMEASURE(1.0)`).
 */

export type StepValue =
  | { k: 'ref'; id: number }
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'enum'; v: string }
  | { k: 'null' }
  | { k: 'derived' }
  | { k: 'list'; items: StepValue[] }
  | { k: 'type'; name: string; arg: StepValue };

export interface StepEntity {
  id: number;
  type: string;
  args: StepValue[];
}

export interface StepFile {
  schema: string;
  entities: Map<number, StepEntity>;
  /** Entidades que o tokenizador não conseguiu ler (não impedem o resto do arquivo). */
  broken: number;
}

const PREFIX: Record<string, number> = {
  EXA: 1e18,
  PETA: 1e15,
  TERA: 1e12,
  GIGA: 1e9,
  MEGA: 1e6,
  KILO: 1e3,
  HECTO: 1e2,
  DECA: 1e1,
  DECI: 1e-1,
  CENTI: 1e-2,
  MILLI: 1e-3,
  MICRO: 1e-6,
  NANO: 1e-9,
  PICO: 1e-12,
  FEMTO: 1e-15,
  ATTO: 1e-18,
};

export const siPrefix = (name: string): number => PREFIX[name] ?? 1;

/** Converte ponto e vírgula do cabeçalho em schema legível (`IFC4`, `IFC2X3`...). */
export function schemaOf(text: string): string {
  const m = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i.exec(text);
  return m?.[1]?.toUpperCase() ?? '';
}

class Reader {
  private i: number;
  constructor(private readonly s: string, start = 0) {
    this.i = start;
  }

  get pos(): number {
    return this.i;
  }

  seek(at: number): void {
    this.i = at;
  }

  private code(at = this.i): number {
    return this.s.charCodeAt(at);
  }

  /** Pula espaços e comentários `/* ... *\/`. */
  skip(): void {
    for (;;) {
      while (this.i < this.s.length && this.code() <= 32) this.i++;
      if (this.s.startsWith('/*', this.i)) {
        const end = this.s.indexOf('*/', this.i + 2);
        this.i = end < 0 ? this.s.length : end + 2;
        continue;
      }
      return;
    }
  }

  /** Lê um identificador simples (`IFCWALL`, `DATA`...). */
  ident(): string {
    this.skip();
    const start = this.i;
    while (this.i < this.s.length) {
      const c = this.code();
      const isLetter = (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
      const isDigit = c >= 48 && c <= 57;
      if (!isLetter && !isDigit) break;
      this.i++;
    }
    return this.s.slice(start, this.i).toUpperCase();
  }

  /** Avança um caractere se for exatamente `ch`. */
  take(ch: string): boolean {
    this.skip();
    if (this.code() === ch.charCodeAt(0)) {
      this.i++;
      return true;
    }
    return false;
  }

  expect(ch: string): void {
    if (!this.take(ch)) throw new Error(`esperava "${ch}" em ${this.i}`);
  }

  /** Inteiro sem sinal (id de entidade, índice). */
  int(): number {
    this.skip();
    let v = 0;
    let any = false;
    for (;;) {
      const c = this.code();
      if (c < 48 || c > 57) break;
      v = v * 10 + (c - 48);
      any = true;
      this.i++;
    }
    if (!any) throw new Error(`esperava número em ${this.i}`);
    return v;
  }

  /** Real (aceita sinal, decimal, expoente). */
  real(): number {
    this.skip();
    const start = this.i;
    if (this.code() === 45 || this.code() === 43) this.i++;
    while (this.i < this.s.length) {
      const c = this.code();
      if ((c >= 48 && c <= 57) || c === 46) {
        this.i++;
        continue;
      }
      if (c === 69 || c === 101) {
        this.i++;
        if (this.code() === 45 || this.code() === 43) this.i++;
        continue;
      }
      break;
    }
    const v = Number(this.s.slice(start, this.i));
    if (!Number.isFinite(v)) throw new Error(`número inválido em ${start}`);
    return v;
  }

  /** Texto STEP com escapes decodificados. */
  str(): string {
    this.expect("'");
    let out = '';
    for (;;) {
      if (this.i >= this.s.length) throw new Error('texto STEP sem fim');
      const c = this.s[this.i] ?? '';
      this.i++;
      if (c === "'") {
        if (this.code() === 39) {
          out += "'";
          this.i++;
          continue;
        }
        return out;
      }
      if (c !== '\\') {
        out += c;
        continue;
      }
      out += this.escape();
    }
  }

  /** Decodifica um escape de barra (o `\` já foi consumido). */
  private escape(): string {
    const rest = this.s.slice(this.i, this.i + 3);
    const upper = rest.toUpperCase();
    if (upper.startsWith('X2\\') || upper.startsWith('X4\\')) {
      const wide = upper.startsWith('X4\\');
      this.i += 3;
      const end = this.s.toUpperCase().indexOf('\\X0\\', this.i);
      const hex = this.s.slice(this.i, end < 0 ? this.s.length : end);
      this.i = end < 0 ? this.s.length : end + 4;
      const step = wide ? 8 : 4;
      let text = '';
      for (let p = 0; p + step <= hex.length; p += step) {
        const code = Number.parseInt(hex.slice(p, p + step), 16);
        if (Number.isFinite(code)) text += String.fromCodePoint(code);
      }
      return text;
    }
    if (upper.startsWith('S\\')) {
      const c = this.code(this.i + 2);
      this.i += 3;
      return String.fromCharCode(c + 128);
    }
    if (upper.startsWith('X\\')) {
      const hex = this.s.slice(this.i + 2, this.i + 4);
      this.i += 4;
      return String.fromCharCode(Number.parseInt(hex, 16) || 0);
    }
    // `\P?\` troca a página de código; `\\` é a própria barra.
    if (this.code() === 80 && this.code(this.i + 2) === 92) {
      this.i += 3;
      return '';
    }
    if (this.code() === 92) {
      this.i++;
      return '\\';
    }
    return '\\';
  }

  /** Um parâmetro: ref, número, texto, enum, `$`, `*`, lista ou valor tipado. */
  value(): StepValue {
    this.skip();
    const c = this.code();
    if (c === 35) {
      this.i++;
      return { k: 'ref', id: this.int() };
    }
    if (c === 40) {
      this.i++;
      const items: StepValue[] = [];
      this.skip();
      if (this.code() !== 41) {
        for (;;) {
          items.push(this.value());
          this.skip();
          if (this.code() === 44) {
            this.i++;
            continue;
          }
          break;
        }
      }
      this.expect(')');
      return { k: 'list', items };
    }
    if (c === 39) return { k: 'str', v: this.str() };
    if (c === 46) {
      this.i++;
      const start = this.i;
      while (this.i < this.s.length && this.code() !== 46) this.i++;
      const name = this.s.slice(start, this.i).toUpperCase();
      this.i++;
      return { k: 'enum', v: name };
    }
    if (c === 36) {
      this.i++;
      return { k: 'null' };
    }
    if (c === 42) {
      this.i++;
      return { k: 'derived' };
    }
    const isNum = (c >= 48 && c <= 57) || c === 45 || c === 43 || c === 46;
    if (isNum) return { k: 'num', v: this.real() };
    const name = this.ident();
    if (!name) throw new Error(`parâmetro desconhecido em ${this.i}`);
    this.skip();
    if (this.code() === 40) {
      this.i++;
      const arg = this.value();
      this.expect(')');
      return { k: 'type', name, arg };
    }
    return { k: 'enum', v: name };
  }
}

/** Lê o arquivo inteiro. Erro em uma entidade não derruba as outras: ela é contada em `broken`. */
export function parseStep(text: string): StepFile {
  const schema = schemaOf(text);
  const entities = new Map<number, StepEntity>();
  const data = /\bDATA\s*;/.exec(text);
  if (!data) return { schema, entities, broken: 0 };
  const r = new Reader(text, data.index + data[0].length);
  let broken = 0;
  for (;;) {
    r.skip();
    if (text.slice(r.pos, r.pos + 6).toUpperCase() === 'ENDSEC') break;
    if (r.pos >= text.length) break;
    if (!r.take('#')) {
      // Conteúdo inesperado: salta até o próximo `;` para não travar o arquivo.
      const next = text.indexOf(';', r.pos);
      if (next < 0) break;
      r.seek(next + 1);
      broken++;
      continue;
    }
    let id: number;
    try {
      id = r.int();
      r.expect('=');
      const type = r.ident();
      r.expect('(');
      const args: StepValue[] = [];
      r.skip();
      if (!r.take(')')) {
        for (;;) {
          args.push(r.value());
          r.skip();
          if (r.take(',')) continue;
          r.expect(')');
          break;
        }
      }
      r.take(';');
      if (type) entities.set(id, { id, type, args });
    } catch {
      broken++;
      const next = text.indexOf(';', r.pos);
      if (next < 0) break;
      r.seek(next + 1);
    }
  }
  return { schema, entities, broken };
}

export const isRef = (v: StepValue | undefined): v is { k: 'ref'; id: number } => v?.k === 'ref';
export const refId = (v: StepValue | undefined): number | null => (isRef(v) ? v.id : null);
export const textOf = (v: StepValue | undefined): string => (v?.k === 'str' ? v.v : '');
export const enumOf = (v: StepValue | undefined): string => (v?.k === 'enum' ? v.v : '');
export const numOf = (v: StepValue | undefined): number | null => {
  if (v?.k === 'num') return v.v;
  if (v?.k === 'type' && v.arg.k === 'num') return v.arg.v;
  return null;
};
export const listOf = (v: StepValue | undefined): StepValue[] => (v?.k === 'list' ? v.items : []);
