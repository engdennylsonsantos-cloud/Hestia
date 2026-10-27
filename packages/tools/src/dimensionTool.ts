import { dist, type Vec2 } from '@hestia/geom';
import { DIM_MIN_LENGTH, dimensionGeometry, formatDimensionValue, newId, roundMm, type DimensionRef } from '@hestia/model';
import { ToolBase } from './base.ts';
import { endRefAt, signedOffset } from './annotationPick.ts';
import { parseNumber } from './numeric.ts';
import type { PointerInfo, PreviewItem } from './types.ts';

/**
 * Cota alinhada (Revit: Aligned Dimension). Clique no ponto A, no ponto B e depois no lado da linha de cota (ou digite
 * o deslocamento e Enter). Pontos sobre a extremidade de uma parede ficam referenciados a ela.
 */
export class DimensionTool extends ToolBase {
  readonly id = 'dimension';
  readonly label = 'Cota';
  readonly hint = 'Cota: clique no primeiro ponto medido, depois no segundo. Mova o cursor para o lado da linha de cota e clique (ou digite o deslocamento).';
  private a: Vec2 | null = null;
  private b: Vec2 | null = null;
  private refA: DimensionRef | undefined;
  private refB: DimensionRef | undefined;

  protected reset(): void {
    this.a = null;
    this.b = null;
    this.refA = undefined;
    this.refB = undefined;
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.a !== null;
  }

  override inputPrompt(): string | null {
    return this.a && this.b ? 'Deslocamento' : null;
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    const inf = this.snap(p);
    if (this.a && !this.b) this.items = [{ kind: 'point', at: this.a }, { kind: 'line', a: this.a, b: inf.point, dashed: true }];
    if (this.a && this.b) this.items = this.previewOf(this.side(p.raw));
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p);
    const point = inf.point;
    if (!this.a) {
      this.a = point;
      this.refA = endRefAt(this.env.project(), this.env.levelId(), point);
      this.env.say('Clique no segundo ponto da cota.');
      return;
    }
    if (!this.b) {
      if (dist(this.a, point) < DIM_MIN_LENGTH) {
        this.env.say('Os dois pontos da cota são o mesmo: escolha outro ponto.');
        return;
      }
      this.b = point;
      this.refB = endRefAt(this.env.project(), this.env.levelId(), point);
      this.env.say('Clique do lado da linha de cota, ou digite o deslocamento e Enter.');
      return;
    }
    this.commit(this.side(p.raw) * roundMm(this.distanceToLine(p.raw)));
  }

  override type(text: string): boolean {
    if (!this.a || !this.b) return false;
    const v = parseNumber(text);
    if (v === null || v === 0) {
      this.env.say('Digite o deslocamento em metros, diferente de zero. Sinal − coloca a linha do outro lado.');
      return false;
    }
    // O sinal digitado escolhe o lado (+ à esquerda de a→b, − à direita); sem sinal vale o lado do cursor.
    const lado = v < 0 ? -1 : this.side(this.raw);
    this.commit(lado * roundMm(Math.abs(v)));
    return true;
  }

  /** Lado da linha de cota pelo cursor: +1 à esquerda de a→b, −1 à direita. */
  private side(q: Vec2): number {
    return signedOffset(this.a!, this.b!, q) >= 0 ? 1 : -1;
  }

  private distanceToLine(q: Vec2): number {
    return Math.abs(signedOffset(this.a!, this.b!, q));
  }

  private previewOf(offset: number): PreviewItem[] {
    // Pré-visualização: 1 mm de papel ≈ 4 px de tela; a cota final sai na escala da vista.
    const mPerMm = this.env.metersPerPixel() * 4;
    const g = dimensionGeometry(this.a!, this.b!, offset, mPerMm);
    const out: PreviewItem[] = [
      { kind: 'line', a: g.line[0], b: g.line[1] },
      ...g.extensions.map(([p, q]): PreviewItem => ({ kind: 'line', a: p, b: q, dashed: true })),
    ];
    out.push({ kind: 'label', at: g.textAt, text: formatDimensionValue(g.length) });
    return out;
  }

  private commit(offset: number): void {
    const a = this.a!;
    const b = this.b!;
    if (!Number.isFinite(offset) || Math.abs(offset) < 1e-6) {
      this.env.say('O deslocamento da cota não pode ser zero.');
      return;
    }
    const refs = { ...(this.refA ? { a: this.refA } : {}), ...(this.refB ? { b: this.refB } : {}) };
    const dimension = { id: newId('dim'), a, b, offset, ...(Object.keys(refs).length ? { refs } : {}) };
    this.env.exec({ type: 'addDimension', levelId: this.env.levelId(), dimension });
    this.reset();
    this.env.say(this.hint);
  }
}
