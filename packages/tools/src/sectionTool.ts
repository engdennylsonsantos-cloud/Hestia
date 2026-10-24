import { dist, mid, type Vec2 } from '@hestia/geom';
import type { SectionView } from '@hestia/model';
import { endRefAt } from './annotationPick.ts';
import { ToolBase, makeId } from './base.ts';
import type { PointerInfo } from './types.ts';

/** Profundidade padrão do corte: quanto do modelo fica visível além do plano. */
export const DEFAULT_SECTION_DEPTH = 6;

const fmt = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

/** Próximo nome livre "Corte A", "Corte B"… (depois de Z, "Corte 27", "Corte 28"…). */
export function nextSectionName(views: SectionView[]): string {
  const used = new Set(views.map((v) => v.name));
  for (let i = 0; i < 26; i++) {
    const name = `Corte ${String.fromCharCode(65 + i)}`;
    if (!used.has(name)) return name;
  }
  for (let n = 27; ; n++) {
    const name = `Corte ${n}`;
    if (!used.has(name)) return name;
  }
}

/**
 * Corte: dois cliques definem a linha em planta. O observador fica à esquerda de a→b (convenção de SectionView).
 * Cria a vista com `addView`, nome automático e profundidade padrão, e volta à seleção.
 */
export class SectionTool extends ToolBase {
  readonly id = 'section';
  readonly label = 'Corte';
  readonly hint = 'Corte: clique no início da linha de corte. Esc cancela.';
  private first: Vec2 | null = null;

  protected reset(): void {
    this.first = null;
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.first !== null;
  }

  override move(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.first ?? undefined });
    this.items = [];
    if (!this.first) {
      this.items.push({ kind: 'point', at: inf.point });
      this.env.say(this.hint);
      return;
    }
    const a = this.first;
    const b = inf.point;
    const l = dist(a, b);
    if (l < 1e-6) return;
    this.items.push({ kind: 'sectionLine', a, b, dashed: true });
    this.items.push({ kind: 'label', at: mid(a, b), text: fmt(l) });
    this.env.say('Clique no fim da linha. A seta mostra o lado que o observador vê.');
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.first ?? undefined });
    if (!this.first) {
      this.first = inf.point;
      this.env.say('Clique no fim da linha de corte. Esc cancela.');
      return;
    }
    const a = this.first;
    const b = inf.point;
    if (dist(a, b) < 0.05) return;
    const refA = endRefAt(this.env.project(), this.env.levelId(), a);
    const refB = endRefAt(this.env.project(), this.env.levelId(), b);
    const view: SectionView = {
      id: makeId('v'),
      name: nextSectionName(this.env.project().views),
      kind: 'section',
      a,
      b,
      depth: DEFAULT_SECTION_DEPTH,
      ...(refA || refB
        ? { refs: { ...(refA ? { a: { wallId: refA.wallId, end: refA.end } } : {}), ...(refB ? { b: { wallId: refB.wallId, end: refB.end } } : {}) } }
        : {}),
    };
    this.env.exec({ type: 'addView', view });
    this.env.done();
    this.env.say(`${view.name} criado. Duplo clique no navegador abre o corte.`);
  }
}
