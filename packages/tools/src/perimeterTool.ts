import type { PerimeterModifyKind } from './perimeterModifyKind.ts';
import { add, angleOf, dist, len, mul, norm, sub, type SketchDraft, type SketchResult, type SketchSeg, type SketchTarget, type Vec2 } from '@hestia/geom';
import { ToolBase } from './base.ts';
import type { InferContext } from './infer.ts';
import { parseNumber } from './numeric.ts';
import { SKETCH_DEFAULTS, addSegs, closeAnalysis, finish as finishSketch, newDraft, removeSegs, type FinishResult } from './perimeterSession.ts';
import { anchorOf, buildShape, kindOf, pointsOf, promptOf, stepPreview, stepsOf, type ShapeStep } from './perimeterToolShape.ts';
import { SELECT_PX, boxRing, draftEdges, draftPoints, hitSeg, segLines } from './perimeterToolPick.ts';
import { boxPick, facePick, facePreview, selectClick } from './perimeterToolInput.ts';
import type { ShapeKindId } from './sketchShapes.ts';
import type { PointerInfo, PreviewItem, ToolEnv } from './types.ts';
import { DraftHistory } from './perimeterToolModifyHistory.ts';
import { ModifyFlow } from './perimeterToolModify.ts';

/** Forma escolhida na barra: uma forma de SHAPE_KINDS, ou um dos dois modos de contorno por referência. */
export type PerimeterShape = ShapeKindId | 'pickFace' | 'byPerimeter';

/** Linha de limite (clique seleciona e desenha) ou inclinação (clique no triângulo de uma aresta, só telhado). */
export type LineKind = 'boundary' | 'slope';

export const PERIMETER_HINT = 'Perímetro: escolha uma forma na barra, ou clique numa linha para selecionar. Concluir fecha o contorno.';
const SELECT_HINT = 'Selecione linhas: clique numa linha (Shift soma), Delete remove. Escolha uma forma na barra para desenhar.';
const PICK_HINT = 'Linha numa face: passe sobre uma face, eixo ou borda do nível. Tab alterna; clique adiciona.';
const BOX_HINT = 'Contorno pela caixa: arraste uma caixa sobre as paredes e solte.';
const SLOPE_HINT = 'Inclinação: clique no triângulo de uma aresta do contorno para ligar ou desligar.';

/** Substitui as linhas com o mesmo id (fileta, por exemplo) e acrescenta as demais, com ids novos. */
function applySegs(d: SketchDraft, segs: SketchSeg[]): SketchDraft {
  const byId = new Map(segs.map((s) => [s.id, s] as const));
  const known = new Set(d.segs.map((s) => s.id));
  return addSegs({ ...d, segs: d.segs.map((s) => byId.get(s.id) ?? s) }, segs.filter((s) => !known.has(s.id)));
}

/**
 * Esboço de perímetro (Criar/Editar perímetro). A ferramenta guarda o `SketchDraft` e só o altera pelas funções puras
 * de `perimeterSession` e de `perimeterModify`. Esc cancela o passo em andamento (e, sem passo, tira a forma escolhida
 * ou desliga o comando de Modificar); Enter não conclui; concluir e descartar são botões (`finish`, `discard`), e
 * `finish` devolve o resultado para quem cria o elemento. Toda mudança de geometria é um passo de `draftHistory`.
 */
export class PerimeterTool extends ToolBase {
  readonly id = 'perimeter';
  readonly label = 'Perímetro';
  readonly hint = PERIMETER_HINT;
  /** Passos de desfazer do rascunho. A UI desfaz e refaz com `undoDraft` e `redoDraft` (Ctrl+Z, Ctrl+Y). */
  readonly draftHistory: DraftHistory;
  private readonly mod: ModifyFlow;
  private shape: PerimeterShape | null = null;
  private line: LineKind = 'boundary';
  private step: ShapeStep | null = null;
  /** Sinalizadores da forma (Tab), ex.: sentido do arco. */
  private flags: Record<string, boolean> = {};
  /** Tab em "pela face": qual candidato entre os ao alcance do cursor. */
  private cycle = 0;
  private hover: string | null = null;
  /** Caixa do arrasto em "pela caixa", ou null. */
  private box: { a: Vec2; b: Vec2 } | null = null;

  constructor(env: ToolEnv, target: SketchTarget = 'roof') {
    super(env);
    const o = env.options();
    this.draftHistory = new DraftHistory(newDraft(target, { slopePct: o.roofSlope ?? SKETCH_DEFAULTS.slopePct, overhang: o.roofOverhang ?? SKETCH_DEFAULTS.overhang }));
    this.mod = new ModifyFlow({
      draft: () => this.d,
      commit: (next) => this.draftHistory.push(next),
      replace: (next) => this.draftHistory.replace(next),
      say: (msg) => this.env.say(msg),
      mpp: () => this.env.metersPerPixel(),
      snap: (p) => this.snap(p, this.snapExtra(null)).point,
      options: () => this.env.options(),
    });
  }

  /** Rascunho corrente (dado puro, para a planta desenhar). */
  draft(): SketchDraft {
    return this.d;
  }

  /** Rascunho corrente, lido do histórico. */
  private get d(): SketchDraft {
    return this.draftHistory.current();
  }

  /** Forma escolhida na barra, ou null (modo de seleção). */
  activeShape(): PerimeterShape | null {
    return this.shape;
  }

  lineKind(): LineKind {
    return this.line;
  }

  /** Validação corrente do rascunho, para a barra de status e o botão Concluir. */
  closeInfo(): SketchResult {
    return closeAnalysis(this.d);
  }

  /** Linha sob o cursor no modo de seleção (ou no comando de Modificar), para a planta destacar. */
  hoverId(): string | null {
    return this.mod.active() ? this.mod.hoverId() : this.hover;
  }

  override preview(): PreviewItem[] {
    return this.mod.active() ? this.mod.preview() : this.items;
  }

  previews(): PreviewItem[] {
    return this.preview();
  }

  /** Escolhe a forma da barra. Null volta à seleção. Troca o passo em andamento e desliga o comando de Modificar. */
  setShape(kind: PerimeterShape | null): void {
    this.mod.stop();
    this.shape = kind;
    this.flags = {};
    this.reset();
    this.env.say(kind === null ? SELECT_HINT : this.shapeHint(kind));
  }

  /** Comando de Modificar ativo, ou null (seleção de linhas). */
  modifyKind(): PerimeterModifyKind | null {
    return this.mod.kind();
  }

  /**
   * Liga um comando de Modificar sobre as linhas do rascunho (null volta à seleção de linhas). Recusa, com aviso, quando
   * não há linhas para modificar. Limpa o passo em andamento.
   */
  setModify(kind: PerimeterModifyKind | null): boolean {
    if (kind === null) {
      this.mod.stop();
      this.shape = null;
      this.reset();
      this.env.say(SELECT_HINT);
      return true;
    }
    if (this.d.segs.length === 0) return this.refuse('Desenhe linhas antes de modificar.');
    this.shape = null;
    this.flags = {};
    this.reset();
    this.mod.start(kind);
    return true;
  }

  /** Desfaz o último passo do rascunho. Devolve false se não há o que desfazer. */
  undoDraft(): boolean {
    if (!this.draftHistory.undo()) return this.refuse('Nada a desfazer.');
    this.reset();
    this.env.say('Desfeito.');
    return true;
  }

  /** Refaz o passo desfeito. Devolve false se não há o que refazer. */
  redoDraft(): boolean {
    if (!this.draftHistory.redo()) return this.refuse('Nada a refazer.');
    this.reset();
    this.env.say('Refeito.');
    return true;
  }

  /** Linha de limite ou de inclinação. Inclinação só existe no telhado e leva o modo de seleção (clique no triângulo). */
  setLineKind(kind: LineKind): boolean {
    if (kind === 'slope' && this.d.target !== 'roof') {
      this.env.say('Inclinação por aresta só existe no telhado.');
      return false;
    }
    this.mod.stop();
    this.line = kind;
    if (kind === 'slope') this.shape = null;
    this.flags = {};
    this.reset();
    this.env.say(kind === 'slope' ? SLOPE_HINT : SELECT_HINT);
    return true;
  }

  /** Botão Concluir: valida o esboço. Se fecha, devolve o contorno e os furos (com as flags das arestas) e limpa o rascunho. */
  finish(): FinishResult {
    const r = finishSketch(this.d);
    if (!r.ok) {
      this.env.say(r.issues[0]?.message ?? 'Esboço incompleto.');
      return r;
    }
    this.draftHistory.reset(newDraft(this.d.target, this.d.defaults));
    this.mod.stop();
    this.reset();
    this.env.say('Perímetro concluído.');
    return r;
  }

  /** Botão Cancelar: descarta o rascunho inteiro. O Esc não faz isto (ver `cancel`). */
  discard(): void {
    this.draftHistory.reset(newDraft(this.d.target, this.d.defaults));
    this.shape = null;
    this.flags = {};
    this.mod.stop();
    this.reset();
    this.env.say('Perímetro descartado.');
  }

  /**
   * Carrega um rascunho (Editar perímetro, ou ajuste de padrões e flags). Troca o rascunho corrente sem passo de
   * desfazer: o histórico de Criar não volta ao contorno carregado.
   */
  loadDraft(d: SketchDraft): void {
    this.draftHistory.replace(d);
    this.reset();
    this.env.say(this.hint);
  }

  /**
   * Esc (contrato `Tool.cancel`). Com comando de Modificar: cancela o passo, e sem passo desliga o comando. Sem
   * comando: cancela o passo da forma; sem passo, tira a forma escolhida. Nunca conclui nem descarta o rascunho.
   */
  override cancel(): void {
    if (this.mod.active()) {
      if (this.mod.cancel()) this.setModify(null);
      return;
    }
    if (this.step || this.box) {
      this.reset();
      this.env.say('Passo cancelado. Esc de novo tira a forma escolhida.');
      return;
    }
    if (this.shape !== null) {
      this.setShape(null);
      return;
    }
    this.env.say(SELECT_HINT);
  }

  /** Enter não conclui: só avisa onde está o botão. Com Modificar, confirma a seleção ou a matriz. */
  override confirm(): void {
    if (this.mod.active()) return this.mod.confirm();
    if (this.d.segs.length > 0) this.env.say('Enter não conclui o perímetro: use o botão Concluir.');
  }

  protected reset(): void {
    this.step = null;
    this.items = [];
    this.inf = null;
    this.hover = null;
    this.box = null;
    this.cycle = 0;
    this.mod.clearStep();
  }

  protected busy(): boolean {
    return this.step !== null || this.box !== null;
  }

  override inputPrompt(): string | null {
    if (this.mod.active()) return this.mod.prompt();
    const st = this.step;
    const input = st ? stepsOf(st.shape)[st.idx] : undefined;
    if (!st || !input) return null;
    if (input.kind === 'length' || input.kind === 'angle' || input.kind === 'count') return input.label;
    return input.kind === 'point' && st.shape.id === 'line' && anchorOf(st) ? 'Comprimento' : null;
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    if (this.box) return;
    this.items = [];
    this.inf = null;
    this.hover = null;
    if (this.mod.active()) {
      this.mod.move(p);
      return;
    }
    const id = this.shapeId();
    if (this.shape === null) {
      if (this.line === 'boundary') this.hover = hitSeg(this.d.segs, p.raw, SELECT_PX * this.env.metersPerPixel());
      return;
    }
    if (this.shape === 'pickFace') this.movePick(p.raw);
    else if (id) this.moveShape(p, id);
  }

  override click(p: PointerInfo): void {
    this.raw = p.raw;
    if (this.mod.active()) this.mod.click(p);
    else if (this.shape === null) this.clickSelect(p);
    else if (this.shape === 'pickFace') this.clickPick(p);
    else if (this.shape === 'byPerimeter') return;
    else this.clickShape(p, this.shape);
  }

  /** Arrasto do contorno pela caixa: começa a caixa no ponto. */
  down(p: PointerInfo): void {
    if (this.shape !== 'byPerimeter') return;
    this.raw = p.raw;
    this.box = { a: p.raw, b: p.raw };
  }

  drag(p: PointerInfo): void {
    if (!this.box) return;
    this.box = { a: this.box.a, b: p.raw };
    this.items = [{ kind: 'polygon', ring: boxRing(this.box.a, this.box.b), dashed: true }];
  }

  /** Solta a caixa: adiciona o contorno externo das paredes que ela pega. Avisos vão para a barra de status. */
  up(p: PointerInfo): void {
    const box = this.box;
    if (!box) return;
    this.reset();
    const r = boxPick(this.env, box.a, p.raw);
    if (!r) return;
    if (r.segs.length > 0) this.commit(applySegs(this.d, r.segs));
    this.env.say(r.msg);
  }

  /** Tab: alterna o candidato sob o cursor (face), o sinalizador da forma (ex.: sentido do arco), ou a variante de Modificar. */
  override tab(): void {
    if (this.mod.active()) return this.mod.tab();
    if (this.shape === 'pickFace') {
      this.cycle += 1;
      this.items = [];
      this.movePick(this.raw);
      return;
    }
    const id = this.shapeId();
    const flag = id ? kindOf(id).inputs.find((i) => i.kind === 'flag') : undefined;
    if (!flag) return;
    this.flags[flag.key] = !this.flags[flag.key];
    this.env.say(`${flag.label}: ${this.flags[flag.key] ? 'sim' : 'não'} (Tab alterna).`);
  }

  /** Digitação: medida, ângulo (graus) ou contagem para a entrada pendente. Na linha, digitar o comprimento põe o fim na direção do cursor. */
  override type(text: string): boolean {
    if (this.mod.active()) return this.mod.type(text);
    const st = this.step;
    const input = st ? stepsOf(st.shape)[st.idx] : undefined;
    if (!st || !input) return false;
    const v = parseNumber(text);
    if (input.kind === 'length' || input.kind === 'angle' || input.kind === 'count') {
      if (v === null) return this.refuse('Valor inválido. Digite um número.');
      if (input.kind === 'length' && v <= 0) return this.refuse('Digite um comprimento maior que zero, em metros.');
      if (input.kind === 'count' && (!Number.isInteger(v) || v < 3)) return this.refuse('Lados: um inteiro de 3 para cima.');
      this.setInput(st, input.key, input.kind === 'angle' ? (v * Math.PI) / 180 : v);
      return true;
    }
    const anchor = anchorOf(st);
    if (input.kind !== 'point' || st.shape.id !== 'line' || !anchor) return false;
    if (v === null) return this.refuse('Valor inválido. Digite um número em metros.');
    if (v <= 0) return this.refuse('Digite um comprimento maior que zero, em metros.');
    const dir = sub(this.inf?.point ?? this.raw, anchor);
    const u = len(dir) < 1e-9 ? { x: 1, y: 0 } : norm(dir);
    this.setInput(st, input.key, add(anchor, mul(u, v)));
    return true;
  }

  /** Delete: remove as linhas selecionadas. Sem seleção, deixa o Delete seguir para a seleção do projeto. */
  deleteKey(): boolean {
    const ids = this.d.selected;
    if (ids.length === 0) return false;
    this.commit(removeSegs(this.d, ids));
    this.hover = null;
    this.env.say(`${ids.length} linha(s) removida(s).`);
    return true;
  }

  /** Muda o rascunho como passo de desfazer (geometria). Seleção só troca o corrente, sem passo. */
  private commit(next: SketchDraft): void {
    this.draftHistory.push(next);
  }

  private shapeId(): ShapeKindId | null {
    return this.shape === null || this.shape === 'pickFace' || this.shape === 'byPerimeter' ? null : this.shape;
  }

  private shapeHint(kind: PerimeterShape): string {
    if (kind === 'pickFace') return PICK_HINT;
    if (kind === 'byPerimeter') return BOX_HINT;
    const k = kindOf(kind);
    return `${k.label}: ${promptOf({ shape: k, idx: 0, vals: {} })}.`;
  }

  private refuse(msg: string): false {
    this.env.say(msg);
    return false;
  }

  /** Captura para os pontos: vértices e linhas do rascunho, mais os pontos do passo, e o ponto anterior da forma. */
  private snapExtra(st: ShapeStep | null): Partial<InferContext> {
    const anchor = anchorOf(st);
    return {
      ...(anchor ? { from: anchor } : {}),
      extraPoints: [...draftPoints(this.d.segs), ...pointsOf(st)],
      extraSegments: draftEdges(this.d.segs),
    };
  }

  private movePick(at: Vec2): void {
    const r = facePreview(this.env, at, this.cycle);
    this.items.push(...r.items);
    this.env.say(r.msg);
  }

  private moveShape(p: PointerInfo, id: ShapeKindId): void {
    const st: ShapeStep = this.step ?? { shape: kindOf(id), idx: 0, vals: {} };
    const input = stepsOf(st.shape)[st.idx];
    if (!input) return;
    const anchor = anchorOf(st);
    if (input.kind === 'segment') {
      const sid = hitSeg(this.d.segs, p.raw, SELECT_PX * this.env.metersPerPixel());
      const seg = this.d.segs.find((s) => s.id === sid);
      if (seg) this.items.push(...segLines(seg, { halo: true }));
      this.env.say(seg ? `${input.label}: clique para escolher.` : `Clique numa linha do esboço (${input.label.toLowerCase()}).`);
      return;
    }
    let value: unknown = null;
    let cursor: Vec2 = p.raw;
    if (input.kind === 'point') {
      const inf = this.snap(p, this.snapExtra(st));
      value = inf.point;
      cursor = inf.point;
    } else if (input.kind === 'length' && anchor) {
      value = dist(p.raw, anchor);
    } else if (input.kind === 'angle' && anchor) {
      value = angleOf(sub(p.raw, anchor));
    }
    this.items.push(...stepPreview(st, value, anchor, cursor, this.flags));
    this.env.say(`${st.shape.label}: ${promptOf(st)}.`);
  }

  private clickSelect(p: PointerInfo): void {
    const r = selectClick(this.d, p, this.line === 'slope', this.env.metersPerPixel(), SELECT_HINT);
    if (r.geom) this.commit(r.next);
    else this.draftHistory.replace(r.next);
    this.env.say(r.msg);
  }

  private clickPick(p: PointerInfo): void {
    const r = facePick(this.env, p.raw, this.cycle, this.d);
    if ('msg' in r) return this.env.say(r.msg);
    this.commit(addSegs(this.d, [r.seg]));
    this.cycle = 0;
    this.env.say(`${r.label} adicionada.`);
  }

  private clickShape(p: PointerInfo, id: ShapeKindId): void {
    const st = this.step ?? this.begin(id);
    const input = stepsOf(st.shape)[st.idx];
    if (!input) return;
    const anchor = anchorOf(st);
    if (input.kind === 'point') {
      const q = this.snap(p, this.snapExtra(st)).point;
      if (anchor && dist(q, anchor) < 1e-9) {
        this.env.say('Ponto repetido: clique noutro lugar.');
        return;
      }
      this.setInput(st, input.key, q);
      return;
    }
    if (input.kind === 'segment') {
      const seg = this.d.segs.find((s) => s.id === hitSeg(this.d.segs, p.raw, SELECT_PX * this.env.metersPerPixel()));
      if (!seg) this.env.say('Clique numa linha do esboço.');
      else this.setInput(st, input.key, seg);
      return;
    }
    if ((input.kind === 'length' || input.kind === 'angle') && anchor) {
      const v = input.kind === 'length' ? dist(p.raw, anchor) : angleOf(sub(p.raw, anchor));
      if (input.kind === 'length' && v < 1e-9) return;
      this.setInput(st, input.key, v);
      return;
    }
    this.env.say(`Digite ${input.label.toLowerCase()}.`);
  }

  private begin(id: ShapeKindId): ShapeStep {
    this.step = { shape: kindOf(id), idx: 0, vals: {} };
    return this.step;
  }

  /** Grava a entrada pendente e avança; ao fechar todas, cria a forma. */
  private setInput(st: ShapeStep, key: string, value: unknown): void {
    st.vals[key] = value;
    st.idx += 1;
    this.items = [];
    if (st.idx >= stepsOf(st.shape).length) this.complete(st);
    else this.env.say(`${st.shape.label}: ${promptOf(st)}.`);
  }

  private complete(st: ShapeStep): void {
    const segs = buildShape(st.shape.id, st.vals, this.flags);
    if (segs.length === 0) {
      const last = stepsOf(st.shape)[st.idx - 1]!;
      st.idx -= 1;
      delete st.vals[last.key];
      this.env.say('Forma degenerada com esses pontos: escolha outro.');
      return;
    }
    this.commit(applySegs(this.d, segs));
    this.items = [];
    this.inf = null;
    if (st.shape.id === 'line') {
      // Linha de limite: a próxima começa na ponta desta, até Esc.
      this.step = { shape: st.shape, idx: 1, vals: { a: st.vals.b } };
      this.env.say('Linha criada. Clique no próximo ponto; Esc encerra.');
      return;
    }
    this.step = null;
    this.env.say(`${st.shape.label} adicionada. Escolha outra forma ou clique numa linha.`);
  }
}
