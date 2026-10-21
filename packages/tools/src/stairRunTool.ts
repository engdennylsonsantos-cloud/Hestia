import { len, sub, type Vec2 } from '@hestia/geom';
import { stairTopLevel, type Stair } from '@hestia/model';
import { stairIssueList } from '@hestia/engine';
import { draftStair, stairFromGenerator, stairLimits, type StairCommandResult, type StairCreateOptions } from './stairCommands.ts';
import { ToolBase } from './base.ts';
import { parseNumber } from './numeric.ts';
import { partsPreview, treadItems } from './stairPreview.ts';
import { componentsFromParts } from './stairSketchState.ts';
import { DEFAULT_STAIR_RUN_OPTIONS, planStairRun, type StairRunPlan, type StairRunToolOptions } from './stairRunPlan.ts';
import type { PointerInfo, PreviewItem } from './types.ts';

const START_HINT = 'Escada: clique no centro do 1º espelho. Esc cancela.';
const DIRECTION_HINT = 'Escada: clique para dar a direção de subida, ou digite o ângulo em graus (0 = eixo X). Esc cancela o ponto.';
/** Distância mínima (m) entre o 1º espelho e o cursor para definir a direção. */
const MIN_DIRECTION = 0.01;

/** Centímetros com vírgula, como nas outras mensagens (0,175 m → "17,5"). */
const cm = (m: number): string => (m * 100).toFixed(1).replace('.', ',');

interface Built {
  plan: StairRunPlan;
  ref: Stair;
}

/**
 * Escada reta, em L, em U ou com leque, criada pronta por cliques (decisão 0011 §5). O 1º clique é o centro do 1º espelho;
 * a prévia segue o cursor (degraus e patamar); o 2º clique fixa a direção de subida e cria a escada em UMA transação
 * ("Criar escada"). Entrada numérica: o ângulo de subida em graus, a partir do eixo X (o comprimento é fixado pelo nº de
 * espelhos e pelo piso). A altura vem do nível ativo e do nível acima (ou da altura da barra de escada, sem nível acima).
 * Depois de criar, a ferramenta continua pronta para outra escada; Esc sai como nas demais.
 */
export class StairRunTool extends ToolBase {
  readonly id = 'stairrun';
  readonly label = 'Escada (reta/L/U)';
  readonly hint = START_HINT;
  private origin: Vec2 | null = null;

  private get opts(): StairRunToolOptions {
    return this.env.options().stairRun ?? DEFAULT_STAIR_RUN_OPTIONS;
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
    this.items = this.drawItems(inf.point);
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
    this.create(dir);
  }

  /** Ângulo digitado (graus, a partir do eixo X): fixa a direção e cria a escada. */
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

  /** Prévia do que seria criado com a direção do cursor; o erro de cálculo aparece na barra de status. */
  private drawItems(cursor: Vec2): PreviewItem[] {
    if (this.origin === null) return [{ kind: 'point', at: cursor }];
    const dir = sub(cursor, this.origin);
    if (len(dir) < MIN_DIRECTION) return [{ kind: 'point', at: this.origin }];
    const b = this.build(dir);
    if ('error' in b) {
      this.env.say(b.error);
      return [{ kind: 'point', at: this.origin }];
    }
    this.env.say(DIRECTION_HINT);
    const { plan } = b;
    return [
      ...partsPreview(plan.parts),
      ...treadItems(plan.parts, plan.riserHeight),
      { kind: 'label', at: cursor, text: `${plan.risers} espelhos · ${cm(plan.riserHeight)} cm · piso ${cm(plan.tread)} cm` },
    ];
  }

  /** Opções da criação: tipo da barra e cotas da barra de escada (base, topo e altura sem nível acima). */
  private creation(): StairCreateOptions {
    const so = this.env.options().stair ?? {};
    return {
      typeId: this.opts.typeId,
      levelId: this.env.levelId(),
      topLevelId: so.topLevelId,
      baseOffset: so.baseOffset,
      topOffset: so.topOffset,
      height: so.height,
    };
  }

  /** Plano da escada para a direção dada, com H do nível ativo; erro com a mensagem de status em pt-BR. */
  private build(dir: Vec2): Built | { error: string } {
    const p = this.env.project();
    const ref = draftStair(p, this.creation(), this.env.levelId());
    const limits = ref ? stairLimits(p, ref) : null;
    const type = ref ? p.stairTypes[ref.typeId] : undefined;
    if (!ref || !limits || !type) return { error: 'O projeto não tem tipo de escada.' };
    if (!(limits.H > 0)) {
      return {
        error: stairTopLevel(p, ref)
          ? 'O nível de topo não fica acima da base: nada a gerar.'
          : 'Altura inválida: informe uma altura positiva na barra de escada.',
      };
    }
    const res = planStairRun({ start: this.origin!, dir, H: limits.H, maxRiser: limits.maxRiser, minTread: type.minTread, options: this.opts });
    return 'error' in res ? res : { plan: res, ref };
  }

  /** Cria a escada com a direção dada, em um passo de desfazer. Mantém a ferramenta pronta para a próxima. */
  private create(dir: Vec2): boolean {
    const b = this.build(dir);
    if ('error' in b) {
      this.env.say(b.error);
      return false;
    }
    const comps = componentsFromParts(b.plan.parts);
    const out: { r?: StairCommandResult } = {};
    this.env.transaction('Criar escada', () => {
      out.r = stairFromGenerator(this.env, comps, { ...this.creation(), generatedBy: this.opts.shape });
    });
    const r = out.r;
    if (!r || 'error' in r) {
      this.env.say(`Não é possível criar a escada: ${r?.error ?? 'falha ao gravar.'}`);
      return false;
    }
    const aviso = stairIssueList(this.env.project()).find((i) => i.stairId === r.id && i.severity === 'warning');
    const extra = aviso ? ` Aviso: ${aviso.message}` : '';
    this.env.say(`Escada criada: ${b.plan.risers} espelhos de ${cm(b.plan.riserHeight)} cm, piso ${cm(b.plan.tread)} cm.${extra} Ctrl+Z desfaz.`);
    this.reset();
    return true;
  }
}
