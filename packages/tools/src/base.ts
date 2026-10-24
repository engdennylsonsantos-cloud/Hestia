import { newId } from '@hestia/model';
import type { Inference, PointerInfo, PreviewItem, Tool, ToolEnv } from './types.ts';
import { infer, type InferContext } from './infer.ts';
import { floorVertices } from './floorPick.ts';
import type { Vec2 } from '@hestia/geom';

/** Implementação comum: Esc em dois passos, inferência e rótulos. */
export abstract class ToolBase implements Tool {
  abstract readonly id: string;
  abstract readonly label: string;
  abstract readonly hint: string;
  protected inf: Inference | null = null;
  protected items: PreviewItem[] = [];
  protected raw: Vec2 = { x: 0, y: 0 };

  constructor(protected env: ToolEnv) {}

  start(): void {
    this.reset();
    this.env.say(this.hint);
  }

  protected abstract reset(): void;
  /** Há um passo em andamento que o primeiro Esc deve cancelar? */
  protected abstract busy(): boolean;

  move(_p: PointerInfo): void {}
  click(_p: PointerInfo): void {}
  type(_text: string): boolean {
    return false;
  }
  tab(): void {}
  space(): void {}
  confirm(): void {
    if (this.busy()) {
      this.reset();
      this.env.say(this.hint);
    }
  }

  cancel(): void {
    if (this.busy()) {
      this.reset();
      this.env.say(this.hint);
    } else {
      this.env.done();
    }
  }

  preview(): PreviewItem[] {
    return this.items;
  }

  inference(): Inference | null {
    return this.inf;
  }

  inputPrompt(): string | null {
    return null;
  }

  protected ctx(extra: Partial<InferContext> = {}): InferContext {
    const project = this.env.project();
    const levelId = this.env.levelId();
    return {
      project,
      levelId,
      mpp: this.env.metersPerPixel(),
      gridStep: this.env.gridStep(),
      orthoLock: this.env.options().orthoLock,
      snap: this.env.options().snap,
      ...extra,
      // Vértices dos pisos do nível entram sempre; os pontos que a ferramenta passa (contorno em construção) somam-se a eles.
      extraPoints: [...floorVertices(project, levelId), ...(extra.extraPoints ?? [])],
    };
  }

  protected snap(p: PointerInfo, extra: Partial<InferContext> = {}): Inference {
    this.raw = p.raw;
    const ctx = this.ctx(extra);
    if (p.shift) ctx.orthoLock = true;
    this.inf = infer(p.raw, ctx);
    return this.inf;
  }
}

export const makeId = newId;
