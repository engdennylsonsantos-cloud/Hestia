import { len, mul, norm, sub, v2, type Vec2 } from '@hestia/geom';
import { copyWalls, ghostBands, ghostViews, transformViews } from './edit.ts';
import { fmtM, SelectionTool } from './transformTools.ts';
import { parseNumber } from './numeric.ts';
import { arraySet, commitRadial, fmtXY, linearStep, radialAngles, radialGhosts } from './arrayRadial.ts';
import type { PointerInfo } from './types.ts';

const HINT_LINEAR = 'Matriz linear: clique no ponto base e no segundo ponto (espaçamento) — ou digite o espaçamento.';
const HINT_RADIAL = 'Matriz radial: clique no centro da matriz. Depois clique para criar os itens, ou digite o ângulo em graus.';

/** Dica do primeiro passo de cada tipo (a barra de status usa a mesma ao trocar o tipo). */
export const arrayHint = (radial: boolean): string => (radial ? HINT_RADIAL : HINT_LINEAR);

/** Porta ou janela sozinha não se copia: ela depende da parede hospedeira (D3). */
export const AVISO_HOSPEDEIRA = 'Selecione também a parede hospedeira: portas e janelas acompanham a parede.';

/**
 * Matriz: linear (N elementos pelo espaçamento) ou radial (N elementos girados em torno de um centro).
 * "Mover para": Segundo leva o espaçamento/ângulo do 1º ao 2º item; Último, do 1º ao último (dividido entre os itens).
 */
export class ArrayTool extends SelectionTool {
  readonly id = 'array';
  readonly label = 'Matriz';
  readonly hint = HINT_LINEAR;
  /** Linear: ponto base. Radial: centro da matriz. */
  private base: Vec2 | null = null;
  /** Tipo e "Mover para" em uso quando o passo começou: se a barra mudar, o passo recomeça (D1/D2). */
  private stepMode = '';

  private radial(): boolean {
    return this.env.options().arrayKind === 'radial';
  }
  private anchor() {
    return this.env.options().arrayAnchor ?? 'second';
  }
  private count(): number {
    return Math.max(2, this.env.options().arrayCount);
  }
  private angleDeg(): number {
    return this.env.options().arrayAngle ?? 360;
  }
  private hintNow(): string {
    return arrayHint(this.radial());
  }
  private modeNow(): string {
    return `${this.radial()}|${this.anchor()}`;
  }
  /** Trocar o tipo ou "Mover para" no meio do passo descarta a base/centro e a prévia: o próximo clique é um primeiro passo. */
  private checkStep(): void {
    if (this.base && this.stepMode !== this.modeNow()) this.reset();
  }
  private startStep(p: Vec2): void {
    this.base = p;
    this.stepMode = this.modeNow();
  }

  protected reset(): void {
    this.base = null;
    this.items = [];
  }
  protected busy(): boolean {
    return this.base !== null;
  }
  override inputPrompt(): string | null {
    this.checkStep();
    if (!this.base) return null;
    if (this.radial()) return 'Ângulo (graus)';
    return this.anchor() === 'last' ? 'Distância total' : 'Espaçamento';
  }

  override start(): void {
    super.start();
    if (this.soAberturas()) this.env.say(AVISO_HOSPEDEIRA);
    else if (this.hasSelection()) this.env.say(this.hintNow());
  }

  /** Só portas ou janelas selecionadas: a Matriz copia paredes, pisos, lajes, vistas e forros, não a abertura solta. */
  private soAberturas(): boolean {
    const set = arraySet(this.env.project(), this.env.selection());
    return this.openings().length > 0 && set.els.length === 0 && set.views.length === 0 && set.ceil.length === 0;
  }

  /** Esc: cancela o centro ou o ponto base; o segundo Esc sai da ferramenta. */
  override cancel(): void {
    if (!this.busy()) {
      this.env.done();
      return;
    }
    this.reset();
    this.env.say(this.hintNow());
  }

  private ghosts(step: Vec2): void {
    const n = this.count();
    for (let i = 1; i < n; i++) {
      const t = { kind: 'translate', d: mul(step, i) } as const;
      this.items.push(...ghostBands(this.env.project(), this.movables(), t), ...ghostViews(this.env.project(), this.env.selection(), t));
    }
  }

  override move(p: PointerInfo): void {
    this.checkStep();
    this.items = [];
    if (this.radial()) return this.moveRadial(p);
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(this.movables()) });
    if (!this.base) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    const d = sub(inf.point, this.base);
    this.items.push({ kind: 'line', a: this.base, b: inf.point, dashed: true });
    const step = linearStep(d, this.count(), this.anchor());
    this.ghosts(step);
    this.items.push({ kind: 'label', at: inf.point, text: `${this.count()} × ${fmtM(len(step))}` });
  }

  /** Radial: antes do centro, mostra a dica no cursor; depois, a pré-visualização dos itens nos ângulos da barra. */
  private moveRadial(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(this.movables()) });
    if (!this.base) {
      this.items.push({ kind: 'point', at: inf.point }, { kind: 'label', at: inf.point, text: 'Clique no centro da matriz' });
      return;
    }
    this.items.push({ kind: 'point', at: this.base }, { kind: 'line', a: this.base, b: inf.point, dashed: true });
    const angles = radialAngles(this.count(), this.angleDeg(), this.anchor());
    this.items.push(...radialGhosts(this.env, arraySet(this.env.project(), this.env.selection()), this.base, angles));
    this.items.push({ kind: 'label', at: inf.point, text: `${this.count()} × ${this.angleDeg().toFixed(1).replace('.', ',')}°` });
  }

  private commit(d: Vec2): void {
    if (this.soAberturas()) return this.env.say(AVISO_HOSPEDEIRA);
    const n = this.count();
    const step = linearStep(d, n, this.anchor());
    if (len(step) < 1e-6) return;
    const els = this.movables();
    const views = this.views();
    this.env.transaction('Matriz', () => {
      for (let i = 1; i < n; i++) {
        const t = { kind: 'translate', d: mul(step, i) } as const;
        if (els.length) copyWalls(this.env, els, t);
        if (views.length) transformViews(this.env, views, t, true);
      }
    });
    this.reset();
    this.env.done();
  }

  /** Radial: copia a seleção em cada ângulo e sai, com a mensagem de resumo. */
  private applyRadial(angleDeg: number): void {
    const center = this.base;
    if (!center || Math.abs(angleDeg) < 1e-6) return;
    if (this.soAberturas()) return this.env.say(AVISO_HOSPEDEIRA);
    const n = this.count();
    const angles = radialAngles(n, angleDeg, this.anchor());
    commitRadial(this.env, arraySet(this.env.project(), this.env.selection()), center, angles);
    const msg = `Matriz radial: ${n} itens em ${angleDeg.toFixed(1).replace('.', ',')}° em torno de (${fmtXY(center)})`;
    this.reset();
    this.env.done();
    this.env.say(msg);
  }

  override click(p: PointerInfo): void {
    this.checkStep();
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(this.movables()) });
    if (this.radial()) {
      if (!this.base) {
        this.startStep(inf.point);
        this.env.say(`Matriz radial: centro em (${fmtXY(inf.point)}). Clique para criar os itens, ou digite o ângulo.`);
        return;
      }
      this.applyRadial(this.angleDeg());
      return;
    }
    if (!this.base) {
      this.startStep(inf.point);
      return;
    }
    this.commit(sub(inf.point, this.base));
  }

  override type(text: string): boolean {
    this.checkStep();
    if (!this.base) return false;
    const v = parseNumber(text);
    if (v === null) return false;
    if (this.radial()) {
      this.applyRadial(v);
      return true;
    }
    const dir = norm(sub(this.inf?.point ?? this.raw, this.base));
    this.commit(mul(len(dir) < 1e-9 ? v2(1, 0) : dir, v));
    return true;
  }
}
