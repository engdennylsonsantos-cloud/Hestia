import type { Vec2 } from '@hestia/geom';
import { parseNumber } from './numeric.ts';
import { PERIMETER_MODIFY_LABEL, type PerimeterModifyKind } from './perimeterModifyKind.ts';
import { deleteSegs } from './perimeterModify.ts';
import { selectSegs } from './perimeterSession.ts';
import { edgeClick, edgeHint, edgePreview } from './perimeterToolModifyEdge.ts';
import { parseDelta } from './perimeterToolInput.ts';
import {
  transformClick,
  transformConfirm,
  transformDelta,
  transformHint,
  transformPreview,
  transformPrompt,
  transformTab,
  transformType,
} from './perimeterToolModifyMove.ts';
import { EDGE, SOURCED, clearData, freshStep, halo, hasData, lineAt, type ModHost, type Step } from './perimeterToolModifyStep.ts';
import type { PointerInfo, PreviewItem } from './types.ts';

/** O clique captura ponto (snap) em todos os estágios de ponto, como o esboço; só o teste de linha usa o cursor cru. */
function snapsAt(kind: PerimeterModifyKind, st: Step): boolean {
  if (kind === 'trim' || kind === 'split' || kind === 'offset') return true;
  if (kind === 'rotate') return st.stage >= 1;
  if (kind === 'move' || kind === 'copy' || kind === 'mirror' || kind === 'array') return st.stage === 1 || st.stage === 2;
  return false;
}

/**
 * Comando de Modificar ativo sobre as linhas do rascunho. Guarda o comando e o passo; cada clique ou valor digitado
 * avança o passo, e a operação aplicada vai para `h.commit` (um passo de desfazer). Esc cancela o passo e, sem passo,
 * desliga o comando; Enter confirma a seleção e a quantidade da matriz; Tab alterna a variante do comando.
 */
export class ModifyFlow {
  private cmd: PerimeterModifyKind | null = null;
  private st: Step = freshStep(false);
  private raw: Vec2 = { x: 0, y: 0 };
  private at: Vec2 = { x: 0, y: 0 };
  private over: string | null = null;

  constructor(private readonly h: ModHost) {}

  kind(): PerimeterModifyKind | null {
    return this.cmd;
  }

  active(): boolean {
    return this.cmd !== null;
  }

  /** Linha sob o cursor, para o realce. */
  hoverId(): string | null {
    return this.over;
  }

  /**
   * Liga o comando. Com linhas selecionadas (comandos sobre a seleção), começa direto no passo de operação. Excluir com
   * seleção apaga a seleção já, num passo de desfazer, e segue ligado para os cliques.
   */
  start(kind: PerimeterModifyKind): void {
    const o = this.h.options();
    this.cmd = kind;
    const d = this.h.draft();
    if (kind === 'delete' && d.selected.length > 0) {
      const next = deleteSegs(d, d.selected);
      if (next) this.h.commit(next);
      this.h.say(`${d.selected.length} linha(s) excluída(s). Clique numa linha para excluir outra, ou Esc sai.`);
      return;
    }
    const copy = kind === 'offset' ? o.offsetCopy : kind === 'rotate' ? o.rotateCopy : kind === 'mirror' ? o.mirrorCopy : false;
    this.st = freshStep(copy);
    if (SOURCED.has(kind) && this.h.draft().selected.length > 0) this.st.stage = 1;
    this.h.say(`${PERIMETER_MODIFY_LABEL[kind]}. ${this.hint()}`);
  }

  stop(): void {
    this.cmd = null;
    this.st = freshStep(false);
    this.over = null;
  }

  /** Limpa o passo em andamento (desfazer, troca de rascunho). O comando segue ligado. */
  clearStep(): void {
    if (!this.cmd) return;
    this.st.ids = [];
    this.st.pts = [];
    this.st.num = null;
    this.st.stage = SOURCED.has(this.cmd) && this.h.draft().selected.length > 0 ? 1 : 0;
    this.over = null;
  }

  move(p: PointerInfo): void {
    if (!this.cmd) return;
    this.raw = p.raw;
    this.over = lineAt(this.h.draft(), p.raw, this.h.mpp());
    this.at = this.pointAt(p);
  }

  click(p: PointerInfo): void {
    const kind = this.cmd;
    if (!kind) return;
    this.raw = p.raw;
    if (this.needsSource()) return this.pickSource(p);
    const at = this.pointAt(p);
    this.at = at;
    if (EDGE.has(kind)) edgeClick(this.h, kind, this.st, p, at);
    else transformClick(this.h, kind, this.st, p, at);
  }

  /** Valor digitado: distância, ângulo, quantidade. Sem entrada numérica no estágio, devolve false. */
  type(text: string): boolean {
    const kind = this.cmd;
    if (!kind || this.needsSource() || transformPrompt(kind, this.st) === null) return false;
    // Mover/Copiar no destino: aceita também o deslocamento digitado "dx,dy" (ou "dx;dy"), em metros.
    if ((kind === 'move' || kind === 'copy') && this.st.stage === 2) {
      const delta = parseDelta(text);
      if (delta) return transformDelta(this.h, kind, this.st, delta);
    }
    const v = parseNumber(text);
    if (v === null) return this.refuse('Valor inválido. Digite um número.');
    return transformType(this.h, kind, this.st, v, this.raw);
  }

  /** Tab: alterna a variante (aparar/estender, dividir) ou copiar/mover. Limpa o passo quando o modo muda. */
  tab(): void {
    const kind = this.cmd;
    if (!kind) return;
    if (kind === 'trim' || kind === 'split') {
      this.st.mode = kind === 'trim' ? (this.st.mode + 1) % 3 : (this.st.mode + 1) % 2;
      clearData(kind, this.st);
      return this.h.say(this.hint());
    }
    if (!transformTab(this.h, kind, this.st)) this.h.say('Tab não alterna nesta etapa.');
  }

  /** Esc: cancela o passo (true = não há passo, o comando deve sair). */
  cancel(): boolean {
    const kind = this.cmd;
    if (!kind) return true;
    const d = this.h.draft();
    if (hasData(this.st)) {
      clearData(kind, this.st);
      this.h.say(this.hint());
      return false;
    }
    if (SOURCED.has(kind) && this.st.stage === 0 && d.selected.length > 0) {
      this.h.replace(selectSegs(d, [], false));
      this.h.say('Seleção limpa. Esc de novo desliga o comando.');
      return false;
    }
    return true;
  }

  /** Enter: confirma a seleção das linhas, ou a quantidade padrão da matriz. */
  confirm(): void {
    const kind = this.cmd;
    if (!kind) return;
    if (SOURCED.has(kind) && this.needsSource()) {
      if (this.h.draft().selected.length === 0) return this.h.say('Selecione ao menos uma linha antes de confirmar.');
      this.st.stage = 1;
      return this.h.say(this.hint());
    }
    transformConfirm(this.h, kind, this.st);
  }

  /** Rótulo do campo numérico do estágio, ou null. */
  prompt(): string | null {
    if (!this.cmd || this.needsSource()) return null;
    return transformPrompt(this.cmd, this.st);
  }

  preview(): PreviewItem[] {
    const kind = this.cmd;
    if (!kind) return [];
    if (EDGE.has(kind)) return edgePreview(this.h, kind, this.st, this.at, this.raw);
    if (this.needsSource()) return this.over ? halo(this.h.draft(), this.over) : [];
    return transformPreview(this.h, kind, this.st, this.at);
  }

  /** Comando sobre a seleção que ainda precisa de linhas: estágio de escolha, ou seleção vazia. */
  private needsSource(): boolean {
    const kind = this.cmd;
    if (!kind || !SOURCED.has(kind)) return false;
    return this.st.stage === 0 || this.h.draft().selected.length === 0;
  }

  /** Ponto do passo: capturado quando o estágio pede ponto, cursor cru nos demais. */
  private pointAt(p: PointerInfo): Vec2 {
    return snapsAt(this.cmd!, this.st) ? this.h.snap(p) : p.raw;
  }

  /** Clique no estágio de escolha: seleciona a linha (Shift soma) e segue até o Enter. */
  private pickSource(p: PointerInfo): void {
    const d = this.h.draft();
    const id = lineAt(d, p.raw, this.h.mpp());
    if (!id) return this.h.say('Clique numa linha; Enter confirma a seleção.');
    this.h.replace(selectSegs(d, [id], p.shift));
    this.h.say(`${this.h.draft().selected.length} linha(s) escolhida(s). Clique mais (Shift soma); Enter confirma.`);
  }

  private hint(): string {
    const kind = this.cmd!;
    if (this.needsSource()) return 'Escolha as linhas: clique numa linha (Shift soma) e Enter confirma.';
    if (EDGE.has(kind)) return edgeHint(kind, this.st);
    return transformHint(kind, this.st);
  }

  private refuse(msg: string): false {
    this.h.say(msg);
    return false;
  }
}
