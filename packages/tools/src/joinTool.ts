import { dist, type Vec2 } from '@hestia/geom';
import { joinStatus, levelFrames } from '@hestia/engine';
import type { JoinKind } from '@hestia/model';
import { ToolBase } from './base.ts';
import type { PointerInfo } from './types.ts';

const ORDER: JoinKind[] = ['butt', 'miter'];
const LABEL: Record<JoinKind, string> = { butt: 'Encosto', miter: 'Esquadria' };

interface Node {
  at: Vec2;
  ends: Array<{ wallId: string; end: 'a' | 'b' }>;
  kind: JoinKind;
  flip: boolean;
}

/** Ferramenta Junção (Revit: Wall Joins): clique num canto para alternar encosto e esquadria. */
export class JoinTool extends ToolBase {
  readonly id = 'joins';
  readonly label = 'Junção';
  readonly hint = 'Junção: clique no canto ou ponta onde duas paredes se encontram para alternar Encosto e Esquadria. Só atua nas pontas, não no meio do vão. Tab inverte qual parede domina.';
  private node: Node | null = null;

  protected reset(): void {
    this.node = null;
    this.items = [];
  }
  protected busy(): boolean {
    return false;
  }

  private find(p: Vec2): Node | null {
    const pr = this.env.project();
    const tol = 12 * this.env.metersPerPixel();
    const frames = levelFrames(pr, this.env.levelId());
    let best: { n: Node; d: number } | null = null;
    for (const f of frames) {
      for (const end of ['a', 'b'] as const) {
        const at = end === 'a' ? f.a : f.b;
        const d = dist(at, p);
        if (d > tol || (best && d >= best.d)) continue;
        const st = joinStatus(frames, f.wall.id, end, pr.settings.joinTolerance);
        if (st.kind !== 'pair') continue;
        const ends = [{ wallId: f.wall.id, end }, ...st.partners];
        const other = pr.elements[st.partners[0]!.wallId];
        const mine = f.wall;
        const first = other && other.kind === 'wall' && other.order < mine.order ? other : mine;
        const firstEnd = first === mine ? end : st.partners[0]!.end;
        const cfg = firstEnd === 'a' ? first.joinStart : first.joinEnd;
        best = { n: { at, ends, kind: cfg.kind, flip: cfg.flip }, d };
      }
    }
    return best ? best.n : null;
  }

  override move(p: PointerInfo): void {
    this.node = this.find(p.raw);
    this.items = [];
    if (this.node) {
      this.items.push({ kind: 'point', at: this.node.at });
      this.items.push({ kind: 'label', at: this.node.at, text: `${LABEL[this.node.kind]}${this.node.flip ? ' (ordem invertida)' : ''}` });
      this.items.push({ kind: 'highlight', ids: this.node.ends.map((e) => e.wallId) });
    }
  }

  private apply(kind: JoinKind, flip: boolean): void {
    if (!this.node) return;
    this.env.exec({ type: 'setJoin', ends: this.node.ends, config: { kind, flip } });
    this.node = { ...this.node, kind, flip };
    this.env.say(`Junção: ${LABEL[kind]}${flip ? ', ordem invertida' : ''}.`);
  }

  /** Por que o clique não virou canto: a ponta mais próxima e o estado dela, ou a falta de ponta perto do clique. */
  private explain(p: Vec2): string {
    const pr = this.env.project();
    const tol = 12 * this.env.metersPerPixel();
    const frames = levelFrames(pr, this.env.levelId());
    let near: { wallId: string; end: 'a' | 'b'; d: number } | null = null;
    for (const f of frames) {
      for (const end of ['a', 'b'] as const) {
        const d = dist(end === 'a' ? f.a : f.b, p);
        if (d <= tol && (!near || d < near.d)) near = { wallId: f.wall.id, end, d };
      }
    }
    if (!near) return 'Clique no canto ou ponta onde duas paredes se encontram. No meio de uma parede não há canto para unir.';
    const st = joinStatus(frames, near.wallId, near.end, pr.settings.joinTolerance);
    if (st.kind === 'free') return 'Esta ponta não encontra outra parede: não há canto para unir.';
    if (st.kind === 'tee') return 'Esta ponta encosta no meio de outra parede (encosto fixo): não há canto para unir.';
    if (st.kind === 'node') return 'Três ou mais paredes se encontram neste ponto: a junção não se altera por aqui.';
    if (st.kind === 'disallowed') return 'A junção desta ponta está desativada.';
    return 'Clique no canto ou ponta onde duas paredes se encontram.';
  }

  override click(p: PointerInfo): void {
    this.node = this.find(p.raw);
    if (!this.node) {
      this.env.say(this.explain(p.raw));
      return;
    }
    this.apply(ORDER[(ORDER.indexOf(this.node.kind) + 1) % ORDER.length]!, this.node.flip);
    this.move(p);
  }

  override tab(): void {
    if (this.node) this.apply(this.node.kind, !this.node.flip);
  }
}
