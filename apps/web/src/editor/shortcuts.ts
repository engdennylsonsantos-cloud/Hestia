import { TOOL_LABEL, type ComandoAtalho, type MapaAtalhos } from '@hestia/tools';

/** Tempo sem tecla que encerra uma sequência pela metade (ms). */
export const TEMPO_SEQUENCIA_MS = 1200;

/** Normaliza uma sequência digitada: maiúsculas, sem espaços. Undefined se não for de 1 a 4 letras ou dígitos. */
export function normalizarSequencia(s: string): string | undefined {
  const t = s.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9]{1,4}$/.test(t) ? t : undefined;
}

/** Nome exibido de um comando (ferramenta ou o diálogo de atalhos). */
export function rotuloComando(c: ComandoAtalho): string {
  return c === 'atalhos' ? 'Atalhos de teclado' : TOOL_LABEL[c];
}

/** Dois comandos com atalhos que não podem coexistir: ou a mesma sequência, ou uma é começo da outra. */
export interface ConflitoAtalho {
  motivo: 'igual' | 'prefixo';
  comando: ComandoAtalho;
  seq: string;
  /** Comando que já usa a sequência (igual) ou cuja sequência começa com a deste (prefixo). */
  outro: ComandoAtalho;
  outraSeq: string;
}

/** Primeiro conflito do mapa, ou null. Um conjunto de atalhos é válido só se for livre de prefixo. */
export function conflitoAtalhos(mapa: MapaAtalhos): ConflitoAtalho | null {
  const itens = (Object.entries(mapa) as Array<[ComandoAtalho, string | undefined]>).filter((x): x is [ComandoAtalho, string] => !!x[1]);
  for (const [i, [ca, a]] of itens.entries()) {
    for (const [cb, b] of itens.slice(i + 1)) {
      if (a === b) return { motivo: 'igual', comando: cb, seq: b, outro: ca, outraSeq: a };
      if (b.startsWith(a)) return { motivo: 'prefixo', comando: ca, seq: a, outro: cb, outraSeq: b };
      if (a.startsWith(b)) return { motivo: 'prefixo', comando: cb, seq: b, outro: ca, outraSeq: a };
    }
  }
  return null;
}

/** Mensagem em português para um conflito, citando qual comando já usa a sequência. */
export function mensagemConflito(c: ConflitoAtalho): string {
  if (c.motivo === 'igual') return `"${c.seq}" já é usado por ${rotuloComando(c.outro)}.`;
  return `"${c.seq}" não pode ser usado: é início de "${c.outraSeq}" (${rotuloComando(c.outro)}).`;
}

export type ResultadoTecla = { tipo: 'executa'; comando: ComandoAtalho } | { tipo: 'espera'; buffer: string } | { tipo: 'nada' };

/**
 * Casador de sequências: acumula as teclas digitadas e diz se executa um comando, se espera (o buffer é início de algum atalho) ou se descarta.
 * Supõe um mapa válido (livre de prefixo, ver conflitoAtalhos).
 */
export class CasadorAtalhos {
  private readonly porSeq = new Map<string, ComandoAtalho>();
  private readonly prefixos = new Set<string>();
  private buffer = '';
  private ultimo = 0;

  constructor(mapa: MapaAtalhos) {
    for (const [cmd, seq] of Object.entries(mapa) as Array<[ComandoAtalho, string | undefined]>) {
      if (!seq) continue;
      this.porSeq.set(seq, cmd);
      for (let i = 1; i < seq.length; i++) this.prefixos.add(seq.slice(0, i));
    }
  }

  /** Teclas digitadas e ainda sem efeito (vazio se nenhuma sequência está em andamento). */
  get texto(): string {
    return this.buffer;
  }

  /** Descarta a sequência em andamento. */
  limpa(): void {
    this.buffer = '';
  }

  /** Processa uma tecla. Depois de TEMPO_SEQUENCIA_MS sem tecla, a sequência pela metade expira. */
  tecla(k: string, agora: number = Date.now()): ResultadoTecla {
    if (this.buffer && agora - this.ultimo > TEMPO_SEQUENCIA_MS) this.buffer = '';
    const t = k.toUpperCase();
    if (!/^[A-Z0-9]$/.test(t)) {
      this.buffer = '';
      return { tipo: 'nada' };
    }
    const cand = this.buffer + t;
    const cmd = this.porSeq.get(cand);
    if (cmd) {
      this.buffer = '';
      return { tipo: 'executa', comando: cmd };
    }
    if (this.prefixos.has(cand)) {
      this.buffer = cand;
      this.ultimo = agora;
      return { tipo: 'espera', buffer: cand };
    }
    // Não casa com nada: zera, e a tecla pode iniciar uma nova sequência.
    if (this.buffer) {
      this.buffer = '';
      return this.tecla(k, agora);
    }
    return { tipo: 'nada' };
  }
}
