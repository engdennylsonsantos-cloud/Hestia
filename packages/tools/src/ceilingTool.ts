import { add, dist, len, mul, multiArea, norm, pointInRing, sub, v2, type Vec2 } from '@hestia/geom';
import { DEFAULT_CEILING_HEIGHT, isCeiling, makeCeiling, newId, type Ceiling, type Id } from '@hestia/model';
import { ToolBase } from './base.ts';
import { ringAreaAbs, ringPerimeter } from './floorPick.ts';
import { roomCeilingAt } from './ceilingRoom.ts';
import { parseNumber } from './numeric.ts';
import type { CeilingMode, PointerInfo } from './types.ts';

const fmt = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

const MODE_HINT: Record<CeilingMode, string> = {
  poly: 'Forro: clique nos vértices. Clique no primeiro ponto, duplo clique ou Enter fecham o contorno. Digite o comprimento e Enter para um segmento exato.',
  rect: 'Forro retangular: clique no primeiro canto e depois no canto oposto.',
  room: 'Forro no ambiente: clique dentro de um ambiente. O forro segue o contorno e o pé-direito dele.',
  hole: 'Furo: selecione um único forro e clique nos vértices do contorno do furo, dentro do forro. Enter fecha.',
};

/** Retângulo com dois cantos opostos, em ordem de contorno. */
const rectRing = (a: Vec2, c: Vec2): Vec2[] => [a, { x: c.x, y: a.y }, c, { x: a.x, y: c.y }];

/**
 * Forro (Revit: Ceiling). Modos: contorno por cliques, retângulo e "Forro no ambiente" (clique num ambiente, que cria o
 * forro com o contorno e o pé-direito do ambiente; decisão 0021). A ferramenta só emite comandos (`addCeiling`).
 */
export class CeilingTool extends ToolBase {
  readonly id = 'ceiling';
  readonly label = 'Forro';
  readonly hint = MODE_HINT.poly;
  private pts: Vec2[] = [];
  private startPt: Vec2 | null = null;

  private mode(): CeilingMode {
    return this.env.options().ceilingMode ?? 'poly';
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

  /** Modos de contorno por cliques: o contorno do forro (poly) e o do furo (hole). */
  private isContour(): boolean {
    return this.mode() === 'poly' || this.mode() === 'hole';
  }

  /** Forro alvo do modo furo: exatamente um forro selecionado. */
  private target(): Ceiling | null {
    const p = this.env.project();
    const ids = this.env.selection().filter((id) => isCeiling(p.elements[id]));
    if (ids.length !== 1) return null;
    return p.elements[ids[0]!] as Ceiling;
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    this.items = [];
    if (this.mode() === 'room') this.moveRoom(p);
    else if (this.mode() === 'rect') this.moveRect(p);
    else this.movePoly(p);
  }

  private moveRoom(p: PointerInfo): void {
    const d = roomCeilingAt(this.env.project(), this.env.levelId(), p.raw, this.typeId());
    if (!d) {
      this.env.say('Clique dentro de um ambiente com circuito fechado de paredes.');
      return;
    }
    this.items.push({ kind: 'polygon', ring: d.boundary });
    this.items.push({ kind: 'label', at: p.raw, text: `${d.mark || 'Ambiente'} · pé-direito ${fmt(d.heightOffset)}` });
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
    const t = this.mode() === 'hole' ? this.target() : null;
    const inf = this.snap(p, { from: last, extraPoints: t?.boundary ?? [] });
    if (t) this.items.push({ kind: 'highlight', ids: [t.id] });
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
    if (this.mode() === 'room') this.clickRoom(p);
    else if (this.mode() === 'rect') this.clickRect(p);
    else this.clickPoly(p);
  }

  private clickRoom(p: PointerInfo): void {
    const d = roomCeilingAt(this.env.project(), this.env.levelId(), p.raw, this.typeId());
    if (!d) {
      this.env.say('Clique dentro de um ambiente com circuito fechado de paredes.');
      return;
    }
    this.commit(d.boundary, { holes: d.holes, roomId: d.roomId, heightOffset: d.heightOffset, mark: d.mark });
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
    if (this.mode() === 'hole' && !this.target()) {
      this.env.say('Furo: selecione um único forro (Selecionar) e escolha Forro de novo.');
      return;
    }
    const last = this.pts[this.pts.length - 1];
    const inf = this.snap(p, { from: last, extraPoints: this.mode() === 'hole' ? this.target()?.boundary ?? [] : [] });
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
    if (this.mode() === 'hole') this.commitHole(ring);
    else if (ringAreaAbs(ring) < 1e-4) this.env.say('Contorno de área zero: afaste os pontos.');
    else this.commit(ring);
    this.reset();
  }

  /** Furo: acrescenta o contorno a `holes` do forro alvo, se ficar dentro dele (um só Ctrl+Z). */
  private commitHole(ring: Vec2[]): void {
    const t = this.target();
    if (!t) return;
    if (!ring.every((q) => pointInRing(q, t.boundary))) {
      this.env.say('O furo precisa ficar dentro do forro.');
      return;
    }
    this.env.exec({ type: 'updateElements', ids: [t.id], patch: { holes: [...t.holes, ring] } });
    this.env.say('Furo criado. Ctrl+Z desfaz.');
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
    if (this.mode() === 'hole' && !this.target()) return false;
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

  /** Tipo de forro das opções, ou o primeiro do projeto quando o escolhido não existe. */
  private typeId(): Id {
    const p = this.env.project();
    const o = this.env.options().ceilingTypeId;
    return o && p.ceilingTypes[o] ? o : (Object.keys(p.ceilingTypes)[0] ?? '');
  }

  /** Cria o forro no nível ativo, com o tipo das opções e a cota do topo (ou a do ambiente), e o deixa selecionado. */
  private commit(boundary: Vec2[], extra: { holes?: Vec2[][]; roomId?: Id | null; heightOffset?: number; mark?: string } = {}): void {
    const p = this.env.project();
    const typeId = this.typeId();
    if (!typeId) {
      this.env.say('O projeto não tem tipo de forro.');
      return;
    }
    const id = newId('f');
    const heightOffset = extra.heightOffset ?? this.env.options().ceilingOffset ?? DEFAULT_CEILING_HEIGHT;
    this.env.exec({
      type: 'addCeiling',
      ceiling: makeCeiling({ id, typeId, levelId: this.env.levelId(), boundary, holes: extra.holes ?? [], roomId: extra.roomId ?? null, heightOffset, mark: extra.mark ?? '' }),
    });
    this.env.setSelection([id]);
    const area = multiArea([[boundary, ...(extra.holes ?? [])]]);
    this.env.say(`Forro criado: ${area.toFixed(2).replace('.', ',')} m² (perímetro ${fmt(ringPerimeter(boundary))}, ${p.ceilingTypes[typeId]?.name ?? ''}). Ctrl+Z desfaz.`);
  }
}
