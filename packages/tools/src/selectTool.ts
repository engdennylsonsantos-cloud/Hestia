import { boxOf, dist, dot, sub, type Vec2 } from '@hestia/geom';
import { frameOfWall } from '@hestia/engine';
import { isFloor, isOpening, isRoof, isSlab, isWall, type Id } from '@hestia/model';
import { ToolBase } from './base.ts';
import { ghostBands, moveWalls, selectedMovables, selectedOpenings, slideOpenings } from './edit.ts';
import { idsInBox, pickAt } from './pick.ts';
import { floorIdsInBox, pickFloorAt, ringRemoveVertex } from './floorPick.ts';
import { pickSlabAt, slabIdsInBox } from './slabPick.ts';
import { pickRoofAt, roofEdgeAt, roofEdgePreview, roofIdsInBox } from './roofPick.ts';
import { roofRingPatch } from './roofEdges.ts';
import { commitRoofPatch } from './roofCheck.ts';
import { parseNumber } from './numeric.ts';
import { resizeWallCommands } from './lengthEdit.ts';
import { gripHoldAt, ringHandlePreview, type GripFocus, type GripHold } from './selectGrips.ts';
import type { PointerInfo, RoofEdgeSel } from './types.ts';

type Mode = 'idle' | 'pending' | 'window' | 'grip' | 'dragwait' | 'moving' | 'opening' | 'roofedge';

/** Elemento sob o cursor: parede, abertura ou piso. */
interface AnyHit {
  id: Id;
  kind: 'wall' | 'door' | 'window' | 'floor' | 'slab' | 'roof';
}

const fmtLen = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

export class SelectTool extends ToolBase {
  readonly id = 'select';
  readonly label = 'Selecionar';
  readonly hint = 'Clique para selecionar. Arraste para janela (esq→dir contém, dir→esq cruza). Shift soma à seleção.';
  private mode: Mode = 'idle';
  private downPt: Vec2 = { x: 0, y: 0 };
  /** Alça pressionada (parede, piso, laje ou telhado); as alças em si estão em selectGrips.ts. */
  private hold: GripHold | null = null;
  /** Aresta de telhado pressionada (ainda sem arrasto: vira seleção de aresta no soltar). */
  private roofEdgeDown: RoofEdgeSel | null = null;
  /** Vértice de piso, laje ou telhado em foco (clicado com a alça): o Delete o remove. */
  private focus: GripFocus | null = null;
  private delta: Vec2 = { x: 0, y: 0 };
  private hover: Id | null = null;
  private openingId: Id | null = null;

  protected reset(): void {
    this.mode = 'idle';
    this.items = [];
    this.hold = null;
    this.roofEdgeDown = null;
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
    if (sl) return { id: sl, kind: 'slab' };
    const rf = pickRoofAt(pr, lv, at, mpp);
    return rf ? { id: rf, kind: 'roof' } : null;
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    const pr = this.env.project();
    const hit = this.hitAt(p.raw);
    this.hover = hit?.id ?? null;
    this.items = this.hover ? [{ kind: 'highlight', ids: [this.hover] }] : [];
    const grip = gripHoldAt(this.env, p.raw);
    this.inf = grip ? { point: grip.at, kind: 'endpoint', guides: [] } : null;
    // Alças do piso, laje ou telhado selecionado: vértices, meio das arestas, foco e seta do caimento.
    if (this.mode === 'idle') this.items.push(...ringHandlePreview(pr, this.env.selection(), this.focus));
    // Aresta de telhado escolhida na planta: destacada enquanto o telhado segue selecionado.
    this.items.push(...roofEdgePreview(pr, this.env.selection(), this.env.roofEdge?.() ?? null));
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
    if (!this.focus || !(isFloor(f) || isSlab(f) || isRoof(f)) || !this.env.selection().includes(f.id) || this.focus.index >= f.boundary.length) {
      this.focus = null;
      return false;
    }
    const ring = ringRemoveVertex(f.boundary, this.focus.index);
    if (!ring) {
      this.env.say(`${isSlab(f) ? 'Uma laje' : isRoof(f) ? 'Um telhado' : 'Um piso'} precisa de ao menos 3 vértices.`);
      return true;
    }
    if (isRoof(f)) commitRoofPatch(this.env, [f.id], roofRingPatch(f, ring, { kind: 'remove', vertex: this.focus.index })); else this.env.exec({ type: 'updateElements', ids: [f.id], patch: { boundary: ring } });
    this.focus = { id: f.id, index: Math.min(this.focus.index, ring.length - 1) };
    this.env.say('Vértice removido. Ctrl+Z desfaz.');
    return true;
  }

  down(p: PointerInfo): void {
    const pr = this.env.project();
    const mpp = this.env.metersPerPixel();
    this.downPt = p.raw;
    const sel = this.env.selection();
    const hold = gripHoldAt(this.env, p.raw);
    if (hold) {
      this.hold = hold;
      this.mode = 'grip';
      return;
    }
    const re = roofEdgeAt(pr, sel, p.raw, mpp);
    if (re) { this.roofEdgeDown = re; this.mode = 'roofedge'; return; }
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

  drag(p: PointerInfo): void {
    const mpp = this.env.metersPerPixel();
    const moved = dist(p.raw, this.downPt) > 4 * mpp;
    const pr = this.env.project();
    if (this.mode === 'pending' && moved) this.mode = 'window';
    if (this.mode === 'roofedge' && moved) this.mode = 'dragwait';
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
        if (this.hold) this.items.push(...this.hold.drag(p, (extra) => this.snap(p, extra).point));
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
    const hold = this.hold;
    if (mode !== 'grip' || !hold?.keepsFocus) this.focus = null;
    if (mode !== 'roofedge') this.env.setRoofEdge?.(null);
    switch (mode) {
      case 'grip': {
        hold?.release(p, (f) => {
          this.focus = f;
        });
        break;
      }
      case 'roofedge': {
        const re = this.roofEdgeDown;
        if (re) { this.env.setSelection([re.roofId]); this.env.setRoofEdge?.(re); this.env.say(`Aresta ${re.index + 1} selecionada: Propriedades define a inclinação e o balanço; I alterna "define inclinação".`); }
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
        const ids = [
          ...idsInBox(pr, this.env.levelId(), this.downPt, p.raw),
          ...floorIdsInBox(pr, this.env.levelId(), this.downPt, p.raw),
          ...slabIdsInBox(pr, this.env.levelId(), this.downPt, p.raw),
          ...roofIdsInBox(pr, this.env.levelId(), this.downPt, p.raw),
        ];
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
      else if (isFloor(e) || isSlab(e) || isRoof(e)) pts.push(...e.boundary);
    }
    return pts.length ? boxOf(pts) : null;
  }
}
