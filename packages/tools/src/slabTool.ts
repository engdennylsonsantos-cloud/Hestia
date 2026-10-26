import { add, dist, len, mul, multiArea, norm, sub, v2, type Ring, type Vec2 } from '@hestia/geom';
import { makeSlab, newId, type OutlineSource } from '@hestia/model';
import { ToolBase } from './base.ts';
import { ringAreaAbs, ringPerimeter } from './floorPick.ts';
import { outerPerimeter } from './enclosed.ts';
import { parseNumber } from './numeric.ts';
import { pickAt } from './pick.ts';
import type { PointerInfo, SlabMode } from './types.ts';

const fmt = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

const MODE_HINT: Record<SlabMode, string> = {
  poly: 'Laje: clique nos vértices. Clique no primeiro ponto, duplo clique ou Enter fecham o contorno. Digite o comprimento e Enter para um segmento exato.',
  rect: 'Laje retangular: clique no primeiro canto e depois no canto oposto.',
  perimetro: 'Laje pelo perímetro externo: clique perto de uma parede. O contorno segue a face externa da edificação, sem furos.',
};

/** Retângulo com dois cantos opostos, em ordem de contorno. */
const rectRing = (a: Vec2, c: Vec2): Vec2[] => [a, { x: c.x, y: a.y }, c, { x: a.x, y: c.y }];

/**
 * Laje (Revit: Floor estrutural / ArchiCAD: Slab). Modos: contorno por cliques, retângulo e perímetro externo das
 * paredes do nível. A ferramenta só emite comandos (`addSlab`).
 */
export class SlabTool extends ToolBase {
  readonly id = 'slab';
  readonly label = 'Laje';
  readonly hint = MODE_HINT.poly;
  private pts: Vec2[] = [];
  private startPt: Vec2 | null = null;

  private mode(): SlabMode {
    return this.env.options().slabMode;
  }

  override start(): void {
    this.reset();
    this.env.say(MODE_HINT[this.mode()]);
  }

  protected reset(): void {
    this.pts = [];
    this.startPt = null;
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.pts.length > 0 || this.startPt !== null;
  }

  override inputPrompt(): string | null {
    return this.isContour() && this.pts.length > 0 ? 'Comprimento' : null;
  }

  private isContour(): boolean {
    return this.mode() === 'poly';
  }

  /** Contorno externo sob o cursor, ou null quando o cursor não está perto de uma parede do nível. */
  private perimeterAt(at: Vec2): Ring | null {
    const p = this.env.project();
    const levelId = this.env.levelId();
    if (!pickAt(p, levelId, at, this.env.metersPerPixel())) return null;
    return outerPerimeter(p, levelId, at);
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    this.items = [];
    if (this.mode() === 'perimetro') this.movePerimeter(p);
    else if (this.mode() === 'rect') this.moveRect(p);
    else this.movePoly(p);
  }

  private movePerimeter(p: PointerInfo): void {
    const ring = this.perimeterAt(p.raw);
    if (!ring) {
      this.env.say('Clique perto de uma parede do nível.');
      return;
    }
    this.items.push({ kind: 'polygon', ring });
    this.env.say(`Clique para criar a laje pelo perímetro externo (${fmt(ringPerimeter(ring))} de perímetro).`);
  }

  private moveRect(p: PointerInfo): void {
    const inf = this.snap(p);
    if (!this.startPt) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    const c = inf.point;
    this.items.push({ kind: 'polygon', ring: rectRing(this.startPt, c) });
    this.items.push({ kind: 'label', at: c, text: `${fmt(Math.abs(c.x - this.startPt.x))} × ${fmt(Math.abs(c.y - this.startPt.y))}` });
  }

  private movePoly(p: PointerInfo): void {
    const last = this.pts[this.pts.length - 1];
    const inf = this.snap(p, { from: last, extraPoints: this.pts });
    if (!last) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    this.items.push({ kind: 'line', a: last, b: inf.point, dashed: true });
    if (this.pts.length >= 2) this.items.push({ kind: 'polygon', ring: [...this.pts, inf.point], dashed: true });
    this.items.push({ kind: 'label', at: inf.point, text: fmt(dist(last, inf.point)) });
  }

  override click(p: PointerInfo): void {
    this.raw = p.raw;
    if (this.mode() === 'perimetro') this.clickPerimeter(p);
    else if (this.mode() === 'rect') this.clickRect(p);
    else this.clickPoly(p);
  }

  private clickPerimeter(p: PointerInfo): void {
    const ring = this.perimeterAt(p.raw);
    if (!ring) {
      this.env.say('Clique perto de uma parede do nível.');
      return;
    }
    this.commit(ring, { mode: 'perimeter', seed: p.raw, linked: true });
  }

  private clickRect(p: PointerInfo): void {
    const inf = this.snap(p);
    if (!this.startPt) {
      this.startPt = inf.point;
      return;
    }
    const a = this.startPt;
    const c = inf.point;
    if (Math.abs(c.x - a.x) < 0.01 || Math.abs(c.y - a.y) < 0.01) {
      this.env.say('Retângulo muito estreito: afaste o canto oposto.');
      return;
    }
    this.commit(rectRing(a, c));
    this.reset();
  }

  private clickPoly(p: PointerInfo): void {
    const last = this.pts[this.pts.length - 1];
    const inf = this.snap(p, { from: last, extraPoints: this.pts });
    const q = inf.point;
    const tol = 10 * this.env.metersPerPixel();
    if (this.pts.length >= 3 && dist(q, this.pts[0]!) <= tol) {
      this.finishContour();
      return;
    }
    // Duplo clique: o segundo clique cai no mesmo ponto do primeiro e fecha o contorno.
    if (last && dist(q, last) < 1e-6) {
      if (this.pts.length >= 3) this.finishContour();
      return;
    }
    this.pts.push(q);
  }

  /** Fecha o contorno em construção. */
  private finishContour(): void {
    const ring = this.pts;
    if (ringAreaAbs(ring) < 1e-4) this.env.say('Contorno de área zero: afaste os pontos.');
    else this.commit(ring);
    this.reset();
  }

  override confirm(): void {
    if (this.isContour() && this.pts.length >= 3) {
      this.finishContour();
      return;
    }
    super.confirm();
  }

  override type(text: string): boolean {
    if (!this.isContour() || this.pts.length === 0) return false;
    const v = parseNumber(text);
    if (v === null) {
      this.env.say('Valor inválido. Digite um número em metros.');
      return false;
    }
    if (v <= 0) {
      this.env.say('Valor inválido. Digite o comprimento em metros.');
      return false;
    }
    const last = this.pts[this.pts.length - 1]!;
    const dir = norm(sub(this.inf?.point ?? this.raw, last));
    const d = len(dir) < 1e-9 ? v2(1, 0) : dir;
    this.pts.push(add(last, mul(d, v)));
    return true;
  }

  /** Cria a laje no nível ativo com o tipo e o deslocamento das opções, e a deixa selecionada. */
  private commit(boundary: Vec2[], outline?: OutlineSource): void {
    const o = this.env.options();
    const p = this.env.project();
    const typeId = p.slabTypes[o.slabTypeId] ? o.slabTypeId : Object.keys(p.slabTypes)[0];
    if (!typeId) {
      this.env.say('O projeto não tem tipo de laje.');
      return;
    }
    const id = newId('l');
    this.env.exec({ type: 'addSlab', slab: makeSlab({ id, typeId, levelId: this.env.levelId(), boundary, holes: [], heightOffset: o.slabOffset, mark: o.placementMark ?? '', comments: o.placementComments ?? '', ...(outline ? { outlineSource: outline } : {}) }) });
    this.env.setSelection([id]);
    const area = multiArea([[boundary]]);
    this.env.say(`Laje criada: ${area.toFixed(2).replace('.', ',')} m² (perímetro ${fmt(ringPerimeter(boundary))}). Ctrl+Z desfaz.`);
  }
}
