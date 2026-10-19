import { boxOf, dist, dot, sagFromThreePoints, sub, type Vec2 } from '@hestia/geom';
import { frameOfWall } from '@hestia/engine';
import { isOpening, isWall, type Id } from '@hestia/model';
import { ToolBase } from './base.ts';
import { moveWalls, selectedOpenings, selectedWalls, slideOpenings } from './edit.ts';
import { ghostBands } from './edit.ts';
import { followingEnds, gripAt, idsInBox, pickAt, type Grip } from './pick.ts';
import { resizeWallCommands } from './lengthEdit.ts';
import { parseNumber } from './numeric.ts';
import type { PointerInfo } from './types.ts';

type Mode = 'idle' | 'pending' | 'window' | 'grip' | 'dragwait' | 'moving' | 'opening';

const fmtLen = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

export class SelectTool extends ToolBase {
  readonly id = 'select';
  readonly label = 'Selecionar';
  readonly hint = 'Clique para selecionar. Arraste para janela (esq→dir contém, dir→esq cruza). Shift soma à seleção.';
  private mode: Mode = 'idle';
  private downPt: Vec2 = { x: 0, y: 0 };
  private grip: Grip | null = null;
  private delta: Vec2 = { x: 0, y: 0 };
  private gripPt: Vec2 | null = null;
  private hover: Id | null = null;
  private openingId: Id | null = null;

  protected reset(): void {
    this.mode = 'idle';
    this.items = [];
    this.grip = null;
    this.gripPt = null;
    this.delta = { x: 0, y: 0 };
    this.openingId = null;
  }

  protected busy(): boolean {
    return this.mode !== 'idle';
  }

  override cancel(): void {
    if (this.mode !== 'idle') this.reset();
    else if (this.env.selection().length) this.env.setSelection([]);
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    const hit = pickAt(this.env.project(), this.env.levelId(), p.raw, this.env.metersPerPixel());
    this.hover = hit?.id ?? null;
    this.items = this.hover ? [{ kind: 'highlight', ids: [this.hover] }] : [];
    const grip = gripAt(this.env.project(), this.env.selection(), p.raw, this.env.metersPerPixel());
    this.inf = grip ? { point: grip.at, kind: 'endpoint', guides: [] } : null;
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
    const hit = pickAt(pr, this.env.levelId(), p.raw, mpp);
    if (hit && sel.includes(hit.id)) {
      if (hit.kind === 'wall') this.mode = 'dragwait';
      else {
        this.mode = 'opening';
        this.openingId = hit.id;
      }
      return;
    }
    this.mode = 'pending';
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
      case 'moving': {
        const walls = selectedWalls(pr, this.env.selection());
        const inf = this.snap(p, { from: this.downPt, ignore: new Set(walls) });
        this.delta = sub(inf.point, this.downPt);
        this.items.push(...ghostBands(pr, walls, { kind: 'translate', d: this.delta }));
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
      case 'moving': {
        const walls = selectedWalls(pr, this.env.selection());
        if (walls.length && (this.delta.x || this.delta.y)) moveWalls(this.env, walls, this.delta, true, p.alt);
        break;
      }
      case 'opening': {
        if (this.openingId && (this.delta.x || this.delta.y)) slideOpenings(this.env, selectedOpenings(pr, [this.openingId]), this.delta);
        break;
      }
      case 'window': {
        const ids = idsInBox(pr, this.env.levelId(), this.downPt, p.raw);
        const cur = this.env.selection();
        this.env.setSelection(p.shift ? [...new Set([...cur, ...ids])] : ids);
        break;
      }
      default:
        break;
    }
    if (mode === 'pending' || mode === 'dragwait' || (mode === 'opening' && !(this.delta.x || this.delta.y))) {
      const hit = pickAt(pr, this.env.levelId(), p.raw, this.env.metersPerPixel());
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
    }
    return pts.length ? boxOf(pts) : null;
  }
}
