import {
  newId,
  rampBaseZ,
  rampTopZ,
  type Project,
  type Ramp,
  type RampInputMode,
  type StairLanding,
  type StairRun,
} from '@hestia/model';
import { planRamp, rampBasis, type RampPlan } from './rampPlan.ts';
import { resolveRamps } from './ramps.ts';

export interface RampRegenPatch {
  width?: number;
  mode?: RampInputMode;
  slope?: number;
  length?: number;
  landingDepth?: number;
}

export interface RampRegenResult {
  components: Array<StairRun | StairLanding>;
  inputMode: RampInputMode;
  slopeTarget: number | null;
  landingDepth: number;
}

/** Componente de rascunho → componente persistido, reaproveitando o id antigo da mesma posição. */
function toComponent(sketch: RampPlan['parts'][number], id: string): StairRun | StairLanding {
  return sketch.kind === 'run' ? { id, kind: 'run', ...sketch.run } : { id, kind: 'landing', ...sketch.landing };
}

/**
 * Regenera os componentes de uma rampa a partir da base do 1º lance, do tipo e do desnível do projeto. Mantém forma e
 * giro. Quem grava faz `updateElements` em uma transação só.
 */
export function regenRamp(ramp: Ramp, p: Project, patch: RampRegenPatch): RampRegenResult | { error: string } {
  const basis = rampBasis(ramp);
  if (!basis) return { error: 'A rampa não tem um lance válido para regenerar.' };
  const type = p.rampTypes[ramp.typeId];
  if (!type) return { error: 'Tipo de rampa inexistente' };

  const mode = patch.mode ?? ramp.inputMode;
  const width = patch.width ?? basis.width;
  const landingDepth = patch.landingDepth ?? ramp.landingDepth;
  const H = rampTopZ(p, ramp) - rampBaseZ(p, ramp);
  const currentLength = resolveRamps(p).find((r) => r.id === ramp.id)?.pathLength;

  const common = {
    start: basis.start,
    dir: basis.dir,
    H,
    type,
    shape: ramp.shape,
    turn: ramp.turn,
    width,
    landingDepth,
    mode,
  } as const;

  const plan =
    mode === 'slope'
      ? planRamp({ ...common, slope: patch.slope ?? ramp.slopeTarget ?? type.defaultSlope })
      : planRamp({ ...common, length: patch.length ?? currentLength });
  if ('error' in plan) return { error: plan.error };

  const components = plan.parts.map((part, i) => toComponent(part, ramp.components[i]?.id ?? newId('rc')));
  return {
    components,
    inputMode: mode,
    slopeTarget: mode === 'slope' ? (patch.slope ?? ramp.slopeTarget ?? type.defaultSlope) : null,
    landingDepth: plan.landingDepth,
  };
}
