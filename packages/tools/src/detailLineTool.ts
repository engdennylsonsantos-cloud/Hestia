import { dist, type Vec2 } from '@hestia/geom';
import { newId } from '@hestia/model';
import { ToolBase, viewPlanId } from './base.ts';
import type { PointerInfo } from './types.ts';

/** Linha de detalhe: traço 2D independente da geometria do modelo, restrito ao nível ativo. */
export class DetailLineTool extends ToolBase {
  readonly id = 'detailLine';
  readonly label = 'Linha de detalhe';
  readonly hint = 'Linha de detalhe: clique no início e no fim.';
  private a: Vec2 | null = null;
  protected reset(): void { this.a = null; this.items = []; this.inf = null; }
  protected busy(): boolean { return this.a !== null; }
  override move(p: PointerInfo): void {
    const q = this.snap(p).point;
    this.items = this.a ? [{ kind: 'line', a: this.a, b: q, dashed: true }] : [];
  }
  override click(p: PointerInfo): void {
    const q = this.snap(p).point;
    if (!this.a) { this.a = q; this.env.say('Clique no fim da linha de detalhe.'); return; }
    if (dist(this.a, q) < 0.01) { this.env.say('Escolha um ponto final mais distante.'); return; }
    this.env.exec({ type: 'addDetailLine', levelId: this.env.levelId(), planId: viewPlanId(this.env), item: { id: newId('dl'), a: this.a, b: q, style: this.env.options().detailLineStyle ?? 'solid' } });
    this.reset();
    this.env.say(this.hint);
  }
}
