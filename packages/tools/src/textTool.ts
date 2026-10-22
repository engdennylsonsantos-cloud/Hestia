import { newId, type TextNote } from '@hestia/model';
import { ToolBase } from './base.ts';
import type { PointerInfo } from './types.ts';

/** Altura padrão do texto de anotação, em mm de papel (Revit: 2,5 mm). */
export const TEXT_DEFAULT_HEIGHT_MM = 2.5;

/**
 * Texto de anotação (Revit: Text). Clique no ponto (centro do texto), digite no campo da barra de opções e Enter.
 * Esc cancela o texto em andamento. A ferramenta só emite `addText`.
 */
export class TextTool extends ToolBase {
  readonly id = 'text';
  readonly label = 'Texto';
  readonly hint = 'Texto: clique no ponto onde o texto fica, digite o texto e Enter.';
  /** O campo aceita letras e espaços (não só números): a interface envia cada tecla digitável. */
  readonly freeText = true;
  private at: { x: number; y: number } | null = null;

  protected reset(): void {
    this.at = null;
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.at !== null;
  }

  override inputPrompt(): string | null {
    return this.at ? 'Texto' : null;
  }

  override move(p: PointerInfo): void {
    this.raw = p.raw;
    const inf = this.snap(p);
    this.items = this.at ? [{ kind: 'point', at: this.at }] : [{ kind: 'point', at: inf.point }];
  }

  override click(p: PointerInfo): void {
    this.at = this.snap(p).point;
    this.items = [{ kind: 'point', at: this.at }];
    this.env.say('Digite o texto e Enter.');
  }

  override type(text: string): boolean {
    if (!this.at) return false;
    const t = text.trim();
    if (t === '') {
      this.env.say('O texto não pode ser vazio.');
      return false;
    }
    const note: TextNote = { id: newId('txt'), at: { ...this.at }, text: t, height: TEXT_DEFAULT_HEIGHT_MM, rotation: 0 };
    this.env.exec({ type: 'addText', levelId: this.env.levelId(), text: note });
    this.reset();
    this.env.say(this.hint);
    return true;
  }
}
