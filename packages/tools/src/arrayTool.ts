import { len, mul, norm, sub, v2, type Vec2 } from '@hestia/geom';
import { copyWalls, ghostBands, ghostViews, transformViews } from './edit.ts';
import { fmtM, SelectionTool } from './transformTools.ts';
import { parseNumber } from './numeric.ts';
import type { PointerInfo } from './types.ts';

/** Matriz linear: N elementos, espaçamento definido por dois pontos ou digitado. */
export class ArrayTool extends SelectionTool {
  readonly id = 'array';
  readonly label = 'Matriz';
  readonly hint = 'Matriz linear: clique no ponto base e no segundo ponto (espaçamento) — ou digite o espaçamento.';
  private base: Vec2 | null = null;

  protected reset(): void {
    this.base = null;
    this.items = [];
  }
  protected busy(): boolean {
    return this.base !== null;
  }
  override inputPrompt(): string | null {
    return this.base ? 'Espaçamento' : null;
  }

  private ghosts(d: Vec2): void {
    const n = Math.max(2, this.env.options().arrayCount);
    for (let i = 1; i < n; i++) {
      const t = { kind: 'translate', d: mul(d, i) } as const;
      this.items.push(...ghostBands(this.env.project(), this.movables(), t), ...ghostViews(this.env.project(), this.env.selection(), t));
    }
  }

  override move(p: PointerInfo): void {
    this.items = [];
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(this.movables()) });
    if (!this.base) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    const d = sub(inf.point, this.base);
    this.items.push({ kind: 'line', a: this.base, b: inf.point, dashed: true });
    this.ghosts(d);
    this.items.push({ kind: 'label', at: inf.point, text: `${this.env.options().arrayCount} × ${fmtM(len(d))}` });
  }

  private commit(d: Vec2): void {
    if (len(d) < 1e-6) return;
    const n = Math.max(2, this.env.options().arrayCount);
    const els = this.movables();
    const views = this.views();
    this.env.transaction('Matriz', () => {
      for (let i = 1; i < n; i++) {
        const t = { kind: 'translate', d: mul(d, i) } as const;
        if (els.length) copyWalls(this.env, els, t);
        if (views.length) transformViews(this.env, views, t, true);
      }
    });
    this.reset();
    this.env.done();
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(this.movables()) });
    if (!this.base) {
      this.base = inf.point;
      return;
    }
    this.commit(sub(inf.point, this.base));
  }

  override type(text: string): boolean {
    if (!this.base) return false;
    const v = parseNumber(text);
    if (v === null) return false;
    const dir = norm(sub(this.inf?.point ?? this.raw, this.base));
    this.commit(mul(len(dir) < 1e-9 ? v2(1, 0) : dir, v));
    return true;
  }
}
