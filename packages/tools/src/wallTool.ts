import { add, angleOf, arcFromSagitta, dist, len, mul, norm, sagFromThreePoints, sub, v2, type Vec2 } from '@hestia/geom';
import { exteriorOffset } from '@hestia/engine';
import { makeWall, totalThickness, type Wall } from '@hestia/model';
import { ToolBase, makeId } from './base.ts';
import { parseNumber } from './numeric.ts';
import type { PointerInfo } from './types.ts';

const fmt = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

/** Parede reta (dois pontos) ou em arco (início, fim e um ponto do arco). */
export class WallTool extends ToolBase {
  readonly id = 'wall';
  readonly label = 'Parede';
  readonly hint = 'Parede: clique no ponto inicial. Tab inverte o lado externo.';
  private startPt: Vec2 | null = null;
  /** Arco: ponto final da corda, já definido; falta o ponto sobre o arco. */
  private chordEnd: Vec2 | null = null;
  private first: Vec2 | null = null;
  private count = 0;
  private flip = false;

  protected reset(): void {
    this.startPt = null;
    this.chordEnd = null;
    this.first = null;
    this.count = 0;
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.startPt !== null;
  }

  private isArc(): boolean {
    return this.env.options().wallShape === 'arc';
  }

  override inputPrompt(): string | null {
    if (!this.startPt) return null;
    return this.chordEnd ? 'Flecha do arco' : this.isArc() ? 'Comprimento da corda' : 'Comprimento';
  }

  override tab(): void {
    this.flip = !this.flip;
    this.env.say(this.flip ? 'Lado externo à direita do sentido de desenho.' : 'Lado externo à esquerda do sentido de desenho.');
  }

  private band() {
    const o = this.env.options();
    const p = this.env.project();
    const t = p.wallTypes[o.wallTypeId] ?? p.wallTypes[p.defaults.wallTypeId];
    if (!t) return { thickness: 0.15, sMid: 0 };
    const th = totalThickness(t);
    const ext = exteriorOffset(t, o.locationLine);
    const sign = this.flip ? -1 : 1;
    return { thickness: th, sMid: sign * (ext - th / 2) };
  }

  override move(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.chordEnd ?? this.startPt ?? undefined });
    this.items = [];
    if (!this.startPt) {
      this.items.push({ kind: 'point', at: inf.point });
      this.env.say(this.hint);
      return;
    }
    const a = this.startPt;
    const { thickness, sMid } = this.band();
    if (this.chordEnd) {
      // Terceiro ponto: o arco passa pelo cursor.
      const sag = sagFromThreePoints(a, inf.point, this.chordEnd);
      this.items.push({ kind: 'wallBand', a, b: this.chordEnd, thickness, sMid, sag });
      const arc = arcFromSagitta(a, this.chordEnd, sag);
      this.items.push({ kind: 'label', at: inf.point, text: arc ? `R ${fmt(arc.radius)}  arco ${fmt(arc.length)}` : 'reta' });
      this.env.say('Clique no ponto do arco, ou digite a flecha e Enter.');
      return;
    }
    const b = inf.point;
    const l = dist(a, b);
    if (l < 1e-6) return;
    this.items.push({ kind: 'wallBand', a, b, thickness, sMid });
    const ang = (angleOf(sub(b, a)) * 180) / Math.PI;
    this.items.push({ kind: 'label', at: add(a, mul(sub(b, a), 0.5)), text: `${fmt(l)}  ${((ang + 360) % 360).toFixed(1).replace('.', ',')}°` });
    this.env.say(this.isArc() ? 'Clique no ponto final da corda.' : 'Clique para terminar a parede, ou digite o comprimento e Enter.');
  }

  private commit(a: Vec2, b: Vec2, sag = 0): void {
    if (dist(a, b) < 0.01) return;
    const o = this.env.options();
    const wall: Omit<Wall, 'order'> = makeWall({
      id: makeId('w'),
      typeId: o.wallTypeId,
      levelId: this.env.levelId(),
      a,
      b,
      height: o.wallHeight,
      locationLine: o.locationLine,
      flipped: this.flip,
      sag,
    });
    this.env.exec({ type: 'addWall', wall });
    this.count += 1;
  }

  private finishSegment(end: Vec2): void {
    const closed = this.first && this.count >= 2 && dist(end, this.first) < 0.02;
    if (this.env.options().chain && !closed) {
      this.startPt = end;
      this.chordEnd = null;
    } else {
      this.reset();
      this.env.say(closed ? 'Circuito fechado.' : this.hint);
    }
    this.items = [];
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.chordEnd ?? this.startPt ?? undefined });
    if (!this.startPt) {
      this.startPt = inf.point;
      this.first = inf.point;
      this.count = 0;
      return;
    }
    if (this.chordEnd) {
      const end = this.chordEnd;
      this.commit(this.startPt, end, sagFromThreePoints(this.startPt, inf.point, end));
      this.finishSegment(end);
      return;
    }
    const b = inf.point;
    if (this.isArc()) {
      if (dist(this.startPt, b) < 0.02) return;
      this.chordEnd = b;
      return;
    }
    this.commit(this.startPt, b);
    this.finishSegment(b);
  }

  override type(text: string): boolean {
    if (!this.startPt) return false;
    const v = parseNumber(text);
    if (v === null) {
      this.env.say('Valor inválido. Digite um número em metros.');
      return false;
    }
    if (this.chordEnd) {
      // Flecha digitada: o lado vem da posição do cursor em relação à corda.
      const a = this.startPt;
      const b = this.chordEnd;
      const ref = this.inf?.point ?? this.raw;
      const side = Math.sign((b.x - a.x) * (ref.y - a.y) - (b.y - a.y) * (ref.x - a.x)) || 1;
      this.commit(a, b, side * Math.abs(v));
      this.finishSegment(b);
      return true;
    }
    if (v <= 0) {
      this.env.say('Valor inválido. Digite o comprimento em metros.');
      return false;
    }
    const dir = norm(sub(this.inf?.point ?? this.raw, this.startPt));
    const d = len(dir) < 1e-9 ? v2(1, 0) : dir;
    const b = add(this.startPt, mul(d, v));
    if (this.isArc()) {
      this.chordEnd = b;
      return true;
    }
    this.commit(this.startPt, b);
    this.finishSegment(b);
    return true;
  }
}
