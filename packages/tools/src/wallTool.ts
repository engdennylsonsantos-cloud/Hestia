import { dist, len, norm, sub, v2, angleOf, add, mul, type Vec2 } from '@hestia/geom';
import { totalThickness, type Wall } from '@hestia/model';
import { ToolBase, makeId } from './base.ts';
import { parseNumber } from './numeric.ts';
import type { PointerInfo } from './types.ts';
import { exteriorOffset } from '@hestia/engine';

const fmt = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

export class WallTool extends ToolBase {
  readonly id = 'wall';
  readonly label = 'Parede';
  readonly hint = 'Parede: clique no ponto inicial. Tab inverte o lado externo.';
  private startPt: Vec2 | null = null;
  private first: Vec2 | null = null;
  private count = 0;
  private flip = false;

  protected reset(): void {
    this.startPt = null;
    this.first = null;
    this.count = 0;
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.startPt !== null;
  }

  override inputPrompt(): string | null {
    return this.startPt ? 'Comprimento' : null;
  }

  override tab(): void {
    this.flip = !this.flip;
    this.env.say(this.flip ? 'Lado externo à direita do sentido de desenho.' : 'Lado externo à esquerda do sentido de desenho.');
  }

  private band(a: Vec2, b: Vec2) {
    const o = this.env.options();
    const p = this.env.project();
    const t = p.wallTypes[o.wallTypeId] ?? p.wallTypes[p.defaults.wallTypeId];
    if (!t) return { thickness: 0.15, sMid: 0 };
    const th = totalThickness(t);
    const ext = exteriorOffset(t, o.locationLine);
    const sign = this.flip ? -1 : 1;
    // s da face externa = sign*ext; da interna = sign*(ext-th). Meio da faixa:
    const sMid = sign * (ext - th / 2);
    void a;
    void b;
    return { thickness: th, sMid };
  }

  override move(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.startPt ?? undefined });
    this.items = [];
    if (!this.startPt) {
      this.items.push({ kind: 'point', at: inf.point });
      this.env.say(this.hint);
      return;
    }
    const a = this.startPt;
    const b = inf.point;
    const l = dist(a, b);
    if (l < 1e-6) return;
    const { thickness, sMid } = this.band(a, b);
    this.items.push({ kind: 'wallBand', a, b, thickness, sMid });
    const ang = (angleOf(sub(b, a)) * 180) / Math.PI;
    this.items.push({ kind: 'label', at: add(a, mul(sub(b, a), 0.5)), text: `${fmt(l)}  ${((ang + 360) % 360).toFixed(1).replace('.', ',')}°` });
    this.env.say('Clique para terminar a parede, ou digite o comprimento e Enter.');
  }

  private commit(a: Vec2, b: Vec2): void {
    if (dist(a, b) < 0.01) return;
    const o = this.env.options();
    const wall: Omit<Wall, 'order'> = {
      id: makeId('w'),
      kind: 'wall',
      typeId: o.wallTypeId,
      levelId: this.env.levelId(),
      a,
      b,
      baseOffset: 0,
      topLevelId: null,
      height: o.wallHeight,
      topOffset: 0,
      locationLine: o.locationLine,
      flipped: this.flip,
      noJoinStart: false,
      noJoinEnd: false,
      mark: '',
      comments: '',
    };
    this.env.exec({ type: 'addWall', wall });
    this.count += 1;
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.startPt ?? undefined });
    if (!this.startPt) {
      this.startPt = inf.point;
      this.first = inf.point;
      this.count = 0;
      return;
    }
    const b = inf.point;
    this.commit(this.startPt, b);
    const closed = this.first && this.count >= 2 && dist(b, this.first) < 0.02;
    if (this.env.options().chain && !closed) {
      this.startPt = b;
    } else {
      this.reset();
      this.env.say(closed ? 'Circuito fechado.' : this.hint);
    }
    this.items = [];
  }

  override type(text: string): boolean {
    if (!this.startPt) return false;
    const v = parseNumber(text);
    if (v === null || v <= 0) {
      this.env.say('Valor inválido. Digite o comprimento em metros.');
      return false;
    }
    const dir = norm(sub(this.inf?.point ?? this.raw, this.startPt));
    const d = len(dir) < 1e-9 ? v2(1, 0) : dir;
    const b = add(this.startPt, mul(d, v));
    this.commit(this.startPt, b);
    this.startPt = this.env.options().chain ? b : null;
    if (!this.startPt) this.reset();
    this.items = [];
    return true;
  }
}
