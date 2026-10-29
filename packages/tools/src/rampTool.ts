import { len, sub, type Vec2 } from '@hestia/geom';
import { formatRampPercent, formatRampSlope, rampTopLevel, type RampInputMode } from '@hestia/model';
import { planRamp, rampIssuesOf, type RampPlan } from '@hestia/engine';
import { ToolBase } from './base.ts';
import { parseNumber } from './numeric.ts';
import { createRampFromPlan, draftRamp, rampRise, rampTypeId, type RampCommandResult } from './rampCommands.ts';
import { DEFAULT_RAMP_OPTIONS, type RampToolOptions } from './rampOptions.ts';
import { rampPartsPreview } from './rampPreview.ts';
import type { PointerInfo, PreviewItem } from './types.ts';

const START_HINT = 'Rampa: clique no centro da borda de início. Esc cancela.';
const DIRECTION_HINT = 'Rampa: clique para dar a direção e o comprimento, ou digite o ângulo em graus (0 = eixo X). Esc cancela o ponto.';
/** Distância mínima (m) entre o ponto inicial e o cursor para definir a direção. */
const MIN_DIRECTION = 0.01;
/** Tolerância (m) para a nota do modo 'slope' comparar o clique com o comprimento necessário. */
const CLICK_EPS = 0.005;

/** Metros com vírgula e duas casas (9,6 → "9,60"). */
const mText = (m: number): string => m.toFixed(2).replace('.', ',');

/** "1 lance" / "4 lances". */
const flightsText = (n: number): string => `${n} ${n === 1 ? 'lance' : 'lances'}`;

/**
 * Rampa reta, em L ou em U, criada pronta por cliques. O 1º clique é o centro da borda de início; o movimento mostra a
 * prévia (croqui, piso dos lances e rótulo). O 2º clique define a direção e, no modo 'length', o comprimento total; no
 * modo 'slope', a inclinação manda e a rampa pode terminar antes ou passar do clique (com nota). Digitar um número é o
 * ângulo de subida em graus: sem comprimento clicado, vale a inclinação da barra (ou a padrão do tipo). Cada criação é
 * UMA transação ("Criar rampa"); depois dela a ferramenta continua pronta e Esc sai.
 */
export class RampTool extends ToolBase {
  readonly id = 'ramp';
  readonly label = 'Rampa';
  readonly hint = START_HINT;
  private origin: Vec2 | null = null;

  private get opts(): RampToolOptions {
    return this.env.options().ramp ?? DEFAULT_RAMP_OPTIONS;
  }

  protected reset(): void {
    this.origin = null;
    this.items = [];
    this.inf = null;
  }

  protected busy(): boolean {
    return this.origin !== null;
  }

  override start(): void {
    this.reset();
    this.env.say(START_HINT);
  }

  override inputPrompt(): string | null {
    return this.origin !== null ? 'Ângulo (°)' : null;
  }

  override move(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.origin ?? undefined });
    if (this.origin === null) {
      this.items = [{ kind: 'point', at: inf.point }];
      return;
    }
    const dir = sub(inf.point, this.origin);
    if (len(dir) < MIN_DIRECTION) {
      this.items = [{ kind: 'point', at: this.origin }];
      return;
    }
    const plan = this.build(dir, len(dir));
    if ('error' in plan) {
      this.env.say(plan.error);
      this.items = [{ kind: 'point', at: this.origin }];
      return;
    }
    this.env.say(DIRECTION_HINT);
    const label: PreviewItem = {
      kind: 'label',
      at: inf.point,
      text: `${formatRampSlope(plan.slope)} · ${flightsText(plan.flights)} · ${mText(plan.pathLength)} m`,
    };
    this.items = [...rampPartsPreview(plan), label];
  }

  override click(p: PointerInfo): void {
    const inf = this.snap(p, { from: this.origin ?? undefined });
    if (this.origin === null) {
      this.origin = inf.point;
      this.env.say(DIRECTION_HINT);
      return;
    }
    const dir = sub(inf.point, this.origin);
    if (len(dir) < MIN_DIRECTION) {
      this.env.say('Afaste o cursor do ponto inicial para dar a direção.');
      return;
    }
    this.create(dir, len(dir));
  }

  override type(text: string): boolean {
    if (this.origin === null) return false;
    const v = parseNumber(text);
    if (v === null) {
      this.env.say('Valor inválido. Digite o ângulo em graus.');
      return false;
    }
    const a = (v * Math.PI) / 180;
    return this.create({ x: Math.cos(a), y: Math.sin(a) });
  }

  /**
   * Plano da rampa para a direção dada. `clickLength` ausente (ângulo digitado) força o modo 'slope' com a inclinação da
   * barra (ou a padrão do tipo) e a nota "Sem clique de comprimento". No modo 'slope' clicado, a nota diz se a rampa
   * termina antes ou passa do clique.
   */
  private build(dir: Vec2, clickLength?: number): RampPlan | { error: string } {
    const p = this.env.project();
    const o = this.opts;
    const typeId = rampTypeId(p, o.typeId);
    const type = typeId ? p.rampTypes[typeId] : undefined;
    if (!typeId || !type) return { error: 'O projeto não tem tipo de rampa.' };
    const draft = draftRamp(p, o, this.env.levelId());
    if (!draft) return { error: 'O projeto não tem tipo de rampa.' };
    const H = rampRise(p, draft);
    if (!(H > 0)) {
      return {
        error: rampTopLevel(p, draft)
          ? 'O nível de topo não fica acima da base: nada a gerar.'
          : 'Sem nível de topo: escolha o nível de cima na barra de colocação (ou informe uma altura positiva).',
      };
    }
    const width = o.width ?? type.defaultWidth;
    const noClick = clickLength === undefined;
    const mode: RampInputMode = noClick ? 'slope' : o.mode;
    const slope = o.slope ?? type.defaultSlope;
    const plan = planRamp({
      start: this.origin!,
      dir,
      H,
      type,
      shape: o.shape,
      turn: o.turn,
      width,
      ...(o.landingDepth !== undefined ? { landingDepth: o.landingDepth } : {}),
      mode,
      ...(mode === 'length' ? { length: clickLength } : { slope }),
    });
    if ('error' in plan) return plan;
    let note: string | undefined;
    if (noClick) {
      note = `Sem clique de comprimento: usada a inclinação ${formatRampSlope(plan.slope)}.`;
    } else if (mode === 'slope') {
      const pct = formatRampPercent(plan.slope);
      if (clickLength > plan.pathLength + CLICK_EPS) {
        note = `A inclinação de ${pct} pede ${mText(plan.pathLength)} m: a rampa termina antes do clique de ${mText(clickLength)} m.`;
      } else if (clickLength < plan.pathLength - CLICK_EPS) {
        note = `A inclinação de ${pct} pede ${mText(plan.pathLength)} m: a rampa passa do clique de ${mText(clickLength)} m.`;
      }
    }
    return note ? { ...plan, note } : plan;
  }

  /** Cria a rampa com a direção dada (e o comprimento, no 2º clique), em um passo de desfazer. Mantém a ferramenta pronta. */
  private create(dir: Vec2, length?: number): boolean {
    const plan = this.build(dir, length);
    if ('error' in plan) {
      this.env.say(plan.error);
      return false;
    }
    const p = this.env.project();
    const o = this.opts;
    const typeId = rampTypeId(p, o.typeId);
    const type = typeId ? p.rampTypes[typeId] : undefined;
    if (!typeId || !type) {
      this.env.say('O projeto não tem tipo de rampa.');
      return false;
    }
    const inputMode: RampInputMode = length === undefined ? 'slope' : o.mode;
    const slopeTarget = inputMode === 'slope' ? (o.slope ?? type.defaultSlope) : null;
    const out: { r?: RampCommandResult } = {};
    this.env.transaction('Criar rampa', () => {
      out.r = createRampFromPlan(this.env, plan, {
        typeId,
        levelId: this.env.levelId(),
        shape: o.shape,
        turn: o.turn,
        inputMode,
        slopeTarget,
        topLevelId: o.topLevelId,
        baseOffset: o.baseOffset,
        topOffset: o.topOffset,
        height: o.height,
        mark: this.env.options().placementMark ?? '',
        comments: this.env.options().placementComments ?? '',
      });
    });
    const r = out.r;
    if (!r || 'error' in r) {
      this.env.say(`Não é possível criar a rampa: ${r?.error ?? 'falha ao gravar.'}`);
      return false;
    }
    const aviso = rampIssuesOf(this.env.project(), r.id).find((i) => i.severity === 'warning');
    const nota = plan.note ? ` ${plan.note}` : '';
    const avisoText = aviso ? ` Aviso: ${aviso.message}` : '';
    this.env.say(`Rampa criada: ${flightsText(plan.flights)}, inclinação ${formatRampSlope(plan.slope)}, ${mText(plan.pathLength)} m.${nota}${avisoText} Ctrl+Z desfaz.`);
    this.reset();
    return true;
  }
}
