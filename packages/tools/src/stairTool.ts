import type { Vec2 } from '@hestia/geom';
import { isStair, type Id } from '@hestia/model';
import { distributeRisers } from '@hestia/engine';
import { ToolBase } from './base.ts';
import type { InferContext } from './infer.ts';
import { parseNumber } from './numeric.ts';
import { pickStairAt, stairSnapPoints } from './stairPick.ts';
import { treadItems } from './stairPreview.ts';
import {
  analyzeDraft,
  componentsFromParts,
  copyCurve,
  lastRun,
  partsFromComponents,
  runSketch,
  type DraftReport,
  type StairPart,
  type StairPrimitive,
  type StairSubmode,
  type StairToolOptions,
} from './stairSketchState.ts';
import { chainEnd, emptyStroke, strokeBusy, typedPoint } from './stairStroke.ts';
import { createStairFromComponents, draftStair, stairLimits, stairTypeId, updateStairComponents, type StairCreateOptions } from './stairCommands.ts';
import { clearActive, closeCurrent, cloneParts, drawPoint, partPoints, undoStroke, type DrawState } from './stairDraw.ts';
import { buildItems, hintText, warningText } from './stairView.ts';
import type { PointerInfo, PreviewItem, Tool } from './types.ts';

const HINT = 'Escada: desenhe o limite esquerdo; Enter passa ao direito e outro Enter vai a Espelhos. Esc cancela a cadeia; outro Esc descarta o croqui.';

/** Estado do croqui para a interface: a análise, o contador e o sub-modo. */
export interface StairStatus extends DraftReport {
  submode: StairSubmode;
  primitive: StairPrimitive;
  /** Edita o croqui de uma escada existente (Concluir faz `updateElements`). */
  editing: boolean;
  typeId: Id | null;
  phase: 'left' | 'right';
}

/**
 * Escada por croqui (Revit: Stair > Run > Create Sketch; decisão 0011). Sub-modos: limites (esquerdo, direito), espelhos
 * (linhas soltas), caminhada (opcional), patamar (laço fechado) e concluir. A análise roda a cada mudança: o 1º erro vai
 * para a barra de status, e o contador "criados / restantes" vai ao cursor. Concluir grava UMA escada (ou atualiza a
 * existente) e só se não houver erro de croqui. Ativar a ferramenta com UMA escada selecionada, ou clicar numa, entra em
 * edição do croqui dela. O desenho (cliques, Enter, apagar) fica em `stairDraw.ts`; a prévia, em `stairView.ts`.
 */
export class StairTool extends ToolBase {
  readonly id = 'stair';
  readonly label = 'Escada';
  readonly hint = HINT;
  private st: DrawState = { submode: 'limites', phase: 'left', parts: [], stroke: emptyStroke('line') };
  /** Croqui ao entrar na edição (Esc descarta o que foi feito desde então). */
  private original: StairPart[] = [];
  private stairId: Id | null = null;
  private report: DraftReport = analyzeDraft([], null);
  private treads: PreviewItem[] = [];
  private cursor: Vec2 = { x: 0, y: 0 };

  private get opts(): StairToolOptions {
    return this.env.options().stair ?? {};
  }

  override start(): void {
    this.st = { submode: 'limites', phase: 'left', parts: [], stroke: emptyStroke(this.opts.primitive ?? 'line') };
    if (this.opts.submode && this.opts.submode !== 'concluir') this.st.submode = this.opts.submode;
    const sel = this.env.selection();
    const p = this.env.project();
    const stairs = sel.filter((id) => isStair(p.elements[id]));
    if (sel.length === 1 && stairs.length === 1) this.load(stairs[0]!);
    else this.loadNew();
    this.refresh();
    this.note(this.stairId ? 'Editando o croqui da escada. Concluir grava; Esc descarta as mudanças.' : undefined);
  }

  protected reset(): void {
    this.st.stroke = emptyStroke(this.st.stroke.prim);
    this.items = [];
  }

  protected busy(): boolean {
    return strokeBusy(this.st.stroke);
  }

  /** Estado para a interface (contador, erros, sub-modo, edição). */
  status(): StairStatus {
    const p = this.env.project();
    const stair = this.stairId ? p.elements[this.stairId] : undefined;
    const typeId = isStair(stair) ? stair.typeId : stairTypeId(p, this.opts.typeId);
    return { ...this.report, submode: this.st.submode, primitive: this.st.stroke.prim, editing: this.stairId !== null, typeId, phase: this.st.phase };
  }

  /** Troca o sub-modo. Muda de sub-modo descarta o traçado em curso (não o croqui). */
  setSubmode(m: StairSubmode): void {
    if (m === 'concluir') {
      this.finish();
      return;
    }
    this.st.submode = m;
    if (m === 'limites') this.st.phase = 'left';
    this.st.stroke = emptyStroke(this.st.stroke.prim);
    this.refresh();
    this.note();
  }

  /** Troca a primitiva (linha ou arco). A cadeia já fechada fica; o traçado em curso se perde. */
  setPrimitive(prim: StairPrimitive): void {
    this.st.stroke = { ...emptyStroke(prim), chain: this.st.stroke.chain, last: chainEnd(this.st.stroke) };
    this.refresh();
    this.note(`Primitiva: ${prim === 'line' ? 'linha' : 'arco (início, fim, flecha)'}.`);
  }

  /** "Distribuir N espelhos": espelhos igualmente espaçados entre os limites do lance atual (N da barra de opções). */
  distribute(): void {
    const run = lastRun(this.st.parts);
    if (!run || run.boundaryLeft.length === 0 || run.boundaryRight.length === 0) {
      this.env.say('Desenhe os limites do lance antes de distribuir os espelhos.');
      return;
    }
    const n = Math.floor(this.opts.distributeCount ?? this.report.desired);
    if (!(n >= 1)) {
      this.env.say('Informe o nº de espelhos (N) na barra de opções.');
      return;
    }
    run.risers = distributeRisers(runSketch(run), n).map(copyCurve);
    this.refresh();
    this.note(`${n} espelhos distribuídos entre os limites. Revise e conclua.`);
  }

  /** Apaga a camada do sub-modo atual (limite do lado em desenho, espelhos, caminhada ou o último patamar). */
  clearLayer(): boolean {
    const ok = clearActive(this.st);
    this.refresh();
    if (ok) this.note('Camada apagada. Redesenhe-a.');
    return ok;
  }

  override move(p: PointerInfo): void {
    const inf = this.snap(p, this.snapExtra());
    this.cursor = inf.point;
    this.items = buildItems(this.st, this.cursor, this.treads, this.report);
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, this.snapExtra());
    this.cursor = inf.point;
    if (this.st.submode === 'concluir') return;
    // Clicar numa escada, sem croqui em andamento, entra na edição dela.
    if (this.st.parts.length === 0 && !strokeBusy(this.st.stroke) && this.st.submode === 'limites') {
      const hit = pickStairAt(this.env.project(), this.env.levelId(), p.raw, this.env.metersPerPixel());
      if (hit) {
        this.load(hit);
        this.refresh();
        this.note('Editando o croqui da escada. Concluir grava; Esc descarta as mudanças.');
        return;
      }
    }
    this.drawAt(inf.point);
  }

  override type(text: string): boolean {
    const from = this.st.stroke.last;
    if (this.st.stroke.prim !== 'line' || from === null || this.st.submode === 'concluir') return false;
    const v = parseNumber(text);
    if (v === null || v <= 0) {
      this.env.say('Valor inválido. Digite o comprimento em metros.');
      return false;
    }
    this.drawAt(typedPoint(from, this.cursor, v));
    return true;
  }

  override inputPrompt(): string | null {
    return this.st.submode !== 'concluir' && this.st.stroke.prim === 'line' && this.st.stroke.last !== null ? 'Comprimento' : null;
  }

  /** Enter: fecha o limite, a caminhada ou o patamar; em Concluir, grava. */
  override confirm(): void {
    if (this.st.submode === 'concluir') {
      this.finish();
      return;
    }
    const msg = closeCurrent(this.st);
    this.refresh();
    this.note(msg);
  }

  /** Tab alterna linha e arco. */
  override tab(): void {
    this.setPrimitive(this.st.stroke.prim === 'line' ? 'arc' : 'line');
  }

  /** Esc em dois passos: 1º cancela a cadeia ou o traçado em curso; 2º descarta o croqui e sai da ferramenta. */
  override cancel(): void {
    if (strokeBusy(this.st.stroke)) {
      this.st.stroke = emptyStroke(this.st.stroke.prim);
      this.refresh();
      this.note('Cadeia cancelada. Esc de novo descarta o croqui.');
      return;
    }
    this.st.parts = cloneParts(this.original);
    this.env.done();
  }

  /** Delete: desfaz o último passo em curso; sem traçado, apaga o último espelho ou a camada ativa. */
  deleteKey(): boolean {
    if (undoStroke(this.st)) {
      this.refresh();
      this.note();
      return true;
    }
    const run = lastRun(this.st.parts);
    if (this.st.submode === 'espelhos' && run && run.risers.length) {
      run.risers.pop();
      this.refresh();
      this.note();
      return true;
    }
    return this.st.parts.length > 0 && this.clearLayer();
  }

  /** Um clique no sub-modo atual; a mensagem (se houver) vai para a barra. */
  private drawAt(q: Vec2): void {
    const msg = drawPoint(this.st, q, this.env.metersPerPixel());
    this.refresh();
    this.note(msg);
  }

  private load(id: Id): void {
    const s = this.env.project().elements[id];
    if (!isStair(s)) return;
    this.stairId = id;
    this.st.parts = partsFromComponents(s.components);
    this.original = partsFromComponents(s.components);
    this.st.submode = 'limites';
    this.st.phase = 'left';
    this.st.stroke = emptyStroke(this.st.stroke.prim);
    this.env.setSelection([id]);
  }

  private loadNew(): void {
    this.stairId = null;
    this.st.parts = [];
    this.original = [];
  }

  /** Pontos de captura: escadas do nível e os pontos do croqui (todos os limites, espelhos e a cadeia em curso). */
  private snapExtra(): Partial<InferContext> {
    const p = this.env.project();
    const draft = this.st.parts.flatMap(partPoints);
    const pending = this.st.stroke.chain.flatMap((c) => [c.a, c.b]);
    return {
      from: this.st.stroke.last ?? undefined,
      extraPoints: [...stairSnapPoints(p, this.env.levelId()), ...draft, ...pending],
    };
  }

  /** Limites de cálculo: da escada em edição, ou da escada que a criação faria com as opções. */
  private limits() {
    const p = this.env.project();
    const s = this.stairId ? p.elements[this.stairId] : undefined;
    if (isStair(s)) return stairLimits(p, s);
    const draft = draftStair(p, this.creationOptions(), this.env.levelId());
    return draft ? stairLimits(p, draft) : null;
  }

  private creationOptions(): StairCreateOptions {
    const o = this.opts;
    return {
      typeId: o.typeId,
      levelId: this.env.levelId(),
      topLevelId: o.topLevelId,
      baseOffset: o.baseOffset,
      topOffset: o.topOffset,
      height: o.height,
    };
  }

  /**
   * Recalcula a análise (altura, nº desejado, contador, issues), os degraus e a prévia. Não zera o traçado em curso nem a
   * fase do croqui: é o que a barra chama quando muda tipo, nível de topo, deslocamentos ou altura.
   */
  refresh(): void {
    this.report = analyzeDraft(this.st.parts, this.limits());
    this.treads = treadItems(this.st.parts, this.report.riserHeight);
    this.items = buildItems(this.st, this.cursor, this.treads, this.report);
  }

  /** Mensagem de status: a mensagem pedida, senão o 1º erro do croqui, senão a dica do sub-modo. */
  private note(msg?: string): void {
    this.env.say(msg ?? this.report.firstError ?? hintText(this.st, this.report));
  }

  /** Concluir: grava a escada nova ou o croqui editado, em um passo de desfazer. Só com croqui sem erro. */
  private finish(): void {
    const components = componentsFromParts(this.st.parts);
    if (this.stairId) {
      const r = updateStairComponents(this.env, this.stairId, components);
      if ('error' in r) return this.env.say(`Não é possível concluir: ${r.error}`);
      this.env.done(); // done() volta ao seletor, cuja dica sobrescreve a mensagem: dizer depois
      this.env.say(`Croqui atualizado. ${warningText(r.report)}Ctrl+Z desfaz.`);
      return;
    }
    const r = createStairFromComponents(this.env, components, this.creationOptions());
    if ('error' in r) return this.env.say(`Não é possível concluir: ${r.error}`);
    this.env.done();
    this.env.say(`Escada criada: ${r.report.created} espelhos. ${warningText(r.report)}Ctrl+Z desfaz.`);
  }
}

/** A ferramenta é uma Escada? (a interface usa para ler o estado e chamar as ações). */
export const isStairTool = (t: Tool): t is StairTool => t instanceof StairTool;
