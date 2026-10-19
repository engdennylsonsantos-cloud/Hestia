import { cross, dist, dot, intersectLines, sub, type Vec2 } from '@hestia/geom';
import { frameOfWall, type WallFrame } from '@hestia/engine';
import type { Id } from '@hestia/model';
import { ToolBase } from './base.ts';
import { moveWalls } from './edit.ts';
import { pickAt } from './pick.ts';
import type { PointerInfo } from './types.ts';

/** Aparar/estender até o canto (Revit: Trim/Extend to Corner). Clique na parte que deve ficar. */
export class TrimTool extends ToolBase {
  readonly id = 'trim';
  readonly label = 'Aparar/Estender';
  readonly hint = 'Aparar/Estender ao canto: clique na parte que deseja manter da primeira e da segunda parede.';
  private first: { id: Id; at: Vec2 } | null = null;

  protected reset(): void {
    this.first = null;
    this.items = [];
  }
  protected busy(): boolean {
    return this.first !== null;
  }

  override move(p: PointerInfo): void {
    const hit = pickAt(this.env.project(), this.env.levelId(), p.raw, this.env.metersPerPixel());
    this.items = hit?.kind === 'wall' ? [{ kind: 'highlight', ids: [hit.id] }] : [];
    if (this.first) this.items.push({ kind: 'highlight', ids: [this.first.id] });
  }

  override click(p: PointerInfo): void {
    const pr = this.env.project();
    const hit = pickAt(pr, this.env.levelId(), p.raw, this.env.metersPerPixel());
    if (!hit || hit.kind !== 'wall') {
      this.env.say('Clique sobre uma parede.');
      return;
    }
    if (!this.first) {
      this.first = { id: hit.id, at: p.raw };
      this.env.say('Agora clique na parte que deseja manter da segunda parede.');
      return;
    }
    if (this.first.id === hit.id) {
      this.env.say('Escolha outra parede.');
      return;
    }
    const fa = frameOfWall(pr, this.first.id);
    const fb = frameOfWall(pr, hit.id);
    if (!fa || !fb) return;
    if (fa.arc || fb.arc) {
      this.env.say('Aparar/estender ao canto ainda não suporta paredes em arco.');
      this.reset();
      return;
    }
    const r = intersectLines(fa.a, fa.u, fb.a, fb.u);
    if (!r) {
      this.env.say('As paredes são paralelas: não há canto.');
      this.reset();
      return;
    }
    const patch = (f: WallFrame, click: Vec2): { a?: Vec2; b?: Vec2 } => {
      const tI = dot(sub(r.point, f.a), f.u);
      const tC = dot(sub(click, f.a), f.u);
      return tI <= tC ? { a: r.point } : { b: r.point };
    };
    this.env.transaction('Aparar ao canto', () => {
      this.env.exec({ type: 'setWallEnds', id: fa.wall.id, ...patch(fa, this.first!.at) });
      this.env.exec({ type: 'setWallEnds', id: fb.wall.id, ...patch(fb, p.raw) });
    });
    this.reset();
    this.env.say(this.hint);
  }
}

interface RefFace {
  id: Id;
  /** Normal unitária da parede de referência. */
  n: Vec2;
  /** Um ponto qualquer da linha de face de referência. */
  at: Vec2;
}

/** Alinhar: leva a face da parede escolhida até a face de referência (paredes paralelas). */
export class AlignTool extends ToolBase {
  readonly id = 'align';
  readonly label = 'Alinhar';
  readonly hint = 'Alinhar: clique na face de referência e depois na face da parede a mover.';
  private ref: RefFace | null = null;

  protected reset(): void {
    this.ref = null;
    this.items = [];
  }
  protected busy(): boolean {
    return this.ref !== null;
  }

  private nearestFace(f: WallFrame, at: Vec2): { s: number; point: Vec2 } {
    const rel = sub(at, f.a);
    const s = dot(rel, f.n);
    const sFace = Math.abs(s - f.sHi) <= Math.abs(s - f.sLo) ? f.sHi : f.sLo;
    return { s: sFace, point: { x: f.a.x + f.n.x * sFace, y: f.a.y + f.n.y * sFace } };
  }

  override move(p: PointerInfo): void {
    const hit = pickAt(this.env.project(), this.env.levelId(), p.raw, this.env.metersPerPixel());
    this.items = hit?.kind === 'wall' ? [{ kind: 'highlight', ids: [hit.id] }] : [];
  }

  override click(p: PointerInfo): void {
    const pr = this.env.project();
    const hit = pickAt(pr, this.env.levelId(), p.raw, this.env.metersPerPixel());
    if (!hit || hit.kind !== 'wall') {
      this.env.say('Clique sobre uma parede.');
      return;
    }
    const f = frameOfWall(pr, hit.id);
    if (!f) return;
    if (f.arc) {
      this.env.say('Alinhar ainda não suporta paredes em arco.');
      return;
    }
    if (!this.ref) {
      const face = this.nearestFace(f, p.raw);
      this.ref = { id: hit.id, n: f.n, at: face.point };
      this.env.say('Referência definida. Clique na parede a alinhar (Esc para trocar a referência).');
      return;
    }
    if (hit.id === this.ref.id) return;
    if (Math.abs(cross(f.u, { x: -this.ref.n.y, y: this.ref.n.x })) > 1e-3) {
      this.env.say('As paredes precisam ser paralelas para alinhar.');
      return;
    }
    const face = this.nearestFace(f, p.raw);
    const k = dot(sub(this.ref.at, face.point), this.ref.n);
    if (Math.abs(k) < 1e-6) {
      this.env.say('Já estão alinhadas.');
      return;
    }
    moveWalls(this.env, [hit.id], { x: this.ref.n.x * k, y: this.ref.n.y * k });
  }
}

export class MeasureTool extends ToolBase {
  readonly id = 'measure';
  readonly label = 'Medir';
  readonly hint = 'Medir: clique em dois pontos.';
  private a: Vec2 | null = null;

  protected reset(): void {
    this.a = null;
    this.items = [];
  }
  protected busy(): boolean {
    return this.a !== null;
  }

  override move(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.a ?? undefined });
    this.items = [];
    if (!this.a) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    this.items.push({ kind: 'line', a: this.a, b: inf.point });
    this.items.push({ kind: 'label', at: inf.point, text: `${dist(this.a, inf.point).toFixed(3).replace('.', ',')} m` });
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.a ?? undefined });
    if (!this.a) {
      this.a = inf.point;
      return;
    }
    const d = dist(this.a, inf.point);
    const ang = (Math.atan2(inf.point.y - this.a.y, inf.point.x - this.a.x) * 180) / Math.PI;
    this.env.say(`Distância ${d.toFixed(3).replace('.', ',')} m · ΔX ${(inf.point.x - this.a.x).toFixed(3).replace('.', ',')} · ΔY ${(inf.point.y - this.a.y).toFixed(3).replace('.', ',')} · ${((ang + 360) % 360).toFixed(1).replace('.', ',')}°`);
    this.a = null;
    this.items = [];
  }
}
