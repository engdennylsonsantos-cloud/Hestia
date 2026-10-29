import { ToolBase } from './base.ts';

const HINT = 'Rampa: ferramenta em implementação.';

/** Esqueleto da ferramenta Rampa (a ferramenta completa nasce na fase seguinte). */
export class RampTool extends ToolBase {
  readonly id = 'ramp';
  readonly label = 'Rampa';
  readonly hint = HINT;

  override start(): void {
    this.env.say(this.hint);
  }

  protected reset(): void {}

  protected busy(): boolean {
    return false;
  }
}
