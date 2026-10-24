import { angleOf, dist, len, mul, norm, offsetArc, sub, v2, type Vec2 } from '@hestia/geom';
import { frameOfWall, normalAt, toLocal } from '@hestia/engine';
import { annotationIdsIn, annotationMoveCommands, isOpening, isWall, type Id } from '@hestia/model';
import { ToolBase } from './base.ts';
import { copyWalls, ghostBands, ghostViews, moveWalls, selectedMovables, selectedOpenings, selectedViews, slideOpenings, transformViews } from './edit.ts';
import { pickAt } from './pick.ts';
import { parseNumber } from './numeric.ts';
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
      this.env.say(`${this.label}: selecione elementos antes (Selecionar) e escolha a ferramenta de novo.`);
      this.env.done();
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
  private base: Vec2 | null = null;

  constructor(env: ToolEnv, private copy: boolean) {
    super(env);
    this.id = copy ? 'copy' : 'move';
    this.label = copy ? 'Copiar' : 'Mover';
    this.hint = `${this.label}: clique no ponto base e depois no destino, ou digite a distância.`;
  }

  protected reset(): void {
    this.base = null;
    this.items = [];
    this.inf = null;
  }
  protected busy(): boolean {
    return this.base !== null;
  }
  override inputPrompt(): string | null {
    return this.base ? 'Distância' : null;
  }

  override move(p: PointerInfo): void {
    this.items = [];
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
    this.items.push({ kind: 'label', at: inf.point, text: fmtM(len(d)) });
  }

  private apply(d: Vec2): void {
    if (len(d) < 1e-6) return;
    const els = this.movables();
    const views = this.views();
    const t = { kind: 'translate', d } as const;
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
      }
      for (const c of notes) this.env.exec(c);
    });
  }

  override click(p: PointerInfo): void {
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

/** Deslocar: copia ou move uma parede paralelamente, para o lado do cursor (concêntrico nas curvas). */
export class OffsetTool extends ToolBase {
  readonly id = 'offset';
  readonly label = 'Deslocar';
  readonly hint = 'Deslocar: passe sobre uma parede e clique para o lado desejado. A distância está na barra de opções.';

  protected reset(): void {
    this.items = [];
  }
  protected busy(): boolean {
    return false;
  }

  private target(p: Vec2): { id: Id; d: Vec2; arc: { a: Vec2; b: Vec2; sag: number } | null } | null {
    const pr = this.env.project();
    let best: { id: Id; dist: number; n: Vec2; side: number } | null = null;
    for (const e of Object.values(pr.elements)) {
      if (!isWall(e) || e.levelId !== this.env.levelId()) continue;
      const f = frameOfWall(pr, e.id);
      if (!f) continue;
      const l = toLocal(f, p);
      if (l.t < 0 || l.t > f.length) continue;
      const dd = Math.abs(l.s - f.sMid);
      const n = f.arc ? normalAt(f, l.t) : f.n;
      if (!best || dd < best.dist) best = { id: e.id, dist: dd, n, side: l.s - f.sMid };
    }
    if (!best || best.dist > 5) return null;
    const dist0 = this.env.options().offsetDistance;
    const sign = best.side >= 0 ? 1 : -1;
    const w = pr.elements[best.id];
    const arc = isWall(w) && Math.abs(w.sag) > 1e-6 ? offsetArc(w.a, w.b, w.sag, sign * dist0) : null;
    return { id: best.id, d: mul(best.n, sign * dist0), arc };
  }

  override move(p: PointerInfo): void {
    this.items = [];
    this.raw = p.raw;
    const t = this.target(p.raw);
    if (!t) return;
    this.items.push({ kind: 'highlight', ids: [t.id] });
    const f = frameOfWall(this.env.project(), t.id);
    if (t.arc && f) this.items.push({ kind: 'wallBand', a: t.arc.a, b: t.arc.b, thickness: f.thickness, sMid: f.sMid, sag: t.arc.sag });
    else this.items.push(...ghostBands(this.env.project(), [t.id], { kind: 'translate', d: t.d }));
  }

  override click(p: PointerInfo): void {
    const t = this.target(p.raw);
    if (!t) return;
    const copy = this.env.options().offsetCopy;
    if (!t.arc) {
      if (copy) this.env.transaction('Deslocar e copiar', () => copyWalls(this.env, [t.id], { kind: 'translate', d: t.d }));
      else moveWalls(this.env, [t.id], t.d);
      return;
    }
    const patch = { a: t.arc.a, b: t.arc.b, sag: t.arc.sag };
    if (copy) {
      this.env.transaction('Deslocar e copiar', () => {
        const [nid] = copyWalls(this.env, [t.id], { kind: 'translate', d: { x: 0, y: 0 } });
        if (nid) this.env.exec({ type: 'updateElements', ids: [nid], patch });
      });
    } else this.env.exec({ type: 'updateElements', ids: [t.id], patch });
  }
}
