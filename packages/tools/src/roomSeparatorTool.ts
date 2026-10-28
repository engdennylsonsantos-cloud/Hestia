import { dist, type Vec2 } from '@hestia/geom';
import { formatQuantity, unitsOf, type ResolvedUnits } from '@hestia/model';
import { ToolBase, makeId } from './base.ts';
import type { PointerInfo } from './types.ts';

const fmt = (u: ResolvedUnits, m: number): string => formatQuantity(u, 'length', m);

/**
 * Linha de separação de ambiente (Revit: Room Separation Line). Clique no ponto inicial e depois no final; a linha
 * divide a área livre entre paredes em dois ambientes. A recusa do modelo (comprimento mínimo) vira mensagem.
 */
export class RoomSeparatorTool extends ToolBase {
  readonly id = 'roomsep';
  readonly label = 'Linha de separação';
  readonly hint = 'Linha de separação: clique no ponto inicial e depois no ponto final.';
  private a: Vec2 | null = null;

  protected reset(): void {
    this.a = null;
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.a !== null;
  }

  override move(p: PointerInfo): void {
    const inf = this.snap(p);
    if (!this.a) return;
    const b = inf.point;
    this.items = [
      { kind: 'point', at: this.a },
      { kind: 'line', a: this.a, b, dashed: true },
      { kind: 'label', at: { x: (this.a.x + b.x) / 2, y: (this.a.y + b.y) / 2 }, text: fmt(unitsOf(this.env.project()), dist(this.a, b)) },
    ];
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p);
    if (!this.a) {
      this.a = inf.point;
      this.env.say('Clique no ponto final da linha de separação.');
      return;
    }
    const a = this.a;
    const b = inf.point;
    try {
      this.env.transaction('Criar linha de separação', () => {
        this.env.exec({ type: 'addRoomSeparator', levelId: this.env.levelId(), separator: { id: makeId('rs'), a, b } });
      });
    } catch (e) {
      // Recusa do modelo (comprimento mínimo): descarta o primeiro clique para a ferramenta não ficar travada.
      this.reset();
      this.env.say(e instanceof Error ? e.message : String(e));
      return;
    }
    this.reset();
    this.env.say(this.hint);
  }
}
