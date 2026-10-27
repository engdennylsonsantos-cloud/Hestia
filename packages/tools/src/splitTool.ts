import { type Vec2 } from '@hestia/geom';
import { isOpening, isWall, type Id, type Wall } from '@hestia/model';
import { frameOfWall, pointAt, toLocal } from '@hestia/engine';
import { ToolBase, makeId } from './base.ts';
import { parseNumber } from './numeric.ts';
import { pickAt } from './pick.ts';
import type { PointerInfo } from './types.ts';

const SNAP_PX = 10;
/** Ponto de corte: distância `t` ao longo da parede, medida a partir de `a`. */
interface Cut {
  wallId: Id;
  t: number;
  at: Vec2;
  snapped: boolean;
}

const fmt = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

/**
 * Dividir (Revit: Split Element / Split with Gap). Clique no ponto de corte; Tab alterna o modo
 * "com intervalo" (dois cliques delimitam o trecho removido); digitar uma distância e Enter corta
 * a essa medida do início da parede em destaque.
 */
export class SplitTool extends ToolBase {
  readonly id = 'split';
  readonly label = 'Dividir';
  readonly hint = 'Dividir: passe sobre a parede e clique no ponto de corte. Digite a distância do início do trecho e Enter para medida exata. Tab: com intervalo.';
  private hoverId: Id | null = null;
  private gapStart: Cut | null = null;
  private withGap = false;

  protected reset(): void {
    this.hoverId = null;
    this.gapStart = null;
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.gapStart !== null;
  }

  override tab(): void {
    this.withGap = !this.withGap;
    this.gapStart = null;
    this.items = [];
    this.env.say(this.withGap ? 'Com intervalo: clique no início e no fim do trecho a remover.' : this.hint);
  }

  override inputPrompt(): string | null {
    return this.hoverId && !this.withGap ? 'Distância do início do trecho' : null;
  }

  /** Parede sob o cursor; uma abertura conta como a parede que a hospeda. */
  private wallAt(p: PointerInfo): Wall | null {
    const pr = this.env.project();
    const hit = pickAt(pr, this.env.levelId(), p.raw, this.env.metersPerPixel());
    if (!hit) return null;
    const el = pr.elements[hit.id];
    const host = isOpening(el) ? pr.elements[el.hostId] : el;
    return isWall(host) ? host : null;
  }

  /** Projeta o cursor no eixo da parede (reta ou arco) e arredonda à grade quando está perto. Null fora do miolo. */
  private cutOn(w: Wall, raw: Vec2): Cut | null {
    const f = frameOfWall(this.env.project(), w.id);
    if (!f || f.length < 1e-9) return null;
    const L = f.length;
    let t = toLocal(f, raw).t;
    if (t <= 0 || t >= L) return null;
    const g = this.env.gridStep();
    const near = g > 0 ? Math.round(t / g) * g : t;
    let snapped = false;
    if (near > 0 && near < L && Math.abs(near - t) <= SNAP_PX * this.env.metersPerPixel()) {
      t = near;
      snapped = true;
    }
    return { wallId: w.id, t, at: pointAt(f, t, 0), snapped };
  }

  override move(p: PointerInfo): void {
    this.items = [];
    this.inf = null;
    const w = this.wallAt(p);
    this.hoverId = w?.id ?? null;
    if (!w) return;
    this.items.push({ kind: 'highlight', ids: [w.id] });
    if (this.gapStart && this.gapStart.wallId !== w.id) this.items.push({ kind: 'highlight', ids: [this.gapStart.wallId] });
    const cut = this.cutOn(w, p.raw);
    if (!cut) return;
    this.inf = { point: cut.at, kind: cut.snapped ? 'grid' : 'nearest', guides: [] };
    if (this.gapStart && this.gapStart.wallId === w.id) {
      this.items.push({ kind: 'point', at: this.gapStart.at });
      this.items.push({ kind: 'line', a: this.gapStart.at, b: cut.at, dashed: true });
      this.items.push({ kind: 'label', at: cut.at, text: `intervalo ${fmt(Math.abs(cut.t - this.gapStart.t))}` });
      return;
    }
    this.items.push({ kind: 'point', at: cut.at });
    this.items.push({ kind: 'label', at: cut.at, text: `${fmt(cut.t)} do início do trecho` });
  }

  override click(p: PointerInfo): void {
    const w = this.wallAt(p);
    if (!w) {
      this.env.say('Clique sobre uma parede.');
      return;
    }
    const cut = this.cutOn(w, p.raw);
    if (!cut) {
      this.env.say('Clique no miolo da parede, longe das extremidades.');
      return;
    }
    if (!this.withGap) {
      this.split(w.id, cut.t, 0);
      this.reset();
      return;
    }
    if (!this.gapStart) {
      this.gapStart = cut;
      this.env.say('Agora clique no fim do trecho a remover.');
      return;
    }
    if (this.gapStart.wallId !== w.id) {
      this.env.say('Os dois cliques devem ser na mesma parede.');
      return;
    }
    const start = this.gapStart;
    this.split(w.id, (start.t + cut.t) / 2, Math.abs(cut.t - start.t));
    this.reset();
  }

  override type(text: string): boolean {
    if (this.withGap || !this.hoverId) return false;
    const v = parseNumber(text);
    if (v === null) {
      this.env.say('Valor inválido. Digite a distância em metros, medida do início do trecho sob o cursor.');
      return false;
    }
    if (!this.split(this.hoverId, v, 0)) return false;
    this.reset();
    return true;
  }

  /** Executa o corte como um único passo de desfazer. Devolve false e mostra o motivo se o modelo recusar. */
  private split(wallId: Id, t: number, gap: number): boolean {
    try {
      this.env.exec({ type: 'splitWall', id: wallId, newId: makeId('w'), t, gap });
    } catch (e) {
      this.env.say(e instanceof Error ? e.message : 'Não foi possível dividir a parede.');
      return false;
    }
    this.env.say(gap > 0 ? `Trecho removido com intervalo de ${fmt(gap)}.` : `Parede dividida a ${fmt(t)} do início do trecho.`);
    return true;
  }
}
