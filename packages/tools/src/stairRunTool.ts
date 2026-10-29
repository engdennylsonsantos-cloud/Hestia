import { add, len, mul, sub, type Vec2 } from '@hestia/geom';
import { stairTopLevel } from '@hestia/model';
import { SPIRAL_MAX_SWEEP, stairIssuesOf, treadRuleOf, type TreadRule } from '@hestia/engine';
import { draftStair, stairFromGenerator, stairLimits, type StairCommandResult, type StairCreateOptions } from './stairCommands.ts';
import { ToolBase } from './base.ts';
import { parseNumber } from './numeric.ts';
import { partsPreview, treadItems } from './stairPreview.ts';
import { componentsFromParts, type StairPart } from './stairSketchState.ts';
import { DEFAULT_STAIR_RUN_OPTIONS, planStairRun, type StairRunPlan, type StairRunToolOptions } from './stairRunPlan.ts';
import { planSpiralRun, SPIRAL_DEFAULT_INNER, SPIRAL_MIN_SWEEP, wrapAngle, type SpiralPlan } from './stairSpiralRun.ts';
import { stairTypeForShape } from './stairRunTypes.ts';
import type { PointerInfo, PreviewItem } from './types.ts';

const START_HINT = 'Escada: clique no centro do 1º espelho. Esc cancela.';
const DIRECTION_HINT = 'Escada: clique para dar a direção de subida, ou digite o ângulo em graus (0 = eixo X). Esc cancela o ponto.';
const SPIRAL_START_HINT = 'Caracol: clique no centro. Esc cancela.';
const SPIRAL_RADIUS_HINT = 'Caracol: clique no raio externo e no ângulo inicial (ou digite o raio em metros). Backspace volta ao centro.';
const SPIRAL_SWEEP_HINT = 'Caracol: gire o mouse em torno do centro para a varredura (passa de 360°, até 720°). Clique ou Enter confirma; Backspace volta.';
/** Distância mínima (m) entre o 1º espelho e o cursor para definir a direção. */
const MIN_DIRECTION = 0.01;
/** Vértices do círculo de prévia do caracol. */
const CIRCLE_SEGMENTS = 96;
const DEG = Math.PI / 180;

/** Centímetros com vírgula, como nas outras mensagens (0,175 m → "17,5"). */
const cm = (m: number): string => (m * 100).toFixed(1).replace('.', ',');
/** Metros com vírgula e duas casas (1 → "1,00"). */
const mText = (m: number): string => m.toFixed(2).replace('.', ',');
/** Graus com uma casa, em módulo (540 → "540°"; 275,25 → "275,3°"). */
const degText = (rad: number): string => `${(Math.round(Math.abs(rad) / DEG * 10) / 10).toString().replace('.', ',')}°`;

const circleRing = (c: Vec2, r: number): Vec2[] =>
  Array.from({ length: CIRCLE_SEGMENTS }, (_, i) => {
    const a = (2 * Math.PI * i) / CIRCLE_SEGMENTS;
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  });

/**
 * Estado do caracol em criação (3 cliques, decisão 0014 §1 item 12). 1º clique = centro (`origin`); 2º = raio externo e
 * ângulo inicial (fixados em `outer` e `start`); 3º = ângulo final: a varredura `sweep` acumula o giro do cursor em torno
 * do centro (passa de 360°, até 720°) e o sentido vem do primeiro movimento.
 */
interface SpiralDraw {
  outer: number | null;
  start: number | null;
  sweep: number;
  /** Ângulo do cursor no último ponto contado (para acumular a varredura). */
  last: number | null;
  /** Último ponto do cursor (cru). */
  cursor: Vec2;
}

const emptySpiral = (cursor: Vec2 = { x: 0, y: 0 }): SpiralDraw => ({ outer: null, start: null, sweep: 0, last: null, cursor });

/** Prévia de um caracol: o croqui do gerador, os degraus e o rótulo "Varredura: X° · N espelhos" no cursor. */
function caracolItems(plan: SpiralPlan, cur: Vec2): PreviewItem[] {
  const parts: StairPart[] = [{ kind: 'run', run: plan.run }];
  return [
    ...partsPreview(parts),
    ...treadItems(parts, plan.riserHeight),
    { kind: 'label', at: cur, text: `Varredura: ${degText(plan.run.spiral.sweep)} · ${plan.risers} espelhos` },
  ];
}

/**
 * Escada reta, em L, em U, com leque ou caracol, criada pronta por cliques (decisão 0011 §5; caracol, decisão 0014 §1 item
 * 12). Reta/L/U/leque: o 1º clique é o centro do 1º espelho, a prévia segue o cursor (degraus e patamar) e o 2º clique fixa a
 * direção de subida; entrada numérica: o ângulo de subida em graus. Caracol: 1º clique = centro; 2º = raio externo e
 * ângulo inicial; 3º = ângulo final (ou Enter), com a varredura acumulada. Cada criação é UMA transação ("Criar escada").
 * A altura vem do nível ativo e do nível acima (ou da altura da barra de escada, sem nível acima). Depois de criar, a
 * ferramenta continua pronta para outra escada; Esc sai como nas demais.
 */
export class StairRunTool extends ToolBase {
  readonly id = 'stairrun';
  readonly label = 'Escada (reta/L/U/caracol)';
  readonly hint = START_HINT;
  private origin: Vec2 | null = null;
  /** Estado do caracol em criação (só usado na forma `spiral`). */
  private sp: SpiralDraw = emptySpiral();

  private get opts(): StairRunToolOptions {
    return this.env.options().stairRun ?? DEFAULT_STAIR_RUN_OPTIONS;
  }

  private get spiralOn(): boolean {
    return this.opts.shape === 'spiral';
  }

  /** Raio interno (m) da ferramenta: o digitado na barra, ou 0,10 m. */
  private get innerR(): number {
    return this.opts.spiralInner ?? SPIRAL_DEFAULT_INNER;
  }

  protected reset(): void {
    this.origin = null;
    this.items = [];
    this.inf = null;
    this.sp = emptySpiral();
  }

  protected busy(): boolean {
    return this.origin !== null;
  }

  override start(): void {
    this.reset();
    this.env.say(this.spiralOn ? SPIRAL_START_HINT : START_HINT);
  }

  override inputPrompt(): string | null {
    if (this.spiralOn) {
      if (this.origin === null) return null;
      return this.sp.start === null ? 'Raio externo (m)' : 'Varredura (°)';
    }
    return this.origin !== null ? 'Ângulo (°)' : null;
  }

  override move(p: PointerInfo): void {
    if (this.spiralOn) {
      if (this.origin === null) {
        this.items = [{ kind: 'point', at: this.snap(p).point }];
        return;
      }
      this.inf = null;
      this.sp.cursor = p.raw;
      if (this.sp.start !== null) this.spiralTrack(p.raw);
      this.items = this.spiralItems();
      return;
    }
    const inf = this.snap(p, { from: this.origin ?? undefined });
    this.items = this.drawItems(inf.point);
  }

  override click(p: PointerInfo): void {
    if (this.spiralOn) {
      this.spiralClick(p);
      return;
    }
    const inf = this.snap(p, { from: this.origin ?? undefined });
    if (this.origin === null) {
      this.origin = inf.point;
      this.env.say(DIRECTION_HINT);
      return;
    }
    const dir = sub(inf.point, this.origin);
    if (len(dir) < MIN_DIRECTION) {
      this.env.say('Afaste o cursor do ponto inicial para dar a direção.');
      return;
    }
    // Reta: o 2º clique define também o comprimento do lance (o nº de espelhos sai dele).
    this.create(dir, len(dir));
  }

  /** Enter: no caracol, confirma a varredura atual (com o cursor onde está); nas outras formas, o padrão. */
  override confirm(): void {
    if (!this.spiralOn) {
      super.confirm();
      return;
    }
    if (this.origin === null) return;
    if (this.sp.start === null) {
      this.env.say(SPIRAL_RADIUS_HINT);
      return;
    }
    this.spiralTrack(this.sp.cursor);
    this.spiralConfirm();
  }

  /** Backspace (e Delete) no caracol volta um passo: da varredura ao raio, do raio ao centro. Fora dele, nada. */
  deleteKey(): boolean {
    if (!this.spiralOn || this.origin === null) return false;
    if (this.sp.start !== null) {
      this.sp = emptySpiral(this.sp.cursor);
      this.env.say(SPIRAL_RADIUS_HINT);
      this.items = this.spiralItems();
      return true;
    }
    this.reset();
    this.env.say(SPIRAL_START_HINT);
    return true;
  }

  /**
   * Ângulo digitado (graus, a partir do eixo X) fixa a direção e cria a escada. No caracol: raio externo (m) no 2º passo,
   * depois a varredura (graus), com o sentido do primeiro movimento ou o da opção.
   */
  override type(text: string): boolean {
    if (this.spiralOn) return this.spiralType(text);
    if (this.origin === null) return false;
    const v = parseNumber(text);
    if (v === null) {
      this.env.say('Valor inválido. Digite o ângulo em graus.');
      return false;
    }
    const a = (v * Math.PI) / 180;
    return this.create({ x: Math.cos(a), y: Math.sin(a) });
  }

  /** Prévia do que seria criado com a direção do cursor; o erro de cálculo aparece na barra de status. */
  private drawItems(cursor: Vec2): PreviewItem[] {
    if (this.origin === null) return [{ kind: 'point', at: cursor }];
    const dir = sub(cursor, this.origin);
    if (len(dir) < MIN_DIRECTION) return [{ kind: 'point', at: this.origin }];
    const b = this.build(dir, len(dir));
    if ('error' in b) {
      this.env.say(b.error);
      return [{ kind: 'point', at: this.origin }];
    }
    this.env.say(DIRECTION_HINT);
    const plan = b;
    return [
      ...partsPreview(plan.parts),
      ...treadItems(plan.parts, plan.riserHeight),
      { kind: 'label', at: cursor, text: `${plan.risers} espelhos · ${cm(plan.riserHeight)} cm · piso ${cm(plan.tread)} cm` },
    ];
  }

  /** Opções da criação: tipo (compatível com a forma), e cotas da barra de escada (base, topo e altura sem nível acima). */
  private creation(): StairCreateOptions {
    const so = this.env.options().stair ?? {};
    return {
      typeId: stairTypeForShape(this.env.project(), this.opts.shape, this.opts.typeId) ?? undefined,
      levelId: this.env.levelId(),
      topLevelId: so.topLevelId,
      baseOffset: so.baseOffset,
      topOffset: so.topOffset,
      height: so.height,
      mark: this.env.options().placementMark ?? '',
      comments: this.env.options().placementComments ?? '',
    };
  }

  /** H (nível ativo e nível acima), espelho máximo, piso mínimo e regra de cálculo do tipo da criação. */
  private limitsNow(): { H: number; maxRiser: number; minTread: number; rule: TreadRule } | { error: string } {
    const p = this.env.project();
    const ref = draftStair(p, this.creation(), this.env.levelId());
    const limits = ref ? stairLimits(p, ref) : null;
    const type = ref ? p.stairTypes[ref.typeId] : undefined;
    if (!ref || !limits || !type) return { error: 'O projeto não tem tipo de escada.' };
    if (!(limits.H > 0)) {
      return {
        error: stairTopLevel(p, ref)
          ? 'O nível de topo não fica acima da base: nada a gerar.'
          : 'Sem nível de topo: escolha o nível de cima na barra de escada (ou informe uma altura positiva).',
      };
    }
    return { H: limits.H, maxRiser: limits.maxRiser, minTread: type.minTread, rule: treadRuleOf(type) };
  }

  /**
   * Plano da escada reta/L/U/leque para a direção dada; erro com a mensagem de status em pt-BR. `length` (reta, pelo 2º
   * clique) fixa o comprimento do lance; sem ele (ângulo digitado), vale o nº de espelhos pela altura.
   */
  private build(dir: Vec2, length?: number): StairRunPlan | { error: string } {
    const lim = this.limitsNow();
    if ('error' in lim) return lim;
    const options = length !== undefined ? { ...this.opts, length } : this.opts;
    return planStairRun({ start: this.origin!, dir, H: lim.H, maxRiser: lim.maxRiser, minTread: lim.minTread, rule: lim.rule, options });
  }

  /** Cria a escada com a direção dada (e o comprimento, na reta), em um passo de desfazer. Mantém a ferramenta pronta. */
  private create(dir: Vec2, length?: number): boolean {
    const b = this.build(dir, length);
    if ('error' in b) {
      this.env.say(b.error);
      return false;
    }
    const comps = componentsFromParts(b.parts);
    const out: { r?: StairCommandResult } = {};
    this.env.transaction('Criar escada', () => {
      out.r = stairFromGenerator(this.env, comps, { ...this.creation(), generatedBy: this.opts.shape });
    });
    const r = out.r;
    if (!r || 'error' in r) {
      this.env.say(`Não é possível criar a escada: ${r?.error ?? 'falha ao gravar.'}`);
      return false;
    }
    // Com comprimento que dá outro nº (`note`), a explicação substitui o aviso "difere do nº desejado", que contradiria o criado.
    const aviso = stairIssuesOf(this.env.project(), r.id).find((i) => i.stairId === r.id && i.severity === 'warning' && !(b.note && i.code === 'stair-risers-count'));
    const extra = b.note ? ` ${b.note}` : '';
    const avisoText = aviso ? ` Aviso: ${aviso.message}` : '';
    this.env.say(`Escada criada: ${b.risers} espelhos de ${cm(b.riserHeight)} cm, piso ${cm(b.tread)} cm.${extra}${avisoText} Ctrl+Z desfaz.`);
    this.reset();
    return true;
  }

  // ---------- caracol (3 cliques) ----------

  private spiralClick(p: PointerInfo): void {
    if (this.origin === null) {
      this.origin = this.snap(p).point;
      this.sp = emptySpiral(p.raw);
      this.env.say(SPIRAL_RADIUS_HINT);
      return;
    }
    if (this.sp.start === null) {
      this.spiralFixRadius(p.raw);
      return;
    }
    this.spiralTrack(p.raw);
    this.spiralConfirm();
  }

  /**
   * 2º passo: fixa o raio externo (o digitado, ou a distância do cursor ao centro) e o ângulo inicial (o do cursor). Com a
   * varredura digitada na barra, o passo já cria o caracol; senão, passa ao 3º (varredura pelo giro).
   */
  private spiralFixRadius(raw: Vec2): void {
    const c = this.origin!;
    const d = sub(raw, c);
    const r = this.opts.spiralOuter ?? len(d);
    if (!(r > 0)) {
      this.env.say('Afaste o cursor do centro para dar o raio externo.');
      return;
    }
    if (!(r > this.innerR)) {
      this.env.say(`O raio externo (${mText(r)} m) deve ser maior que o interno (${mText(this.innerR)} m).`);
      return;
    }
    this.sp = { outer: r, start: Math.atan2(d.y, d.x), sweep: 0, last: null, cursor: raw };
    this.sp.last = this.sp.start;
    const typed = this.typedSweep();
    if (typed !== null) {
      this.sp.sweep = typed;
      if (!this.spiralConfirm()) this.sp.sweep = 0;
      return;
    }
    this.env.say(SPIRAL_SWEEP_HINT);
    this.items = this.spiralItems();
  }

  /** Acumula o giro do cursor em torno do centro na varredura (passa de 360°, até 720°). O 1º movimento dá o sentido. */
  private spiralTrack(raw: Vec2): void {
    const d = sub(raw, this.origin!);
    if (len(d) < 1e-9) return;
    const th = Math.atan2(d.y, d.x);
    if (this.sp.last !== null) {
      const delta = wrapAngle(th - this.sp.last);
      if (Math.abs(delta) > 1e-6) this.sp.sweep = Math.max(-SPIRAL_MAX_SWEEP, Math.min(SPIRAL_MAX_SWEEP, this.sp.sweep + delta));
    }
    this.sp.last = th;
  }

  /** Varredura digitada na barra (rad, com o sentido da opção), ou null se não foi digitada. */
  private typedSweep(): number | null {
    const v = this.opts.spiralSweep;
    if (v === undefined) return null;
    return (this.opts.spiralSense === 'cw' ? -1 : 1) * v * DEG;
  }

  /** Plano do caracol com os passos fixados até agora; erro em pt-BR. */
  private spiralPlanNow(): SpiralPlan | { error: string } {
    const lim = this.limitsNow();
    if ('error' in lim) return lim;
    if (this.origin === null || this.sp.outer === null || this.sp.start === null) return { error: 'Caracol: falta o centro, o raio ou o ângulo inicial.' };
    return planSpiralRun({
      center: this.origin,
      rInner: this.innerR,
      rOuter: this.sp.outer,
      startAngle: this.sp.start,
      sweep: this.sp.sweep,
      H: lim.H,
      maxRiser: lim.maxRiser,
    });
  }

  /** Cria o caracol se a varredura vale (30° a 720°); senão, a mensagem diz o que falta. */
  private spiralConfirm(): boolean {
    const plan = this.spiralPlanNow();
    if ('error' in plan) {
      this.env.say(plan.error);
      return false;
    }
    return this.spiralCreate(plan);
  }

  /** Cria o caracol com `stairFromGenerator` (uma transação, um passo de desfazer). Origem `spiral`, com os parâmetros. */
  private spiralCreate(plan: SpiralPlan): boolean {
    const comps = componentsFromParts([{ kind: 'run', run: plan.run }]);
    const out: { r?: StairCommandResult } = {};
    this.env.transaction('Criar escada', () => {
      out.r = stairFromGenerator(this.env, comps, { ...this.creation(), generatedBy: 'spiral' });
    });
    const r = out.r;
    if (!r || 'error' in r) {
      this.env.say(`Não é possível criar a escada: ${r?.error ?? 'falha ao gravar.'}`);
      return false;
    }
    // O aviso fixo de saída de emergência vem em todo caracol: a mensagem traz só o aviso que muda o projeto.
    const aviso = stairIssuesOf(this.env.project(), r.id).find((i) => i.stairId === r.id && i.severity === 'warning' && i.code !== 'stair-spiral-exit');
    const extra = aviso ? ` Aviso: ${aviso.message}` : '';
    this.env.say(`Escada caracol criada: ${plan.risers} espelhos, varredura ${degText(plan.run.spiral.sweep)}.${extra} Ctrl+Z desfaz.`);
    this.reset();
    return true;
  }

  /** Digitação no caracol: raio externo (m) no 2º passo, depois a varredura (graus). */
  private spiralType(text: string): boolean {
    if (this.origin === null) return false;
    const v = parseNumber(text);
    if (v === null || !(v > 0)) {
      this.env.say(this.sp.start === null ? 'Valor inválido. Digite o raio externo em metros.' : 'Valor inválido. Digite a varredura em graus.');
      return false;
    }
    if (this.sp.start === null) {
      if (!(v > this.innerR)) {
        this.env.say(`O raio externo (${mText(v)} m) deve ser maior que o interno (${mText(this.innerR)} m).`);
        return false;
      }
      const d = sub(this.sp.cursor, this.origin);
      this.sp = { outer: v, start: Math.atan2(d.y, d.x), sweep: 0, last: null, cursor: this.sp.cursor };
      this.sp.last = this.sp.start;
      this.env.say(SPIRAL_SWEEP_HINT);
      this.items = this.spiralItems();
      return true;
    }
    // Varredura digitada: no sentido já dado pelo giro, ou no da opção se o cursor ainda não girou.
    const sign = this.sp.sweep !== 0 ? Math.sign(this.sp.sweep) : this.opts.spiralSense === 'cw' ? -1 : 1;
    this.sp.sweep = sign * v * DEG;
    return this.spiralConfirm();
  }

  /** Prévia do caracol no estado atual: o círculo e o raio no 2º passo; o caracol completo no 3º (ou com varredura digitada). */
  private spiralItems(): PreviewItem[] {
    const c = this.origin;
    if (!c) return [];
    const cur = this.sp.cursor;
    const d = sub(cur, c);
    if (this.sp.start === null) return this.radiusItems(c, cur, d);
    return this.sweepItems(c, cur);
  }

  /** 2º passo: círculo do raio externo e do interno, raio na direção do cursor, com o valor na dica. */
  private radiusItems(c: Vec2, cur: Vec2, d: Vec2): PreviewItem[] {
    const r = this.opts.spiralOuter ?? len(d);
    const th = len(d) > 1e-9 ? Math.atan2(d.y, d.x) : 0;
    const u = { x: Math.cos(th), y: Math.sin(th) };
    const items: PreviewItem[] = [];
    if (r > this.innerR) {
      items.push({ kind: 'polygon', ring: circleRing(c, r), dashed: true }, { kind: 'polygon', ring: circleRing(c, this.innerR), dashed: true });
    }
    items.push({ kind: 'line', a: c, b: add(c, mul(u, r)), dashed: true });
    const sw = this.typedSweep();
    if (sw !== null && r > this.innerR) {
      const lim = this.limitsNow();
      if (!('error' in lim)) {
        const plan = planSpiralRun({ center: c, rInner: this.innerR, rOuter: r, startAngle: th, sweep: sw, H: lim.H, maxRiser: lim.maxRiser });
        if (!('error' in plan)) items.push(...caracolItems(plan, cur));
      }
    }
    items.push({ kind: 'label', at: cur, text: `Raio externo ${mText(r)} m` });
    if (sw === null) this.env.say(`Raio externo ${mText(r)} m: clique para fixar o raio e o ângulo inicial.`);
    return items;
  }

  /** 3º passo: o caracol com a varredura atual; abaixo de 30° só o croqui de referência, com o aviso. */
  private sweepItems(c: Vec2, cur: Vec2): PreviewItem[] {
    const lim = this.limitsNow();
    const sw = this.sp.sweep;
    const label: PreviewItem = { kind: 'label', at: cur, text: `Varredura: ${degText(sw)}` };
    if ('error' in lim || this.sp.outer === null || this.sp.start === null) {
      this.env.say('error' in lim ? lim.error : 'Caracol: falta o raio ou o ângulo inicial.');
      return [label];
    }
    const outer = this.sp.outer;
    const start = this.sp.start;
    const plan = planSpiralRun({ center: c, rInner: this.innerR, rOuter: outer, startAngle: start, sweep: sw, H: lim.H, maxRiser: lim.maxRiser });
    if ('error' in plan) {
      // Abaixo de 30° (ou fora dos limites) não há caracol: mostra o raio e o ângulo inicial, com o motivo na barra.
      const short = Math.abs(sw) < SPIRAL_MIN_SWEEP;
      this.env.say(short ? `Varredura ${degText(sw)}: gire o mouse para pelo menos 30°.` : plan.error);
      const u = { x: Math.cos(start), y: Math.sin(start) };
      return [
        { kind: 'polygon', ring: circleRing(c, outer), dashed: true },
        { kind: 'line', a: c, b: add(c, mul(u, outer)), dashed: true },
        label,
      ];
    }
    this.env.say(`Varredura ${degText(sw)}: clique ou Enter confirma; Backspace volta.`);
    return caracolItems(plan, cur);
  }
}
