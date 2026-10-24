import { add, angleOf, arcFromSagitta, cross, dist, len, mul, norm, sagFromThreePoints, sub, v2, type Vec2 } from '@hestia/geom';
import { exteriorOffset } from '@hestia/engine';
import { makeWall, totalThickness, type Wall } from '@hestia/model';
import { ToolBase, makeId } from './base.ts';
import type { InferContext } from './infer.ts';
import { parseNumber } from './numeric.ts';
import type { PointerInfo } from './types.ts';

const fmt = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

/**
 * Parede reta (dois pontos), em arco (início, fim e um ponto do arco) ou retângulo (dois cantos opostos:
 * quatro paredes encadeadas, anti-horário, com o lado externo para fora).
 */
export class WallTool extends ToolBase {
  readonly id = 'wall';
  readonly label = 'Parede';
  readonly hint = 'Parede: clique no ponto inicial. Tab alterna referências de alinhamento; Espaço inverte o lado.';
  private startPt: Vec2 | null = null;
  /** Arco: ponto final da corda, já definido; falta o ponto sobre o arco. */
  private chordEnd: Vec2 | null = null;
  private first: Vec2 | null = null;
  private count = 0;
  private flip = false;
  private alignmentCycle = 0;
  private lastPointer: PointerInfo | null = null;

  protected reset(): void {
    this.startPt = null;
    this.chordEnd = null;
    this.first = null;
    this.count = 0;
    this.items = [];
    this.inf = null;
    this.alignmentCycle = 0;
    this.lastPointer = null;
  }

  protected busy(): boolean {
    return this.startPt !== null;
  }

  private isArc(): boolean {
    return this.env.options().wallShape === 'arc';
  }

  private isRect(): boolean {
    return this.env.options().wallShape === 'rect';
  }

  /**
   * Lado externo à direita de a→b (`flipped`). Paredes de retângulo saem anti-horárias, então o externo
   * padrão é o da direita (para fora); Espaço inverte nos dois casos.
   */
  private sideFlip(): boolean {
    return this.isRect() ? !this.flip : this.flip;
  }

  override inputPrompt(): string | null {
    if (!this.startPt || this.isRect()) return null;
    return this.chordEnd ? 'Flecha do arco' : this.isArc() ? 'Comprimento da corda' : 'Comprimento';
  }

  override tab(): void {
    this.alignmentCycle += 1;
    if (this.lastPointer) this.move(this.lastPointer);
  }

  override space(): void {
    this.flip = !this.flip;
    if (this.lastPointer) this.move(this.lastPointer);
    this.env.say(this.sideFlip() ? 'Lado externo à direita do sentido de desenho.' : 'Lado externo à esquerda do sentido de desenho.');
  }

  private snapWall(p: PointerInfo, extra: Partial<InferContext> = {}) {
    return this.snap(p, { ...extra, alignmentCycle: this.alignmentCycle });
  }

  private band() {
    const o = this.env.options();
    const p = this.env.project();
    const t = p.wallTypes[o.wallTypeId] ?? p.wallTypes[p.defaults.wallTypeId];
    if (!t) return { thickness: 0.15, sMid: 0 };
    const th = totalThickness(t);
    const ext = exteriorOffset(t, o.locationLine);
    const sign = this.sideFlip() ? -1 : 1;
    return { thickness: th, sMid: sign * (ext - th / 2) };
  }

  /** Quatro cantos do retângulo com o primeiro canto em `startPt` e o oposto em `c`, no sentido anti-horário. */
  private rectCorners(c: Vec2): Vec2[] {
    const a = this.startPt!;
    const pts = [a, { x: c.x, y: a.y }, c, { x: a.x, y: c.y }];
    let area = 0;
    for (let i = 0; i < 4; i++) area += cross(pts[i]!, pts[(i + 1) % 4]!);
    // Área com sinal positiva = anti-horário. Diagonal "de sinal misto" sai horária: inverte a ordem.
    return area >= 0 ? pts : [pts[0]!, pts[3]!, pts[2]!, pts[1]!];
  }

  private moveRect(p: PointerInfo): void {
    const inf = this.snapWall(p);
    this.items = [];
    const a = this.startPt;
    if (!a) {
      this.items.push({ kind: 'point', at: inf.point });
      this.env.say(this.hint);
      return;
    }
    const c = inf.point;
    const pts = this.rectCorners(c);
    const { thickness, sMid } = this.band();
    for (let i = 0; i < 4; i++) this.items.push({ kind: 'wallBand', a: pts[i]!, b: pts[(i + 1) % 4]!, thickness, sMid });
    this.items.push({ kind: 'label', at: c, text: `${fmt(Math.abs(c.x - a.x))} × ${fmt(Math.abs(c.y - a.y))}` });
    this.env.say('Clique no canto oposto do retângulo.');
  }

  private clickRect(p: PointerInfo): void {
    const inf = this.snapWall(p);
    if (!this.startPt) {
      this.startPt = inf.point;
      this.first = inf.point;
      this.count = 0;
      return;
    }
    const a = this.startPt;
    const c = inf.point;
    if (Math.abs(c.x - a.x) < 0.01 || Math.abs(c.y - a.y) < 0.01) {
      this.env.say('Retângulo muito estreito: afaste o canto oposto.');
      return;
    }
    const pts = this.rectCorners(c);
    this.env.transaction('Parede retangular', () => {
      for (let i = 0; i < 4; i++) this.commit(pts[i]!, pts[(i + 1) % 4]!);
    });
    this.reset();
    this.env.say('Retângulo criado. Clique em outro canto para desenhar outro, ou Esc para sair.');
  }

  override move(p: PointerInfo): void {
    this.lastPointer = p;
    if (this.isRect()) {
      this.moveRect(p);
      return;
    }
    const inf = this.snapWall(p, { from: this.chordEnd ?? this.startPt ?? undefined });
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
      flipped: this.sideFlip(),
      sag,
    });
    this.env.transaction('Criar parede', () => {
      this.env.exec({ type: 'addWall', wall });
    });
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
    if (this.isRect()) {
      this.clickRect(p);
      return;
    }
    const inf = this.snapWall(p, { from: this.chordEnd ?? this.startPt ?? undefined });
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
    if (this.isRect() || !this.startPt) return false;
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
