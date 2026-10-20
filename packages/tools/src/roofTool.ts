import { boxOf, dist, mul, norm, add, sub, len, v2, type Ring, type Vec2 } from '@hestia/geom';
import { makeRoof, newId, type RoofShape } from '@hestia/model';
import { resolveRoofs, ROOF_SHAPE_LABEL } from '@hestia/engine';
import { ToolBase } from './base.ts';
import { ringAreaAbs } from './floorPick.ts';
import { outerPerimeter } from './enclosed.ts';
import { parseNumber } from './numeric.ts';
import { pickAt } from './pick.ts';
import { defaultRoofDir, eaveOutline, rectRing, roofAutoOffset, roofDirFor, roofSlopeError } from './roofGeom.ts';
import { fmtPercent, slopePreview } from './slabSlope.ts';
import type { PointerInfo, PreviewItem, RoofMode } from './types.ts';

const fmt = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

const MODE_HINT: Record<RoofMode, string> = {
  poly: 'Telhado: clique nos vértices do beiral. Clique no primeiro ponto, duplo clique ou Enter fecham o contorno. Digite o comprimento e Enter para um segmento exato.',
  rect: 'Telhado retangular: clique no primeiro canto e depois no canto oposto.',
  paredes: 'Telhado pelas paredes: clique perto de uma parede do nível. O beiral sai do perímetro externo pelo balanço da barra de opções.',
};

/** Balanço do beiral quando a barra de opções não traz um valor (m). */
const DEFAULT_OVERHANG = 0.5;

/**
 * Telhado (Revit: Roof by footprint; ArchiCAD: Roof). Modos: contorno do beiral por cliques, retângulo ou pelo perímetro
 * externo das paredes do nível com balanço. Tab troca o eixo da cumeeira (ou da subida, na uma água). A ferramenta só
 * emite `addRoof`; a forma e as águas são resolvidas pelo motor.
 */
export class RoofTool extends ToolBase {
  readonly id = 'roof';
  readonly label = 'Telhado';
  readonly hint = MODE_HINT.poly;
  private pts: Vec2[] = [];
  private startPt: Vec2 | null = null;
  /** Tab: `true` usa o eixo ortogonal ao padrão (lado maior) para cumeeira ou subida. */
  private axisAlt = false;

  private mode(): RoofMode {
    return this.env.options().roofMode ?? 'poly';
  }

  /** Tipo do telhado: o da barra de opções se existir no projeto, senão o primeiro. */
  private typeId(): string | null {
    const p = this.env.project();
    const want = this.env.options().roofTypeId;
    return want && p.roofTypes[want] ? want : (Object.keys(p.roofTypes)[0] ?? null);
  }

  private overhang(): number {
    return this.env.options().roofOverhang ?? DEFAULT_OVERHANG;
  }

  override start(): void {
    this.reset();
    this.axisAlt = false;
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
    return this.mode() === 'poly' && this.pts.length > 0 ? 'Comprimento' : null;
  }

  /** Contorno externo sob o cursor, ou null quando o cursor não está perto de uma parede do nível. */
  private perimeterAt(at: Vec2): Ring | null {
    const p = this.env.project();
    const levelId = this.env.levelId();
    if (!pickAt(p, levelId, at, this.env.metersPerPixel())) return null;
    return outerPerimeter(p, levelId, at);
  }

  /**
   * Linha da cumeeira (duas águas) ou seta do caimento (uma água) sobre o contorno em prévia. Quatro águas não tem
   * eixo: nada é desenhado. Usa a mesma direção que o commit.
   */
  private ridgePreview(ring: Vec2[]): PreviewItem[] {
    const shape = this.env.options().roofShape ?? 'gable';
    if (shape === 'hip' || ring.length < 3) return [];
    const dir = roofDirFor(shape, defaultRoofDir(ring), this.axisAlt);
    const b = boxOf(ring);
    const c = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    const half = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2;
    if (shape === 'shed') return slopePreview({ origin: c, dir, percent: this.env.options().roofSlope ?? 30 }, half);
    return [{ kind: 'line', a: add(c, mul(dir, -half)), b: add(c, mul(dir, half)), dashed: true }];
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    this.items = [];
    const m = this.mode();
    if (m === 'paredes') this.movePerimeter(p);
    else if (m === 'rect') this.moveRect(p);
    else this.movePoly(p);
  }

  private movePerimeter(p: PointerInfo): void {
    const outer = this.perimeterAt(p.raw);
    if (!outer) {
      this.env.say('Clique perto de uma parede do nível.');
      return;
    }
    const eave = eaveOutline(outer, this.overhang());
    this.items.push({ kind: 'polygon', ring: outer, dashed: true }, { kind: 'polygon', ring: eave }, ...this.ridgePreview(eave));
    this.env.say(`Clique para criar o telhado. Beiral com balanço de ${fmt(this.overhang())}.`);
  }

  private moveRect(p: PointerInfo): void {
    const inf = this.snap(p);
    if (!this.startPt) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    const c = inf.point;
    const ring = rectRing(this.startPt, c);
    this.items.push({ kind: 'polygon', ring }, ...this.ridgePreview(ring));
    this.items.push({ kind: 'label', at: c, text: `${fmt(Math.abs(c.x - this.startPt.x))} × ${fmt(Math.abs(c.y - this.startPt.y))}` });
  }

  private movePoly(p: PointerInfo): void {
    const last = this.pts[this.pts.length - 1];
    const inf = this.snap(p, { from: last });
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
    const m = this.mode();
    if (m === 'paredes') this.clickPerimeter(p);
    else if (m === 'rect') this.clickRect(p);
    else this.clickPoly(p);
  }

  private clickPerimeter(p: PointerInfo): void {
    const outer = this.perimeterAt(p.raw);
    if (!outer) {
      this.env.say('Clique perto de uma parede do nível.');
      return;
    }
    this.commit(eaveOutline(outer, this.overhang()));
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
    const inf = this.snap(p, { from: last });
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

  /** Fecha o contorno do beiral em construção. */
  private finishContour(): void {
    const ring = this.pts;
    if (ringAreaAbs(ring) < 1e-4) this.env.say('Contorno de área zero: afaste os pontos.');
    else this.commit(ring);
    this.reset();
  }

  override confirm(): void {
    if (this.mode() === 'poly' && this.pts.length >= 3) {
      this.finishContour();
      return;
    }
    super.confirm();
  }

  override type(text: string): boolean {
    if (this.mode() !== 'poly' || this.pts.length === 0) return false;
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

  /** Tab: troca o eixo da cumeeira (ou da subida) entre os dois eixos ortogonais, e mostra a prévia de novo. */
  override tab(): void {
    this.axisAlt = !this.axisAlt;
    const shape = this.env.options().roofShape ?? 'gable';
    const eixo = this.axisAlt ? 'transversal' : 'longitudinal';
    this.env.say(shape === 'hip' ? 'Quatro águas não usa eixo de cumeeira.' : `Eixo ${eixo} da ${shape === 'shed' ? 'subida' : 'cumeeira'} (Tab alterna).`);
  }

  /** Cria o telhado no nível ativo com o tipo e as opções da barra, e o deixa selecionado. */
  private commit(boundary: Vec2[]): void {
    const o = this.env.options();
    const p = this.env.project();
    const levelId = this.env.levelId();
    const typeId = this.typeId();
    if (!typeId) {
      this.env.say('O projeto não tem tipo de telhado.');
      return;
    }
    const shape: RoofShape = o.roofShape ?? 'gable';
    const slope = o.roofSlope ?? 30;
    const err = roofSlopeError(slope);
    if (err) {
      this.env.say(err);
      return;
    }
    const id = newId('t');
    const dir = roofDirFor(shape, defaultRoofDir(boundary), this.axisAlt);
    const heightOffset = o.roofOffset ?? roofAutoOffset(p, levelId);
    this.env.exec({ type: 'addRoof', roof: makeRoof({ id, typeId, levelId, boundary, heightOffset, shape, slopePercent: slope, dir }) });
    this.env.setSelection([id]);
    this.env.say(this.created(id, shape, slope));
  }

  /** Mensagem de criação: com o motor, águas e cumeeira reais; sem ele, a forma e a inclinação. */
  private created(id: string, shape: RoofShape, slope: number): string {
    const r = resolveRoofs(this.env.project(), this.env.levelId()).find((x) => x.roofId === id);
    if (!r || r.planes.length === 0) return `Telhado criado: ${ROOF_SHAPE_LABEL[shape]}, inclinação ${fmtPercent(slope)}. Ctrl+Z desfaz.`;
    const n = r.planes.length;
    const ridge = r.lines.filter((l) => l.kind === 'ridge').reduce((s, l) => s + dist(l.a, l.b), 0);
    return `Telhado criado: ${n} ${n === 1 ? 'água' : 'águas'}, cumeeira ${fmt(ridge)}. Ctrl+Z desfaz.`;
  }
}
