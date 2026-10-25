import { angleOf, dist, len, mul, norm, sub, v2, type Vec2 } from '@hestia/geom';
import { frameOfWall } from '@hestia/engine';
import { annotationIdsIn, annotationMoveCommands, isOpening, isWall, type Id } from '@hestia/model';
import { ToolBase } from './base.ts';
import { copyWalls, ghostBands, ghostViews, moveWalls, selectedMovables, selectedOpenings, selectedViews, slideOpenings, transformViews } from './edit.ts';
import { pickAt } from './pick.ts';
import { parseNumber } from './numeric.ts';
import { commitRingEdit, edgeAtCursor, ringOfRef } from './ringTarget.ts';
import { ringOps } from './ringOps.ts';
import { moveRoomSeparators, movableSeparatorIds, separatorGhostItems } from './roomSeparatorPick.ts';
import type { EdgePick } from './ringEdge.ts';
import type { PointerInfo, ToolEnv } from './types.ts';

const deg = (r: number): number => (r * 180) / Math.PI;
const fmtM = (m: number): string => `${m.toFixed(3).replace('.', ',')} m`;

/** Base das ferramentas que exigem seleção prévia. */
abstract class SelectionTool extends ToolBase {
  /** Paredes e pisos selecionados: entram em mover, copiar, girar, espelhar e matriz. */
  protected movables(): Id[] {
    return selectedMovables(this.env.project(), this.env.selection());
  }
  protected openings(): Id[] {
    return selectedOpenings(this.env.project(), this.env.selection());
  }
  /** Vistas de corte/elevação selecionadas: marcas de anotação também movem, copiam, giram e espelham. */
  protected views(): Id[] {
    return selectedViews(this.env.project(), this.env.selection());
  }
  protected hasSelection(): boolean {
    return this.movables().length + this.openings().length + this.views().length + annotationIdsIn(this.env.project(), this.env.levelId(), this.env.selection()).length > 0;
  }
  override start(): void {
    this.reset();
    if (!this.hasSelection()) {
      // Sair para Selecionar põe a dica dela na barra: o aviso vem depois, para não ser apagado.
      this.env.done();
      this.env.say(`${this.label}: selecione elementos antes (Selecionar) e escolha a ferramenta de novo.`);
      return;
    }
    this.env.say(this.hint);
  }
}

/** Mover e Copiar (modo `copy` repete até Esc). */
export class MoveTool extends SelectionTool {
  readonly id: 'move' | 'copy';
  readonly label: string;
  readonly hint: string;
  /** Dica quando não há seleção: a ferramenta espera um clique numa aresta de anel. */
  readonly edgeHint: string;
  private base: Vec2 | null = null;
  /** Aresta escolhida no primeiro clique (só sem seleção). */
  private edgePick: EdgePick | null = null;

  constructor(env: ToolEnv, private copy: boolean) {
    super(env);
    this.id = copy ? 'copy' : 'move';
    this.label = copy ? 'Copiar' : 'Mover';
    this.hint = `${this.label}: clique no ponto base e depois no destino, ou digite a distância.`;
    this.edgeHint = copy
      ? 'Copiar: selecione elementos (Selecionar) para copiar. Uma aresta sozinha ainda não pode ser copiada.'
      : 'Mover: selecione elementos (Selecionar) ou clique numa aresta de piso, laje, telhado ou forro.';
  }

  protected override hasSelection(): boolean {
    return super.hasSelection() || movableSeparatorIds(this.env, this.copy).length > 0;
  }

  /** Sem seleção a ferramenta continua ativa, à espera de um clique em aresta. */
  override start(): void {
    this.reset();
    this.env.say(this.hasSelection() ? this.hint : this.edgeHint);
  }

  protected reset(): void {
    this.base = null;
    this.edgePick = null;
    this.items = [];
    this.inf = null;
  }
  protected busy(): boolean {
    return this.base !== null;
  }
  override inputPrompt(): string | null {
    return this.base ? 'Distância' : null;
  }

  /** Sem seleção: mostra a aresta sob o cursor ou, depois do clique base, a aresta na posição de destino. */
  private edgeMove(p: PointerInfo): void {
    if (!this.edgePick || !this.base) {
      const pick = edgeAtCursor(this.env, p.raw);
      if (!pick) return;
      this.items.push({ kind: 'highlight', ids: [pick.ref.elementId] }, { kind: 'line', a: pick.a, b: pick.b }, { kind: 'point', at: pick.at });
      return;
    }
    const inf = this.snap(p, { from: this.base });
    const d = sub(inf.point, this.base);
    const ring = ringOfRef(this.env.project(), this.edgePick.ref);
    if (!ring) return;
    const moved = ringOps.moveEdge(ring, this.edgePick.ref.index, d);
    const i = this.edgePick.ref.index;
    this.items.push({ kind: 'line', a: this.base, b: inf.point, dashed: true });
    this.items.push({ kind: 'line', a: moved[i]!, b: moved[(i + 1) % ring.length]!, dashed: true });
    this.items.push({ kind: 'label', at: inf.point, text: fmtM(len(d)) });
  }

  /** Move só a aresta pelo vetor d (Mover aresta). Copiar aresta não existe nesta versão. */
  private applyEdge(pick: EdgePick, d: Vec2): void {
    if (len(d) < 1e-6) return;
    const ring = ringOfRef(this.env.project(), pick.ref);
    if (!ring) return;
    this.env.transaction('Mover aresta', () => {
      commitRingEdit(this.env, pick.ref, ringOps.moveEdge(ring, pick.ref.index, d));
    });
  }

  /** Sem seleção: o primeiro clique numa aresta define a base; o segundo, o destino. Outro clique sai com a mensagem de seleção. */
  private edgeClick(p: PointerInfo): void {
    const pick = this.edgePick;
    if (!pick || !this.base) {
      const found = edgeAtCursor(this.env, p.raw);
      if (!found) {
        this.env.done();
        this.env.say(`${this.label}: selecione elementos antes (Selecionar) e escolha a ferramenta de novo.`);
        return;
      }
      if (this.copy) {
        this.env.say('Copiar aresta: não permitido. A cópia sobreporia a linha ou deixaria o croqui aberto (como no Revit).');
        return;
      }
      this.edgePick = found;
      this.base = found.at;
      return;
    }
    const inf = this.snap(p, { from: this.base });
    this.applyEdge(pick, sub(inf.point, this.base));
    this.reset();
    this.env.done();
  }

  override move(p: PointerInfo): void {
    this.items = [];
    if (!this.hasSelection()) {
      this.edgeMove(p);
      return;
    }
    const els = this.movables();
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(els) });
    if (!this.base) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    const d = sub(inf.point, this.base);
    this.items.push({ kind: 'line', a: this.base, b: inf.point, dashed: true });
    const t = { kind: 'translate' as const, d };
    this.items.push(...ghostBands(this.env.project(), els, t), ...ghostViews(this.env.project(), this.env.selection(), t));
    if (!this.copy) this.items.push(...separatorGhostItems(this.env.project(), this.env.levelId(), movableSeparatorIds(this.env, this.copy), d));
    this.items.push({ kind: 'label', at: inf.point, text: fmtM(len(d)) });
  }

  private apply(d: Vec2): void {
    if (len(d) < 1e-6) return;
    const els = this.movables();
    const views = this.views();
    const t = { kind: 'translate', d } as const;
    const seps = movableSeparatorIds(this.env, this.copy);
    // Cotas, textos (decisão 0019) e marcas de corte/elevação seguem a seleção e entram no mesmo passo de desfazer.
    const notes = annotationMoveCommands(this.env.project(), this.env.levelId(), this.env.selection(), d, this.copy);
    this.env.transaction(this.copy ? 'Copiar' : 'Mover', () => {
      if (this.copy) {
        if (els.length) copyWalls(this.env, els, t);
        if (views.length) transformViews(this.env, views, t, true);
      } else {
        if (els.length) moveWalls(this.env, els, d);
        else if (this.openings().length) slideOpenings(this.env, this.openings(), d);
        if (views.length) transformViews(this.env, views, t);
        if (seps.length) moveRoomSeparators(this.env, seps, d);
      }
      for (const c of notes) this.env.exec(c);
    });
  }

  override click(p: PointerInfo): void {
    if (!this.hasSelection()) {
      this.edgeClick(p);
      return;
    }
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(this.movables()) });
    if (!this.base) {
      this.base = inf.point;
      return;
    }
    this.apply(sub(inf.point, this.base));
    if (this.copy) return; // várias cópias a partir da mesma base
    this.reset();
    this.env.done();
  }

  override type(text: string): boolean {
    if (!this.base) return false;
    const v = parseNumber(text);
    if (v === null) return false;
    const dir = norm(sub(this.inf?.point ?? this.raw, this.base));
    if (!this.hasSelection()) {
      if (!this.edgePick) return false;
      this.applyEdge(this.edgePick, mul(len(dir) < 1e-9 ? v2(1, 0) : dir, v));
      this.reset();
      this.env.done();
      return true;
    }
    this.apply(mul(len(dir) < 1e-9 ? v2(1, 0) : dir, v));
    if (!this.copy) {
      this.reset();
      this.env.done();
    }
    return true;
  }
}

export class RotateTool extends SelectionTool {
  readonly id = 'rotate';
  readonly label = 'Girar';
  readonly hint = 'Girar: clique no centro, depois na direção de referência e na direção final — ou digite o ângulo em graus.';
  private center: Vec2 | null = null;
  private ref: Vec2 | null = null;

  protected reset(): void {
    this.center = null;
    this.ref = null;
    this.items = [];
  }
  protected busy(): boolean {
    return this.center !== null;
  }
  override inputPrompt(): string | null {
    return this.center ? 'Ângulo (graus)' : null;
  }

  private angleTo(p: Vec2): number {
    if (!this.center) return 0;
    const a = angleOf(sub(p, this.center));
    const r = this.ref ? angleOf(sub(this.ref, this.center)) : 0;
    let d = a - r;
    // Passos de 15° quando próximo: o cursor "adivinha" ângulos úteis.
    const step = (15 * Math.PI) / 180;
    const snapped = Math.round(d / step) * step;
    if (Math.abs(d - snapped) < 0.05) d = snapped;
    return d;
  }

  override move(p: PointerInfo): void {
    this.items = [];
    const inf = this.snap(p, { from: this.center ?? undefined, ignore: new Set(this.movables()) });
    if (!this.center) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    this.items.push({ kind: 'line', a: this.center, b: inf.point, dashed: true });
    if (this.ref) {
      const ang = this.angleTo(p.raw);
      const t = { kind: 'rotate', about: this.center, angle: ang } as const;
      this.items.push(...ghostBands(this.env.project(), this.movables(), t), ...ghostViews(this.env.project(), this.env.selection(), t));
      this.items.push({ kind: 'label', at: p.raw, text: `${deg(ang).toFixed(1).replace('.', ',')}°` });
    }
  }

  private commit(angle: number): void {
    if (!this.center || Math.abs(angle) < 1e-6) return;
    const els = this.movables();
    const views = this.views();
    const t = { kind: 'rotate', about: this.center, angle } as const;
    const copy = this.env.options().rotateCopy;
    this.env.transaction(copy ? 'Girar e copiar' : 'Girar', () => {
      if (els.length) {
        if (copy) copyWalls(this.env, els, t);
        else this.env.exec({ type: 'transform', ids: els, transform: t });
      }
      if (views.length) transformViews(this.env, views, t, copy);
    });
    this.reset();
    this.env.done();
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.center ?? undefined, ignore: new Set(this.movables()) });
    if (!this.center) {
      this.center = inf.point;
    } else if (!this.ref) {
      this.ref = inf.point;
    } else {
      this.commit(this.angleTo(inf.point));
    }
  }

  override type(text: string): boolean {
    if (!this.center) return false;
    const v = parseNumber(text);
    if (v === null) return false;
    this.commit((v * Math.PI) / 180);
    return true;
  }
}

/**
 * Espelhar (Revit: Mirror - Pick Axis). Dois cliques definem o eixo; Tab alterna "Pegar parede":
 * o primeiro clique numa parede existente usa a linha a→b dela como eixo e espelha na hora.
 */
export class MirrorTool extends SelectionTool {
  readonly id = 'mirror';
  readonly label = 'Espelhar';
  readonly hint = 'Espelhar: clique em dois pontos para definir o eixo de simetria. Tab: pegar uma parede como eixo.';
  private p1: Vec2 | null = null;
  private pickAxis = false;

  protected reset(): void {
    this.p1 = null;
    this.items = [];
  }
  protected busy(): boolean {
    return this.p1 !== null;
  }

  override tab(): void {
    this.pickAxis = !this.pickAxis;
    this.reset();
    this.env.say(this.pickAxis ? 'Pegar parede: clique numa parede existente para usá-la como eixo.' : this.hint);
  }

  /** Parede sob o cursor (uma abertura conta como a parede que a hospeda). */
  private wallUnder(p: Vec2): Id | null {
    const pr = this.env.project();
    const hit = pickAt(pr, this.env.levelId(), p, this.env.metersPerPixel());
    if (!hit) return null;
    const e = pr.elements[hit.id];
    if (isWall(e)) return e.id;
    return isOpening(e) ? e.hostId : null;
  }

  override move(p: PointerInfo): void {
    this.items = [];
    if (this.pickAxis) {
      const id = this.wallUnder(p.raw);
      const f = id ? frameOfWall(this.env.project(), id) : null;
      if (!id || !f) return;
      this.items.push({ kind: 'highlight', ids: [id] });
      this.items.push({ kind: 'line', a: f.a, b: f.b, dashed: true });
      const t = { kind: 'mirror', a: f.a, b: f.b } as const;
      this.items.push(...ghostBands(this.env.project(), this.movables(), t), ...ghostViews(this.env.project(), this.env.selection(), t));
      return;
    }
    const inf = this.snap(p, { from: this.p1 ?? undefined, ignore: new Set(this.movables()) });
    if (!this.p1) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    this.items.push({ kind: 'line', a: this.p1, b: inf.point, dashed: true });
    if (dist(this.p1, inf.point) > 1e-6) {
      const t = { kind: 'mirror', a: this.p1, b: inf.point } as const;
      this.items.push(...ghostBands(this.env.project(), this.movables(), t), ...ghostViews(this.env.project(), this.env.selection(), t));
    }
  }

  /** Aplica o espelho pelo eixo a→b às paredes, com cópia se a opção estiver marcada. */
  private apply(a: Vec2, b: Vec2): void {
    const els = this.movables();
    const views = this.views();
    const t = { kind: 'mirror', a, b } as const;
    const copy = this.env.options().mirrorCopy;
    this.env.transaction(copy ? 'Espelhar e copiar' : 'Espelhar', () => {
      if (els.length) {
        if (copy) copyWalls(this.env, els, t);
        else this.env.exec({ type: 'transform', ids: els, transform: t });
      }
      if (views.length) transformViews(this.env, views, t, copy);
    });
    this.reset();
    this.env.done();
  }

  override click(p: PointerInfo): void {
    if (this.pickAxis) {
      const id = this.wallUnder(p.raw);
      const f = id ? frameOfWall(this.env.project(), id) : null;
      if (!f) {
        this.env.say('Clique numa parede para usá-la como eixo.');
        return;
      }
      if (dist(f.a, f.b) < 1e-4) return;
      this.apply(f.a, f.b);
      return;
    }
    const inf = this.snap(p, { from: this.p1 ?? undefined, ignore: new Set(this.movables()) });
    if (!this.p1) {
      this.p1 = inf.point;
      return;
    }
    if (dist(this.p1, inf.point) < 1e-4) return;
    this.apply(this.p1, inf.point);
  }
}

/** Matriz linear: N elementos, espaçamento definido por dois pontos ou digitado. */
export class ArrayTool extends SelectionTool {
  readonly id = 'array';
  readonly label = 'Matriz';
  readonly hint = 'Matriz linear: clique no ponto base e no segundo ponto (espaçamento) — ou digite o espaçamento.';
  private base: Vec2 | null = null;

  protected reset(): void {
    this.base = null;
    this.items = [];
  }
  protected busy(): boolean {
    return this.base !== null;
  }
  override inputPrompt(): string | null {
    return this.base ? 'Espaçamento' : null;
  }

  private ghosts(d: Vec2): void {
    const n = Math.max(2, this.env.options().arrayCount);
    for (let i = 1; i < n; i++) {
      const t = { kind: 'translate', d: mul(d, i) } as const;
      this.items.push(...ghostBands(this.env.project(), this.movables(), t), ...ghostViews(this.env.project(), this.env.selection(), t));
    }
  }

  override move(p: PointerInfo): void {
    this.items = [];
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(this.movables()) });
    if (!this.base) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    const d = sub(inf.point, this.base);
    this.items.push({ kind: 'line', a: this.base, b: inf.point, dashed: true });
    this.ghosts(d);
    this.items.push({ kind: 'label', at: inf.point, text: `${this.env.options().arrayCount} × ${fmtM(len(d))}` });
  }

  private commit(d: Vec2): void {
    if (len(d) < 1e-6) return;
    const n = Math.max(2, this.env.options().arrayCount);
    const els = this.movables();
    const views = this.views();
    this.env.transaction('Matriz', () => {
      for (let i = 1; i < n; i++) {
        const t = { kind: 'translate', d: mul(d, i) } as const;
        if (els.length) copyWalls(this.env, els, t);
        if (views.length) transformViews(this.env, views, t, true);
      }
    });
    this.reset();
    this.env.done();
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(this.movables()) });
    if (!this.base) {
      this.base = inf.point;
      return;
    }
    this.commit(sub(inf.point, this.base));
  }

  override type(text: string): boolean {
    if (!this.base) return false;
    const v = parseNumber(text);
    if (v === null) return false;
    const dir = norm(sub(this.inf?.point ?? this.raw, this.base));
    this.commit(mul(len(dir) < 1e-9 ? v2(1, 0) : dir, v));
    return true;
  }
}
