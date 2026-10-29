import { riserCountFor, treadFor } from '@hestia/engine';
import { DEFAULT_STAIR_CALC_RULE, STAIR_CALC_PRESETS, type StairCalcRule, type StairType } from '@hestia/model';

/** Campos do tipo que entram no cálculo do piso (os mesmos do motor, sem duplicar a fórmula). */
export type StairCalcInput = Pick<
  StairType,
  'maxRiser' | 'minTread' | 'maxTread' | 'calcRiserFactor' | 'calcTreadFactor' | 'calcTarget' | 'calcMin' | 'calcMax'
>;

/** Resultado do cálculo ao vivo da calculadora do tipo de escada. */
export interface StairCalcResult {
  valid: boolean;
  risers: number;
  riser: number;
  tread: number;
  sum: number;
  status: 'ok' | 'warn' | 'bad';
  /** Distância (m) até a faixa [calcMin, calcMax]; 0 quando dentro dela. */
  delta: number;
  run: number;
  angleDeg: number;
}

const TOL = 0.0005;
const WARN = 0.03;

const finite = (v: number): boolean => Number.isFinite(v);

const bad = (): StairCalcResult => ({ valid: false, risers: 0, riser: 0, tread: 0, sum: 0, status: 'bad', delta: 0, run: 0, angleDeg: 0 });

/**
 * Calcula o lance pela mesma regra do motor (`riserCountFor` + `treadFor`): N espelhos, R = H ÷ N, T limitado entre o
 * piso mínimo e o máximo e a soma a·R + b·T comparada com a faixa do tipo. Entradas inválidas devolvem `valid: false`
 * sem lançar exceção (o motor lança RangeError em `riserCountFor`).
 */
export function computeStairCalc(type: StairCalcInput, floorToFloor: number): StairCalcResult {
  const { maxRiser, minTread, maxTread, calcRiserFactor: a, calcTreadFactor: b, calcTarget: target, calcMin, calcMax } = type;
  if (
    !finite(floorToFloor) || floorToFloor <= 0 ||
    !finite(maxRiser) || maxRiser <= 0 ||
    !finite(minTread) || minTread < 0 ||
    !finite(maxTread) || maxTread < minTread ||
    !finite(a) || a <= 0 ||
    !finite(b) || b <= 0 ||
    !finite(target) || !finite(calcMin) || !finite(calcMax) || calcMin > calcMax
  ) {
    return bad();
  }
  let risers = 0;
  let riser = 0;
  let tread = 0;
  try {
    risers = riserCountFor(floorToFloor, maxRiser);
    riser = floorToFloor / risers;
    tread = treadFor(riser, { minTread, maxTread, a, b, target });
  } catch {
    return bad();
  }
  if (!finite(risers) || risers <= 0 || !finite(riser) || !finite(tread) || tread <= 0) return bad();
  const sum = a * riser + b * tread;
  const delta = sum < calcMin ? calcMin - sum : sum > calcMax ? sum - calcMax : 0;
  const status: StairCalcResult['status'] = sum >= calcMin - TOL && sum <= calcMax + TOL ? 'ok' : delta <= WARN + 1e-12 ? 'warn' : 'bad';
  return {
    valid: true,
    risers,
    riser,
    tread,
    sum,
    status,
    delta,
    run: (risers - 1) * tread,
    angleDeg: (Math.atan2(riser, tread) * 180) / Math.PI,
  };
}

export type StairPresetId = 'hestia' | 'nbr9050' | 'nbr9077' | 'ibc' | 'custom';

export interface StairDialogPreset {
  id: Exclude<StairPresetId, 'custom'>;
  maxRiser: number;
  minTread: number;
  minRunWidth: number;
  rule: StairCalcRule;
}

/** Regra de uma predefinição de norma do modelo; sem predefinição própria (Hestia), usa a regra padrão. */
function ruleOf(id: 'nbr9050' | 'nbr9077' | 'ibc'): StairCalcRule {
  const preset = STAIR_CALC_PRESETS.find((p) => p.id === id);
  return preset ? { ...preset.rule } : { ...DEFAULT_STAIR_CALC_RULE };
}

/**
 * Predefinições do diálogo: as dimensões vêm da especificação e a regra de cálculo vem de `STAIR_CALC_PRESETS` do modelo
 * (fonte única), para o modal nunca divergir do motor. São valores de referência; a norma vigente deve ser conferida.
 */
export const STAIR_DIALOG_PRESETS: readonly StairDialogPreset[] = [
  { id: 'hestia', maxRiser: 0.18, minTread: 0.28, minRunWidth: 0.8, rule: { ...DEFAULT_STAIR_CALC_RULE } },
  { id: 'nbr9050', maxRiser: 0.18, minTread: 0.28, minRunWidth: 1.2, rule: ruleOf('nbr9050') },
  { id: 'nbr9077', maxRiser: 0.18, minTread: 0.28, minRunWidth: 1.1, rule: ruleOf('nbr9077') },
  { id: 'ibc', maxRiser: 0.178, minTread: 0.279, minRunWidth: 1.118, rule: ruleOf('ibc') },
];

const near = (x: number | undefined, y: number): boolean => typeof x === 'number' && Math.abs(x - y) <= 1e-9;

/** Id da predefinição cujos campos (dimensões e regra) casam com o tipo; `custom` quando nenhuma casa. */
export function matchPreset(type: StairCalcInput & Pick<StairType, 'minRunWidth'>): StairPresetId {
  for (const p of STAIR_DIALOG_PRESETS) {
    if (
      near(type.maxRiser, p.maxRiser) &&
      near(type.minTread, p.minTread) &&
      near(type.minRunWidth, p.minRunWidth) &&
      near(type.maxTread, p.rule.maxTread) &&
      near(type.calcRiserFactor, p.rule.calcRiserFactor) &&
      near(type.calcTreadFactor, p.rule.calcTreadFactor) &&
      near(type.calcTarget, p.rule.calcTarget) &&
      near(type.calcMin, p.rule.calcMin) &&
      near(type.calcMax, p.rule.calcMax)
    ) {
      return p.id;
    }
  }
  return 'custom';
}

/**
 * Patch com TODOS os campos da predefinição (dimensões + regra), para aplicar em um único `set`. A predefinição não é
 * gravada no tipo: "Personalizado" aparece sozinho quando nenhum conjunto de campos casa.
 */
export function applyPreset(_type: StairCalcInput, id: StairPresetId): Partial<StairType> {
  const preset = STAIR_DIALOG_PRESETS.find((p) => p.id === id);
  if (!preset) return {};
  return {
    maxRiser: preset.maxRiser,
    minTread: preset.minTread,
    minRunWidth: preset.minRunWidth,
    maxTread: preset.rule.maxTread,
    calcRiserFactor: preset.rule.calcRiserFactor,
    calcTreadFactor: preset.rule.calcTreadFactor,
    calcTarget: preset.rule.calcTarget,
    calcMin: preset.rule.calcMin,
    calcMax: preset.rule.calcMax,
  };
}
