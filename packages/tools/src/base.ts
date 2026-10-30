import { newId, type Id, type Wall } from '@hestia/model';
import type { Inference, PointerInfo, PreviewItem, Tool, ToolEnv } from './types.ts';
import { infer, type InferContext } from './infer.ts';
import { floorEdges, floorVertices } from './floorPick.ts';
import { openingSnapGeometry } from './openingSnapPoints.ts';
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
    const hidden = this.env.hiddenInView?.();
    const under = this.env.underlayLevelId?.() ?? null;
    const levelsIn = (l: string): string[] => (under ? [l, under] : [l]);
    const visible = hidden ? (w: Wall) => !hidden.has(w.id) : undefined;
    const levels = levelsIn(levelId);
    // Aberturas entram na captura com cantos, centro e ombreiras; na inserção de abertura (só paredes) ficam de fora.
    const openings = extra.onWallsOnly ? [] : levels.flatMap((l) => openingSnapGeometry(project, l, visible));
    const options = this.env.options();
    const angle = options.angleMode;
    return {
      project,
      levelId,
      isVisible: visible,
      underlayLevelId: under,
      mpp: this.env.metersPerPixel(),
      gridStep: this.env.gridStep(),
      orthoLock: options.orthoLock || angle?.ortho === true,
      polar: angle?.polar === true,
      polarIncrementDeg: angle?.polarIncrementDeg,
      snap: options.snap,
      ...extra,
      // Vértices dos pisos do nível entram sempre; os pontos que a ferramenta passa (contorno em construção) somam-se a eles.
      extraPoints: [...levels.flatMap((l) => floorVertices(project, l)), ...openings.flatMap((g) => g.points), ...(extra.extraPoints ?? [])],
      extraSegments: [...levels.flatMap((l) => floorEdges(project, l)), ...openings.flatMap((g) => g.segments), ...(extra.extraSegments ?? [])],
    };
  }

  protected snap(p: PointerInfo, extra: Partial<InferContext> = {}): Inference {
    this.raw = p.raw;
    const ctx = this.ctx({ previous: this.inf, ...extra });
    if (p.shift) ctx.orthoLock = true;
    this.inf = infer(p.raw, ctx);
    return this.inf;
  }
}

export const makeId = newId;

/**
 * Planta de área aberta na vista, quando há uma. As ferramentas de anotação passam este id no comando para
 * gravar a anotação na planta (vista) e não no nível; `undefined` mantém a anotação na planta de piso.
 */
export const viewPlanId = (env: ToolEnv): Id | undefined => env.areaPlanId?.() ?? undefined;
