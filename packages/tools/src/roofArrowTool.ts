import { add, dot, len, mul, norm, sub, type Vec2 } from '@hestia/geom';
import { isRoof, type Roof } from '@hestia/model';
import { ToolBase } from './base.ts';
import { commitRoofPatch } from './roofCheck.ts';
import { roofSlopeError } from './roofGeom.ts';
import { lowestVertex } from './roofEdges.ts';
import { fmtPercent } from './slabSlope.ts';
import type { PointerInfo } from './types.ts';

const HINT = 'Seta de inclinação: clique no beiral da água e depois no ponto para onde ela sobe. A água cobre o contorno do telhado.';

/**
 * Seta de inclinação (A5, Revit: águas livres). Em um telhado de águas livres selecionado, dois cliques definem uma água:
 * o primeiro fixa a linha de beiral (perpendicular à subida, no lado mais baixo do contorno) e o segundo, a direção de
 * subida. A água usa o contorno inteiro e a inclinação da barra de opções. A água é acrescentada a `planes`.
 */
export class RoofArrowTool extends ToolBase {
  readonly id = 'roofarrow';
  readonly label = 'Seta de inclinação';
  readonly hint = HINT;
  private first: Vec2 | null = null;

  /** Telhado selecionado, se for o único selecionado. */
  private roof(): Roof | null {
    const sel = this.env.selection();
    if (sel.length !== 1) return null;
    const r = this.env.project().elements[sel[0]!];
    return isRoof(r) ? r : null;
  }

  /** Mensagem para o estado da seleção: o que falta para a seta funcionar. */
  private stateHint(): string {
    const r = this.roof();
    if (!r) return 'Selecione um telhado de águas livres (Propriedades → Forma → Águas livres).';
    if (r.shape !== 'free') return 'A seta só vale em telhado de águas livres. Clique em Converter para águas livres na barra, ou troque a Forma em Propriedades.';
    return HINT;
  }

  override start(): void {
    this.reset();
    this.env.say(this.stateHint());
  }

  /** O primeiro Esc cancela só o passo em andamento; sem passo, o Esc sai da ferramenta (ToolBase.cancel). */
  override cancel(): void {
    if (this.busy()) {
      this.reset();
      this.env.say('Passo cancelado. Esc de novo sai da ferramenta.');
      return;
    }
    super.cancel();
  }

  protected reset(): void {
    this.first = null;
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.first !== null;
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    this.items = [];
    const inf = this.snap(p, this.first ? { from: this.first } : {});
    if (!this.first) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    const up = this.upOf(inf.point);
    if (!up) return;
    this.items.push({ kind: 'line', a: this.first, b: inf.point });
    const r = this.roof();
    if (r) this.items.push({ kind: 'polygon', ring: r.boundary, dashed: true });
    this.items.push({ kind: 'label', at: inf.point, text: fmtPercent(this.env.options().roofSlope ?? 30) });
  }

  /** Direção de subida unitária do primeiro clique até `q`, ou null quando os pontos coincidem. */
  private upOf(q: Vec2): Vec2 | null {
    if (!this.first) return null;
    const d = sub(q, this.first);
    return len(d) < 0.01 ? null : norm(d);
  }

  override click(p: PointerInfo): void {
    this.raw = p.raw;
    const r = this.roof();
    if (!r || r.shape !== 'free') {
      this.env.say(this.stateHint());
      return;
    }
    const inf = this.snap(p, this.first ? { from: this.first } : {});
    if (!this.first) {
      this.first = inf.point;
      this.env.say('Agora clique no ponto para onde a água sobe.');
      return;
    }
    this.commit(r, inf.point);
  }

  /** Acrescenta a água ao telhado: linha de beiral no lado mais baixo do contorno, subida na direção dos dois cliques. */
  private commit(r: Roof, to: Vec2): void {
    const up = this.upOf(to);
    if (!up || !this.first) {
      this.env.say('Direção nula: afaste o segundo ponto do primeiro.');
      return;
    }
    const slope = this.env.options().roofSlope ?? 30;
    const err = roofSlopeError(slope);
    if (err) {
      this.env.say(err);
      return;
    }
    // A origem fica na reta de beiral: o vértice mais baixo na subida, na mesma posição transversal do primeiro clique.
    const low = lowestVertex(r.boundary, up);
    const origin = add(this.first, mul(up, dot(low, up) - dot(this.first, up)));
    const patch: Partial<Roof> = { planes: [...r.planes, { polygon: r.boundary, origin, up, percent: slope, z0: 0 }] };
    if (commitRoofPatch(this.env, [r.id], patch)) this.env.say(`Água adicionada com inclinação de ${fmtPercent(slope)}. Ctrl+Z desfaz.`);
    this.reset();
  }
}
