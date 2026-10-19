import { add, dist, len, mul, multiArea, norm, pointInRing, sub, v2, type Polygon, type Ring, type Vec2 } from '@hestia/geom';
import { isFloor, makeFloor, type Floor, type Id, type Project } from '@hestia/model';
import { ToolBase, makeId } from './base.ts';
import { enclosedRooms, outerPerimeter, roomAt } from './enclosed.ts';
import { ringAreaAbs, ringPerimeter, selectedFloors } from './floorPick.ts';
import { parseNumber } from './numeric.ts';
import type { FloorMode, PointerInfo } from './types.ts';

const fmt = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

const MODE_HINT: Record<FloorMode, string> = {
  poly: 'Piso: clique nos vértices. Clique no primeiro ponto, duplo clique ou Enter fecham o contorno. Digite o comprimento e Enter para um segmento exato.',
  rect: 'Piso retangular: clique no primeiro canto e depois no canto oposto.',
  walls: 'Piso por paredes: clique numa área fechada pelas paredes (face interna). Tab alterna para a face externa da edificação.',
  hole: 'Furo: clique nos vértices do contorno do furo, dentro do piso selecionado. Enter fecha.',
  perimetro: 'Perímetro: clique numa parede (ou perto da casa) para criar o piso pela face externa da edificação.',
};

/** Retângulo com dois cantos opostos, em ordem de contorno. */
const rectRing = (a: Vec2, c: Vec2): Vec2[] => [a, { x: c.x, y: a.y }, c, { x: a.x, y: c.y }];

/**
 * Piso (Revit: Floor). Modos: contorno por cliques, retângulo, área fechada pelas paredes (face interna, ou
 * externa com Tab), furo num piso selecionado e perímetro externo da edificação. A ferramenta só emite comandos
 * (`addFloor`, `updateElements`).
 */
export class FloorTool extends ToolBase {
  readonly id = 'floor';
  readonly label = 'Piso';
  readonly hint = MODE_HINT.poly;
  private pts: Vec2[] = [];
  private startPt: Vec2 | null = null;
  /** Modo paredes: false = espaço fechado (padrão); true = contorno externo da edificação (Tab). */
  private outside = false;
  /** Última posição do ponteiro, para refazer a pré-visualização ao alternar com Tab. */
  private last: PointerInfo | null = null;
  /** Espaços fechados pelas paredes, recalculados só quando o projeto, o nível ou a extensão mudam. */
  private rooms: { project: Project; levelId: Id; core: boolean; value: Polygon[] } | null = null;

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
    const core = this.env.options().floorCore === true;
    if (this.rooms && this.rooms.project === p && this.rooms.levelId === levelId && this.rooms.core === core) return this.rooms.value;
    const value = enclosedRooms(p, levelId, core ? 'core' : 'finish');
    this.rooms = { project: p, levelId, core, value };
    return value;
  }

  /** Região do modo paredes sob o cursor: o espaço fechado, ou (com Tab) a edificação que contém o ponto. [anel, furos...] */
  private regionAt(at: Vec2): Polygon | null {
    if (this.outside) {
      const ring = outerPerimeter(this.env.project(), this.env.levelId(), at);
      return ring ? [ring] : null;
    }
    return roomAt(this.roomList(), at);
  }

  /** Vértices que a captura deve aceitar além das paredes: o contorno em construção e, no furo, o piso alvo. */
  private snapPoints(): Vec2[] {
    return [...this.pts, ...(this.mode() === 'hole' ? (this.target()?.boundary ?? []) : [])];
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    this.last = p;
    this.items = [];
    if (this.mode() === 'walls') this.moveWalls(p);
    else if (this.mode() === 'rect') this.moveRect(p);
    else if (this.mode() === 'perimetro') this.movePerimeter(p);
    else this.movePoly(p);
  }

  private moveWalls(p: PointerInfo): void {
    const region = this.regionAt(p.raw);
    if (!region) {
      this.env.say(this.outside ? 'Aponte para a edificação (perto das paredes).' : 'Passe sobre um espaço fechado por paredes.');
      return;
    }
    this.items.push({ kind: 'polygon', ring: region[0]! });
    for (const h of region.slice(1)) this.items.push({ kind: 'polygon', ring: h, dashed: true });
    this.env.say(this.outside ? 'Clique para criar o piso pela face externa da edificação.' : 'Clique para criar o piso nesta área.');
  }

  private movePerimeter(p: PointerInfo): void {
    const ring = outerPerimeter(this.env.project(), this.env.levelId(), p.raw);
    if (!ring) {
      this.env.say('Aponte para uma parede (ou perto da casa) para criar o perímetro.');
      return;
    }
    this.items.push({ kind: 'polygon', ring });
    this.env.say('Clique para criar o piso pela face externa da edificação.');
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
    else if (this.mode() === 'perimetro') this.clickPerimeter(p);
    else this.clickPoly(p);
  }

  /** Tab no modo paredes alterna entre o espaço fechado e a face externa da edificação. */
  override tab(): void {
    if (this.mode() !== 'walls') return;
    this.outside = !this.outside;
    this.env.say(this.outside ? 'Piso pela face externa da edificação. Tab volta ao espaço interno.' : MODE_HINT.walls);
    if (this.last) this.move(this.last);
  }

  private clickWalls(p: PointerInfo): void {
    const region = this.regionAt(p.raw);
    if (!region) {
      this.env.say(this.outside ? 'Não há edificação neste ponto' : 'Não há área fechada por paredes neste ponto');
      return;
    }
    this.commit(region[0]!, region.slice(1));
  }

  private clickPerimeter(p: PointerInfo): void {
    const ring = outerPerimeter(this.env.project(), this.env.levelId(), p.raw);
    if (!ring) {
      this.env.say('Não há parede perto deste ponto.');
      return;
    }
    this.commit(ring);
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
  private commit(boundary: Ring, holes: Ring[] = []): void {
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
