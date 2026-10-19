import { boxOf, dist, type Vec2 } from '@hestia/geom';
import { isSlab, type Slab } from '@hestia/model';
import { ToolBase } from './base.ts';
import { parseNumber } from './numeric.ts';
import { selectedSlabs } from './slabPick.ts';
import { fmtPercent, slopeError, slopeFrom, slopePreview } from './slabSlope.ts';
import type { PointerInfo } from './types.ts';

/**
 * Definir inclinação da laje selecionada (Revit: Slope arrow). 1º clique = origem da linha de caimento; 2º clique =
 * direção. Depois, o percentual: Enter aplica o da barra de opções, ou digite outro valor e Enter. A ferramenta só
 * emite `updateElements` com o campo `slope`.
 */
export class SlopeTool extends ToolBase {
  readonly id = 'slope';
  readonly label = 'Inclinação';
  readonly hint = 'Inclinação: selecione uma laje. Clique na origem do caimento e depois na direção. Enter aplica o percentual da barra.';
  private origin: Vec2 | null = null;
  private dirPt: Vec2 | null = null;

  override start(): void {
    this.reset();
    this.env.say(this.target() ? this.hint : 'Selecione uma laje primeiro e escolha Inclinação de novo.');
  }

  protected reset(): void {
    this.origin = null;
    this.dirPt = null;
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.origin !== null;
  }

  /** A única laje selecionada (a inclinação é de uma laje por vez). */
  private target(): Slab | null {
    const p = this.env.project();
    const ids = selectedSlabs(p, this.env.selection());
    if (ids.length !== 1) return null;
    const s = p.elements[ids[0]!];
    return isSlab(s) ? s : null;
  }

  private percent(): number {
    return this.env.options().slabSlopePercent;
  }

  /** Comprimento da seta da prévia: um quarto da diagonal da laje, entre 0,5 m e 3 m. */
  private arrowLength(s: Slab): number {
    const b = boxOf(s.boundary);
    return Math.min(3, Math.max(0.5, Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 4));
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    this.items = [];
    const s = this.target();
    if (!s) return;
    const inf = this.snap(p, { from: this.origin ?? undefined, extraPoints: s.boundary });
    this.items.push({ kind: 'highlight', ids: [s.id] });
    if (this.origin && this.dirPt) {
      const slope = slopeFrom(this.origin, this.dirPt, this.percent());
      if (slope) this.items.push(...slopePreview(slope, this.arrowLength(s)));
      return;
    }
    if (this.origin) this.items.push({ kind: 'line', a: this.origin, b: inf.point, dashed: true });
    else this.items.push({ kind: 'point', at: inf.point });
  }

  override click(p: PointerInfo): void {
    this.raw = p.raw;
    const s = this.target();
    if (!s) {
      this.env.say('Selecione uma laje primeiro.');
      return;
    }
    if (this.dirPt) {
      this.env.say(`Enter aplica ${fmtPercent(this.percent())}; ou digite outro percentual e Enter.`);
      return;
    }
    const inf = this.snap(p, { from: this.origin ?? undefined, extraPoints: s.boundary });
    if (!this.origin) {
      this.origin = inf.point;
      this.env.say('Agora clique na direção do caimento.');
      return;
    }
    if (dist(inf.point, this.origin) < 1e-6) {
      this.env.say('Direção inválida: clique em outro ponto.');
      return;
    }
    this.dirPt = inf.point;
    this.env.say(`Percentual: Enter aplica ${fmtPercent(this.percent())}; ou digite outro valor e Enter.`);
  }

  override inputPrompt(): string | null {
    return this.dirPt ? 'Percentual (%)' : null;
  }

  override type(text: string): boolean {
    if (!this.dirPt) return false;
    const v = parseNumber(text);
    if (v === null) {
      this.env.say('Valor inválido. Digite o percentual (ex.: 2,5).');
      return false;
    }
    return this.apply(v);
  }

  override confirm(): void {
    if (this.dirPt) {
      this.apply(this.percent());
      return;
    }
    super.confirm();
  }

  /** Grava a inclinação na laje selecionada, em um passo de desfazer. */
  private apply(percent: number): boolean {
    const s = this.target();
    if (!s || !this.origin || !this.dirPt) return false;
    const err = slopeError(percent);
    if (err) {
      this.env.say(err);
      return false;
    }
    const slope = slopeFrom(this.origin, this.dirPt, percent);
    if (!slope) {
      this.env.say('Direção inválida: clique em outro ponto.');
      return false;
    }
    this.env.exec({ type: 'updateElements', ids: [s.id], patch: { slope } });
    this.reset();
    this.env.say(`Inclinação de ${fmtPercent(percent)} definida. Ctrl+Z desfaz.`);
    return true;
  }
}
