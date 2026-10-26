import { boxOf, dist, dot, sub, type Vec2 } from '@hestia/geom';
import { ceilingOutline, frameOfWall } from '@hestia/engine';
import { isCeiling, isFloor, isOpening, isRoof, isSlab, isStair, isWall, type Id } from '@hestia/model';
import { ToolBase } from './base.ts';
import { ghostBands, ghostViews, moveWalls, selectedMovables, selectedOpenings, selectedViews, slideOpenings, transformViews } from './edit.ts';
import { idsInBox, pickAt } from './pick.ts';
import { floorIdsInBox, pickFloorAt, ringRemoveVertex } from './floorPick.ts';
import { pickRoomAt, roomIdsInBox } from './roomPick.ts';
import { pickRoomSeparatorAt } from './roomSeparatorPick.ts';
import { pickCeilingAt } from './ceilingPick.ts';
import { pickSlabAt, slabIdsInBox } from './slabPick.ts';
import { pickRoofAt, roofEdgeAt, roofEdgePreview, roofIdsInBox } from './roofPick.ts';
import { roofRingPatch } from './roofEdges.ts';
import { commitRoofPatch } from './roofCheck.ts';
import { commitCeilingBoundary, commitOutlineBoundary } from './outlineEdit.ts';
import { parseNumber } from './numeric.ts';
import { resizeWallCommands } from './lengthEdit.ts';
import { gripHoldAt, ringHandlePreview, type GripFocus, type GripHold } from './selectGrips.ts';
import { pickStairAt, stairEndpoints, stairIdsInBox } from './stairPick.ts';
import { annotationAt, detailItemAt, dimGripAt, dimTextGripAt, signedOffset } from './annotationPick.ts';
import { sectionMarkAt, sectionMarkIdsInBox } from './sectionMarkPick.ts';
import { DIM_MIN_LENGTH, dimensionGeometry, dimensionPoints, levelDimensions, sectionPoints } from '@hestia/model';
import { stairHandlePreview } from './stairGrips.ts';
import { spiralHandlePreview } from './stairSpiralGrips.ts';
import type { PointerInfo, RoofEdgeSel } from './types.ts';

type Mode = 'idle' | 'pending' | 'window' | 'grip' | 'dragwait' | 'moving' | 'opening' | 'roofedge' | 'dimgrip' | 'dimtext';

/** Elemento sob o cursor: parede, abertura ou piso. */
interface AnyHit {
  id: Id;
  kind: 'wall' | 'door' | 'window' | 'floor' | 'slab' | 'ceiling' | 'roof' | 'stair' | 'roomSeparator' | 'room' | 'annotation' | 'view';
}

const fmtLen = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

/** Shift ou Ctrl (Cmd no Mac): o clique e a janela somam à seleção (Ctrl alterna quem já está selecionado). */
const soma = (p: PointerInfo): boolean => p.shift || p.ctrl;

export class SelectTool extends ToolBase {
  readonly id = 'select';
  readonly label = 'Selecionar';
  readonly hint = 'Clique para selecionar. Arraste para janela (esq→dir contém, dir→esq cruza). Shift ou Ctrl soma à seleção.';
  private mode: Mode = 'idle';
  private downPt: Vec2 = { x: 0, y: 0 };
  /** Alça pressionada (parede, piso, laje ou telhado); as alças em si estão em selectGrips.ts. */
  private hold: GripHold | null = null;
  /** Aresta de telhado pressionada (ainda sem arrasto: vira seleção de aresta no soltar). */
  private roofEdgeDown: RoofEdgeSel | null = null;
  /** Vértice de piso, laje ou telhado em foco (clicado com a alça): o Delete o remove. */
  private focus: GripFocus | null = null;
  private delta: Vec2 = { x: 0, y: 0 };
  /** Base capturada do arrasto direto (a mesma regra da ferramenta Mover): o deslocamento parte dela, não do clique cru. */
  private moveBase: Vec2 | null = null;
  private hover: Id | null = null;
  private openingId: Id | null = null;
  /** Alça de deslocamento da cota selecionada (decisão 0019) e o deslocamento que ela assume ao soltar. */
  private dimGrip: Id | null = null;
  private dimOffset: number | null = null;
  private dimTextGrip: Id | null = null;
  private dimTextAt: Vec2 | null = null;

  /** Arrasto da alça da cota: o deslocamento é a distância do cursor à linha a–b, no lado do cursor. */
  private dragDimGrip(p: PointerInfo): void {
    const pr = this.env.project();
    const d = levelDimensions(pr, this.env.levelId()).find((x) => x.id === this.dimGrip);
    if (!d) return;
    const pts = dimensionPoints(pr, d);
    const off = signedOffset(pts.a, pts.b, p.raw);
    if (Math.abs(off) < DIM_MIN_LENGTH) return;
    this.dimOffset = off;
    const g = dimensionGeometry(pts.a, pts.b, off, this.env.metersPerPixel() * 4);
    this.items = [{ kind: 'line', a: g.line[0], b: g.line[1] }];
  }

  protected reset(): void {
    this.mode = 'idle';
    this.items = [];
    this.hold = null;
    this.roofEdgeDown = null;
    this.delta = { x: 0, y: 0 };
    this.openingId = null;
    this.dimTextGrip = null;
    this.dimTextAt = null;
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
    const detail = detailItemAt(pr, lv, at, mpp);
    if (detail) return { id: detail, kind: 'annotation' };
    const hit = pickAt(pr, lv, at, mpp);
    if (hit) return hit;
    // Linha de separação de ambiente (guardada no nível, fora de project.elements): tem prioridade sobre piso, laje, forro,
    // telhado e escada que estejam embaixo dela, como no Revit. Parede e abertura continuam ganhando o clique.
    const rs = pickRoomSeparatorAt(pr, lv, at, mpp);
    if (rs) return { id: rs.id, kind: 'roomSeparator' };
    const st = pickStairAt(pr, lv, at, mpp);
    if (st) return { id: st, kind: 'stair' };
    const f = pickFloorAt(pr, lv, at, mpp);
    if (f) return { id: f, kind: 'floor' };
    const sl = pickSlabAt(pr, lv, at, mpp);
    if (sl) return { id: sl, kind: 'slab' };
    const cl = pickCeilingAt(pr, lv, at, mpp);
    if (cl) return { id: cl, kind: 'ceiling' };
    const rf = pickRoofAt(pr, lv, at, mpp);
    if (rf) return { id: rf, kind: 'roof' };
    // Ambiente: por último entre os elementos de planta (o piso e a parede sob o cursor ganham o clique).
    const rm = pickRoomAt(pr, lv, at);
    if (rm) return { id: rm, kind: 'room' };
    // Cotas e textos de anotação (decisão 0019) e marcas de corte/elevação: por último, para não roubar o clique de um
    // elemento. A marca é uma anotação de primeira classe e também pode ser selecionada e transformada.
    const an = annotationAt(pr, lv, at, mpp);
    if (an) return { id: an.id, kind: 'annotation' };
    const vm = sectionMarkAt(pr, lv, at, mpp);
    return vm ? { id: vm, kind: 'view' } : null;
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
    if (this.mode === 'idle') this.items.push(...ringHandlePreview(pr, this.env.selection(), this.focus), ...stairHandlePreview(pr, this.env.selection()), ...spiralHandlePreview(pr, this.env.selection()));
    // Aresta de telhado escolhida na planta: destacada enquanto o telhado segue selecionado.
    this.items.push(...roofEdgePreview(pr, this.env.selection(), this.env.roofEdge?.() ?? null));
    // Alça da cota selecionada: sob o cursor, a cota destaca-se (arrastar muda o deslocamento).
    const dgHover = this.mode === 'idle' ? dimGripAt(pr, this.env.levelId(), this.env.selection(), p.raw, this.env.metersPerPixel()) : null;
    if (dgHover) this.items.push({ kind: 'highlight', ids: [dgHover] });
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
    const ring0 = f && (isFloor(f) || isSlab(f) || isRoof(f) || isCeiling(f)) ? (isCeiling(f) ? ceilingOutline(pr, f).boundary : f.boundary) : null;
    if (!this.focus || !f || ring0 === null || !this.env.selection().includes(f.id) || this.focus.index >= ring0.length) {
      this.focus = null;
      return false;
    }
    const ring = ringRemoveVertex(ring0, this.focus.index);
    if (!ring) {
      this.env.say(`${isSlab(f) ? 'Uma laje' : isRoof(f) ? 'Um telhado' : isCeiling(f) ? 'Um forro' : 'Um piso'} precisa de ao menos 3 vértices.`);
      return true;
    }
    if (isRoof(f)) commitRoofPatch(this.env, [f.id], roofRingPatch(f, ring, { kind: 'remove', vertex: this.focus.index }));
    else if (isCeiling(f)) commitCeilingBoundary(this.env, f.id, ring);
    else commitOutlineBoundary(this.env, f.id, ring);
    this.focus = { id: f.id, index: Math.min(this.focus.index, ring.length - 1) };
    this.env.say('Vértice removido. Ctrl+Z desfaz.');
    return true;
  }

  down(p: PointerInfo): void {
    const pr = this.env.project();
    const mpp = this.env.metersPerPixel();
    this.downPt = p.raw;
    this.moveBase = null;
    const sel = this.env.selection();
    const hold = gripHoldAt(this.env, p.raw);
    if (hold) {
      this.hold = hold;
      this.mode = 'grip';
      return;
    }
    const re = roofEdgeAt(pr, sel, p.raw, mpp);
    if (re) { this.roofEdgeDown = re; this.mode = 'roofedge'; return; }
    const dt = dimTextGripAt(pr, this.env.levelId(), sel, p.raw, mpp);
    if (dt) { this.dimTextGrip = dt; this.dimTextAt = null; this.mode = 'dimtext'; return; }
    const dg = dimGripAt(pr, this.env.levelId(), sel, p.raw, mpp);
    if (dg) { this.dimGrip = dg; this.dimOffset = null; this.mode = 'dimgrip'; return; }
    const hit = this.hitAt(p.raw);
    // Linha de separação selecionada não se arrasta (não é movível pelo arrasto): o clique só (des)seleciona no soltar.
    if (hit && sel.includes(hit.id) && hit.kind !== 'roomSeparator') {
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
    if (this.mode === 'dimgrip') this.dragDimGrip(p);
    if (this.mode === 'dimtext') {
      this.dimTextAt = p.raw;
      const d = levelDimensions(pr, this.env.levelId()).find((x) => x.id === this.dimTextGrip);
      if (d) { const pts = dimensionPoints(pr, d); const g = dimensionGeometry(pts.a, pts.b, d.offset, mpp * 4); this.items = [{ kind: 'line', a: { x: (g.line[0].x + g.line[1].x) / 2, y: (g.line[0].y + g.line[1].y) / 2 }, b: p.raw, dashed: true }]; }
    }
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
        const ignore = new Set(els);
        this.moveBase ??= this.snap({ ...p, raw: this.downPt, shift: false }, { ignore }).point;
        const inf = this.snap(p, { from: this.moveBase, ignore });
        this.delta = sub(inf.point, this.moveBase);
        const t = { kind: 'translate' as const, d: this.delta };
        this.items.push(...ghostBands(pr, els, t), ...ghostViews(pr, this.env.selection(), t));
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
      case 'dimgrip': {
        if (this.dimGrip && this.dimOffset !== null) this.env.exec({ type: 'updateDimension', levelId: this.env.levelId(), id: this.dimGrip, patch: { offset: this.dimOffset } });
        break;
      }
      case 'dimtext': {
        if (this.dimTextGrip && this.dimTextAt) this.env.exec({ type: 'updateDimension', levelId: this.env.levelId(), id: this.dimTextGrip, patch: { textAt: this.dimTextAt } });
        this.dimTextGrip = null;
        this.dimTextAt = null;
        break;
      }
      case 'roofedge': {
        const re = this.roofEdgeDown;
        if (re) { this.env.setSelection([re.roofId]); this.env.setRoofEdge?.(re); this.env.say(`Aresta ${re.index + 1} selecionada: Propriedades define a inclinação e o balanço; I alterna "define inclinação".`); }
        break;
      }
      case 'moving': {
        const sel = this.env.selection();
        const els = selectedMovables(pr, sel);
        const views = selectedViews(pr, sel);
        if ((els.length || views.length) && (this.delta.x || this.delta.y)) {
          if (els.length) moveWalls(this.env, els, this.delta, true, p.alt);
          if (views.length) transformViews(this.env, views, { kind: 'translate', d: this.delta });
        }
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
          ...stairIdsInBox(pr, this.env.levelId(), this.downPt, p.raw),
          ...roomIdsInBox(pr, this.env.levelId(), this.downPt, p.raw),
          ...sectionMarkIdsInBox(pr, this.env.levelId(), this.downPt, p.raw),
        ];
        const cur = this.env.selection();
        this.env.setSelection(soma(p) ? [...new Set([...cur, ...ids])] : ids);
        break;
      }
      default:
        break;
    }
    if (mode === 'pending' || mode === 'dragwait' || (mode === 'opening' && !(this.delta.x || this.delta.y))) {
      const hit = this.hitAt(p.raw);
      const cur = this.env.selection();
      if (!hit) {
        if (!soma(p)) this.env.setSelection([]);
      } else if (soma(p)) {
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
      else if (isStair(e)) pts.push(...stairEndpoints(e));
      else if (isFloor(e) || isSlab(e) || isRoof(e)) pts.push(...e.boundary);
      else {
        const v = pr.views.find((x) => x.id === id);
        if (v) {
          const p = sectionPoints(pr, v);
          pts.push(p.a, p.b);
        }
      }
    }
    return pts.length ? boxOf(pts) : null;
  }
}
