import { orientedRect, v2 } from '@hestia/geom';
import { frameOfWall, pointAt } from '@hestia/engine';
import { openingType, openingsOfWall, type Opening } from '@hestia/model';
import { ToolBase, makeId } from './base.ts';
import { hostUnder, occupiedRanges } from './infer.ts';
import { parseNumber } from './numeric.ts';
import type { PointerInfo } from './types.ts';

/** Porta e janela: hospedadas na parede sob o cursor (docs/02 §5). */
export class OpeningTool extends ToolBase {
  readonly id: 'door' | 'window';
  readonly label: string;
  readonly hint: string;
  private flipHand = false;
  private flipFacing = false;
  private current: { wallId: string; offset: number } | null = null;

  constructor(env: ConstructorParameters<typeof ToolBase>[0], kind: 'door' | 'window') {
    super(env);
    this.id = kind;
    this.label = kind === 'door' ? 'Porta' : 'Janela';
    this.hint = `${this.label}: passe o cursor sobre uma parede e clique. Tab inverte o lado, Espaço a dobradiça.`;
  }

  protected reset(): void {
    this.items = [];
    this.current = null;
  }

  protected busy(): boolean {
    return false;
  }

  private typeId(): string {
    const o = this.env.options();
    return this.id === 'door' ? o.doorTypeId : o.windowTypeId;
  }

  override tab(): void {
    this.flipFacing = !this.flipFacing;
  }

  flipHandToggle(): void {
    this.flipHand = !this.flipHand;
  }

  override inputPrompt(): string | null {
    return this.current ? 'Distância do início da parede' : null;
  }

  private resolve(offset: number, wallId: string): number | null {
    const p = this.env.project();
    const t = p.openingTypes[this.typeId()];
    const f = frameOfWall(p, wallId);
    if (!t || !f) return null;
    const half = t.width / 2;
    if (f.length < t.width + 0.02) return null;
    const o = Math.max(half + 0.01, Math.min(f.length - half - 0.01, offset));
    for (const [a, b] of occupiedRanges(p, wallId, undefined, [t.sill, t.sill + t.height])) {
      if (o + half > a + 1e-6 && o - half < b - 1e-6) return null;
    }
    return o;
  }

  /**
   * Captura da posição na parede (S-11): a borda da abertura encosta na ponta da parede, em outra abertura (encosto,
   * batente ou centro). Só com a captura ligada (F3 desliga). Digitar a distância não passa por aqui: é exata.
   */
  private snapOffset(offset: number, wallId: string, width: number): { offset: number; note: string | null } {
    if (this.env.options().snap?.enabled === false) return { offset, note: null };
    const pr = this.env.project();
    const f = frameOfWall(pr, wallId);
    if (!f) return { offset, note: null };
    const tol = 10 * this.env.metersPerPixel();
    const h = width / 2;
    const targets: Array<{ c: number; note: string }> = [
      { c: h + 0.01, note: 'início da parede' },
      { c: f.length - h - 0.01, note: 'fim da parede' },
    ];
    for (const o of openingsOfWall(pr, wallId)) {
      const ot = pr.openingTypes[o.typeId];
      const ow = (ot?.width ?? 0.8) / 2;
      targets.push(
        { c: o.offset - ow - h, note: 'encosto na abertura' },
        { c: o.offset + ow + h, note: 'encosto na abertura' },
        { c: o.offset - ow + h, note: 'batente alinhado' },
        { c: o.offset + ow - h, note: 'batente alinhado' },
        { c: o.offset, note: 'centro alinhado' },
      );
    }
    let best: { c: number; note: string; d: number } | null = null;
    for (const t of targets) {
      const d = Math.abs(t.c - offset);
      if (d <= tol && (!best || d < best.d)) best = { ...t, d };
    }
    return best ? { offset: best.c, note: best.note } : { offset, note: null };
  }

  override move(p: PointerInfo): void {
    this.items = [];
    this.raw = p.raw;
    const pr = this.env.project();
    const host = hostUnder(p.raw, pr, this.env.levelId(), this.env.metersPerPixel(), this.env.options().snap?.enabled !== false);
    this.inf = null;
    this.current = null;
    if (!host) {
      this.env.say(this.hint);
      return;
    }
    const f = frameOfWall(pr, host.wallId);
    const t = pr.openingTypes[this.typeId()];
    if (!f || !t) return;
    const aligned = this.snapOffset(host.offset, host.wallId, t.width);
    const off = this.resolve(aligned.offset, host.wallId);
    this.items.push({ kind: 'highlight', ids: [host.wallId] });
    if (off === null) {
      this.env.say('Sem espaço livre neste ponto da parede.');
      return;
    }
    this.current = { wallId: host.wallId, offset: off };
    const c = pointAt(f, off, f.sMid);
    this.items.push({ kind: 'polygon', ring: orientedRect(c.x, c.y, f.u.x, f.u.y, t.width / 2, f.thickness / 2 + 0.02) });
    this.items.push({ kind: 'label', at: v2(c.x, c.y), text: `${(off).toFixed(2).replace('.', ',')} m${aligned.note ? ` · ${aligned.note}` : ''}` });
    this.env.say(`${t.name}: clique para inserir. Digite a distância ao início da parede e Enter para posição exata.`);
  }

  private place(wallId: string, offset: number): void {
    const options = this.env.options();
    const o: Opening = {
      id: makeId(this.id === 'door' ? 'd' : 'j'),
      kind: this.id,
      typeId: this.typeId(),
      hostId: wallId,
      offset,
      flipHand: (options.openingFlipHand ?? false) !== this.flipHand,
      flipFacing: (options.openingFlipFacing ?? false) !== this.flipFacing,
      sillOverride: options.openingSillOverride ?? null,
      mark: options.placementMark ?? '',
    };
    this.env.exec({ type: 'addOpening', opening: o });
    const pr = this.env.project();
    this.env.say(`${openingType(pr, o).name} inserida.`);
  }

  override click(p: PointerInfo): void {
    this.move(p);
    if (this.current) this.place(this.current.wallId, this.current.offset);
  }

  override type(text: string): boolean {
    if (!this.current) return false;
    const v = parseNumber(text);
    if (v === null) return false;
    const off = this.resolve(v, this.current.wallId);
    if (off === null) {
      this.env.say('Posição ocupada ou fora da parede.');
      return false;
    }
    this.place(this.current.wallId, off);
    return true;
  }
}
