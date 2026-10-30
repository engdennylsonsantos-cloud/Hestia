import { projectSheets, type Command, type Id, type Project, type Sheet, type SheetRevision } from '@hestia/model';

/**
 * Numeração em lote, reordenação e emissão de revisão das pranchas (Revit: *Sheet Issues/Revisions*, ArchiCAD:
 * *Revision History*). Funções puras: devolvem o comando e o teste confere; quem grava é a tela.
 */

/** Prefixo antes do último hífen: `A-101` → `A`; sem hífen → ''. */
export function numberPrefix(number: string): string {
  const i = number.lastIndexOf('-');
  return i < 0 ? '' : number.slice(0, i);
}

/** Sequência numérica final: `A-101` → 101; sem dígitos no fim → null. */
export function numberSequence(number: string): number | null {
  const m = /(\d+)\s*$/.exec(number);
  return m ? Number(m[1]) : null;
}

/** Número de prancha a partir do prefixo, da sequência e das casas: (`E`, 1, 3) → `E-001`. */
export function formatSheetNumber(prefix: string, sequence: number, padding: number): string {
  const digits = String(Math.trunc(sequence)).padStart(Math.max(0, Math.trunc(padding)), '0');
  return prefix === '' ? digits : `${prefix}-${digits}`;
}

export interface RenumberOptions {
  /** Prefixo das pranchas (`A`). Padrão: o prefixo da primeira prancha. */
  prefix?: string;
  /** Primeira sequência (`101`). Padrão: a sequência da primeira prancha, ou 101. */
  start?: number;
  /** Incremento entre pranchas (1). */
  step?: number;
  /** Casas da sequência, com zeros à esquerda (3 → `A-001`). */
  padding?: number;
}

const finiteOr = (v: number | undefined, fallback: number): number => (v !== undefined && Number.isFinite(v) ? Math.trunc(v) : fallback);

/** Pranchas existentes entre os ids, sem repetição e na ordem dada. */
function validSheets(p: Pick<Project, 'sheets'>, ids: Id[]): Sheet[] {
  const byId = new Map(projectSheets(p).map((s) => [s.id, s]));
  const seen = new Set<Id>();
  const out: Sheet[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const s = byId.get(id);
    if (s) out.push(s);
  }
  return out;
}

/**
 * Renumera as pranchas dadas, na ordem em que aparecem em `ids`, num único passo de desfazer. O prefixo padrão é o da
 * primeira prancha e o início padrão é a sequência dela (ou 101); as demais pranchas ficam como estão. Sem ids válidos:
 * null.
 */
export function renumberCommand(p: Pick<Project, 'sheets'>, ids: Id[], opts: RenumberOptions = {}): Command | null {
  const targets = validSheets(p, ids);
  const first = targets[0];
  if (!first) return null;
  const prefix = opts.prefix ?? numberPrefix(first.number);
  const start = finiteOr(opts.start, numberSequence(first.number) ?? 101);
  const step = finiteOr(opts.step, 1) || 1;
  const padding = Math.min(10, Math.max(0, finiteOr(opts.padding, 3)));
  return {
    type: 'batch',
    commands: targets.map((s, i) => ({ type: 'updateSheet', id: s.id, patch: { number: formatSheetNumber(prefix, start + i * step, padding) } })),
  };
}

/** Troca a prancha com a vizinha de cima (`-1`) ou de baixo (`1`). Inexistente ou já no limite: null. */
export function moveSheetCommand(p: Pick<Project, 'sheets'>, id: Id, delta: -1 | 1): Command | null {
  const sheets = projectSheets(p);
  const i = sheets.findIndex((s) => s.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= sheets.length) return null;
  const ids = sheets.map((s) => s.id);
  const a = ids[i]!;
  ids[i] = ids[j]!;
  ids[j] = a;
  return { type: 'setSheetOrder', ids };
}

const isNumericTag = (tag: string): boolean => /^\d+$/.test(tag);

/** Valor das letras de um rótulo (A = 1, Z = 26, AA = 27); 0 se não for só letras. */
function lettersValue(tag: string): number {
  let n = 0;
  for (const ch of tag) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) return 0;
    n = n * 26 + (c - 64);
  }
  return n;
}

/** Rótulo de letras maiúsculas do valor dado (1 → A, 26 → Z, 27 → AA). */
function lettersOf(n: number): string {
  let out = '';
  for (let v = Math.max(1, Math.trunc(n)); v > 0; v = Math.floor((v - 1) / 26)) out = String.fromCharCode(65 + ((v - 1) % 26)) + out;
  return out;
}

/**
 * Próximo rótulo de revisão. Sem revisões: '0'. Todas numéricas: o maior mais um (1 → 2). Senão: a próxima letra depois
 * da maior (A → B, Z → AA).
 */
export function nextRevisionTag(revisions: readonly SheetRevision[] | undefined): string {
  const tags = (revisions ?? []).map((r) => r.tag.trim().toUpperCase()).filter((t) => t !== '');
  if (tags.length === 0) return '0';
  if (tags.every(isNumericTag)) return String(Math.max(...tags.map(Number)) + 1);
  const letters = tags.filter((t) => lettersValue(t) > 0);
  return lettersOf(letters.reduce((max, t) => Math.max(max, lettersValue(t)), 0) + 1);
}

/** Dados de uma revisão emitida; sem `tag`, cada prancha usa a sua próxima (`nextRevisionTag`). */
export interface RevisionInput {
  date: string;
  description: string;
  by?: string;
  tag?: string;
}

/**
 * Emite a revisão nas pranchas dadas: acrescenta a linha no histórico e leva a tag para o carimbo
 * (`titleBlock.revision`), num único passo de desfazer. Sem ids válidos: null.
 */
export function emitRevisionCommand(p: Pick<Project, 'sheets'>, ids: Id[], rev: RevisionInput): Command | null {
  const targets = validSheets(p, ids);
  if (targets.length === 0) return null;
  return {
    type: 'batch',
    commands: targets.map((s) => {
      const tag = rev.tag ?? nextRevisionTag(s.revisions);
      const row: SheetRevision = { tag, date: rev.date, description: rev.description, ...(rev.by ? { by: rev.by } : {}) };
      return { type: 'updateSheet', id: s.id, patch: { revisions: [...(s.revisions ?? []), row], titleBlock: { ...s.titleBlock, revision: tag } } };
    }),
  };
}
