import { add, dist, len, mul, multiArea, norm, pointInRing, sub, v2, type Polygon, type Vec2 } from '@hestia/geom';
import { isFloor, makeFloor, type Floor, type Id, type Project } from '@hestia/model';
import { ToolBase, makeId } from './base.ts';
import { enclosedRooms, roomAt } from './enclosed.ts';
import { ringAreaAbs, ringPerimeter, selectedFloors } from './floorPick.ts';
import { parseNumber } from './numeric.ts';
import type { FloorMode, PointerInfo } from './types.ts';

const fmt = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

const MODE_HINT: Record<FloorMode, string> = {
  poly: 'Piso: clique nos vértices. Clique no primeiro ponto, duplo clique ou Enter fecham o contorno. Digite o comprimento e Enter para um segmento exato.',
  rect: 'Piso retangular: clique no primeiro canto e depois no canto oposto.',
  walls: 'Piso por paredes: clique numa área fechada pelas paredes (face interna).',
  hole: 'Furo: clique nos vértices do contorno do furo, dentro do piso selecionado. Enter fecha.',
};

/** Retângulo com dois cantos opostos, em ordem de contorno. */
const rectRing = (a: Vec2, c: Vec2): Vec2[] => [a, { x: c.x, y: a.y }, c, { x: a.x, y: c.y }];

/**
 * Piso (Revit: Floor). Modos: contorno por cliques, retângulo, área fechada pelas paredes (face interna)
 * e furo num piso selecionado. A ferramenta só emite comandos (`addFloor`, `updateElements`).
 */
export class FloorTool extends ToolBase {
  readonly id = 'floor';
  readonly label = 'Piso';
  readonly hint = MODE_HINT.poly;
  private pts: Vec2[] = [];
  private startPt: Vec2 | null = null;
  /** Espaços fechados pelas paredes, recalculados só quando o projeto ou o nível muda. */
  private rooms: { project: Project; levelId: Id; value: Polygon[] } | null = null;

  private mode(): FloorMode {
    return this.env.options().floorMode;
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
    return this.mode() === 'poly' || this.mode() === 'hole';
  }

  /** Piso alvo do modo furo: exatamente um piso selecionado. */
  private target(): Floor | null {
    const p = this.env.project();
    const ids = selectedFloors(p, this.env.selection());
    if (ids.length !== 1) return null;
    const f = p.elements[ids[0]!];
    return isFloor(f) ? f : null;
  }

  private roomList(): Polygon[] {
    const p = this.env.project();
    const levelId = this.env.levelId();
    if (this.rooms && this.rooms.project === p && this.rooms.levelId === levelId) return this.rooms.value;
    const value = enclosedRooms(p, levelId);
    this.rooms = { project: p, levelId, value };
    return value;
  }

  /** Vértices que a captura deve aceitar além das paredes: o contorno em construção e, no furo, o piso alvo. */
  private snapPoints(): Vec2[] {
    return [...this.pts, ...(this.mode() === 'hole' ? (this.target()?.boundary ?? []) : [])];
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    this.items = [];
    if (this.mode() === 'walls') this.moveWalls(p);
    else if (this.mode() === 'rect') this.moveRect(p);
    else this.movePoly(p);
  }

  private moveWalls(p: PointerInfo): void {
    const room = roomAt(this.roomList(), p.raw);
    if (!room) {
      this.env.say('Passe sobre um espaço fechado por paredes.');
      return;
    }
    this.items.push({ kind: 'polygon', ring: room[0]! });
    for (const h of room.slice(1)) this.items.push({ kind: 'polygon', ring: h, dashed: true });
    this.env.say('Clique para criar o piso nesta área.');
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
    const inf = this.snap(p, { from: last, extraPoints: this.snapPoints() });
    if (this.mode() === 'hole') {
      const t = this.target();
      if (t) this.items.push({ kind: 'highlight', ids: [t.id] });
    }
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
    if (this.mode() === 'walls') this.clickWalls(p);
    else if (this.mode() === 'rect') this.clickRect(p);
    else this.clickPoly(p);
  }

  private clickWalls(p: PointerInfo): void {
    const room = roomAt(this.roomList(), p.raw);
    if (!room) {
      this.env.say('Não há área fechada por paredes neste ponto');
      return;
    }
    this.commit(room[0]!, room.slice(1));
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
      this.env.say('Furo: selecione um único piso (Selecionar) e escolha Piso de novo.');
      return;
    }
    const last = this.pts[this.pts.length - 1];
    const inf = this.snap(p, { from: last, extraPoints: this.snapPoints() });
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

  /** Fecha o contorno (ou furo) em construção. */
  private finishContour(): void {
    const ring = this.pts;
    if (this.mode() === 'hole') this.commitHole(ring);
    else if (ringAreaAbs(ring) < 1e-4) this.env.say('Contorno de área zero: afaste os pontos.');
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

  /** Cria o piso no nível ativo com o tipo e o deslocamento das opções, e o deixa selecionado. */
  private commit(boundary: Vec2[], holes: Vec2[][] = []): void {
    const o = this.env.options();
    const p = this.env.project();
    const typeId = p.floorTypes[o.floorTypeId] ? o.floorTypeId : Object.keys(p.floorTypes)[0];
    if (!typeId) {
      this.env.say('O projeto não tem tipo de piso.');
      return;
    }
    const id = makeId('f');
    this.env.exec({ type: 'addFloor', floor: makeFloor({ id, typeId, levelId: this.env.levelId(), boundary, holes, heightOffset: o.floorOffset }) });
    this.env.setSelection([id]);
    const area = multiArea([[boundary, ...holes]]);
    this.env.say(`Piso criado: ${area.toFixed(2).replace('.', ',')} m² (perímetro ${fmt(ringPerimeter(boundary))}). Ctrl+Z desfaz.`);
  }

  /** Furo: acrescenta o contorno a `holes` do piso alvo, se ficar dentro dele. */
  private commitHole(ring: Vec2[]): void {
    const t = this.target();
    if (!t) return;
    if (!ring.every((q) => pointInRing(q, t.boundary))) {
      this.env.say('O furo precisa ficar dentro do piso.');
      return;
    }
    this.env.exec({ type: 'updateElements', ids: [t.id], patch: { holes: [...t.holes, ring] } });
    this.env.say('Furo criado. Ctrl+Z desfaz.');
  }
}
