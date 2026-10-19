import { angleOf, dist, len, mul, norm, sub, v2, type Vec2 } from '@hestia/geom';
import { frameOfWall } from '@hestia/engine';
import { isWall, type Id } from '@hestia/model';
import { ToolBase } from './base.ts';
import { copyWalls, ghostBands, moveWalls, selectedOpenings, selectedWalls, slideOpenings } from './edit.ts';
import { parseNumber } from './numeric.ts';
import type { PointerInfo, ToolEnv } from './types.ts';

const deg = (r: number): number => (r * 180) / Math.PI;
const fmtM = (m: number): string => `${m.toFixed(3).replace('.', ',')} m`;

/** Base das ferramentas que exigem seleção prévia. */
abstract class SelectionTool extends ToolBase {
  protected walls(): Id[] {
    return selectedWalls(this.env.project(), this.env.selection());
  }
  protected openings(): Id[] {
    return selectedOpenings(this.env.project(), this.env.selection());
  }
  protected hasSelection(): boolean {
    return this.walls().length + this.openings().length > 0;
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
    const walls = this.walls();
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(walls) });
    if (!this.base) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    const d = sub(inf.point, this.base);
    this.items.push({ kind: 'line', a: this.base, b: inf.point, dashed: true });
    this.items.push(...ghostBands(this.env.project(), walls, { kind: 'translate', d }));
    this.items.push({ kind: 'label', at: inf.point, text: fmtM(len(d)) });
  }

  private apply(d: Vec2): void {
    if (len(d) < 1e-6) return;
    const walls = this.walls();
    if (this.copy) {
      this.env.transaction('Copiar', () => {
        if (walls.length) copyWalls(this.env, walls, { kind: 'translate', d });
      });
    } else if (walls.length) {
      moveWalls(this.env, walls, d);
    } else {
      slideOpenings(this.env, this.openings(), d);
    }
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(this.walls()) });
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
    const inf = this.snap(p, { from: this.center ?? undefined, ignore: new Set(this.walls()) });
    if (!this.center) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    this.items.push({ kind: 'line', a: this.center, b: inf.point, dashed: true });
    if (this.ref) {
      const ang = this.angleTo(p.raw);
      this.items.push(...ghostBands(this.env.project(), this.walls(), { kind: 'rotate', about: this.center, angle: ang }));
      this.items.push({ kind: 'label', at: p.raw, text: `${deg(ang).toFixed(1).replace('.', ',')}°` });
    }
  }

  private commit(angle: number): void {
    if (!this.center || Math.abs(angle) < 1e-6) return;
    const walls = this.walls();
    const t = { kind: 'rotate', about: this.center, angle } as const;
    if (this.env.options().rotateCopy) this.env.transaction('Girar e copiar', () => copyWalls(this.env, walls, t));
    else this.env.exec({ type: 'transform', ids: walls, transform: t });
    this.reset();
    this.env.done();
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.center ?? undefined, ignore: new Set(this.walls()) });
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

export class MirrorTool extends SelectionTool {
  readonly id = 'mirror';
  readonly label = 'Espelhar';
  readonly hint = 'Espelhar: clique em dois pontos para definir o eixo de simetria.';
  private p1: Vec2 | null = null;

  protected reset(): void {
    this.p1 = null;
    this.items = [];
  }
  protected busy(): boolean {
    return this.p1 !== null;
  }

  override move(p: PointerInfo): void {
    this.items = [];
    const inf = this.snap(p, { from: this.p1 ?? undefined, ignore: new Set(this.walls()) });
    if (!this.p1) {
      this.items.push({ kind: 'point', at: inf.point });
      return;
    }
    this.items.push({ kind: 'line', a: this.p1, b: inf.point, dashed: true });
    if (dist(this.p1, inf.point) > 1e-6) {
      this.items.push(...ghostBands(this.env.project(), this.walls(), { kind: 'mirror', a: this.p1, b: inf.point }));
    }
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.p1 ?? undefined, ignore: new Set(this.walls()) });
    if (!this.p1) {
      this.p1 = inf.point;
      return;
    }
    if (dist(this.p1, inf.point) < 1e-4) return;
    const walls = this.walls();
    const t = { kind: 'mirror', a: this.p1, b: inf.point } as const;
    if (this.env.options().mirrorCopy) this.env.transaction('Espelhar e copiar', () => copyWalls(this.env, walls, t));
    else this.env.exec({ type: 'transform', ids: walls, transform: t });
    this.reset();
    this.env.done();
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
      this.items.push(...ghostBands(this.env.project(), this.walls(), { kind: 'translate', d: mul(d, i) }));
    }
  }

  override move(p: PointerInfo): void {
    this.items = [];
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(this.walls()) });
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
    const walls = this.walls();
    this.env.transaction('Matriz', () => {
      for (let i = 1; i < n; i++) copyWalls(this.env, walls, { kind: 'translate', d: mul(d, i) });
    });
    this.reset();
    this.env.done();
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.base ?? undefined, ignore: new Set(this.walls()) });
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

/** Deslocar: copia ou move uma parede paralelamente, para o lado do cursor. */
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

  private target(p: Vec2): { id: Id; d: Vec2 } | null {
    const pr = this.env.project();
    let best: { id: Id; dist: number; n: Vec2; side: number } | null = null;
    for (const e of Object.values(pr.elements)) {
      if (!isWall(e) || e.levelId !== this.env.levelId()) continue;
      const f = frameOfWall(pr, e.id);
      if (!f) continue;
      const rel = sub(p, f.a);
      const t = rel.x * f.u.x + rel.y * f.u.y;
      if (t < 0 || t > f.length) continue;
      const s = rel.x * f.n.x + rel.y * f.n.y;
      const dd = Math.abs(s - f.sMid);
      if (!best || dd < best.dist) best = { id: e.id, dist: dd, n: f.n, side: s - f.sMid };
    }
    if (!best || best.dist > 5) return null;
    const dist0 = this.env.options().offsetDistance;
    const sign = best.side >= 0 ? 1 : -1;
    return { id: best.id, d: mul(best.n, sign * dist0) };
  }

  override move(p: PointerInfo): void {
    this.items = [];
    this.raw = p.raw;
    const t = this.target(p.raw);
    if (!t) return;
    this.items.push({ kind: 'highlight', ids: [t.id] });
    this.items.push(...ghostBands(this.env.project(), [t.id], { kind: 'translate', d: t.d }));
  }

  override click(p: PointerInfo): void {
    const t = this.target(p.raw);
    if (!t) return;
    if (this.env.options().offsetCopy) this.env.transaction('Deslocar e copiar', () => copyWalls(this.env, [t.id], { kind: 'translate', d: t.d }));
    else moveWalls(this.env, [t.id], t.d);
  }
}

