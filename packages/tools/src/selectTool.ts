import { boxOf, dist, dot, sagFromThreePoints, sub, type Vec2 } from '@hestia/geom';
import { frameOfWall } from '@hestia/engine';
import { isFloor, isOpening, isSlab, isWall, type Floor, type Id, type Slab } from '@hestia/model';
import { ToolBase } from './base.ts';
import { ghostBands, moveWalls, selectedMovables, selectedOpenings, slideOpenings } from './edit.ts';
import { followingEnds, gripAt, idsInBox, pickAt, type Grip } from './pick.ts';
import { floorGripAt, floorIdsInBox, pickFloorAt, ringInsertAfter, ringMoveVertex, ringRemoveVertex, type FloorGrip } from './floorPick.ts';
import { pickSlabAt, slabGripAt, slabIdsInBox, type SlabGrip } from './slabPick.ts';
import { resizeWallCommands } from './lengthEdit.ts';
import { parseNumber } from './numeric.ts';
import type { PointerInfo } from './types.ts';

type Mode = 'idle' | 'pending' | 'window' | 'grip' | 'floorgrip' | 'slabgrip' | 'dragwait' | 'moving' | 'opening';

/** Elemento sob o cursor: parede, abertura ou piso. */
interface AnyHit {
  id: Id;
  kind: 'wall' | 'door' | 'window' | 'floor' | 'slab';
}

const fmtLen = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

export class SelectTool extends ToolBase {
  readonly id = 'select';
  readonly label = 'Selecionar';
  readonly hint = 'Clique para selecionar. Arraste para janela (esq→dir contém, dir→esq cruza). Shift soma à seleção.';
  private mode: Mode = 'idle';
  private downPt: Vec2 = { x: 0, y: 0 };
  private grip: Grip | null = null;
  private floorGrip: FloorGrip | null = null;
  private slabGrip: SlabGrip | null = null;
  /** Vértice de piso ou laje em foco (clicado com a alça): o Delete o remove. */
  private focus: { id: Id; index: number } | null = null;
  private delta: Vec2 = { x: 0, y: 0 };
  private gripPt: Vec2 | null = null;
  private hover: Id | null = null;
  private openingId: Id | null = null;

  protected reset(): void {
    this.mode = 'idle';
    this.items = [];
    this.grip = null;
    this.floorGrip = null;
    this.slabGrip = null;
    this.gripPt = null;
    this.delta = { x: 0, y: 0 };
    this.openingId = null;
  }

  protected busy(): boolean {
    return this.mode !== 'idle';
  }

  override cancel(): void {
    this.focus = null;
    if (this.mode !== 'idle') this.reset();
    else if (this.env.selection().length) this.env.setSelection([]);
  }

  /** Parede, abertura ou piso sob o cursor (aberturas têm prioridade sobre a parede; a parede, sobre o piso). */
  private hitAt(at: Vec2): AnyHit | null {
    const pr = this.env.project();
    const lv = this.env.levelId();
    const mpp = this.env.metersPerPixel();
    const hit = pickAt(pr, lv, at, mpp);
    if (hit) return hit;
    const f = pickFloorAt(pr, lv, at, mpp);
    if (f) return { id: f, kind: 'floor' };
    const sl = pickSlabAt(pr, lv, at, mpp);
    return sl ? { id: sl, kind: 'slab' } : null;
  }

  /** O único elemento selecionado, se for um piso ou uma laje (ambos têm contorno editável por alças). */
  private singleRing(): Floor | Slab | null {
    const sel = this.env.selection();
    if (sel.length !== 1) return null;
    const f = this.env.project().elements[sel[0]!];
    return isFloor(f) || isSlab(f) ? f : null;
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    const pr = this.env.project();
    const mpp = this.env.metersPerPixel();
    const hit = this.hitAt(p.raw);
    this.hover = hit?.id ?? null;
    this.items = this.hover ? [{ kind: 'highlight', ids: [this.hover] }] : [];
    const grip = gripAt(pr, this.env.selection(), p.raw, mpp);
    const fgrip = grip ? null : floorGripAt(pr, this.env.selection(), p.raw, mpp);
    const sgrip = grip || fgrip ? null : slabGripAt(pr, this.env.selection(), p.raw, mpp);
    const at = grip?.at ?? fgrip?.at ?? sgrip?.at ?? null;
    this.inf = at ? { point: at, kind: 'endpoint', guides: [] } : null;
    const f = this.singleRing();
    if (f && this.mode === 'idle') {
      // Alças do piso ou da laje selecionada: vértices e meio das arestas (arrastar o meio insere um vértice).
      const n = f.boundary.length;
      for (let i = 0; i < n; i++) {
        const a = f.boundary[i]!;
        const b = f.boundary[(i + 1) % n]!;
        this.items.push({ kind: 'point', at: a }, { kind: 'point', at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
      }
      if (this.focus?.id === f.id && f.boundary[this.focus.index]) this.items.push({ kind: 'highlight', ids: [f.id] });
    }
    // Cota temporária: com uma parede selecionada, mostra o comprimento no meio dela.
    const w = this.singleWall();
    if (w && this.mode === 'idle') {
      const a = w.a;
      const b = w.b;
      this.items.push({ kind: 'label', at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, text: fmtLen(dist(a, b)) });
    }
  }

  /** A única seleção é uma parede (aberturas e pluralidades não entram na cota temporária). */
  private singleWall() {
    const sel = this.env.selection();
    if (sel.length !== 1) return null;
    const w = this.env.project().elements[sel[0]!];
    return isWall(w) ? w : null;
  }

  override inputPrompt(): string | null {
    if (this.mode !== 'idle') return null;
    return this.singleWall() ? 'Comprimento' : null;
  }

  /** Enter sem valor digitado: abre o campo de cota (a mensagem indica como digitar). */
  override confirm(): void {
    if (this.mode === 'idle' && this.singleWall()) {
      this.env.say('Comprimento: digite o valor em metros (aceita expressões) e Enter.');
      return;
    }
    super.confirm();
  }

  /** Digitar o comprimento: mantém a extremidade `a` e move `b` ao longo do eixo; vizinhas em `b` acompanham. */
  override type(text: string): boolean {
    const w = this.singleWall();
    if (!w) return false;
    const v = parseNumber(text);
    if (v === null) {
      this.env.say('Valor inválido. Digite um número em metros.');
      return false;
    }
    const r = resizeWallCommands(this.env.project(), this.env.levelId(), w.id, v);
    if ('error' in r) {
      this.env.say(r.error);
      return false;
    }
    this.env.transaction('Alterar comprimento', () => {
      for (const c of r.commands) this.env.exec(c);
    });
    this.env.say(`Comprimento alterado para ${fmtLen(v)}. Ctrl+Z desfaz.`);
    return true;
  }

  /** Delete com vértice de piso em foco: remove o vértice (mantendo ao menos 3). Senão, o Delete exclui a seleção. */
  deleteKey(): boolean {
    const pr = this.env.project();
    const f = this.focus ? pr.elements[this.focus.id] : undefined;
    if (!this.focus || !(isFloor(f) || isSlab(f)) || !this.env.selection().includes(f.id) || this.focus.index >= f.boundary.length) {
      this.focus = null;
      return false;
    }
    const ring = ringRemoveVertex(f.boundary, this.focus.index);
    if (!ring) {
      this.env.say(`${isSlab(f) ? 'Uma laje' : 'Um piso'} precisa de ao menos 3 vértices.`);
      return true;
    }
    this.env.exec({ type: 'updateElements', ids: [f.id], patch: { boundary: ring } });
    this.focus = { id: f.id, index: Math.min(this.focus.index, ring.length - 1) };
    this.env.say('Vértice removido. Ctrl+Z desfaz.');
    return true;
  }

  down(p: PointerInfo): void {
    const pr = this.env.project();
    const mpp = this.env.metersPerPixel();
    this.downPt = p.raw;
    const sel = this.env.selection();
    const grip = gripAt(pr, sel, p.raw, mpp);
    if (grip) {
      this.grip = grip;
      this.mode = 'grip';
      return;
    }
    const fg = floorGripAt(pr, sel, p.raw, mpp);
    if (fg) {
      this.floorGrip = fg;
      this.gripPt = fg.at;
      this.mode = 'floorgrip';
      return;
    }
    const sg = slabGripAt(pr, sel, p.raw, mpp);
    if (sg) {
      this.slabGrip = sg;
      this.gripPt = sg.at;
      this.mode = 'slabgrip';
      return;
    }
    const hit = this.hitAt(p.raw);
    if (hit && sel.includes(hit.id)) {
      if (hit.kind === 'door' || hit.kind === 'window') {
        this.mode = 'opening';
        this.openingId = hit.id;
      } else this.mode = 'dragwait';
      return;
    }
    this.mode = 'pending';
  }

  /** Contorno de um piso com a alça `g` levada até `pt` (vértice movido, ou vértice novo na aresta). */
  private floorRing(f: Floor, g: FloorGrip, pt: Vec2): Vec2[] {
    return g.kind === 'vertex' ? ringMoveVertex(f.boundary, g.index, pt) : ringInsertAfter(f.boundary, g.index, pt);
  }

  drag(p: PointerInfo): void {
    const mpp = this.env.metersPerPixel();
    const moved = dist(p.raw, this.downPt) > 4 * mpp;
    const pr = this.env.project();
    if (this.mode === 'pending' && moved) this.mode = 'window';
    if (this.mode === 'dragwait' && moved) this.mode = 'moving';
    this.items = [];
    switch (this.mode) {
      case 'window': {
        const a = this.downPt;
        const b = p.raw;
        this.items.push({ kind: 'polygon', dashed: b.x < a.x, ring: [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }] });
        break;
      }
      case 'grip': {
        if (!this.grip) break;
        const w = pr.elements[this.grip.wallId];
        if (!isWall(w)) break;
        const f = frameOfWall(pr, w.id);
        if (this.grip.end === 'mid') {
          // Alça do meio do arco: o arco passa a atravessar o cursor.
          this.gripPt = p.raw;
          if (f) this.items.push({ kind: 'wallBand', a: w.a, b: w.b, thickness: f.thickness, sMid: f.sMid, sag: sagFromThreePoints(w.a, p.raw, w.b) });
          break;
        }
        const other = this.grip.end === 'a' ? w.b : w.a;
        const inf = this.snap(p, { from: other, ignore: new Set([w.id]) });
        this.gripPt = inf.point;
        if (f) {
          const a = this.grip.end === 'a' ? inf.point : w.a;
          const b = this.grip.end === 'b' ? inf.point : w.b;
          this.items.push({ kind: 'wallBand', a, b, thickness: f.thickness, sMid: f.sMid, sag: w.sag });
        }
        // Vizinhas que vão acompanhar (canto simples; Alt inverte): aparecem na prévia para não haver surpresa.
        for (const c of followingEnds(pr, this.env.levelId(), this.grip.at, new Set([w.id]), p.alt)) {
          const nw = pr.elements[c.wallId];
          const nf = frameOfWall(pr, c.wallId);
          if (!isWall(nw) || !nf) continue;
          this.items.push({ kind: 'wallBand', a: c.end === 'a' ? inf.point : nw.a, b: c.end === 'b' ? inf.point : nw.b, thickness: nf.thickness, sMid: nf.sMid, sag: nw.sag });
        }
        break;
      }
      case 'floorgrip': {
        const g = this.floorGrip;
        const f = g ? pr.elements[g.floorId] : undefined;
        if (!g || !isFloor(f)) break;
        // Snap aos outros vértices do próprio piso (o vértice arrastado não se captura a si mesmo).
        const others = g.kind === 'vertex' ? f.boundary.filter((_, i) => i !== g.index) : f.boundary;
        const inf = this.snap(p, { extraPoints: others });
        this.gripPt = inf.point;
        this.items.push({ kind: 'polygon', ring: f.boundary, dashed: true });
        this.items.push({ kind: 'polygon', ring: this.floorRing(f, g, inf.point) });
        break;
      }
      case 'slabgrip': {
        const g = this.slabGrip;
        const sl = g ? pr.elements[g.slabId] : undefined;
        if (!g || !isSlab(sl)) break;
        const others = g.kind === 'vertex' ? sl.boundary.filter((_, i) => i !== g.index) : sl.boundary;
        const inf = this.snap(p, { extraPoints: others });
        this.gripPt = inf.point;
        this.items.push({ kind: 'polygon', ring: sl.boundary, dashed: true });
        this.items.push({ kind: 'polygon', ring: g.kind === 'vertex' ? ringMoveVertex(sl.boundary, g.index, inf.point) : ringInsertAfter(sl.boundary, g.index, inf.point) });
        break;
      }
      case 'moving': {
        const els = selectedMovables(pr, this.env.selection());
        const inf = this.snap(p, { from: this.downPt, ignore: new Set(els) });
        this.delta = sub(inf.point, this.downPt);
        this.items.push(...ghostBands(pr, els, { kind: 'translate', d: this.delta }));
        break;
      }
      case 'opening': {
        const id = this.openingId;
        const o = id ? pr.elements[id] : undefined;
        if (!isOpening(o)) break;
        const f = frameOfWall(pr, o.hostId);
        if (!f) break;
        this.delta = { x: f.u.x * dot(sub(p.raw, this.downPt), f.u), y: f.u.y * dot(sub(p.raw, this.downPt), f.u) };
        this.items.push({ kind: 'highlight', ids: [o.id] });
        break;
      }
      default:
        break;
    }
  }

  up(p: PointerInfo): void {
    const pr = this.env.project();
    const mode = this.mode;
    if (mode !== 'floorgrip' && mode !== 'slabgrip') this.focus = null;
    switch (mode) {
      case 'grip': {
        if (this.grip && this.gripPt) {
          const g = this.grip;
          const pt = this.gripPt;
          const wall = pr.elements[g.wallId];
          if (g.end === 'mid' && isWall(wall)) {
            this.env.exec({ type: 'updateElements', ids: [g.wallId], patch: { sag: sagFromThreePoints(wall.a, pt, wall.b) } });
            break;
          }
          if (g.end === 'mid') break;
          const exclude = new Set([g.wallId]);
          const follow = followingEnds(pr, this.env.levelId(), g.at, exclude, p.alt);
          this.env.transaction('Ajustar parede', () => {
            this.env.exec({ type: 'setWallEnds', id: g.wallId, [g.end]: pt });
            for (const c of follow) this.env.exec({ type: 'setWallEnds', id: c.wallId, [c.end]: pt });
          });
        }
        break;
      }
      case 'floorgrip': {
        const g = this.floorGrip;
        const f = g ? pr.elements[g.floorId] : undefined;
        if (!g || !isFloor(f) || !this.gripPt) break;
        if (dist(this.gripPt, g.at) > 1e-6) {
          this.env.exec({ type: 'updateElements', ids: [f.id], patch: { boundary: this.floorRing(f, g, this.gripPt) } });
        } else if (g.kind === 'vertex') {
          // Clique sem arrastar num vértice: fica em foco para o Delete.
          this.focus = { id: f.id, index: g.index };
          this.env.say('Vértice em foco: Delete o remove (mínimo de 3).');
        }
        break;
      }
      case 'slabgrip': {
        const g = this.slabGrip;
        const sl = g ? pr.elements[g.slabId] : undefined;
        if (!g || !isSlab(sl) || !this.gripPt) break;
        if (dist(this.gripPt, g.at) > 1e-6) {
          const ring = g.kind === 'vertex' ? ringMoveVertex(sl.boundary, g.index, this.gripPt) : ringInsertAfter(sl.boundary, g.index, this.gripPt);
          this.env.exec({ type: 'updateElements', ids: [sl.id], patch: { boundary: ring } });
        } else if (g.kind === 'vertex') {
          this.focus = { id: sl.id, index: g.index };
          this.env.say('Vértice em foco: Delete o remove (mínimo de 3).');
        }
        break;
      }
      case 'moving': {
        const els = selectedMovables(pr, this.env.selection());
        if (els.length && (this.delta.x || this.delta.y)) moveWalls(this.env, els, this.delta, true, p.alt);
        break;
      }
      case 'opening': {
        if (this.openingId && (this.delta.x || this.delta.y)) slideOpenings(this.env, selectedOpenings(pr, [this.openingId]), this.delta);
        break;
      }
      case 'window': {
        const ids = [...idsInBox(pr, this.env.levelId(), this.downPt, p.raw), ...floorIdsInBox(pr, this.env.levelId(), this.downPt, p.raw), ...slabIdsInBox(pr, this.env.levelId(), this.downPt, p.raw)];
        const cur = this.env.selection();
        this.env.setSelection(p.shift ? [...new Set([...cur, ...ids])] : ids);
        break;
      }
      default:
        break;
    }
    if (mode === 'pending' || mode === 'dragwait' || (mode === 'opening' && !(this.delta.x || this.delta.y))) {
      const hit = this.hitAt(p.raw);
      const cur = this.env.selection();
      if (!hit) {
        if (!p.shift) this.env.setSelection([]);
      } else if (p.shift) {
        this.env.setSelection(cur.includes(hit.id) ? cur.filter((x) => x !== hit.id) : [...cur, hit.id]);
      } else {
        this.env.setSelection([hit.id]);
      }
    }
    this.reset();
  }

  /** Caixa envolvente da seleção, para zoom e dimensões. */
  selectionBox(): ReturnType<typeof boxOf> | null {
    const pr = this.env.project();
    const pts: Vec2[] = [];
    for (const id of this.env.selection()) {
      const e = pr.elements[id];
      if (isWall(e)) pts.push(e.a, e.b);
      else if (isFloor(e) || isSlab(e)) pts.push(...e.boundary);
    }
    return pts.length ? boxOf(pts) : null;
  }
}
