import type { ShortcutCommand, ShortcutMap } from '@hestia/tools';
import { comandoDaSequencia } from './toolKeys.ts';

/** Tempo (ms) que o buffer espera pela próxima tecla antes de zerar. */
export const TEMPO_SEQUENCIA_MS = 1200;

/** Teclas que só mudam modificador: não zeram o buffer nem contam como tecla. */
const MODIFICADORES = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

/** Normaliza uma sequência digitada: maiúsculas, só letras e dígitos, de 1 a 4 caracteres. Null se inválida. */
export function normalizaSequencia(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  return /^[A-Z0-9]{1,4}$/.test(s) ? s : null;
}

/** Conflito de uma sequência: outro comando a usa igual, ou é prefixo dela (ou ela é prefixo dele). */
export interface ConflitoAtalho {
  comando: ShortcutCommand;
  sequencia: string;
  motivo: 'igual' | 'prefixo';
}

/** Todos os conflitos que `seq` causaria se fosse atribuída a `cmd` no mapa (ignora o próprio `cmd`). Lista vazia se livre. */
export function conflitosDe(mapa: ShortcutMap, cmd: ShortcutCommand, seq: string): ConflitoAtalho[] {
  const out: ConflitoAtalho[] = [];
  for (const [outro, s] of Object.entries(mapa) as Array<[ShortcutCommand, string | undefined]>) {
    if (!s || outro === cmd) continue;
    if (s === seq) out.push({ comando: outro, sequencia: s, motivo: 'igual' });
    else if (s.startsWith(seq) || seq.startsWith(s)) out.push({ comando: outro, sequencia: s, motivo: 'prefixo' });
  }
  return out;
}

/** Primeiro conflito que `seq` causaria em `cmd`. Undefined se livre. */
export function conflitoDe(mapa: ShortcutMap, cmd: ShortcutCommand, seq: string): ConflitoAtalho | undefined {
  return conflitosDe(mapa, cmd, seq)[0];
}

/** Valida um mapa inteiro: devolve o primeiro par de comandos em conflito, ou undefined se o mapa é livre de prefixo. */
export function conflitoNoMapa(mapa: ShortcutMap): { a: ShortcutCommand; b: ShortcutCommand; sequencia: string; motivo: 'igual' | 'prefixo' } | undefined {
  const pares = Object.entries(mapa).filter((e): e is [ShortcutCommand, string] => typeof e[1] === 'string');
  for (let i = 0; i < pares.length; i++) {
    for (let j = i + 1; j < pares.length; j++) {
      const [a, sa] = pares[i]!;
      const [b, sb] = pares[j]!;
      if (sa === sb) return { a, b, sequencia: sa, motivo: 'igual' };
      if (sa.startsWith(sb) || sb.startsWith(sa)) return { a, b, sequencia: sa.length <= sb.length ? sa : sb, motivo: 'prefixo' };
    }
  }
  return undefined;
}

/** Resultado de uma tecla: `comando` é o que deve executar agora; `tratada` diz se a tecla foi consumida pelo casador. */
export interface ResultadoTecla {
  comando?: ShortcutCommand;
  tratada: boolean;
}

/** Casador de sequências com buffer e tempo limite. Cada tecla executa (casa exata), espera (prefixo) ou zera (sem casamento). */
export class CasadorSequencia {
  private buf = '';
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly mapa: () => ShortcutMap,
    private readonly aoMudar: (buf: string) => void = () => {},
    private readonly tempoMs = TEMPO_SEQUENCIA_MS,
  ) {}

  /** Sequência parcial digitada até agora (vazia se nenhuma). */
  get pendente(): string {
    return this.buf;
  }

  /** Trata uma tecla (`KeyboardEvent.key`). */
  tecla(key: string): ResultadoTecla {
    if (MODIFICADORES.has(key)) return { tratada: false };
    if (!/^[A-Za-z0-9]$/.test(key)) {
      this.ajusta('');
      return { tratada: false };
    }
    const k = key.toUpperCase();
    const mapa = this.mapa();
    // Tenta completar o buffer; se a tentativa não é prefixo de nenhum atalho, a tecla sozinha pode começar outra sequência.
    let tentativa = this.buf + k;
    if (!ehPrefixo(mapa, tentativa)) tentativa = k;
    if (!ehPrefixo(mapa, tentativa)) {
      this.ajusta('');
      return { tratada: false };
    }
    const exata = comandoDaSequencia(tentativa, mapa);
    if (exata) {
      this.ajusta('');
      return { comando: exata, tratada: true };
    }
    this.ajusta(tentativa);
    this.agenda();
    return { tratada: true };
  }

  /** Zera o buffer (Esc, troca de contexto). */
  limpar(): void {
    this.ajusta('');
  }

  private ajusta(buf: string): void {
    this.buf = buf;
    if (!buf && this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.aoMudar(buf);
  }

  /** Cada tecla que espera reinicia o tempo: o buffer só zera depois de `tempoMs` sem tecla. */
  private agenda(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.ajusta('');
    }, this.tempoMs);
  }
}

/** Alguma sequência do mapa começa por `seq` (inclusive quando é igual a ela). */
function ehPrefixo(mapa: ShortcutMap, seq: string): boolean {
  return Object.values(mapa).some((s) => typeof s === 'string' && s.startsWith(seq));
}
