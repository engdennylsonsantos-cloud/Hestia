import type { SketchDraft } from '@hestia/geom';

/** Limite de passos guardados: cada passo é um rascunho inteiro, então o teto mantém a memória pequena. */
const HISTORY_LIMIT = 100;

/**
 * Passos de desfazer do rascunho, em ordem. `current()` é o rascunho visível; `push` cria um passo (o refazer se
 * perde); `replace` troca o corrente sem passo (seleção). A UI desfaz e refaz pela ferramenta (`undoDraft`).
 */
export class DraftHistory {
  private stack: SketchDraft[];
  private at = 0;

  constructor(first: SketchDraft) {
    this.stack = [first];
  }

  current(): SketchDraft {
    return this.stack[this.at]!;
  }

  replace(d: SketchDraft): void {
    this.stack[this.at] = d;
  }

  push(d: SketchDraft): void {
    this.stack = [...this.stack.slice(0, this.at + 1), d];
    if (this.stack.length > HISTORY_LIMIT) this.stack.shift();
    this.at = this.stack.length - 1;
  }

  /** Esquece os passos e começa de `d` (concluir, descartar). */
  reset(d: SketchDraft): void {
    this.stack = [d];
    this.at = 0;
  }

  /** Volta um passo. Devolve false se não há o que desfazer. */
  undo(): boolean {
    if (!this.canUndo) return false;
    this.at -= 1;
    return true;
  }

  /** Refaz um passo. Devolve false se não há o que refazer. */
  redo(): boolean {
    if (!this.canRedo) return false;
    this.at += 1;
    return true;
  }

  get canUndo(): boolean {
    return this.at > 0;
  }

  get canRedo(): boolean {
    return this.at < this.stack.length - 1;
  }
}
