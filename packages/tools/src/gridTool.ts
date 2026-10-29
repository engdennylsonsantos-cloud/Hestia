import { add, dist, mul, norm, sub, v2, type Vec2 } from '@hestia/geom';
import { DEFAULT_GRID_TYPE_ID, GRID_MIN_SEGMENT, formatQuantity, isWall, nextGridName, newId, unitsOf, type Grid, type ResolvedUnits } from '@hestia/model';
import { ToolBase } from './base.ts';
import { clampSag, gridPreviewItems } from './gridGeom.ts';
import { lengthUnitName, parseQuantityText } from './numeric.ts';
import { pickAt } from './pick.ts';
import type { GridMode, PointerInfo } from './types.ts';

const fmt = (u: ResolvedUnits, m: number): string => formatQuantity(u, 'length', m);

const HINTS: Record<GridMode, string> = {
  line: 'Grade: clique no início e no fim do eixo, ou digite o comprimento e Enter.',
  arc: 'Grade em arco: clique no início, no fim e num ponto do arco (ou digite a flecha).',
  pick: 'Grade: clique numa parede para criar a grade sobre o eixo dela.',
  multi: 'Grade multissegmento: clique nos pontos; Enter ou duplo clique termina, Esc remove o último ponto.',
};

/**
 * Ferramenta Grade (Revit: Grid). Modos: linha (2 cliques), arco (início, fim e flecha), escolher linhas (parede vira
 * grade sobre o eixo) e multissegmento. Nome automático, bolha só no fim; cada grade é um comando = um passo de desfazer.
 */
export class GridTool extends ToolBase {
  readonly id = 'grid';
  readonly label = 'Grade';
  readonly hint = HINTS.line;
  /** Pontos já fixados (linha: 1; arco: 1 ou 2; multi: quantos clicados). */
  private pts: Vec2[] = [];

  private mode(): GridMode {
    return this.env.options().grid?.mode ?? 'line';
  }

  private currentHint(): string {
    return HINTS[this.mode()];
  }

  override start(): void {
    this.reset();
    this.env.say(this.currentHint());
  }

  protected reset(): void {
    this.pts = [];
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.pts.length > 0;
  }

  /** Esc: no multissegmento tira o último ponto; nos demais cancela o passo; sem passo, sai da ferramenta. */
  override cancel(): void {
    if (this.mode() === 'multi' && this.pts.length > 0) {
      this.pts.pop();
      this.items = [];
      this.env.say(this.pts.length ? 'Último ponto removido.' : this.currentHint());
      return;
    }
    if (this.busy()) {
      this.reset();
      this.env.say(this.currentHint());
      return;
    }
    this.env.done();
  }

  override confirm(): void {
    if (this.mode() === 'multi' && this.pts.length >= 2) {
      this.commit(this.pts, 0);
      return;
    }
    if (this.busy()) {
      this.reset();
      this.env.say(this.currentHint());
    }
  }

  override inputPrompt(): string | null {
    if (!this.pts.length) return null;
    return this.mode() === 'arc' && this.pts.length === 2 ? 'Flecha do arco' : 'Comprimento';
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    this.items = [];
    const mode = this.mode();
    if (mode === 'pick') {
      const w = this.wallAt(p.raw);
      this.inf = null;
      if (w) this.items.push({ kind: 'highlight', ids: [w.id] });
      return;
    }
    const last = this.pts[this.pts.length - 1];
    const inf = this.snap(p, last ? { from: last } : {});
    const at = inf.point;
    if (!last) {
      this.items.push({ kind: 'point', at });
      return;
    }
    if (mode === 'arc' && this.pts.length === 2) {
      const sag = this.sagFor(at);
      this.items.push(...gridPreviewItems({ points: this.pts, sag }), { kind: 'label', at, text: `flecha ${fmt(unitsOf(this.env.project()), Math.abs(sag))}` });
      return;
    }
    if (dist(last, at) < 1e-6) return;
    const fixed = mode === 'multi' ? this.pts : [last];
    this.items.push(...gridPreviewItems({ points: [...fixed, at], sag: 0 }));
    this.items.push({ kind: 'label', at: add(last, mul(sub(at, last), 0.5)), text: fmt(unitsOf(this.env.project()), dist(last, at)) });
  }

  override click(p: PointerInfo): void {
    this.raw = p.raw;
    const mode = this.mode();
    if (mode === 'pick') {
      this.clickPick(p);
      return;
    }
    const last = this.pts[this.pts.length - 1];
    const at = this.snap(p, last ? { from: last } : {}).point;
    if (mode === 'arc' && this.pts.length === 2) {
      this.commit(this.pts, this.sagFor(at));
      return;
    }
    if (!last) {
      this.pts = [at];
      this.say2();
      return;
    }
    if (dist(last, at) < GRID_MIN_SEGMENT) {
      // Duplo clique no multissegmento termina; nos outros modos o ponto repetido é recusado.
      if (mode === 'multi' && this.pts.length >= 2) this.commit(this.pts, 0);
      else this.env.say(`O ponto está perto demais do anterior: afaste-o pelo menos ${formatQuantity(unitsOf(this.env.project()), 'smallLength', GRID_MIN_SEGMENT, { trim: true })}.`);
      return;
    }
    if (mode === 'line') this.commit([last, at], 0);
    else if (mode === 'arc') {
      this.pts = [last, at];
      this.say2();
    } else {
      this.pts = [...this.pts, at];
      this.say2();
    }
  }

  private say2(): void {
    const mode = this.mode();
    if (mode === 'arc') this.env.say(this.pts.length === 1 ? 'Clique no fim da grade.' : 'Clique num ponto do arco, ou digite a flecha e Enter.');
    else if (mode === 'multi') this.env.say(`${this.pts.length} ponto(s). Continue clicando; Enter ou duplo clique termina, Esc remove o último.`);
    else this.env.say('Clique no fim da grade, ou digite o comprimento e Enter.');
  }

  /** Flecha do arco (início, fim) que passa pelo cursor: distância à corda, com sinal, limitada à metade da corda. */
  private sagFor(at: Vec2): number {
    const [a, b] = this.pts as [Vec2, Vec2];
    const c = (b.x - a.x) * (at.y - a.y) - (b.y - a.y) * (at.x - a.x);
    return clampSag(a, b, c / Math.max(dist(a, b), 1e-9));
  }

  override type(text: string): boolean {
    if (!this.pts.length || this.mode() === 'pick') return false;
    const v = parseQuantityText(text, unitsOf(this.env.project()), 'length');
    if (v === null) {
      this.env.say(`Valor inválido. Digite um número em ${lengthUnitName(unitsOf(this.env.project()))}.`);
      return false;
    }
    if (this.mode() === 'arc' && this.pts.length === 2) {
      // Flecha digitada: o lado vem do cursor em relação à corda; o sinal negativo inverte.
      const side = Math.sign(this.sagFor(this.inf?.point ?? this.raw)) || 1;
      this.commit(this.pts, clampSag(this.pts[0]!, this.pts[1]!, side * v));
      return true;
    }
    if (v <= 0) {
      this.env.say(`Digite o comprimento em ${lengthUnitName(unitsOf(this.env.project()))}, maior que zero.`);
      return false;
    }
    const last = this.pts[this.pts.length - 1]!;
    const dir = norm(sub(this.inf?.point ?? this.raw, last));
    const end = add(last, mul(Math.hypot(dir.x, dir.y) < 1e-9 ? v2(1, 0) : dir, v));
    if (this.mode() === 'line') this.commit([last, end], 0);
    else if (this.mode() === 'arc') {
      this.pts = [last, end];
      this.say2();
    } else {
      this.pts = [...this.pts, end];
      this.say2();
    }
    return true;
  }

  private wallAt(at: Vec2) {
    const hit = pickAt(this.env.project(), this.env.levelId(), at, this.env.metersPerPixel());
    const w = hit?.kind === 'wall' ? this.env.project().elements[hit.id] : undefined;
    return isWall(w) ? w : null;
  }

  private clickPick(p: PointerInfo): void {
    const w = this.wallAt(p.raw);
    if (!w) {
      this.env.say('Clique sobre uma parede para criar a grade no eixo dela.');
      return;
    }
    // Parede curva vira arco com a mesma flecha.
    this.commit([w.a, w.b], w.sag ?? 0);
  }

  /** Cria a grade (um comando = um passo de desfazer). Recusa do modelo vira mensagem e mantém o passo em curso. */
  private commit(points: Vec2[], sag: number): void {
    const opts = this.env.options().grid;
    const grid: Omit<Grid, 'order'> = {
      id: newId('grid'),
      name: nextGridName(this.env.project()),
      typeId: opts?.typeId ?? DEFAULT_GRID_TYPE_ID,
      points: [...points],
      sag,
      bubbleStart: false,
      bubbleEnd: true,
    };
    try {
      this.env.transaction('Criar grade', () => this.env.exec({ type: 'addGrid', grid }));
    } catch (e) {
      this.env.say(e instanceof Error ? e.message : String(e));
      return;
    }
    const mode = this.mode();
    this.reset();
    this.env.say(`Grade ${grid.name} criada. ${HINTS[mode]}`);
  }
}
