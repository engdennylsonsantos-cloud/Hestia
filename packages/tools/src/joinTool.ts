import { dist, type Vec2 } from '@hestia/geom';
import { joinStatus, levelFrames } from '@hestia/engine';
import type { JoinKind } from '@hestia/model';
import { ToolBase } from './base.ts';
import { pickAt } from './pick.ts';
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
  readonly hint = 'Junção: clique num canto de duas paredes para alternar Encosto e Esquadria. Tab inverte qual parede domina.';
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

  /** Motivo do clique ignorado: ponta sem parceira, meio do vão (cruzamento) ou fora de paredes. */
  private miss(p: Vec2): string {
    const pr = this.env.project();
    const tol = 12 * this.env.metersPerPixel();
    const frames = levelFrames(pr, this.env.levelId());
    for (const f of frames) {
      for (const end of ['a', 'b'] as const) {
        if (dist(end === 'a' ? f.a : f.b, p) > tol) continue;
        const st = joinStatus(frames, f.wall.id, end, pr.settings.joinTolerance);
        if (st.kind === 'node') return 'Clique no canto/ponta onde duas paredes se encontram. Mais de duas paredes neste canto: a junção só atua em cantos de duas paredes.';
        if (st.kind === 'disallowed') return 'Clique no canto/ponta onde duas paredes se encontram. Esta ponta está com a junção desligada.';
        return 'Clique no canto/ponta onde duas paredes se encontram. Esta ponta não tem outra parede para unir.';
      }
    }
    if (pickAt(pr, this.env.levelId(), p, this.env.metersPerPixel())) return 'Clique no canto/ponta onde duas paredes se encontram. No meio do vão não há junção.';
    return 'Clique no canto/ponta onde duas paredes se encontram.';
  }

  override click(p: PointerInfo): void {
    this.node = this.find(p.raw);
    if (!this.node) {
      this.env.say(this.miss(p.raw));
      return;
    }
    this.apply(ORDER[(ORDER.indexOf(this.node.kind) + 1) % ORDER.length]!, this.node.flip);
    this.move(p);
  }

  override tab(): void {
    if (this.node) this.apply(this.node.kind, !this.node.flip);
  }
}
