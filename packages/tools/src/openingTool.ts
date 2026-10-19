import { orientedRect, v2 } from '@hestia/geom';
import { frameOfWall, pointAt } from '@hestia/engine';
import { openingType, type Opening } from '@hestia/model';
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
    for (const [a, b] of occupiedRanges(p, wallId)) {
      if (o + half > a + 1e-6 && o - half < b - 1e-6) return null;
    }
    return o;
  }

  override move(p: PointerInfo): void {
    this.items = [];
    this.raw = p.raw;
    const pr = this.env.project();
    const host = hostUnder(p.raw, pr, this.env.levelId(), this.env.metersPerPixel());
    this.inf = null;
    this.current = null;
    if (!host) {
      this.env.say(this.hint);
      return;
    }
    const f = frameOfWall(pr, host.wallId);
    const t = pr.openingTypes[this.typeId()];
    if (!f || !t) return;
    const off = this.resolve(host.offset, host.wallId);
    this.items.push({ kind: 'highlight', ids: [host.wallId] });
    if (off === null) {
      this.env.say('Sem espaço livre neste ponto da parede.');
      return;
    }
    this.current = { wallId: host.wallId, offset: off };
    const c = pointAt(f, off, f.sMid);
    this.items.push({ kind: 'polygon', ring: orientedRect(c.x, c.y, f.u.x, f.u.y, t.width / 2, f.thickness / 2 + 0.02) });
    this.items.push({ kind: 'label', at: v2(c.x, c.y), text: `${(off).toFixed(2).replace('.', ',')} m` });
    this.env.say(`${t.name}: clique para inserir. Digite a distância ao início da parede e Enter para posição exata.`);
  }

  private place(wallId: string, offset: number): void {
    const o: Opening = {
      id: makeId(this.id === 'door' ? 'd' : 'j'),
      kind: this.id,
      typeId: this.typeId(),
      hostId: wallId,
      offset,
      flipHand: this.flipHand,
      flipFacing: this.flipFacing,
      sillOverride: null,
      mark: '',
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
