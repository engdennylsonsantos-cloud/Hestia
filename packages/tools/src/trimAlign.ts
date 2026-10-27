import { dist, type Vec2 } from '@hestia/geom';
import { ToolBase } from './base.ts';
import type { PointerInfo, PreviewItem } from './types.ts';

/** Cota de uma medida: linha entre os dois pontos, marcas nas extremidades e o valor no meio. */
function cotaItems(a: Vec2, b: Vec2): PreviewItem[] {
  return [
    { kind: 'line', a, b, halo: true },
    { kind: 'point', at: a },
    { kind: 'point', at: b },
    { kind: 'label', at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, text: `${dist(a, b).toFixed(3).replace('.', ',')} m` },
  ];
}

export class MeasureTool extends ToolBase {
  readonly id = 'measure';
  readonly label = 'Medir';
  readonly hint = 'Medir: clique em dois pontos. A cota fica no desenho até Esc ou um novo clique.';
  private a: Vec2 | null = null;
  /** Última medida concluída: a cota fica no desenho até Esc ou um novo clique. Só é visual (não entra no modelo nem no desfazer). */
  private kept: { a: Vec2; b: Vec2 } | null = null;

  protected reset(): void {
    this.a = null;
    this.kept = null;
    this.items = [];
  }
  protected busy(): boolean {
    return this.a !== null || this.kept !== null;
  }

  override move(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.a ?? undefined });
    this.items = [];
    if (!this.a) {
      if (this.kept) this.items.push(...cotaItems(this.kept.a, this.kept.b));
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    this.items.push({ kind: 'line', a: this.a, b: inf.point, halo: true });
    this.items.push({ kind: 'label', at: inf.point, text: `${dist(this.a, inf.point).toFixed(3).replace('.', ',')} m` });
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.a ?? undefined });
    if (!this.a) {
      this.kept = null;
      this.items = [];
      this.a = inf.point;
      return;
    }
    const d = dist(this.a, inf.point);
    const ang = (Math.atan2(inf.point.y - this.a.y, inf.point.x - this.a.x) * 180) / Math.PI;
    this.env.say(`Distância ${d.toFixed(3).replace('.', ',')} m · ΔX ${(inf.point.x - this.a.x).toFixed(3).replace('.', ',')} · ΔY ${(inf.point.y - this.a.y).toFixed(3).replace('.', ',')} · ${((ang + 360) % 360).toFixed(1).replace('.', ',')}°`);
    this.kept = { a: this.a, b: inf.point };
    this.a = null;
    this.items = cotaItems(this.kept.a, this.kept.b);
  }
}
